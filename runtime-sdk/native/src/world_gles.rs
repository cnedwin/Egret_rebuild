// SPDX-License-Identifier: Apache-2.0
//! Opaque indexed World3D meshes in the project player's context. Resource
//! names belong to this EGL generation, and geometry is shared by its draws.
use crate::gl::*;
use crate::gles::link_program;
use crate::world_frame::{Geometry, WorldFrame};
use std::{collections::BTreeMap, ptr};

const VERTEX: &[u8] = concat!("#version 300 es\n", include_str!("world_standard.vert"), "\0").as_bytes();
const FRAGMENT: &[u8] = concat!("#version 300 es\n", include_str!("world_standard.frag"), "\0").as_bytes();

struct Mesh {
    vao: u32,
    vertex_buffer: u32,
    index_buffer: u32,
    stride: usize,
    vertices: Vec<u8>,
    indices: Vec<u8>,
}

impl Mesh {
    unsafe fn upload(data: &Geometry<'_>) -> Option<Self> {
        let mut mesh = Self {
            vao: 0, vertex_buffer: 0, index_buffer: 0,
            stride: data.stride, vertices: data.vertices.to_vec(), indices: data.indices.to_vec(),
        };
        glGenVertexArrays(1, &mut mesh.vao);
        glGenBuffers(1, &mut mesh.vertex_buffer);
        glGenBuffers(1, &mut mesh.index_buffer);
        if mesh.vao != 0 && mesh.vertex_buffer != 0 && mesh.index_buffer != 0 {
            glBindVertexArray(mesh.vao);
            glBindBuffer(ARRAY_BUFFER, mesh.vertex_buffer);
            glBufferData(ARRAY_BUFFER, data.vertices.len() as isize, data.vertices.as_ptr().cast(), STATIC_DRAW);
            glEnableVertexAttribArray(0);
            glVertexAttribPointer(0, 3, FLOAT, FALSE, data.stride as i32, ptr::null());
            glEnableVertexAttribArray(1);
            glVertexAttribPointer(1, 3, FLOAT, FALSE, data.stride as i32, 12usize as *const _);
            if data.stride == 32 {
                glEnableVertexAttribArray(2);
                glVertexAttribPointer(2, 2, FLOAT, FALSE, 32, 24usize as *const _);
            }
            glBindBuffer(ELEMENT_ARRAY_BUFFER, mesh.index_buffer);
            glBufferData(ELEMENT_ARRAY_BUFFER, data.indices.len() as isize, data.indices.as_ptr().cast(), STATIC_DRAW);
            if glGetError() == 0 { return Some(mesh); }
        }
        mesh.destroy();
        None
    }

    unsafe fn destroy(&self) {
        glDeleteVertexArrays(1, &self.vao);
        glDeleteBuffers(1, &self.vertex_buffer);
        glDeleteBuffers(1, &self.index_buffer);
    }
}

pub(crate) struct WorldPipeline {
    program: u32,
    view_projection: i32,
    model: i32,
    eye: i32,
    to_sun: i32,
    sun: i32,
    sky: i32,
    ground: i32,
    ambient: i32,
    albedo: i32,
    surface: i32,
    has_map: i32,
    meshes: BTreeMap<u32, Mesh>,
}

impl WorldPipeline {
    pub unsafe fn create() -> Option<Self> {
        let program = link_program(VERTEX, FRAGMENT)?;
        let loc = |s: &[u8]| glGetUniformLocation(program, s.as_ptr().cast());
        let pipeline = Self {
            program, view_projection: loc(b"viewProjection\0"), model: loc(b"model\0"), eye: loc(b"eye\0"),
            to_sun: loc(b"toSun\0"), sun: loc(b"sun\0"), sky: loc(b"sky\0"), ground: loc(b"ground\0"),
            ambient: loc(b"ambient\0"), albedo: loc(b"albedo\0"), surface: loc(b"surface\0"), has_map: loc(b"hasMap\0"),
            meshes: BTreeMap::new(),
        };
        if [pipeline.view_projection, pipeline.model, pipeline.eye, pipeline.to_sun,
            pipeline.sun, pipeline.sky, pipeline.ground, pipeline.ambient, pipeline.albedo,
            pipeline.surface, pipeline.has_map].contains(&-1) || glGetError() != 0 {
            pipeline.destroy();
            return None;
        }
        Some(pipeline)
    }

    pub unsafe fn destroy(&self) {
        for mesh in self.meshes.values() { mesh.destroy(); }
        glDeleteProgram(self.program);
    }

    pub unsafe fn draw(&mut self, frame: &WorldFrame<'_>, white: u32, pages: &[u32; crate::frame::PAGE_SLOTS]) -> bool {
        // The complete table for this frame defines residency. Check both
        // streams so replacing geometry under a stable id updates it atomically.
        self.meshes.retain(|id, mesh| {
            let live = frame.geometry.iter().any(|g| g.id == *id);
            if !live { mesh.destroy(); }
            live
        });
        for g in &frame.geometry {
            if self.meshes.get(&g.id).is_some_and(|m| m.stride == g.stride && m.vertices == g.vertices && m.indices == g.indices) { continue; }
            let Some(uploaded) = Mesh::upload(g) else { return false; };
            if let Some(previous) = self.meshes.insert(g.id, uploaded) { previous.destroy(); }
        }
        glUseProgram(self.program);
        glUniformMatrix4fv(self.view_projection, 1, FALSE, frame.view_projection.as_ptr());
        for (location, value) in [
            (self.eye, frame.eye), (self.to_sun, frame.to_sun), (self.sun, frame.sun),
            (self.sky, frame.sky), (self.ground, frame.ground), (self.ambient, frame.ambient),
        ] { glUniform3f(location, value[0], value[1], value[2]); }
        glDisable(BLEND);
        glEnable(DEPTH_TEST);
        glDepthFunc(LEQUAL);
        glCullFace(BACK);
        for draw in &frame.draws {
            // World3D reverses front-face winding for mirrored model transforms.
            let m = &draw.world;
            let determinant = m[0] * (m[5]*m[10] - m[6]*m[9])
                - m[4] * (m[1]*m[10] - m[2]*m[9]) + m[8] * (m[1]*m[6] - m[2]*m[5]);
            glFrontFace(if determinant < 0. { CW } else { CCW });
            if draw.double_sided { glDisable(CULL_FACE); } else { glEnable(CULL_FACE); }
            glUniform1i(self.has_map, i32::from(draw.page != 0));
            glBindTexture(TEXTURE_2D, if draw.page == 0 { white } else { pages[draw.page] });
            glUniformMatrix4fv(self.model, 1, FALSE, m.as_ptr());
            glUniform3f(self.albedo, draw.albedo[0], draw.albedo[1], draw.albedo[2]);
            glUniform2f(self.surface, draw.roughness, draw.metallic);
            let mesh = &self.meshes[&draw.geometry];
            glBindVertexArray(mesh.vao);
            glDrawElements(TRIANGLES, (mesh.indices.len() / 4) as i32, UNSIGNED_INT, ptr::null());
        }
        glFrontFace(CCW);
        glDisable(CULL_FACE);
        glDisable(DEPTH_TEST);
        // ProjectPipeline owns the submission error query after the HUD and resolve.
        true
    }
}
