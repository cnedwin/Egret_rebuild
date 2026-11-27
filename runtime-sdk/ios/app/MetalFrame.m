// SPDX-License-Identifier: Apache-2.0
#import "MetalFrame.h"
#import "egret_frame2d.h"
#import <simd/simd.h>
#import <math.h>

static NSError *failure(NSString *reason) {
    return [NSError errorWithDomain:@"EgretMetal" code:1 userInfo:@{NSLocalizedDescriptionKey:reason}];
}
static double linear(uint8_t code) {
    double c = code / 255.0;
    return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4);
}
@implementation MetalFrame {
    EgretFrame2D *_decoder;
    id<MTLDevice> _device;
    id<MTLCommandQueue> _queue;
    id<MTLRenderPipelineState> _pipeline;
    NSMutableDictionary<NSNumber *,id<MTLTexture>> *_pages;
    NSUInteger _residentBytes;
}
- (instancetype)initWithDevice:(id<MTLDevice>)device error:(NSError **)error {
    if (!(self = [super init])) return nil;
    _device = device;
    _queue = [device newCommandQueue];
    NSURL *shaderURL = [NSBundle.mainBundle URLForResource:@"Quad" withExtension:@"metal.txt"];
    NSString *source = shaderURL ? [NSString stringWithContentsOfURL:shaderURL encoding:NSUTF8StringEncoding error:error] : nil;
    if (!source) { if (error) *error = failure(@"Missing bundled Metal shader"); return nil; }
    id<MTLLibrary> shaders = [device newLibraryWithSource:source options:nil error:error];
    if (!shaders) return nil;
    MTLRenderPipelineDescriptor *desc = [MTLRenderPipelineDescriptor new];
    desc.vertexFunction = [shaders newFunctionWithName:@"quadVertex"];
    desc.fragmentFunction = [shaders newFunctionWithName:@"quadFragment"];
    MTLRenderPipelineColorAttachmentDescriptor *color = desc.colorAttachments[0];
    color.pixelFormat = MTLPixelFormatBGRA8Unorm_sRGB;
    color.blendingEnabled = YES;
    color.sourceRGBBlendFactor = color.sourceAlphaBlendFactor = MTLBlendFactorOne;
    color.destinationRGBBlendFactor = color.destinationAlphaBlendFactor = MTLBlendFactorOneMinusSourceAlpha;
    if (!_queue || !desc.vertexFunction || !desc.fragmentFunction) {
        if (error) *error = failure(@"Metal command queue or bundled shader missing");
        return nil;
    }
    _pipeline = [device newRenderPipelineStateWithDescriptor:desc error:error];
    if (!_pipeline) return nil;
    _decoder = egret_frame2d_create();
    _pages = [NSMutableDictionary new];
    const uint8_t white[4] = {255,255,255,255};
    id<MTLTexture> solid = [self texture:[NSData dataWithBytes:white length:4] width:1 height:1];
    if (!solid) { if (error) *error = failure(@"Cannot allocate the solid page"); return nil; }
    _pages[@0] = solid;
    return self;
}
- (id<MTLTexture>)texture:(NSData *)data width:(NSUInteger)w height:(NSUInteger)h {
    MTLTextureDescriptor *desc = [MTLTextureDescriptor texture2DDescriptorWithPixelFormat:MTLPixelFormatRGBA8Unorm_sRGB
        width:w height:h mipmapped:NO];
    desc.usage = MTLTextureUsageShaderRead;
    desc.storageMode = MTLStorageModeShared;
    id<MTLTexture> texture = [_device newTextureWithDescriptor:desc];
    [texture replaceRegion:MTLRegionMake2D(0,0,w,h) mipmapLevel:0 withBytes:data.bytes bytesPerRow:w*4];
    return texture;
}
- (BOOL)upload:(NSData *)rgba slot:(NSUInteger)slot width:(NSUInteger)width height:(NSUInteger)height {
    // Charge both generations during replacement. The previous texture can still be retained by GPU work.
    if (slot == 0 || slot > 255 || width == 0 || width > 16384 || height == 0 || height > 16384
        || width*height*4 != rgba.length || rgba.length > 16*1024*1024 || _residentBytes + rgba.length > 64*1024*1024)
        return NO;
    id<MTLTexture> replacement = [self texture:rgba width:width height:height];
    if (!replacement || egret_frame2d_page(_decoder, (uint32_t)slot, (uint32_t)width, (uint32_t)height)) return NO;
    id<MTLTexture> previous = _pages[@(slot)];
    _residentBytes += rgba.length;
    _residentBytes -= previous.width * previous.height * 4;
    _pages[@(slot)] = replacement;
    return YES;
}
- (void)releasePages {
    for (NSNumber *slot in _pages.allKeys) {
        if (slot.unsignedIntValue == 0) continue;
        egret_frame2d_page(_decoder, slot.unsignedIntValue, 0, 0);
        [_pages removeObjectForKey:slot];
    }
    _residentBytes = 0;
}
- (void)dealloc { egret_frame2d_destroy(_decoder); }
- (BOOL)draw:(NSData *)packet target:(id<MTLTexture>)target drawable:(id<CAMetalDrawable>)drawable error:(NSError **)error {
    EgretDecoded2D scene = {0};
    int status = egret_frame2d_decode(_decoder, packet.bytes, packet.length, (uint32_t)target.width,
                                      (uint32_t)target.height, &scene);
    if (status) {
        if (error) *error = [NSError errorWithDomain:@"EgretFrame" code:status userInfo:nil];
        return NO;
    }
    id<MTLBuffer> vertices = scene.vertex_count ? [_device newBufferWithBytes:scene.vertices
        length:scene.vertex_count*sizeof(EgretVertex2D) options:MTLResourceStorageModeShared] : nil;
    MTLRenderPassDescriptor *pass = [MTLRenderPassDescriptor renderPassDescriptor];
    MTLRenderPassColorAttachmentDescriptor *color = pass.colorAttachments[0];
    color.texture = target;
    color.loadAction = MTLLoadActionClear;
    color.storeAction = MTLStoreActionStore;
    color.clearColor = MTLClearColorMake(linear(scene.clear_rgba[0]),linear(scene.clear_rgba[1]),linear(scene.clear_rgba[2]),1);
    id<MTLCommandBuffer> command = [_queue commandBuffer];
    id<MTLRenderCommandEncoder> encoder = [command renderCommandEncoderWithDescriptor:pass];
    if (!encoder || (scene.vertex_count && !vertices)) {
        if (error) *error = failure(@"Metal frame allocation failed");
        [encoder endEncoding];
        return NO;
    }
    [encoder setRenderPipelineState:_pipeline];
    [encoder setVertexBuffer:vertices offset:0 atIndex:0];
    [encoder setVertexBytes:scene.logical_size length:sizeof(scene.logical_size) atIndex:1];
    for (size_t i=0; i<scene.draw_count; ++i) {
        const EgretDraw2D *draw = &scene.draws[i];
        if (!draw->scissor[2] || !draw->scissor[3]) continue;
        [encoder setScissorRect:(MTLScissorRect){draw->scissor[0],draw->scissor[1],draw->scissor[2],draw->scissor[3]}];
        struct { vector_float4 region; float opacity; } params = {
            {draw->region[0], draw->region[1], draw->region[2], draw->region[3]}, draw->opacity};
        [encoder setFragmentTexture:_pages[@(draw->page)] atIndex:0];
        [encoder setFragmentBytes:&params length:sizeof(params) atIndex:0];
        [encoder drawPrimitives:MTLPrimitiveTypeTriangle vertexStart:draw->first vertexCount:draw->count];
    }
    [encoder endEncoding];
    if (drawable) [command presentDrawable:drawable];
    [command commit];
    if (!drawable) {
        // Diagnostic offscreen frames alone wait for completion before pixel inspection.
        [command waitUntilCompleted];
        if (command.status != MTLCommandBufferStatusCompleted) {
            if (error) *error = command.error ?: failure(@"Offscreen GPU frame failed");
            return NO;
        }
    }
    return YES;
}
- (NSData *)readback:(id<MTLTexture>)target {
    NSUInteger row = ((target.width * 4 + 255) / 256) * 256;
    id<MTLBuffer> copy = [_device newBufferWithLength:row*target.height options:MTLResourceStorageModeShared];
    id<MTLCommandBuffer> command = [_queue commandBuffer];
    id<MTLBlitCommandEncoder> blit = [command blitCommandEncoder];
    if (!copy || !blit) return nil;
    [blit copyFromTexture:target sourceSlice:0 sourceLevel:0 sourceOrigin:MTLOriginMake(0,0,0)
        sourceSize:MTLSizeMake(target.width,target.height,1) toBuffer:copy destinationOffset:0
        destinationBytesPerRow:row destinationBytesPerImage:row*target.height];
    [blit endEncoding];
    [command commit];
    [command waitUntilCompleted];
    if (command.status != MTLCommandBufferStatusCompleted) return nil;
    NSMutableData *pixels = [NSMutableData dataWithLength:target.width*target.height*4];
    for (NSUInteger y=0; y<target.height; y++)
        memcpy((uint8_t *)pixels.mutableBytes+y*target.width*4,(uint8_t *)copy.contents+y*row,target.width*4);
    return pixels;
}
@end
