// SPDX-License-Identifier: Apache-2.0
#import <MetalKit/MetalKit.h>

/// A thread-confined Metal consumer for the shared Rust decoder's opaque-target EGR2 profile.
@interface MetalFrame : NSObject
- (instancetype)initWithDevice:(id<MTLDevice>)device error:(NSError **)error;
- (BOOL)upload:(NSData *)rgba slot:(NSUInteger)slot width:(NSUInteger)width height:(NSUInteger)height;
- (BOOL)draw:(NSData *)packet target:(id<MTLTexture>)target drawable:(id<CAMetalDrawable>)drawable error:(NSError **)error;
- (NSData *)readback:(id<MTLTexture>)target;
- (void)releasePages;
@end
