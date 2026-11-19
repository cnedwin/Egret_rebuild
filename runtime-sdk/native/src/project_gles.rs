// SPDX-License-Identifier: Apache-2.0
//! Composite into a linear-light sRGB attachment and resolve to the window's
//! premultiplied display bytes. The EGR1 benchmark retains its direct path.
use crate::{frame::{Batch, Header, PAGE_SLOTS}, gl::*, gles::{link_program, VERTEX}, project_color::decode_srgb};
use std::ptr;

const DRAW: &[u8] = b"#version 300 es\nprecision highp float;\n\
uniform highp sampler2D page; uniform float opacity; uniform vec4 region; in vec2 uv; in vec4 color; out vec4 pixel;\n\
vec3 linearRGB(vec3 c){return mix(c/12.92,pow((c+0.055)/1.055,vec3(2.4)),greaterThan(c,vec3(0.04045)));}\n\
void main(){ivec2 size=textureSize(page,0); ivec2 lo=ivec2(round(region.xy*vec2(size)));\n\
ivec2 hi=ivec2(round(region.zw*vec2(size)))-ivec2(1);\n\
ivec2 tap=clamp(ivec2(floor(uv*vec2(size))),lo,hi); vec4 p=texelFetch(page,tap,0); pixel=vec4(linearRGB(p.rgb)*linearRGB(color.rgb),p.a)*opacity;}\n\0";
const RESOLVE_VERTEX: &[u8] = b"#version 300 es\n\
void main(){ vec2 p=gl_VertexID==0 ? vec2(-1,-1) : (gl_VertexID==1 ? vec2(3,-1) : vec2(-1,3));\n\
gl_Position=vec4(p,0,1); }\n\0";
const RESOLVE: &[u8] = b"#version 300 es\nprecision highp float;\n\
uniform highp sampler2D working; uniform bool srgbWindow; out vec4 pixel;\n\
vec3 encoded(vec3 x){return mix(12.92*x,1.055*pow(x,vec3(1.0/2.4))-0.055,greaterThan(x,vec3(0.0031308)));}\n\
vec3 decoded(vec3 x){return mix(x/12.92,pow((x+0.055)/1.055,vec3(2.4)),greaterThan(x,vec3(0.04045)));}\n\
void main(){vec4 p=texelFetch(working,ivec2(gl_FragCoord.xy),0);\n\
vec3 c=p.a>0.0 ? p.a*encoded(clamp(p.rgb/p.a,0.0,1.0)) : vec3(0);\n\
pixel=vec4(srgbWindow ? decoded(c) : c,p.a);}\n\0";

pub(crate) struct ProjectPipeline {
    draw: u32,
    resolve: u32,
    size: i32,
    opacity: i32,
    region: i32,
    resolve_vao: u32,
    target: u32,
    target_texture: u32,
    physical: [u32; 2],
}

impl ProjectPipeline {
    pub(crate) unsafe fn create() -> Option<Self> {
        let draw = link_program(VERTEX, DRAW)?;
        let Some(resolve) = link_program(RESOLVE_VERTEX, RESOLVE) else {
            glDeleteProgram(draw);
            return None;
        };
        let mut p = Self {
            draw, resolve, size: glGetUniformLocation(draw, b"size\0".as_ptr().cast()),
            region: glGetUniformLocation(draw, b"region\0".as_ptr().cast()),
            opacity: glGetUniformLocation(draw, b"opacity\0".as_ptr().cast()),
            resolve_vao: 0, target: 0, target_texture: 0, physical: [0; 2],
        };
        glGenVertexArrays(1, &mut p.resolve_vao);
        glUseProgram(resolve);
        let srgb_window = glGetUniformLocation(resolve, b"srgbWindow\0".as_ptr().cast());
        let mut encoding = 0;
        glBindFramebuffer(FRAMEBUFFER, 0);
        glGetFramebufferAttachmentParameteriv(FRAMEBUFFER, BACK, FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING, &mut encoding);
        glUniform1i(srgb_window, i32::from(encoding == SRGB));
        // Both linked sampler uniforms default to texture unit zero.
        if p.size < 0 || p.opacity < 0 || p.region < 0 || srgb_window < 0 || p.resolve_vao == 0 || glGetError() != 0 {
            p.destroy();
            return None;
        }
        Some(p)
    }

    pub(crate) unsafe fn destroy(&self) {
        glDeleteFramebuffers(1, &self.target);
        glDeleteTextures(1, &self.target_texture);
        glDeleteVertexArrays(1, &self.resolve_vao);
        glDeleteProgram(self.draw);
        glDeleteProgram(self.resolve);
    }

    unsafe fn resize(&mut self, physical: [u32; 2]) -> bool {
        if self.physical == physical { return true; }
        let [w, h] = physical;
        if u64::from(w)*u64::from(h)*4 > 64*1024*1024 { return false; }
        let (mut target, mut tex) = (0, 0);
        glGenTextures(1, &mut tex);
        glBindTexture(TEXTURE_2D, tex);
        glTexParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
        glTexParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
        glTexImage2D(TEXTURE_2D, 0, SRGB8_ALPHA8, w as i32, h as i32, 0, RGBA, UNSIGNED_BYTE, ptr::null());
        glGenFramebuffers(1, &mut target);
        glBindFramebuffer(FRAMEBUFFER, target);
        glFramebufferTexture2D(FRAMEBUFFER, COLOR_ATTACHMENT0, TEXTURE_2D, tex, 0);
        let complete = glCheckFramebufferStatus(FRAMEBUFFER) == FRAMEBUFFER_COMPLETE;
        glBindFramebuffer(FRAMEBUFFER, 0);
        let error = glGetError();
        if tex == 0 || target == 0 || !complete || error != 0 {
            glDeleteFramebuffers(1, &target);
            glDeleteTextures(1, &tex);
            return false;
        }
        glDeleteFramebuffers(1, &self.target);
        glDeleteTextures(1, &self.target_texture);
        self.target = target;
        self.target_texture = tex;
        self.physical = physical;
        true
    }

    pub(crate) unsafe fn render(&mut self, header: &Header, physical: [u32; 2], vao: u32,
                                pages: &[u32; PAGE_SLOTS], batches: &[Batch]) -> bool {
        if !self.resize(physical) { return false; }
        glBindFramebuffer(FRAMEBUFFER, self.target);
        glDisable(SCISSOR_TEST);
        let [r, g, b, a] = header.clear;
        let alpha = f32::from(a)/255.;
        glClearColor(decode_srgb(r) as f32 * alpha, decode_srgb(g) as f32 * alpha, decode_srgb(b) as f32 * alpha, alpha);
        glClear(COLOR_BUFFER_BIT);
        glUseProgram(self.draw);
        glBindVertexArray(vao);
        glUniform2f(self.size, header.size[0], header.size[1]);
        glEnable(BLEND);
        glBlendFunc(ONE, ONE_MINUS_SRC_ALPHA);
        glEnable(SCISSOR_TEST);
        for batch in batches {
            let [x, y, w, h] = batch.scissor(header.size, physical);
            if w == 0 || h == 0 { continue; }
            glScissor(x, y, w, h);
            glUniform1f(self.opacity, batch.opacity);
            let [u0, v0, u1, v1] = batch.region;
            glUniform4f(self.region, u0, v0, u1, v1);
            glBindTexture(TEXTURE_2D, pages[batch.page]);
            glDrawArrays(TRIANGLES, batch.first, batch.count);
        }
        glDisable(SCISSOR_TEST);
        glDisable(BLEND);
        glBindFramebuffer(FRAMEBUFFER, 0);
        glUseProgram(self.resolve);
        glBindVertexArray(self.resolve_vao);
        glBindTexture(TEXTURE_2D, self.target_texture);
        glDrawArrays(TRIANGLES, 0, 3);
        glGetError() == 0
    }
}
