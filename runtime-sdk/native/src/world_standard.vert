// SPDX-License-Identifier: Apache-2.0
// Object positions and normals remain in mesh space until GLES executes the draw.
layout(location=0) in vec3 position;
layout(location=1) in vec3 normal;
uniform mat4 viewProjection;
uniform mat4 model;
out highp vec3 worldPosition;
out highp vec3 worldNormal;

void main() {
    vec4 p = model * vec4(position, 1.0);
    worldPosition = p.xyz;
    // Match World3D's zero normal matrix for collapsed transforms.
    mat3 basis = mat3(model);
    worldNormal = determinant(basis) == 0.0 ? vec3(0.0) : transpose(inverse(basis)) * normal;
    gl_Position = viewProjection * p;
}
