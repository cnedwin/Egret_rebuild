// SPDX-License-Identifier: Apache-2.0
//! EGR4 records interleave ordinary quads, atlas quads, and indexed meshes in paint order.
use super::*;

fn take<'a>(bytes: &mut &'a [u8], length: usize) -> Result<&'a [u8], Error> {
    let (record, tail) = bytes.split_at_checked(length).ok_or(Error::Invalid)?;
    *bytes = tail;
    Ok(record)
}

pub(super) fn decode(mut bytes: &[u8], count: usize, size: [f32; 2], pages: &[[u32; 2]; PAGE_SLOTS],
                     vertices: &mut Vec<Vertex>, batches: &mut Vec<Batch>, indices: &mut Vec<u32>) -> Result<bool, Error> {
    let mut mapped = false;
    let mut contains_mesh = false;
    for _ in 0..count {
        match word(take(&mut bytes, 4)?, 0) {
            kind @ (0 | 1) => {
                let quad = take(&mut bytes, PROJECT_QUAD_BYTES)?;
                let mapping = if kind == 1 { Some(take(&mut bytes, MAPPING_BYTES - 4)?) } else { None };
                mapped |= mapping.is_some();
                decode_quad(quad, mapping, true, size, pages, vertices, batches)?;
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
                if !(1..PAGE_SLOTS).contains(&page) || !(0.0..=1.0).contains(&opacity)
                    || !valid_clip(clip, size) || !region.iter().all(|v| (0.0..=1.0).contains(v))
                    || region[0] >= region[2] || region[1] >= region[3] || vertex_count < 3
                    || index_count < 3 || !index_count.is_multiple_of(3) {
                    return Err(Error::Invalid);
                }
                if pages[page][0] == 0 { return Err(Error::MissingPage); }
                let mapping = if kind == 3 {
                    Some(AtlasMapping::decode(take(&mut bytes, MAPPING_BYTES - 4)?, region, pages[page])?)
                } else { None };
                let vertex_bytes = take(&mut bytes, vertex_count.checked_mul(16).ok_or(Error::Invalid)?)?;
                let index_bytes = take(&mut bytes, index_count.checked_mul(4).ok_or(Error::Invalid)?)?;
                // Wire indices are local to the draw. Rebase once into the shared frame VBO
                // while keeping each position/UV pair unique all the way to glDrawElements.
                let base_vertex = vertices.len() as u32;
                let first = indices.len() as i32;
                for vertex in vertex_bytes.chunks_exact(16) {
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
                append_batch(batches, Batch { page, indexed: true, first, count: index_count as i32,
                                               opacity, clip, region, mapping });
                mapped |= mapping.is_some();
                contains_mesh = true;
            }
            _ => return Err(Error::Invalid),
        }
    }
    if !contains_mesh || !bytes.is_empty() { return Err(Error::Invalid); }
    Ok(mapped)
}
