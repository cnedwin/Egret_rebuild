// SPDX-License-Identifier: Apache-2.0
#include <metal_stdlib>
using namespace metal;

// packed_float2 and uchar4 keep the shared Rust Vertex record exactly 20 bytes.
struct QuadVertex { packed_float2 position; packed_float2 uv; uchar4 color; };
struct VertexOut { float4 position [[position]]; float2 uv; float4 color; };
struct DrawParams { float4 region; float opacity; };
float3 linearRGB(float3 code) {
    return select(code / 12.92, pow((code + 0.055) / 1.055, float3(2.4)), code > 0.04045);
}
vertex VertexOut quadVertex(uint index [[vertex_id]], const device QuadVertex *vertices [[buffer(0)]],
                            constant float2 &size [[buffer(1)]]) {
    QuadVertex v = vertices[index];
    float2 position = float2(v.position) / size;
    return {float4(2.0 * position.x - 1.0, 1.0 - 2.0 * position.y, 0.0, 1.0),
            float2(v.uv), float4(v.color) / 255.0};
}
fragment float4 quadFragment(VertexOut in [[stage_in]], texture2d<float,access::read> page [[texture(0)]],
                             constant DrawParams &draw [[buffer(0)]]) {
    float2 size = float2(page.get_width(), page.get_height());
    int2 first = int2(round(draw.region.xy * size));
    int2 last = int2(round(draw.region.zw * size)) - 1;
    uint2 texel = uint2(clamp(int2(floor(in.uv * size)), first, last));
    float4 sample = page.read(texel);
    float a = draw.opacity * in.color.a * sample.a;
    return float4(sample.rgb * linearRGB(in.color.rgb) * a, a);
}
