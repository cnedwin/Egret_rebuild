// SPDX-License-Identifier: Apache-2.0
#ifndef EGRET_RUNTIME_NATIVE_H
#define EGRET_RUNTIME_NATIVE_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct EgretRenderer EgretRenderer;

/* Calls are serialized on the owning GL thread with its GLES 3 context current.
 * abandon is the sole exception: after context loss it frees CPU state only.
 * destroy and abandon both consume the pointer. Every other call borrows it.
 * Byte buffers remain caller-owned and must stay readable throughout the call.
 * Returns: 0 success, 1 invalid input/profile, 2 missing page, 3 GPU failure, 4 missing World3D predecessor.
 */
EgretRenderer *egret_renderer_create(void);
void egret_renderer_destroy(EgretRenderer *renderer);
void egret_renderer_abandon(EgretRenderer *renderer);
/* Upload a top-down, tightly packed, straight sRGB RGBA8 image to slot 1..255.
 * Opaque bytes remain exact. EGR2 through EGR4 accept translucent pages and composite
 * normal source-over in linear premultiplied space. Slot zero is reserved. */
int32_t egret_renderer_upload(EgretRenderer *renderer, uint32_t page,
                              uint32_t width, uint32_t height,
                              const uint8_t *rgba, size_t length);
/* Prepare the repeat/trilinear glTF base-color view for this exact published page
 * generation. Supply the same source bytes as upload. Release/replacement retires both views. */
int32_t egret_renderer_prepare_world_page(EgretRenderer *renderer, uint32_t page,
                                          const uint8_t *rgba, size_t length);
int32_t egret_renderer_release(EgretRenderer *renderer, uint32_t page);
/* Current committed mesh vertex + index payload, in bytes (zero without a World3D scene).
 * This describes each logical CPU/GPU copy; it does not estimate driver allocation overhead. */
size_t egret_renderer_world_geometry_bytes(const EgretRenderer *renderer);
int32_t egret_renderer_draw(EgretRenderer *renderer, const uint8_t *frame,
                            size_t length, uint32_t physical_width,
                            uint32_t physical_height);

#ifdef __cplusplus
}
#endif
#endif
