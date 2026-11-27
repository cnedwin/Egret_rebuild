// SPDX-License-Identifier: Apache-2.0
//! Context-owned render targets for isolated project subtrees. Each active group owns its
//! color target until exit; a filter can then borrow the following (now inactive) slot.
use crate::{
    frame::{self, ProjectEffect},
    gl::*,
    gles::link_program,
    project_color::decode_srgb,
};
use std::ptr;

const SHADER: &[u8] = concat!(
    "#version 300 es\n",
    include_str!("project_effect.frag"),
    "\0"
)
.as_bytes();

#[derive(Clone, Copy)]
pub(super) struct Target {
    pub framebuffer: u32,
    pub texture: u32,
}

impl Target {
    unsafe fn create([w, h]: [u32; 2]) -> Option<Self> {
        let mut t = Self {
            framebuffer: 0,
            texture: 0,
        };
        glGenTextures(1, &mut t.texture);
        glBindTexture(TEXTURE_2D, t.texture);
        glTexParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
        glTexParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
        glTexImage2D(
            TEXTURE_2D,
            0,
            SRGB8_ALPHA8,
            w as i32,
            h as i32,
            0,
            RGBA,
            UNSIGNED_BYTE,
            ptr::null(),
        );
        glGenFramebuffers(1, &mut t.framebuffer);
        glBindFramebuffer(FRAMEBUFFER, t.framebuffer);
        glFramebufferTexture2D(FRAMEBUFFER, COLOR_ATTACHMENT0, TEXTURE_2D, t.texture, 0);
        let complete = glCheckFramebufferStatus(FRAMEBUFFER) == FRAMEBUFFER_COMPLETE;
        let error = glGetError();
        glBindFramebuffer(FRAMEBUFFER, 0);
        glBindTexture(TEXTURE_2D, 0);
        if error != 0 || !complete || t.framebuffer == 0 || t.texture == 0 {
            t.destroy();
            return None;
        }
        Some(t)
    }

    unsafe fn destroy(&self) {
        glDeleteFramebuffers(1, &self.framebuffer);
        glDeleteTextures(1, &self.texture);
    }
}

struct Program {
    name: u32,
    operation: i32,
    radius: i32,
    shift: i32,
    outline: i32,
    has_matrix: i32,
    matrix: i32,
    bias: i32,
    has_glow: i32,
    glow_color: i32,
    strength: i32,
    inner: i32,
    knockout: i32,
}

impl Program {
    unsafe fn create() -> Option<Self> {
        let name = link_program(super::RESOLVE_VERTEX, SHADER)?;
        let uniform = |label: &[u8]| glGetUniformLocation(name, label.as_ptr().cast());
        let p = Self {
            name,
            operation: uniform(b"operation\0"),
            radius: uniform(b"radius\0"),
            shift: uniform(b"shift\0"),
            outline: uniform(b"outline\0"),
            has_matrix: uniform(b"hasMatrix\0"),
            matrix: uniform(b"colorMatrix\0"),
            bias: uniform(b"bias\0"),
            has_glow: uniform(b"hasGlow\0"),
            glow_color: uniform(b"glowColor\0"),
            strength: uniform(b"strength\0"),
            inner: uniform(b"inner\0"),
            knockout: uniform(b"knockout\0"),
        };
        let content = uniform(b"content\0");
        let spread = uniform(b"spreadImage\0");
        if [
            p.operation,
            p.radius,
            p.shift,
            p.outline,
            p.has_matrix,
            p.matrix,
            p.bias,
            p.has_glow,
            p.glow_color,
            p.strength,
            p.inner,
            p.knockout,
            content,
            spread,
        ]
        .contains(&-1)
        {
            glDeleteProgram(name);
            return None;
        }
        glUseProgram(name);
        glUniform1i(content, 0);
        glUniform1i(spread, 1);
        if glGetError() != 0 {
            glDeleteProgram(name);
            return None;
        }
        Some(p)
    }

    unsafe fn pass(&self, op: i32, radius: i32, target: u32, source: u32, spread: u32) {
        glBindFramebuffer(FRAMEBUFFER, target);
        // Never leave a destination image bound to an active sampler, even for a branch
        // of the shader which does not sample that unit.
        glActiveTexture(TEXTURE0 + 1);
        glBindTexture(TEXTURE_2D, spread);
        glActiveTexture(TEXTURE0);
        glBindTexture(TEXTURE_2D, source);
        glUniform1i(self.operation, op);
        glUniform1i(self.radius, radius);
        glDrawArrays(TRIANGLES, 0, 3);
    }
}

#[derive(Default)]
pub(super) struct Effects {
    program: Option<Program>,
    targets: Vec<Target>,
}

impl Effects {
    pub unsafe fn destroy(&self) {
        for t in &self.targets {
            t.destroy();
        }
        if let Some(p) = &self.program {
            glDeleteProgram(p.name);
        }
    }

    pub unsafe fn trim(&mut self, count: usize) {
        while self.targets.len() > count {
            if let Some(t) = self.targets.pop() {
                t.destroy();
            }
        }
    }

    pub unsafe fn prepare(&mut self, size: [u32; 2], required: usize) -> bool {
        if required == 0 {
            return true;
        }
        if self.program.is_none() {
            self.program = Program::create();
        }
        if self.program.is_none() {
            return false;
        }
        while self.targets.len() < required {
            let Some(t) = Target::create(size) else {
                return false;
            };
            self.targets.push(t);
        }
        true
    }

    pub unsafe fn enter(&self, depth: usize) {
        glBindFramebuffer(FRAMEBUFFER, self.targets[depth].framebuffer);
        glDisable(SCISSOR_TEST);
        glClearColor(0., 0., 0., 0.);
        glClear(COLOR_BUFFER_BIT);
        glEnable(SCISSOR_TEST);
    }

    pub unsafe fn composite(
        &self,
        group: &ProjectEffect,
        depth: usize,
        base: u32,
        physical: [u32; 2],
        logical: [f32; 2],
        fullscreen_vao: u32,
    ) {
        let parent = if depth == 0 {
            base
        } else {
            self.targets[depth - 1].framebuffer
        };
        let source = self.targets[depth].texture;
        let clip = frame::scissor(group.clip, logical, physical);
        if clip[2] == 0 || clip[3] == 0 {
            glBindFramebuffer(FRAMEBUFFER, parent);
            return;
        }
        let p = self
            .program
            .as_ref()
            .expect("effects prepared before drawing");
        glUseProgram(p.name);
        glBindVertexArray(fullscreen_vao);
        glDisable(SCISSOR_TEST);
        glDisable(BLEND);
        let scale = [
            physical[0] as f32 / logical[0],
            physical[1] as f32 / logical[1],
        ];
        let radius = |v: f32, axis: usize| (v * scale[axis]).ceil().min(16.) as i32;
        if group.blur > 0. {
            let scratch = self.targets[depth + 1];
            p.pass(
                0,
                radius(group.blur, 0),
                scratch.framebuffer,
                source,
                source,
            );
            p.pass(
                1,
                radius(group.blur, 1),
                self.targets[depth].framebuffer,
                scratch.texture,
                scratch.texture,
            );
        }
        let mut alpha_texture = source;
        let mut vertical_radius = 0;
        glUniform1i(p.has_glow, i32::from(group.glow.is_some()));
        if let Some(glow) = &group.glow {
            let spread = |axis: usize| {
                if glow.outline {
                    (glow.spread * scale[axis] + 0.5_f32).floor().clamp(1., 16.) as i32
                } else {
                    radius(glow.spread, axis)
                }
            };
            let scratch = self.targets[depth + 1];
            glUniform1i(p.outline, i32::from(glow.outline));
            let shift = |axis: usize| (glow.offset[axis] * scale[axis] + 0.5).floor() as i32;
            glUniform2i(p.shift, shift(0), -shift(1));
            p.pass(2, spread(0), scratch.framebuffer, source, source);
            alpha_texture = scratch.texture;
            vertical_radius = spread(1);
            let channel = |at: u32| decode_srgb((glow.color >> at) as u8) as f32;
            glUniform4f(
                p.glow_color,
                channel(16),
                channel(8),
                channel(0),
                glow.alpha,
            );
            glUniform1f(p.strength, glow.strength);
            glUniform1i(p.knockout, i32::from(glow.knockout));
            glUniform1i(p.inner, i32::from(glow.inner));
        }
        glUniform1i(p.has_matrix, i32::from(group.matrix.is_some()));
        if let Some(m) = &group.matrix {
            let column_major: [f32; 16] = std::array::from_fn(|i| m[(i % 4) * 5 + i / 4]);
            glUniformMatrix4fv(p.matrix, 1, FALSE, column_major.as_ptr());
            glUniform4f(p.bias, m[4] / 255., m[9] / 255., m[14] / 255., m[19] / 255.);
        }
        glEnable(SCISSOR_TEST);
        glScissor(clip[0], clip[1], clip[2], clip[3]);
        glEnable(BLEND);
        glBlendFunc(ONE, ONE_MINUS_SRC_ALPHA);
        p.pass(3, vertical_radius, parent, source, alpha_texture);
        glActiveTexture(TEXTURE0 + 1);
        glBindTexture(TEXTURE_2D, 0);
        glActiveTexture(TEXTURE0);
        glBindTexture(TEXTURE_2D, 0);
    }
}
