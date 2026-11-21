// SPDX-License-Identifier: Apache-2.0
precision highp float;
precision highp int;

uniform highp sampler2D page;
uniform float opacity;
uniform bool linearFilter;
uniform vec4 region;
in vec2 uv;
in vec4 color;
in vec4 linearLight;
out vec4 pixel;

#ifdef EGRET_MAPPED_ATLAS
uniform ivec4 logicalTrim;
uniform int quarterTurn;
#endif

vec3 linearRGB(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), greaterThan(c, vec3(0.04045)));
}

vec4 readTap(ivec2 texel, ivec2 lo, ivec2 end) {
    ivec2 tap;
#ifdef EGRET_MAPPED_ATLAS
    if (quarterTurn >= 0) {
        ivec2 local = clamp(texel, ivec2(0), logicalTrim.xy - 1) - logicalTrim.zw;
        ivec2 packedSize = end - lo;
        ivec2 content = (quarterTurn & 1) == 0 ? packedSize : packedSize.yx;
        if (any(lessThan(local, ivec2(0))) || any(greaterThanEqual(local, content))) return vec4(0.0);
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
        tap = clamp(texel, lo, end - 1);
    }
    vec4 sampleColor = texelFetch(page, tap, 0);
    return vec4(linearRGB(sampleColor.rgb), sampleColor.a);
}

void main() {
    ivec2 size = textureSize(page, 0);
    ivec2 lo = ivec2(round(region.xy * vec2(size)));
    ivec2 end = ivec2(round(region.zw * vec2(size)));
    vec2 q = uv * vec2(size);
#ifdef EGRET_MAPPED_ATLAS
    if (quarterTurn >= 0) q = uv * vec2(logicalTrim.xy);
#endif
    vec4 value;
    if (linearFilter) {
        // The source page stores encoded linear-PMA. Decode each tap before mixing.
        vec2 shifted = q - 0.5;
        ivec2 base = ivec2(floor(shifted));
        vec2 weight = fract(shifted);
        value = mix(mix(readTap(base, lo, end), readTap(base + ivec2(1,0), lo, end), weight.x),
                    mix(readTap(base + ivec2(0,1), lo, end), readTap(base + ivec2(1,1), lo, end), weight.x), weight.y);
    } else {
        value = readTap(ivec2(floor(q)), lo, end);
    }
    pixel = vec4(value.rgb * linearRGB(color.rgb) * linearLight.rgb, value.a) * (opacity * linearLight.a);
}
