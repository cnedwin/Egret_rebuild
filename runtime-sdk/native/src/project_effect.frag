// SPDX-License-Identifier: Apache-2.0
precision highp float;
precision highp int;

uniform highp sampler2D content;
uniform highp sampler2D spreadImage;
uniform int operation; // 0: filter horizontally, 1: vertically, 2: alpha spread, 3: composite.
uniform int radius;
uniform ivec2 shift;
uniform bool outline;
uniform bool hasMatrix;
uniform mat4 colorMatrix;
uniform vec4 bias;
uniform bool hasGlow;
uniform vec4 glowColor;
uniform float strength;
uniform bool inner;
uniform bool knockout;
layout(location=0) out vec4 pixel;

vec4 readOrZero(highp sampler2D image, ivec2 at, ivec2 size) {
    if (any(lessThan(at, ivec2(0))) || any(greaterThanEqual(at, size))) return vec4(0);
    return texelFetch(image, at, 0);
}

vec3 encode(vec3 c) {
    return mix(12.92*c, 1.055*pow(c, vec3(1.0/2.4))-0.055, greaterThan(c, vec3(0.0031308)));
}
vec3 decode(vec3 c) {
    return mix(c/12.92, pow((c+0.055)/1.055, vec3(2.4)), greaterThan(c, vec3(0.04045)));
}

float spreadAxis(highp sampler2D image, ivec2 at, ivec2 size, ivec2 axis) {
    float sum = 0.0;
    for (int i=-radius; i<=radius; ++i) {
        float a = readOrZero(image, at+axis*i, size).a;
        sum = outline ? max(sum,a) : sum+a;
    }
    return outline ? sum : sum/float(radius*2+1);
}

void main() {
    ivec2 at = ivec2(gl_FragCoord.xy), size = textureSize(content,0);
    if (operation < 2) {
        ivec2 axis = operation==0 ? ivec2(1,0) : ivec2(0,1);
        vec4 sum = vec4(0);
        for (int i=-radius; i<=radius; ++i) sum += readOrZero(content, at+axis*i, size);
        pixel = sum/float(radius*2+1);
        return;
    }
    if (operation == 2) {
        pixel = vec4(0,0,0,spreadAxis(content,at-shift,size,ivec2(1,0)));
        return;
    }
    vec4 c = texelFetch(content,at,0);
    if (hasMatrix) {
        // Color transforms act on straight display codes; our target blends linear premultiplied light.
        vec4 straight = vec4(c.a>0.0 ? encode(clamp(c.rgb/c.a,0.0,1.0)) : vec3(0), c.a);
        vec4 result = clamp(colorMatrix*straight+bias,0.0,1.0);
        c = vec4(decode(result.rgb)*result.a,result.a);
    }
    if (hasGlow) {
        float halo = spreadAxis(spreadImage,at,size,ivec2(0,1));
        if (inner) {
            float k = clamp((1.0-halo)*strength,0.0,1.0)*glowColor.a;
            c = knockout ? vec4(glowColor.rgb,1)*k*c.a : vec4(mix(c.rgb,glowColor.rgb*c.a,k),c.a);
        } else {
            float k = (outline ? halo : clamp(halo*strength,0.0,1.0))*glowColor.a;
            vec4 edge = vec4(glowColor.rgb,1)*k*(1.0-c.a);
            c = knockout ? edge : c+edge;
        }
    }
    pixel = c;
}
