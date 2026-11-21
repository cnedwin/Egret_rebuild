// SPDX-License-Identifier: Apache-2.0
//! EGR4 records interleave ordinary quads, atlas quads, and indexed meshes in paint order.
use super::*;

fn take<'a>(bytes: &mut &'a [u8], length: usize) -> Result<&'a [u8], Error> {
    let (record, tail) = bytes.split_at_checked(length).ok_or(Error::Invalid)?;
    *bytes = tail;
    Ok(record)
}

pub(super) fn decode(mut bytes: &[u8], count: usize, size: [f32; 2], pages: &[[u32; 2]; PAGE_SLOTS],
                     vertices: &mut Vec<Vertex>, batches: &mut Vec<Batch>, indices: &mut Vec<u32>,
                     extended: bool, lights: &mut Vec<[f32; 4]>) -> Result<bool, Error> {
    let mut mapped = false;
    let mut contains_mesh = false;
    let mut has_policy = false;
    for _ in 0..count {
        let tag = word(take(&mut bytes, 4)?, 0);
        let policy = tag & !3;
        let lit = policy & VERTEX_LIGHT != 0;
        let white = policy & SOLID_PAGE != 0;
        let known = MULTIPLY | ADD | LINEAR | VERTEX_LIGHT | SOLID_PAGE;
        if (!extended && policy != 0) || policy & !known != 0 || (policy & (MULTIPLY | ADD)) == (MULTIPLY | ADD)
            || (lit && tag & 2 == 0) || (white && tag & 3 != 2) {
            return Err(Error::Invalid);
        }
        has_policy |= policy != 0;
        let state = policy & !(VERTEX_LIGHT | SOLID_PAGE);
        match tag & 3 {
            kind @ (0 | 1) => {
                let quad = take(&mut bytes, PROJECT_QUAD_BYTES)?;
                let mapping = if kind == 1 { Some(take(&mut bytes, MAPPING_BYTES - 4)?) } else { None };
                mapped |= mapping.is_some();
                decode_quad(quad, mapping, true, size, state, pages, vertices, batches)?;
            }
            kind @ (2 | 3) => {
                let fixed = take(&mut bytes, 48)?;
                let page = word(fixed, 0) as usize;
                let field = |at| f32::from_bits(word(fixed, at));
                let opacity = field(4);
                let clip = [8, 12, 16, 20].map(field);
                let region = [24, 28, 32, 36].map(field);
                let vertex_count = word(fixed, 40) as usize;
                let index_count = word(fixed, 44) as usize;
                if page >= PAGE_SLOTS || (page == 0) != white || (white && region != [0., 0., 1., 1.]) || !(0.0..=1.0).contains(&opacity)
                    || !valid_clip(clip, size) || !region.iter().all(|v| (0.0..=1.0).contains(v))
                    || region[0] >= region[2] || region[1] >= region[3] || vertex_count < 3
                    || index_count < 3 || !index_count.is_multiple_of(3) {
                    return Err(Error::Invalid);
                }
                if !white && pages[page][0] == 0 { return Err(Error::MissingPage); }
                let mapping = if kind == 3 {
                    Some(AtlasMapping::decode(take(&mut bytes, MAPPING_BYTES - 4)?, region, pages[page])?)
                } else { None };
                let stride = if lit { 32 } else { 16 };
                let vertex_bytes = take(&mut bytes, vertex_count.checked_mul(stride).ok_or(Error::Invalid)?)?;
                let index_bytes = take(&mut bytes, index_count.checked_mul(4).ok_or(Error::Invalid)?)?;
                // Wire indices are local to the draw. Rebase once into the shared frame VBO
                // while keeping each position/UV pair unique all the way to glDrawElements.
                let base_vertex = vertices.len() as u32;
                let first = indices.len() as i32;
                if lit { lights.resize(vertices.len(), [1.; 4]); }
                for vertex in vertex_bytes.chunks_exact(stride) {
                    if lit {
                        let light = [16,20,24,28].map(|i| f32::from_bits(word(vertex,i)));
                        if !light.iter().all(|v| (0.0..=1.0).contains(v)) { return Err(Error::Invalid); }
                        lights.push(light);
                    }
                    let [x, y, u, v] = [0, 4, 8, 12].map(|at| f32::from_bits(word(vertex, at)));
                    if ![x, y].iter().all(|p| p.is_finite() && p.abs() <= 16_777_216.)
                        || ![u, v].iter().all(|p| (0.0..=1.0).contains(p)) {
                        return Err(Error::Invalid);
                    }
                    vertices.push(Vertex { position: [x, y], uv: [u, v], color: [255; 4] });
                }
                for value in index_bytes.chunks_exact(4) {
                    let local = word(value, 0);
                    if local as usize >= vertex_count { return Err(Error::Invalid); }
                    indices.push(base_vertex + local);
                }
                append_batch(batches, Batch { page, indexed: true, policy: state, first, count: index_count as i32,
                                               opacity, clip, region, mapping });
                mapped |= mapping.is_some();
                contains_mesh = true;
            }
            _ => return Err(Error::Invalid),
        }
    }
    if !(if extended { has_policy } else { contains_mesh }) || !bytes.is_empty() { return Err(Error::Invalid); }
    if !lights.is_empty() { lights.resize(vertices.len(), [1.; 4]); }
    Ok(mapped)
}
