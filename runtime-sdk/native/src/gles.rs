// SPDX-License-Identifier: Apache-2.0
//! The host owns a dedicated EGL context on its GL thread. Native names belong
//! to exactly one renderer/context generation. No GL deletion crosses generations.
use crate::frame::{self, Batch, Vertex, MAX_DIMENSION, MAX_FRAME_BYTES, PAGE_SLOTS};
use crate::gl::*;
use crate::{project_color::canonical_page, project_gles::ProjectPipeline};
use std::{ffi::c_void, mem::{offset_of, size_of}, ptr, slice};

const INVALID: i32 = 1;
const MISSING_PAGE: i32 = 2;
const GPU_FAILURE: i32 = 3;
const MAX_PAGE_BYTES: usize = 64 * 1024 * 1024;
const MAX_RESIDENT_BYTES: usize = 256 * 1024 * 1024;
pub(crate) const VERTEX: &[u8] = b"#version 300 es\n\
layout(location=0) in vec2 position; layout(location=1) in vec2 texcoord;\n\
layout(location=2) in vec4 tint; uniform vec2 size; out vec2 uv; out vec4 color;\n\
void main(){ uv=texcoord; color=tint; vec2 p=position/size;\n\
gl_Position=vec4(p.x*2.0-1.0,1.0-p.y*2.0,0.0,1.0); }\n\0";
const FRAGMENT: &[u8] = b"#version 300 es\nprecision highp float;\n\
uniform sampler2D page; in vec2 uv; in vec4 color; out vec4 pixel;\n\
void main(){pixel=texture(page,uv)*color;}\n\0";

pub struct EgretRenderer {
    program: u32,
    buffer: u32,
    vao: u32,
    logical_size: i32,
    texture_limit: u32,
    buffer_bytes: usize,
    textures: [u32; PAGE_SLOTS],
    opaque_pages: [bool; PAGE_SLOTS],
    project: Option<ProjectPipeline>,
    page_bytes: [usize; PAGE_SLOTS],
    resident_bytes: usize,
    vertices: Vec<Vertex>,
    batches: Vec<Batch>,
}

unsafe fn shader(kind: u32, text: &[u8]) -> Option<u32> {
    let name = glCreateShader(kind);
    if name == 0 { return None; }
    glShaderSource(name, 1, &text.as_ptr().cast(), ptr::null());
    glCompileShader(name);
    let mut compiled = 0;
    glGetShaderiv(name, COMPILE_STATUS, &mut compiled);
    if compiled == 0 {
        glDeleteShader(name);
        return None;
    }
    Some(name)
}

pub(crate) unsafe fn link_program(vertex_source: &[u8], fragment_source: &[u8]) -> Option<u32> {
    let vertex = shader(VERTEX_SHADER, vertex_source)?;
    let Some(fragment) = shader(FRAGMENT_SHADER, fragment_source) else {
        glDeleteShader(vertex);
        return None;
    };
    let program = glCreateProgram();
    if program != 0 {
        glAttachShader(program, vertex);
        glAttachShader(program, fragment);
        glLinkProgram(program);
    }
    glDeleteShader(vertex);
    glDeleteShader(fragment);
    if program == 0 { return None; }
    let mut linked = 0;
    glGetProgramiv(program, LINK_STATUS, &mut linked);
    if linked == 0 {
        glDeleteProgram(program);
        return None;
    }
    Some(program)
}

unsafe fn texture(width: u32, height: u32, rgba: &[u8]) -> Option<u32> {
    let mut name = 0;
    glGenTextures(1, &mut name);
    if name == 0 { return None; }
    glBindTexture(TEXTURE_2D, name);
    glTexParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    glTexParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
    glTexParameteri(TEXTURE_2D, TEXTURE_WRAP_S, CLAMP_TO_EDGE);
    glTexParameteri(TEXTURE_2D, TEXTURE_WRAP_T, CLAMP_TO_EDGE);
    glTexImage2D(TEXTURE_2D, 0, RGBA8, width as i32, height as i32, 0, RGBA,
                 UNSIGNED_BYTE, rgba.as_ptr().cast());
    if glGetError() != 0 {
        glDeleteTextures(1, &name);
        return None;
    }
    Some(name)
}

impl EgretRenderer {
    unsafe fn create() -> Option<Self> {
        let program = link_program(VERTEX, FRAGMENT)?;
        let mut renderer = Self {
            program, buffer: 0, vao: 0, logical_size: -1, texture_limit: 0, buffer_bytes: 0,
            opaque_pages: [true; PAGE_SLOTS], project: None,
            textures: [0; PAGE_SLOTS], page_bytes: [0; PAGE_SLOTS], resident_bytes: 0,
            vertices: Vec::new(), batches: Vec::new(),
        };
        glUseProgram(program);
        renderer.logical_size = glGetUniformLocation(program, b"size\0".as_ptr().cast());
        let page = glGetUniformLocation(program, b"page\0".as_ptr().cast());
        glUniform1i(page, 0);
        let mut limit = 0;
        glGetIntegerv(MAX_TEXTURE_SIZE, &mut limit);
        renderer.texture_limit = limit.max(0) as u32;
        glGenBuffers(1, &mut renderer.buffer);
        glGenVertexArrays(1, &mut renderer.vao);
        glBindVertexArray(renderer.vao);
        glBindBuffer(ARRAY_BUFFER, renderer.buffer);
        let stride = size_of::<Vertex>() as i32;
        for (index, count, ty, norm, offset) in [
            (0, 2, FLOAT, FALSE, offset_of!(Vertex, position)),
            (1, 2, FLOAT, FALSE, offset_of!(Vertex, uv)),
            (2, 4, UNSIGNED_BYTE, TRUE, offset_of!(Vertex, color)),
        ] {
            glEnableVertexAttribArray(index);
            glVertexAttribPointer(index, count, ty, norm, stride, offset as *const c_void);
        }
        glActiveTexture(TEXTURE0);
        glDisable(DITHER);
        renderer.textures[0] = texture(1, 1, &[255; 4]).unwrap_or(0);
        if renderer.logical_size < 0 || page < 0 || limit <= 0 || renderer.vao == 0
            || renderer.buffer == 0 || renderer.textures[0] == 0 || glGetError() != 0
        {
            renderer.delete_gl();
            return None;
        }
        Some(renderer)
    }

    unsafe fn delete_gl(&self) {
        if let Some(project) = &self.project { project.destroy(); }
        glDeleteTextures(PAGE_SLOTS as i32, self.textures.as_ptr());
        glDeleteBuffers(1, &self.buffer);
        glDeleteVertexArrays(1, &self.vao);
        glUseProgram(0);
        glDeleteProgram(self.program);
    }

    unsafe fn draw(&mut self, bytes: &[u8], width: u32, height: u32) -> i32 {
        let header = match frame::prepare(bytes, &self.textures, &mut self.vertices, &mut self.batches) {
            Ok(header) => header,
            Err(error) => return error as i32,
        };
        if !header.project && self.batches.iter().any(|b| !self.opaque_pages[b.page]) { return INVALID; }
        glBindBuffer(ARRAY_BUFFER, self.buffer);
        let size = self.vertices.len() * size_of::<Vertex>();
        if size > self.buffer_bytes {
            let capacity = size.next_power_of_two();
            glBufferData(ARRAY_BUFFER, capacity as isize, ptr::null(), DYNAMIC_DRAW);
            if glGetError() != 0 { return GPU_FAILURE; }
            self.buffer_bytes = capacity;
        }
        glViewport(0, 0, width as i32, height as i32);
        if header.project {
            if self.project.is_none() { self.project = ProjectPipeline::create(); }
            let Some(pipeline) = &mut self.project else { return GPU_FAILURE; };
            if size != 0 { glBufferSubData(ARRAY_BUFFER, 0, size as isize, self.vertices.as_ptr().cast()); }
            return if pipeline.render(&header, [width, height], self.vao, &self.textures, &self.batches) {
                0
            } else { GPU_FAILURE };
        }
        let [r, g, b, a] = header.clear.map(|v| v as f32 / 255.0);
        glClearColor(r, g, b, a);
        glClear(COLOR_BUFFER_BIT);
        if size == 0 { return 0; }
        glUseProgram(self.program);
        glBindVertexArray(self.vao);
        glUniform2f(self.logical_size, header.size[0], header.size[1]);
        glBufferSubData(ARRAY_BUFFER, 0, size as isize, self.vertices.as_ptr().cast());
        for batch in &self.batches {
            glBindTexture(TEXTURE_2D, self.textures[batch.page]);
            glDrawArrays(TRIANGLES, batch.first, batch.count);
        }
        // This acknowledges command recording, not GPU completion or presentation.
        0
    }
}

#[no_mangle]
pub unsafe extern "C" fn egret_renderer_create() -> *mut EgretRenderer {
    EgretRenderer::create().map_or(ptr::null_mut(), |r| Box::into_raw(Box::new(r)))
}

#[no_mangle]
pub unsafe extern "C" fn egret_renderer_destroy(ptr: *mut EgretRenderer) {
    if !ptr.is_null() {
        let renderer = Box::from_raw(ptr);
        renderer.delete_gl();
    }
}

#[no_mangle]
pub unsafe extern "C" fn egret_renderer_abandon(ptr: *mut EgretRenderer) {
    if !ptr.is_null() {
        drop(Box::from_raw(ptr));
    }
}

#[no_mangle]
pub unsafe extern "C" fn egret_renderer_upload(
    ptr: *mut EgretRenderer, page: u32, width: u32, height: u32, rgba: *const u8, length: usize,
) -> i32 {
    let Some(renderer) = ptr.as_mut() else { return INVALID; };
    let index = page as usize;
    let limit = renderer.texture_limit.min(MAX_DIMENSION);
    if index == 0 || index >= PAGE_SLOTS || !(1..=limit).contains(&width)
        || !(1..=limit).contains(&height) || rgba.is_null() || length > MAX_PAGE_BYTES
        || u64::from(width) * u64::from(height) * 4 != length as u64
    {
        return INVALID;
    }
    let rgba = slice::from_raw_parts(rgba, length);
    // Peak resident bytes include both the old and replacement textures during allocation.
    if renderer.resident_bytes + length > MAX_RESIDENT_BYTES { return INVALID; }
    let canonical = canonical_page(rgba);
    // Replace atomically. On a failed allocation the prior page remains drawable.
    let Some(name) = texture(width, height, canonical.as_deref().unwrap_or(rgba)) else { return GPU_FAILURE; };
    renderer.opaque_pages[index] = canonical.is_none();
    let old = renderer.textures[index];
    renderer.textures[index] = name;
    glDeleteTextures(1, &old);
    renderer.resident_bytes += length;
    renderer.resident_bytes -= renderer.page_bytes[index];
    renderer.page_bytes[index] = length;
    0
}

#[no_mangle]
pub unsafe extern "C" fn egret_renderer_release(ptr: *mut EgretRenderer, page: u32) -> i32 {
    let Some(renderer) = ptr.as_mut() else { return INVALID; };
    let index = page as usize;
    if index == 0 || index >= PAGE_SLOTS { return INVALID; }
    let name = renderer.textures[index];
    if name == 0 { return MISSING_PAGE; }
    glDeleteTextures(1, &name);
    renderer.textures[index] = 0;
    renderer.resident_bytes -= renderer.page_bytes[index];
    renderer.page_bytes[index] = 0;
    0
}

#[no_mangle]
pub unsafe extern "C" fn egret_renderer_draw(
    ptr: *mut EgretRenderer, bytes: *const u8, length: usize, width: u32, height: u32,
) -> i32 {
    let Some(renderer) = ptr.as_mut() else { return INVALID; };
    if bytes.is_null() || !(frame::HEADER_BYTES..=MAX_FRAME_BYTES).contains(&length)
        || !(1..=MAX_DIMENSION).contains(&width) || !(1..=MAX_DIMENSION).contains(&height)
    {
        return INVALID;
    }
    renderer.draw(slice::from_raw_parts(bytes, length), width, height)
}
