// SPDX-License-Identifier: Apache-2.0
//! Opaque indexed World3D meshes in the project player's context. Resource
//! names belong to this EGL generation, and geometry is shared by its draws.
use crate::gl::*;
use crate::gles::link_program;
use crate::world_frame::{Geometry, StagedMeshes, WorldFrame, SKIN_MAGIC, SKIN_STRIDE};
use std::{collections::BTreeMap, ptr};

const VERTEX: &[u8] = concat!("#version 300 es\n", include_str!("world_standard.vert"), "\0").as_bytes();
const FRAGMENT: &[u8] = concat!("#version 300 es\n", include_str!("world_standard.frag"), "\0").as_bytes();

const SKIN_VERTEX: &[u8] = concat!("#version 300 es\n#define EGRET_SKIN_FRAME\n", include_str!("world_standard.vert"), "\0").as_bytes();
const SKIN_FRAGMENT: &[u8] = concat!("#version 300 es\n#define EGRET_SKIN_FRAME\n", include_str!("world_standard.frag"), "\0").as_bytes();

pub(super) struct Mesh {
    vao: u32,
    vertex_buffer: u32,
    index_buffer: u32,
    stride: usize,
    required_joints: usize,
    vertices: Vec<u8>,
    indices: Vec<u8>,
}

// Temporary names are used only on the current EGL thread. Failed uploads or a
// failed final resolve drop these replacements without disturbing resident names.
#[derive(Default)]
pub(super) struct PendingMeshes(BTreeMap<u32, Mesh>);
impl Drop for PendingMeshes {
    fn drop(&mut self) { for mesh in self.0.values() { unsafe { mesh.destroy(); } } }
}

// Staging spans GL calls but never EGL generations. Ordinary drop releases only
// CPU memory: on context loss its GL names are already invalid. While current,
// clear explicitly, or transfer ownership into the final draw's rollback guard.
pub(super) type WorldUploads = StagedMeshes<Mesh>;

impl WorldUploads {
    pub unsafe fn clear(&mut self) { self.clear_with(|mesh| mesh.destroy()); }

    pub fn mesh_bytes(&self, id: u32) -> Option<usize> {
        self.meshes.get(&id).map(|m| m.vertices.len() + m.indices.len())
    }

    pub fn mesh_joints(&self, id: u32) -> Option<usize> {
        self.meshes.get(&id).map(|m| m.required_joints)
    }

    pub fn take(&mut self) -> PendingMeshes {
        PendingMeshes(std::mem::take(self).meshes)
    }
}

impl Mesh {
    pub(super) unsafe fn upload(data: &Geometry<'_>) -> Option<Self> {
        let mut mesh = Self {
            vao: 0, vertex_buffer: 0, index_buffer: 0,
            stride: data.stride, required_joints: data.required_joints, vertices: data.vertices.to_vec(), indices: data.indices.to_vec(),
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
            if data.stride >= 32 {
                glEnableVertexAttribArray(2);
                glVertexAttribPointer(2, 2, FLOAT, FALSE, data.stride as i32, 24usize as *const _);
            }
            if data.stride == SKIN_STRIDE {
                for (slot, ty, offset) in [(3, UNSIGNED_BYTE, 32usize), (4, FLOAT, 36), (5, FLOAT, 52)] {
                    glEnableVertexAttribArray(slot);
                    glVertexAttribPointer(slot, 4, ty, FALSE, SKIN_STRIDE as i32, offset as *const _);
                }
            }
            glBindBuffer(ELEMENT_ARRAY_BUFFER, mesh.index_buffer);
            glBufferData(ELEMENT_ARRAY_BUFFER, data.indices.len() as isize, data.indices.as_ptr().cast(), STATIC_DRAW);
            if glGetError() == 0 { return Some(mesh); }
        }
        mesh.destroy();
        None
    }

    pub(super) unsafe fn destroy(&self) {
        glDeleteVertexArrays(1, &self.vao);
        glDeleteBuffers(1, &self.vertex_buffer);
        glDeleteBuffers(1, &self.index_buffer);
    }
}

struct WorldProgram {
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
    bones: i32,
    skinned: i32,
    use_vertex_color: i32,
    has_metal_rough: i32,
    has_normal: i32,
    normal_scale: i32,
    emissive: i32,
}

impl WorldProgram {
    unsafe fn create(skin: bool) -> Option<Self> {
        let program = if skin { link_program(SKIN_VERTEX, SKIN_FRAGMENT) } else { link_program(VERTEX, FRAGMENT) }?;
        let loc = |s: &[u8]| glGetUniformLocation(program, s.as_ptr().cast());
        let pipeline = Self {
            program, view_projection: loc(b"viewProjection\0"), model: loc(b"model\0"), eye: loc(b"eye\0"),
            to_sun: loc(b"toSun\0"), sun: loc(b"sun\0"), sky: loc(b"sky\0"), ground: loc(b"ground\0"),
            ambient: loc(b"ambient\0"), albedo: loc(b"albedo\0"), surface: loc(b"surface\0"), has_map: loc(b"hasMap\0"),
            bones: loc(b"bones[0]\0"), skinned: loc(b"skinned\0"), use_vertex_color: loc(b"useVertexColor\0"),
            has_metal_rough: loc(b"hasMetalRough\0"), has_normal: loc(b"hasNormal\0"), normal_scale: loc(b"normalScale\0"), emissive: loc(b"emissive\0"),
        };
        if skin {
            let mr = loc(b"metalRoughMap\0");
            let normal = loc(b"normalMap\0");
            if [mr, normal, pipeline.bones, pipeline.skinned, pipeline.use_vertex_color,
                pipeline.has_metal_rough, pipeline.has_normal, pipeline.normal_scale, pipeline.emissive].contains(&-1) {
                glDeleteProgram(program);
                return None;
            }
            glUseProgram(program);
            glUniform1i(mr, 1);
            glUniform1i(normal, 2);
        }
        if [pipeline.view_projection, pipeline.model, pipeline.eye, pipeline.to_sun,
            pipeline.sun, pipeline.sky, pipeline.ground, pipeline.ambient, pipeline.albedo,
            pipeline.surface, pipeline.has_map].contains(&-1) || glGetError() != 0 {
            glDeleteProgram(program);
            return None;
        }
        Some(pipeline)
    }
}

pub(crate) struct WorldPipeline {
    rigid_program: Option<WorldProgram>,
    skin_program: Option<WorldProgram>,
    meshes: BTreeMap<u32, Mesh>,
    pub(super) confirmed: Option<(u32, u32)>,
}

impl WorldPipeline {
    pub fn create() -> Self {
        Self { rigid_program: None, skin_program: None, meshes: BTreeMap::new(), confirmed: None }
    }

    pub unsafe fn destroy(&self) {
        for mesh in self.meshes.values() { mesh.destroy(); }
        for program in [&self.skin_program, &self.rigid_program].into_iter().flatten() {
            glDeleteProgram(program.program);
        }
    }

    pub(super) fn mesh_joints(&self, id: u32) -> Option<usize> {
        self.meshes.get(&id).map(|m| m.required_joints)
    }

    pub(super) fn mesh_bytes(&self, id: u32) -> Option<usize> {
        self.meshes.get(&id).map(|m| m.vertices.len() + m.indices.len())
    }

    pub(super) fn resident_bytes(&self) -> usize {
        self.meshes.values().map(|m| m.vertices.len() + m.indices.len()).sum()
    }

    pub(super) unsafe fn commit(&mut self, frame: &WorldFrame<'_>, pending: &mut PendingMeshes) {
        for (id, mesh) in std::mem::take(&mut pending.0) {
            if let Some(retired) = self.meshes.insert(id, mesh) { retired.destroy(); }
        }
        self.meshes.retain(|id, mesh| {
            let live = frame.live_ids.contains(id);
            if !live { mesh.destroy(); }
            live
        });
        self.confirmed = Some((frame.id, frame.format));
    }

    pub(super) unsafe fn draw(&mut self, frame: &WorldFrame<'_>, white: u32,
                              pages: &[u32; crate::frame::PAGE_SLOTS], data_pages: &[u32; crate::frame::PAGE_SLOTS],
                              pending: &mut PendingMeshes) -> bool {
        let skin = frame.format == SKIN_MAGIC || frame.batches.is_some();
        let slot = if skin { &mut self.skin_program } else { &mut self.rigid_program };
        if slot.is_none() { *slot = WorldProgram::create(skin); }
        let Some(program) = slot.as_ref() else { return false; };
        for g in &frame.geometry {
            if self.meshes.get(&g.id).is_some_and(|m| m.stride == g.stride && m.vertices == g.vertices && m.indices == g.indices) { continue; }
            let Some(uploaded) = Mesh::upload(g) else { return false; };
            pending.0.insert(g.id, uploaded);
        }
        glUseProgram(program.program);
        glUniformMatrix4fv(program.view_projection, 1, FALSE, frame.view_projection.as_ptr());
        for (location, value) in [
            (program.eye, frame.eye), (program.to_sun, frame.to_sun), (program.sun, frame.sun),
            (program.sky, frame.sky), (program.ground, frame.ground), (program.ambient, frame.ambient),
        ] { glUniform3f(location, value[0], value[1], value[2]); }
        glDisable(BLEND);
        glEnable(DEPTH_TEST);
        glDepthFunc(LEQUAL);
        glCullFace(BACK);
        let mut last_palette = None;
        for draw in &frame.draws {
            // Browser World3D reverses winding only for mirrored rigid nodes. A
            // skinned draw carries its bind matrix here, not a rigid node transform.
            let m = &draw.world;
            let determinant = m[0] * (m[5]*m[10] - m[6]*m[9])
                - m[4] * (m[1]*m[10] - m[2]*m[9]) + m[8] * (m[1]*m[6] - m[2]*m[5]);
            glFrontFace(if draw.palette.is_none() && determinant < 0. { CW } else { CCW });
            if draw.double_sided { glDisable(CULL_FACE); } else { glEnable(CULL_FACE); }
            if skin {
                if let Some(index) = draw.palette {
                    if last_palette != Some(index) {
                        let matrices = &frame.palettes[index];
                        glUniformMatrix4fv(program.bones, matrices.len() as i32, FALSE, matrices.as_ptr().cast());
                        last_palette = Some(index);
                    }
                }
                glUniform1i(program.skinned, i32::from(draw.palette.is_some()));
                glUniform1i(program.use_vertex_color, i32::from(draw.vertex_colors));
                glUniform3f(program.emissive, draw.emissive[0], draw.emissive[1], draw.emissive[2]);
                glUniform2f(program.normal_scale, draw.normal_scale[0], draw.normal_scale[1]);
                for (unit, page, flag) in [(1, draw.metal_rough_page, program.has_metal_rough), (2, draw.normal_page, program.has_normal)] {
                    glActiveTexture(TEXTURE0 + unit);
                    glBindTexture(TEXTURE_2D, if page == 0 { white } else { data_pages[page] });
                    glUniform1i(flag, i32::from(page != 0));
                }
                // The shared 2D compositor and resolve both own sampler zero.
                glActiveTexture(TEXTURE0);
            }
            glUniform1i(program.has_map, i32::from(draw.page != 0));
            glBindTexture(TEXTURE_2D, if draw.page == 0 { white } else { pages[draw.page] });
            glUniformMatrix4fv(program.model, 1, FALSE, m.as_ptr());
            glUniform3f(program.albedo, draw.albedo[0], draw.albedo[1], draw.albedo[2]);
            glUniform2f(program.surface, draw.roughness, draw.metallic);
            let Some(mesh) = pending.0.get(&draw.geometry).or_else(|| self.meshes.get(&draw.geometry)) else { return false; };
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
