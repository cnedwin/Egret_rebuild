// SPDX-License-Identifier: Apache-2.0
precision highp float;
precision highp int;

uniform highp sampler2D page;
uniform float opacity;
uniform vec4 region;
in vec2 uv;
in vec4 color;
out vec4 pixel;

#ifdef EGRET_MAPPED_ATLAS
uniform ivec4 logicalTrim;
uniform int quarterTurn;
#endif

vec3 linearRGB(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), greaterThan(c, vec3(0.04045)));
}

void main() {
    ivec2 size = textureSize(page, 0);
    ivec2 lo = ivec2(round(region.xy * vec2(size)));
    ivec2 end = ivec2(round(region.zw * vec2(size)));
    ivec2 tap;
#ifdef EGRET_MAPPED_ATLAS
    if (quarterTurn >= 0) {
        // Pick the logical texel first. Reversing UVs before floor would pick the
        // adjacent texel on a reflected axis at an exact integer boundary.
        ivec2 logical = clamp(ivec2(floor(uv * vec2(logicalTrim.xy))), ivec2(0), logicalTrim.xy - 1);
        ivec2 local = logical - logicalTrim.zw;
        ivec2 packedSize = end - lo;
        ivec2 content = (quarterTurn & 1) == 0 ? packedSize : packedSize.yx;
        if (any(lessThan(local, ivec2(0))) || any(greaterThanEqual(local, content))) {
            pixel = vec4(0.0);
            return;
        }
        switch (quarterTurn) {
            case 1: tap = ivec2(content.y - 1 - local.y, local.x); break;
            case 2: tap = content - 1 - local; break;
            case 3: tap = ivec2(local.y, content.x - 1 - local.x); break;
            default: tap = local; break;
        }
        tap += lo;
    } else
#endif
    {
        tap = clamp(ivec2(floor(uv * vec2(size))), lo, end - 1);
    }
    vec4 sampleColor = texelFetch(page, tap, 0);
    pixel = vec4(linearRGB(sampleColor.rgb) * linearRGB(color.rgb), sampleColor.a) * opacity;
}
