// SPDX-License-Identifier: Apache-2.0
#import "GameHost.h"
#import "MetalFrame.h"
#import "egret_frame2d.h"
#import <JavaScriptCore/JavaScriptCore.h>
#import <CommonCrypto/CommonDigest.h>
#import <QuartzCore/QuartzCore.h>

static NSString *digest(NSData *data) {
    unsigned char value[CC_SHA256_DIGEST_LENGTH];
    CC_SHA256(data.bytes, (CC_LONG)data.length, value);
    NSMutableString *text = [NSMutableString string];
    for (NSUInteger i=0; i<sizeof(value); i++) [text appendFormat:@"%02x",value[i]];
    return text;
}
// Read the owning ArrayBuffer length first. Copy its temporary data pointer before entering JSC again.
static NSData *bufferData(JSValue *value, NSUInteger maximum) {
    JSContextRef ctx = value.context.JSGlobalContextRef;
    JSValueRef exception = NULL;
    if (!ctx || !value || JSValueGetTypedArrayType(ctx,value.JSValueRef,&exception) != kJSTypedArrayTypeArrayBuffer || exception)
        return nil;
    JSObjectRef object = JSValueToObject(ctx,value.JSValueRef,&exception);
    if (!object || exception) return nil;
    size_t length = JSObjectGetArrayBufferByteLength(ctx,object,&exception);
    if (exception || length == 0 || length > maximum) return nil;
    void *bytes = JSObjectGetArrayBufferBytesPtr(ctx,object,&exception);
    return !exception && bytes ? [NSData dataWithBytes:bytes length:length] : nil;
}

@interface GameHost () <MTKViewDelegate>
@end
@implementation GameHost {
    JSContext *_context;
    id<MTLDevice> _device;
    MetalFrame *_frame;
    MTKView *_surface;
    UILabel *_label;
    NSMutableDictionary *_receipt;
    NSMutableDictionary<NSNumber *,NSNumber *> *_timers;
    NSUInteger _timerGeneration, _tick;
    BOOL _ready, _suspended, _closed, _diagnose, _finished, _awaitingPresentation;
}
- (void)viewDidLoad {
    [super viewDidLoad];
    self.view.backgroundColor = UIColor.blackColor;
    _diagnose = [NSProcessInfo.processInfo.arguments containsObject:@"--egret-verify"];
    _receipt = [NSMutableDictionary new];
    _timers = [NSMutableDictionary new];
    _label = [[UILabel alloc] initWithFrame:self.view.bounds];
    _label.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    _label.textColor = UIColor.whiteColor;
    _label.textAlignment = NSTextAlignmentCenter;
    _label.numberOfLines = 0;
    _label.text = @"Opening the Egret scene…";
    [self.view addSubview:_label];
    _device = MTLCreateSystemDefaultDevice();
    if (_device) {
        _surface = [[MTKView alloc] initWithFrame:CGRectZero device:_device];
        _surface.colorPixelFormat = MTLPixelFormatBGRA8Unorm_sRGB;
        _surface.preferredFramesPerSecond = 60;
        _surface.paused = YES;
        _surface.delegate = self;
        [self.view insertSubview:_surface belowSubview:_label];
    }
    [self openScripts];
}
- (void)viewDidLayoutSubviews {
    [super viewDidLayoutSubviews];
    CGRect r = UIEdgeInsetsInsetRect(self.view.bounds,self.view.safeAreaInsets);
    CGFloat scale = MIN(r.size.width/320,r.size.height/192);
    _surface.frame = CGRectMake(CGRectGetMidX(r)-160*scale,CGRectGetMidY(r)-96*scale,320*scale,192*scale);
}
- (void)writeResult:(NSString *)status {
    if (!_diagnose || _finished) return;
    _finished = YES;
    _receipt[@"status"] = status;
    _receipt[@"system"] = UIDevice.currentDevice.systemVersion;
    _receipt[@"metalDevice"] = _device.name ?: NSNull.null;
    NSData *json = [NSJSONSerialization dataWithJSONObject:_receipt options:NSJSONWritingPrettyPrinted error:nil];
    NSURL *dir = [NSFileManager.defaultManager URLsForDirectory:NSDocumentDirectory inDomains:NSUserDomainMask].firstObject;
    [json writeToURL:[dir URLByAppendingPathComponent:@"egret-ios-receipt.json"] atomically:YES];
}
- (void)fail:(NSString *)reason {
    _surface.paused = YES;
    _receipt[@"failure"] = reason ?: @"Unknown error";
    _label.hidden = NO;
    _label.text = _receipt[@"failure"];
    NSLog(@"Egret: %@",_label.text);
    [self writeResult:@"failed"];
}
- (void)openScripts {
    _context = [JSContext new];
    __weak GameHost *owner = self;
    _context.exceptionHandler = ^(JSContext *ctx, JSValue *error) { [owner fail:error.toString]; };
    JSValue *bridge = [JSValue valueWithNewObjectInContext:_context];
    _context[@"EgretNativePlayer"] = bridge;
    _context[@"EgretApple"] = bridge;
    bridge[@"now"] = ^double { return CACurrentMediaTime()*1000; };
    bridge[@"failure"] = bridge[@"fail"] = ^(NSString *message) { [owner fail:message]; };
    bridge[@"ready"] = ^{ dispatch_async(dispatch_get_main_queue(), ^{ [owner scriptsReady]; }); };
    bridge[@"schedule"] = ^(int identifier, int delay) { [owner schedule:@(identifier) delay:delay]; };
    bridge[@"cancel"] = ^(int identifier) {
        GameHost *host = owner;
        if (host) [host->_timers removeObjectForKey:@(identifier)];
    };
    bridge[@"upload"] = ^BOOL(int slot, int width, int height, JSValue *data) {
        GameHost *host = owner;
        NSData *pixels = bufferData(data,16*1024*1024);
        if (!host || !pixels || !host->_frame) return NO;
        return [host->_frame upload:pixels slot:slot width:width height:height];
    };
    for (NSString *name in @[@"bootstrap",@"scene"]) {
        NSURL *url = [NSBundle.mainBundle URLForResource:name withExtension:@"js"];
        NSError *error = nil;
        NSString *source = url ? [NSString stringWithContentsOfURL:url encoding:NSUTF8StringEncoding error:&error] : nil;
        if (!source) { [self fail:error.localizedDescription ?: @"Missing JavaScript bundle"]; return; }
        [_context evaluateScript:source withSourceURL:url];
        if (_receipt[@"failure"]) return;
    }
}
- (void)schedule:(NSNumber *)identifier delay:(int)delay {
    NSNumber *generation = @(++_timerGeneration);
    _timers[identifier] = generation;
    __weak GameHost *owner = self;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW,(int64_t)MAX(0,delay)*NSEC_PER_MSEC),dispatch_get_main_queue(),^{
        GameHost *host = owner;
        if (!host || ![host->_timers[identifier] isEqual:generation]) return;
        [host->_timers removeObjectForKey:identifier];
        [host->_context[@"EgretRuntimeTasks"] invokeMethod:@"fire" withArguments:@[identifier]];
    });
}
- (NSData *)packet:(NSUInteger)index {
    JSValue *frame = [_context[@"EgretIosScene"] invokeMethod:@"frame" withArguments:@[@(index)]];
    return bufferData(frame,24+4096*(64+24));
}
- (BOOL)restoreRenderer {
    NSError *error = nil;
    _frame = [[MetalFrame alloc] initWithDevice:_device error:&error];
    if (!_frame || ![[_context[@"EgretIosScene"] invokeMethod:@"publish" withArguments:@[]] toBool]) {
        [self fail:error.localizedDescription ?: @"Could not restore the scene atlas"];
        return NO;
    }
    return YES;
}
- (void)scriptsReady {
    if (_closed) return;
    _ready = YES;
    NSData *initial = [self packet:0], *animated = [self packet:7];
    if (!initial || !animated) { [self fail:@"JavaScriptCore did not return two frame packets"]; return; }
    _receipt[@"frame0"] = digest(initial);
    _receipt[@"frame7"] = digest(animated);
    if (!_device) {
        _label.text = @"Metal device unavailable";
        if (_diagnose) [self finishDiagnostic:@"metal-unavailable"];
        return;
    }
    if (_suspended) return;
    if (![self restoreRenderer]) return;
    _label.hidden = YES;
    if (_diagnose) [self verify:initial animated:animated];
    else _surface.paused = NO;
}
- (void)verify:(NSData *)packet animated:(NSData *)animated {
    MTLTextureDescriptor *desc = [MTLTextureDescriptor texture2DDescriptorWithPixelFormat:MTLPixelFormatBGRA8Unorm_sRGB
        width:320 height:192 mipmapped:NO];
    desc.usage = MTLTextureUsageRenderTarget;
    desc.storageMode = MTLStorageModePrivate;
    id<MTLTexture> target = [_device newTextureWithDescriptor:desc];
    NSError *error = nil;
    if (!target || ![_frame draw:packet target:target drawable:nil error:&error]) {
        [self fail:error.localizedDescription ?: @"Missing offscreen render target"]; return;
    }
    NSData *first = [_frame readback:target];
    if (!first || ![_frame draw:animated target:target drawable:nil error:&error]) { [self fail:@"Animation draw failed"]; return; }
    NSData *next = [_frame readback:target];
    if (!next || [first isEqual:next]) { [self fail:@"Animation did not change the frame"]; return; }
    const uint8_t *bgra = first.bytes;
    const unsigned samples[][5] = {{0,0,0x47,0x47,0x63},{10,10,0x63,0x63,0x89},{20,17,0x89,0x89,0xbc},{20,44,0x63,0xbc,0xbc}};
    for (size_t i=0; i<sizeof(samples)/sizeof(samples[0]); i++) {
        const unsigned *s = samples[i];
        const uint8_t *actual = bgra+4*(s[1]*320+s[0]);
        if (abs((int)actual[2]-(int)s[2])>1 || abs((int)actual[1]-(int)s[3])>1 ||
            abs((int)actual[0]-(int)s[4])>1 || actual[3]!=255) { [self fail:@"Reference pixel differs"]; return; }
    }
    [_frame releasePages];
    if ([_frame draw:packet target:target drawable:nil error:&error] || ![error.domain isEqual:@"EgretFrame"] || error.code != 2) {
        [self fail:@"Released page was not refused"]; return;
    }
    _frame = nil;
    if (![self restoreRenderer]) return;
    if (![_frame draw:packet target:target drawable:nil error:&error] || ![first isEqual:[_frame readback:target]]) {
        [self fail:@"Restoring the renderer changed the pixels"]; return;
    }
    _receipt[@"pixels0"] = digest(first);
    _receipt[@"pixels7"] = digest(next);
    _receipt[@"sampleCount"] = @4;
    _receipt[@"missingPageCode"] = @2;
    _receipt[@"restoredPixelsMatch"] = @YES;
    // Observe a real layer presentation separately from the deterministic offscreen comparison.
    _awaitingPresentation = YES;
    _surface.paused = NO;
}
- (void)finishDiagnostic:(NSString *)status {
    _surface.paused = YES;
    [_frame releasePages];
    _frame = nil;
    __weak GameHost *owner = self;
    _context[@"EgretApple"][@"closed"] = ^(int releases) {
        GameHost *host = owner;
        if (!host) return;
        host->_receipt[@"releasedAtlases"] = @(releases);
        if (releases != 1) [host fail:@"Unexpected scene release count"];
        else [host writeResult:status];
    };
    [_context evaluateScript:@"EgretIosScene.close().then(x=>EgretApple.closed(x.releases),e=>EgretApple.fail(String(e)))"];
}
- (void)mtkView:(MTKView *)view drawableSizeWillChange:(CGSize)size {}
- (void)drawInMTKView:(MTKView *)view {
    if (_closed || _suspended || !_ready) return;
    id<CAMetalDrawable> drawable = view.currentDrawable;
    if (!drawable) return;
    [_context[@"EgretIosScene"] invokeMethod:@"poll" withArguments:@[]];
    NSData *packet = [self packet:_tick++%60];
    NSError *error = nil;
    if (!packet || ![_frame draw:packet target:drawable.texture drawable:drawable error:&error]) {
        [self fail:error.localizedDescription ?: @"Invalid JavaScriptCore frame"];
        return;
    }
    if (_awaitingPresentation) {
        _awaitingPresentation = NO;
        // The simulator SDK does not expose the device presentation callback. The verifier reads
        // the actual Simulator screenshot and maps scene pixels into this window viewport.
        UIWindow *window = _surface.window;
        CGRect viewport = [_surface convertRect:_surface.bounds toView:window];
        CGSize screen = window.bounds.size;
        if (screen.width <= 0 || screen.height <= 0) { [self fail:@"Invalid presentation viewport"]; return; }
        _receipt[@"screenViewport"] = @[@(viewport.origin.x/screen.width),@(viewport.origin.y/screen.height),
                                        @(viewport.size.width/screen.width),@(viewport.size.height/screen.height)];
        _receipt[@"drawableSubmitted"] = @YES;
        [self finishDiagnostic:@"passed"];
    }
}
- (void)suspendGame {
    _suspended = YES;
    _surface.paused = YES;
    [_frame releasePages];
    _frame = nil;
}
- (void)resumeGame {
    if (!_suspended || _closed) return;
    _suspended = NO;
    if (_ready && _device && !_finished && [self restoreRenderer]) {
        if (_diagnose) [self verify:[self packet:0] animated:[self packet:7]];
        else { _label.hidden = YES; _surface.paused = NO; }
    }
}
- (void)closeGame {
    if (_closed) return;
    _closed = YES;
    _surface.paused = YES;
    [_frame releasePages];
    _frame = nil;
    JSContext *context = _context;
    if (!context) return;
    // A disconnected scene can still be opening. Keep the host, JSC and its timers alive until
    // the engine has actually returned the resource lease or reported the close failure.
    context[@"EgretApple"][@"retired"] = ^(NSString *message) {
        if (message.length) [self fail:message];
        [self->_timers removeAllObjects];
        self->_context[@"EgretApple"][@"retired"] = nil;
        self->_context = nil;
    };
    [context evaluateScript:@"Promise.resolve().then(()=>EgretIosScene.close()).then(()=>EgretApple.retired(''),e=>EgretApple.retired(String(e)))"];
    __weak GameHost *owner = self;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW,10*NSEC_PER_SEC),dispatch_get_main_queue(),^{
        GameHost *host = owner;
        if (!host || !host->_context) return;
        [host fail:@"Scene retirement timed out"];
        [host->_timers removeAllObjects];
        host->_context[@"EgretApple"][@"retired"] = nil;
        host->_context = nil;
    });
}
@end
