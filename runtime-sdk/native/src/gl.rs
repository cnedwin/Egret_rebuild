// SPDX-License-Identifier: Apache-2.0
//! Narrow Android NDK GLES 3 bindings used by the native executor.
#![allow(non_snake_case)]
use std::ffi::{c_char, c_void};

pub const FALSE: u8 = 0;
pub const TRUE: u8 = 1;
pub const VERTEX_SHADER: u32 = 0x8b31;
pub const FRAGMENT_SHADER: u32 = 0x8b30;
pub const COMPILE_STATUS: u32 = 0x8b81;
pub const LINK_STATUS: u32 = 0x8b82;
pub const ARRAY_BUFFER: u32 = 0x8892;
pub const DYNAMIC_DRAW: u32 = 0x88e8;
pub const FLOAT: u32 = 0x1406;
pub const UNSIGNED_BYTE: u32 = 0x1401;
pub const TEXTURE_2D: u32 = 0x0de1;
pub const TEXTURE0: u32 = 0x84c0;
pub const MAX_TEXTURE_SIZE: u32 = 0x0d33;
pub const TEXTURE_MIN_FILTER: u32 = 0x2801;
pub const TEXTURE_MAG_FILTER: u32 = 0x2800;
pub const TEXTURE_WRAP_S: u32 = 0x2802;
pub const TEXTURE_WRAP_T: u32 = 0x2803;
pub const NEAREST: i32 = 0x2600;
pub const CLAMP_TO_EDGE: i32 = 0x812f;
pub const RGBA: u32 = 0x1908;
pub const RGBA8: i32 = 0x8058;
pub const COLOR_BUFFER_BIT: u32 = 0x4000;
pub const TRIANGLES: u32 = 0x0004;
pub const DITHER: u32 = 0x0bd0;

#[link(name = "GLESv3")]
extern "C" {
    pub fn glGetError() -> u32;
    pub fn glGetIntegerv(pname: u32, data: *mut i32);
    pub fn glCreateShader(kind: u32) -> u32;
    pub fn glShaderSource(shader: u32, count: i32, sources: *const *const c_char, lengths: *const i32);
    pub fn glCompileShader(shader: u32);
    pub fn glGetShaderiv(shader: u32, pname: u32, params: *mut i32);
    pub fn glDeleteShader(shader: u32);
    pub fn glCreateProgram() -> u32;
    pub fn glAttachShader(program: u32, shader: u32);
    pub fn glLinkProgram(program: u32);
    pub fn glGetProgramiv(program: u32, pname: u32, params: *mut i32);
    pub fn glDeleteProgram(program: u32);
    pub fn glUseProgram(program: u32);
    pub fn glGetUniformLocation(program: u32, name: *const c_char) -> i32;
    pub fn glUniform1i(location: i32, value: i32);
    pub fn glUniform2f(location: i32, x: f32, y: f32);
    pub fn glGenBuffers(count: i32, buffers: *mut u32);
    pub fn glBindBuffer(target: u32, buffer: u32);
    pub fn glBufferData(target: u32, size: isize, data: *const c_void, usage: u32);
    pub fn glBufferSubData(target: u32, offset: isize, size: isize, data: *const c_void);
    pub fn glDeleteBuffers(count: i32, buffers: *const u32);
    pub fn glGenVertexArrays(count: i32, arrays: *mut u32);
    pub fn glBindVertexArray(array: u32);
    pub fn glDeleteVertexArrays(count: i32, arrays: *const u32);
    pub fn glEnableVertexAttribArray(index: u32);
    pub fn glVertexAttribPointer(index: u32, size: i32, ty: u32, normalized: u8,
                                 stride: i32, offset: *const c_void);
    pub fn glGenTextures(count: i32, textures: *mut u32);
    pub fn glBindTexture(target: u32, texture: u32);
    pub fn glActiveTexture(unit: u32);
    pub fn glTexParameteri(target: u32, pname: u32, param: i32);
    pub fn glTexImage2D(target: u32, level: i32, format: i32, width: i32, height: i32,
                        border: i32, source_format: u32, ty: u32, data: *const c_void);
    pub fn glDeleteTextures(count: i32, textures: *const u32);
    pub fn glDisable(capability: u32);
    pub fn glViewport(x: i32, y: i32, width: i32, height: i32);
    pub fn glClearColor(r: f32, g: f32, b: f32, a: f32);
    pub fn glClear(mask: u32);
    pub fn glDrawArrays(mode: u32, first: i32, count: i32);
}
