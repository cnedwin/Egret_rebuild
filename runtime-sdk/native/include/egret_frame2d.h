// SPDX-License-Identifier: Apache-2.0
#ifndef EGRET_FRAME2D_H
#define EGRET_FRAME2D_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Backend-neutral decode boundary. A single render thread owns the decoder.
 * Decode output borrows the decoder's storage until its next decode or destroy.
 * Decode accepts opaque-output EGR2 normal/nearest quads and never calls a GPU. */
typedef struct EgretFrame2D EgretFrame2D;
typedef struct { float position[2], uv[2]; uint8_t color[4]; } EgretVertex2D;
typedef struct {
    uint32_t page, first, count;
    float opacity, region[4];
    uint32_t scissor[4]; /* Physical left, top, width, height. */
} EgretDraw2D;
typedef struct {
    float logical_size[2];
    uint8_t clear_rgba[4];
    const EgretVertex2D *vertices;
    const EgretDraw2D *draws;
    size_t vertex_count, draw_count;
} EgretDecoded2D;

EgretFrame2D *egret_frame2d_create(void);
void egret_frame2d_destroy(EgretFrame2D *decoder);
/* Slots 1..255 reflect textures admitted by the owning GPU host. A 0x0 size releases a slot. */
int32_t egret_frame2d_page(EgretFrame2D *decoder, uint32_t slot, uint32_t width, uint32_t height);
/* Returns 0 on success, 1 for invalid/unsupported input, 2 for a missing page.
 * On failure out contains no borrowed pointers. Supply a valid readable packet and writable out. */
int32_t egret_frame2d_decode(EgretFrame2D *decoder, const uint8_t *packet, size_t length,
                             uint32_t width, uint32_t height, EgretDecoded2D *out);

#ifdef __cplusplus
}
#endif
#endif
