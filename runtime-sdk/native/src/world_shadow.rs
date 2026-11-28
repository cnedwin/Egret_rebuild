// SPDX-License-Identifier: Apache-2.0
//! A single directional depth tile; all names are owned by the current EGL generation.
use super::{Mesh, PendingMeshes};
use crate::{gl::*, gles::link_program, world_frame::WorldFrame};
use std::{collections::BTreeMap, ptr};

const VERTEX: &[u8] = b"#version 300 es
layout(location=0) in vec3 position;
layout(location=3) in vec4 joints;
layout(location=4) in vec4 weights;
uniform mat4 lightMatrix, model, bones[56];
uniform bool skinned;
void main() {
    mat4 transform = model;
    if (skinned) {
        ivec4 j = ivec4(joints);
        transform = (bones[j.x]*weights.x + bones[j.y]*weights.y +
                     bones[j.z]*weights.z + bones[j.w]*weights.w) * model;
    }
    gl_Position = lightMatrix * transform * vec4(position, 1.);
}\0";
const FRAGMENT: &[u8] = b"#version 300 es\nprecision highp float;\nvoid main() {}\0";

pub(super) struct ShadowMap {
    pub texture: u32,
    framebuffer: u32,
    size: u32,
    program: u32,
    matrix: i32,
    model: i32,
    bones: i32,
    skin: i32,
}

impl Default for ShadowMap {
    fn default() -> Self {
        Self { texture: 0, framebuffer: 0, size: 0, program: 0, matrix: -1, model: -1, bones: -1, skin: -1 }
    }
}

impl ShadowMap {
    pub unsafe fn trim(&mut self, size: u32) {
        if size == self.size { return; }
        glDeleteTextures(1, &self.texture);
        glDeleteFramebuffers(1, &self.framebuffer);
        self.texture = 0;
        self.framebuffer = 0;
        self.size = 0;
    }

    pub unsafe fn destroy(&self) {
        glDeleteTextures(1, &self.texture);
        glDeleteFramebuffers(1, &self.framebuffer);
        glDeleteProgram(self.program);
    }

    unsafe fn prepare(&mut self, size: u32) -> bool {
        if self.program == 0 {
            let Some(program) = link_program(VERTEX, FRAGMENT) else { return false; };
            let loc = |s: &[u8]| glGetUniformLocation(program, s.as_ptr().cast());
            self.matrix = loc(b"lightMatrix\0");
            self.model = loc(b"model\0");
            self.bones = loc(b"bones[0]\0");
            self.skin = loc(b"skinned\0");
            if [self.matrix,self.model,self.bones,self.skin].contains(&-1) {
                glDeleteProgram(program);
                return false;
            }
            self.program = program;
        }
        if self.size == size { return true; }
        self.trim(size);
        let (mut texture, mut framebuffer) = (0,0);
        glGenTextures(1, &mut texture);
        glBindTexture(TEXTURE_2D, texture);
        for (key, value) in [(TEXTURE_MIN_FILTER, LINEAR_FILTER), (TEXTURE_MAG_FILTER, LINEAR_FILTER),
            (TEXTURE_WRAP_S, CLAMP_TO_EDGE), (TEXTURE_WRAP_T, CLAMP_TO_EDGE),
            (TEXTURE_COMPARE_MODE, COMPARE_REF_TO_TEXTURE), (TEXTURE_COMPARE_FUNC, LEQUAL as i32)] {
            glTexParameteri(TEXTURE_2D, key, value);
        }
        glTexImage2D(TEXTURE_2D, 0, DEPTH_COMPONENT24 as i32, size as i32, size as i32,
            0, DEPTH_COMPONENT, UNSIGNED_INT, ptr::null());
        glGenFramebuffers(1, &mut framebuffer);
        glBindFramebuffer(FRAMEBUFFER, framebuffer);
        glFramebufferTexture2D(FRAMEBUFFER, DEPTH_ATTACHMENT, TEXTURE_2D, texture, 0);
        glDrawBuffers(1, &0);
        glReadBuffer(0);
        let complete = glCheckFramebufferStatus(FRAMEBUFFER) == FRAMEBUFFER_COMPLETE;
        glBindTexture(TEXTURE_2D, 0);
        if texture == 0 || framebuffer == 0 || !complete || glGetError() != 0 {
            glDeleteTextures(1, &texture);
            glDeleteFramebuffers(1, &framebuffer);
            return false;
        }
        self.size = size;
        self.texture = texture;
        self.framebuffer = framebuffer;
        true
    }

    pub unsafe fn render(&mut self, frame: &WorldFrame<'_>, meshes: &BTreeMap<u32, Mesh>, pending: &PendingMeshes) -> bool {
        let size = frame.lighting.shadow_size;
        if !self.prepare(size) { return false; }
        glBindFramebuffer(FRAMEBUFFER, self.framebuffer);
        glViewport(0, 0, size as i32, size as i32);
        glDisable(CULL_FACE);
        glDisable(BLEND);
        glEnable(DEPTH_TEST);
        glDepthFunc(LEQUAL);
        glClear(DEPTH_BUFFER_BIT);
        glEnable(POLYGON_OFFSET_FILL);
        glPolygonOffset(1.5, 4.);
        glUseProgram(self.program);
        glUniformMatrix4fv(self.matrix, 1, FALSE, frame.lighting.shadow_matrix.as_ptr());
        let mut last_pose = None;
        let mut complete = true;
        for d in frame.draws.iter().filter(|d| d.lighting_policy & 1 != 0) {
            let Some(mesh) = pending.0.get(&d.geometry).or_else(||meshes.get(&d.geometry)) else { complete=false; break; };
            glUniform1i(self.skin, i32::from(d.palette.is_some()));
            if let Some(index) = d.palette {
                if last_pose != Some(index) {
                    let pose = &frame.palettes[index];
                    glUniformMatrix4fv(self.bones, pose.len() as i32, FALSE, pose.as_ptr().cast());
                    last_pose = Some(index);
                }
            }
            glUniformMatrix4fv(self.model, 1, FALSE, d.world.as_ptr());
            glBindVertexArray(mesh.vao);
            glDrawElements(TRIANGLES, (mesh.indices.len()/4) as i32, UNSIGNED_INT, ptr::null());
        }
        glDisable(POLYGON_OFFSET_FILL);
        complete
    }
}
