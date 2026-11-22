// SPDX-License-Identifier: Apache-2.0
// Object positions and normals remain in mesh space until GLES executes the draw.
layout(location=0) in vec3 position;
layout(location=1) in vec3 normal;
layout(location=2) in vec2 texcoord;
#ifdef EGRET_SKIN_FRAME
layout(location=3) in vec4 joints;
layout(location=4) in vec4 weights;
layout(location=5) in vec4 vertexColor;
uniform mat4 bones[56];
uniform bool skinned, useVertexColor;
out highp vec3 tint;
#endif
out highp vec2 uv;
uniform mat4 viewProjection;
uniform mat4 model;
out highp vec3 worldPosition;
out highp vec3 worldNormal;

void main() {
    mat4 transform = model;
#ifdef EGRET_SKIN_FRAME
    if (skinned) {
        ivec4 j = ivec4(joints);
        mat4 skin = weights.x * bones[j.x] + weights.y * bones[j.y]
                  + weights.z * bones[j.z] + weights.w * bones[j.w];
        transform = skin * model; // Skinned draws carry the asset's bind matrix.
    }
    tint = useVertexColor ? vertexColor.rgb : vec3(1.0);
#endif
    vec4 p = transform * vec4(position, 1.0);
    worldPosition = p.xyz;
    uv = texcoord;
    // Match World3D's zero normal matrix for collapsed transforms.
    mat3 basis = mat3(transform);
#ifdef EGRET_SKIN_FRAME
    if (skinned) worldNormal = basis * normal;
    else
#endif
        worldNormal = determinant(basis) == 0.0 ? vec3(0.0) : transpose(inverse(basis)) * normal;
    gl_Position = viewProjection * p;
}
