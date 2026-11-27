// SPDX-License-Identifier: Apache-2.0
//! Painter-ordered baseline (EGR1), project quads (EGR2/EGR3), and indexed project meshes (EGR4).
#[path = "frame_indexed.rs"]
mod indexed;
/// Highest project packet version this native renderer decodes. No GL context is needed.
#[no_mangle]
pub extern "C" fn egret_renderer_project_frame_version() -> u32 { 6 }

pub(crate) const HEADER_BYTES: usize = 24;
pub(crate) const QUAD_BYTES: usize = 48;
const PROJECT_QUAD_BYTES: usize = 64;
const MAPPING_BYTES: usize = 24;
pub(crate) const MAX_QUADS: usize = 4096;
pub(crate) const MAX_FRAME_BYTES: usize = HEADER_BYTES + MAX_QUADS * (PROJECT_QUAD_BYTES + MAPPING_BYTES);
pub(crate) const PAGE_SLOTS: usize = 256;
pub(crate) const MULTIPLY: u32 = 4;
pub(crate) const ADD: u32 = 8;
pub(crate) const LINEAR: u32 = 16;
const VERTEX_LIGHT: u32 = 32;
const SOLID_PAGE: u32 = 64;
pub(crate) const EFFECT_ENTER: u32 = 128;
pub(crate) const EFFECT_EXIT: u32 = 129;
const MAX_EFFECT_GROUPS: usize = 8;
const MAX_EFFECT_DEPTH: usize = 4;
pub(crate) const MAX_DIMENSION: u32 = 16384;

#[derive(Debug, PartialEq)]
pub(crate) enum Error {
    Invalid = 1,
    MissingPage = 2,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct AtlasMapping {
    pub logical: [i32; 2],
    pub trim: [i32; 2],
    pub turn: i32,
}

impl AtlasMapping {
    fn decode(bytes: &[u8], region: [f32; 4], page: [u32; 2]) -> Result<Self, Error> {
        let [width, height, x, y, turn] = [0, 4, 8, 12, 16].map(|at| word(bytes, at));
        if !(1..=1 << 20).contains(&width) || !(1..=1 << 20).contains(&height)
            || x >= width || y >= height || turn > 3 {
            return Err(Error::Invalid);
        }
        // A mapped crop must address integer texels in this resident page generation.
        let mut edges = [0; 4];
        for (i, value) in region.into_iter().enumerate() {
            let extent = page[i % 2] as f32;
            let texel = (value * extent).round();
            if texel / extent != value { return Err(Error::Invalid); }
            edges[i] = texel as u32;
        }
        let [left, top, right, bottom] = edges;
        let (mut w, mut h) = (right - left, bottom - top);
        if turn % 2 != 0 { std::mem::swap(&mut w, &mut h); }
        if w == 0 || h == 0 || w > width - x || h > height - y { return Err(Error::Invalid); }
        Ok(Self { logical: [width as i32, height as i32], trim: [x as i32, y as i32], turn: turn as i32 })
    }
}

#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct Vertex {
    pub position: [f32; 2],
    pub uv: [f32; 2],
    pub color: [u8; 4],
}

#[derive(Debug, PartialEq)]
pub(crate) struct Batch {
    pub page: usize,
    pub opacity: f32,
    pub clip: [f32; 4],
    pub region: [f32; 4],
    pub mapping: Option<AtlasMapping>,
    pub indexed: bool,
    pub policy: u32,
    // Vertex offset for arrays, or index offset for indexed batches.
    pub first: i32,
    pub count: i32,
}

impl Batch {
    pub fn scissor(&self, logical: [f32; 2], physical: [u32; 2]) -> [i32; 4] {
        scissor(self.clip, logical, physical)
    }
}

/// Both draw clipping and isolated composition use the same physical pixel centers.
pub(crate) fn scissor(clip: [f32; 4], logical: [f32; 2], physical: [u32; 2]) -> [i32; 4] {
    let edge = |v: f32, axis: usize| {
        ((f64::from(v) * f64::from(physical[axis]) / f64::from(logical[axis]) - 0.5).ceil() as i32)
            .clamp(0, physical[axis] as i32)
    };
    let [left, top, right, bottom] = clip;
    let (x, y, r, b) = (edge(left, 0), edge(top, 1), edge(right, 0), edge(bottom, 1));
    [x, physical[1] as i32 - b, r - x, b - y]
}

#[derive(Debug)]
pub(crate) struct ProjectGlow {
    pub spread: f32,
    pub strength: f32,
    pub color: u32,
    pub alpha: f32,
    pub offset: [f32; 2],
    pub inner: bool,
    pub knockout: bool,
    pub outline: bool,
}

#[derive(Debug)]
pub(crate) struct ProjectEffect {
    pub clip: [f32; 4],
    pub matrix: Option<[f32; 20]>,
    pub blur: f32,
    pub glow: Option<ProjectGlow>,
}

pub(crate) struct Header {
    pub project: bool,
    pub mapped: bool,
    pub effects: Vec<ProjectEffect>,
    pub size: [f32; 2],
    pub clear: [u8; 4],
}

fn word(bytes: &[u8], offset: usize) -> u32 {
    // Callers have already checked the full header or record length.
    u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap())
}

fn append_batch(batches: &mut Vec<Batch>, batch: Batch) {
    if let Some(last) = batches.last_mut() {
        if last.policy == batch.policy && last.indexed == batch.indexed && last.page == batch.page && last.opacity == batch.opacity
            && last.clip == batch.clip && last.region == batch.region && last.mapping == batch.mapping {
            last.count += batch.count;
            return;
        }
    }
    batches.push(batch);
}

fn valid_clip(clip: [f32; 4], size: [f32; 2]) -> bool {
    let [left, top, right, bottom] = clip;
    (0.0..=size[0]).contains(&left) && (0.0..=size[1]).contains(&top)
        && (left..=size[0]).contains(&right) && (top..=size[1]).contains(&bottom)
}

fn decode_quad(record: &[u8], mapping_bytes: Option<&[u8]>, project: bool, size: [f32; 2], policy: u32,
               page_sizes: &[[u32; 2]; PAGE_SLOTS], vertices: &mut Vec<Vertex>,
               batches: &mut Vec<Batch>) -> Result<(), Error> {
    let (page, color, opacity, clip) = if project {
        let opacity = f32::from_bits(word(record, 4));
        let clip = [48, 52, 56, 60].map(|at| f32::from_bits(word(record, at)));
        if !(0.0..=1.0).contains(&opacity) || !valid_clip(clip, size) {
            return Err(Error::Invalid);
        }
        (record[0] as usize, [record[1], record[2], record[3], 255], opacity, clip)
    } else {
        let color = word(record, 4).to_be_bytes();
        if color[3] != 255 { return Err(Error::Invalid); }
        (word(record, 0) as usize, color, 1.0, [0., 0., size[0], size[1]])
    };
    if page >= PAGE_SLOTS || (page != 0 && color != [255; 4]) { return Err(Error::Invalid); }
    if page != 0 && page_sizes[page][0] == 0 {
        return Err(Error::MissingPage);
    }
    let mut values = [0.0; 10];
    for (index, value) in values.iter_mut().enumerate() {
        *value = f32::from_bits(word(record, 8 + 4 * index));
    }
    if values[..6].iter().any(|v| !v.is_finite() || v.abs() > 16_777_216.0)
        || values[6..].iter().any(|v| !(0.0..=1.0).contains(v))
    {
        return Err(Error::Invalid);
    }
    let [x0, y0, x1, y1, x2, y2, u0, v0, u1, v1] = values;
    if project && (u0 >= u1 || v0 >= v1) { return Err(Error::Invalid); }
    let region = if project { [u0, v0, u1, v1] } else { [0., 0., 1., 1.] };
    let mapping = if let Some(params) = mapping_bytes {
        if page == 0 { return Err(Error::Invalid); }
        Some(AtlasMapping::decode(params, region, page_sizes[page])?)
    } else { None };
    let [u0, v0, u1, v1] = if mapping.is_some() { [0., 0., 1., 1.] } else { [u0, v0, u1, v1] };
    let corner = |x, y, u, v| Vertex { position: [x, y], uv: [u, v], color };
    let a = corner(x0, y0, u0, v0);
    let b = corner(x1, y1, u1, v0);
    let c = corner(x2, y2, u0, v1);
    let d = corner(x1 + x2 - x0, y1 + y2 - y0, u1, v1);
    let first = vertices.len() as i32;
    vertices.extend_from_slice(&[a, b, c, c, b, d]);
    append_batch(batches, Batch { page, indexed: false, policy, first, count: 6, opacity, clip, region, mapping });
    Ok(())
}

#[cfg(test)]
fn prepare(bytes: &[u8], page_sizes: &[[u32; 2]; PAGE_SLOTS], vertices: &mut Vec<Vertex>,
           batches: &mut Vec<Batch>) -> Result<Header, Error> {
    prepare_frame(bytes, page_sizes, vertices, batches, &mut Vec::new())
}

#[cfg(test)]
pub(crate) fn prepare_frame(bytes: &[u8], pages: &[[u32; 2]; PAGE_SLOTS], vertices: &mut Vec<Vertex>,
                            batches: &mut Vec<Batch>, indices: &mut Vec<u32>) -> Result<Header, Error> {
    prepare_lit_frame(bytes, pages, vertices, batches, indices, &mut Vec::new())
}

pub(crate) fn prepare_lit_frame(
    bytes: &[u8],
    page_sizes: &[[u32; 2]; PAGE_SLOTS],
    vertices: &mut Vec<Vertex>,
    batches: &mut Vec<Batch>,
    indices: &mut Vec<u32>,
    lights: &mut Vec<[f32; 4]>,
) -> Result<Header, Error> {
    vertices.clear();
    batches.clear();
    indices.clear();
    lights.clear();
    if !(HEADER_BYTES..=MAX_FRAME_BYTES).contains(&bytes.len()) {
        return Err(Error::Invalid);
    }
    let format = word(bytes, 0);
    let layered = format == 0x36524745;
    let (project, mapped, stride) = match format {
        0x31524745 => (false, false, QUAD_BYTES),
        0x32524745 => (true, false, PROJECT_QUAD_BYTES),
        0x33524745 => (true, true, PROJECT_QUAD_BYTES),
        0x34524745 | 0x35524745 | 0x36524745 => (true, false, 0),
        _ => return Err(Error::Invalid),
    };
    let width = word(bytes, 8);
    let height = word(bytes, 12);
    let clear = word(bytes, 16).to_be_bytes();
    let count = word(bytes, 20) as usize;
    if !(1..=MAX_DIMENSION).contains(&width)
        || !(1..=MAX_DIMENSION).contains(&height)
        || (!project && clear[3] != 255)
        || count > MAX_QUADS + if layered { 2 * MAX_EFFECT_GROUPS } else { 0 }
    {
        return Err(Error::Invalid);
    }
    let size = [width as f32, height as f32];
    let mut effects = Vec::new();
    if stride == 0 {
        let mapped = indexed::decode(&bytes[HEADER_BYTES..], count, size, page_sizes, vertices, batches, indices,
                                     format == 0x35524745 || layered, layered, lights, &mut effects)?;
        return Ok(Header { project, mapped, size, clear, effects });
    }
    let records_end = HEADER_BYTES + count * stride;
    let suffix = bytes.get(records_end..).ok_or(Error::Invalid)?;
    let mut descriptors = suffix.chunks_exact(MAPPING_BYTES);
    if !descriptors.remainder().is_empty() || descriptors.len() > count || mapped == suffix.is_empty() {
        return Err(Error::Invalid);
    }
    let mut next = descriptors.next();
    for (ordinal, record) in bytes[HEADER_BYTES..records_end].chunks_exact(stride).enumerate() {
        let mapping = match next {
            Some(desc) if word(desc, 0) as usize == ordinal => {
                next = descriptors.next();
                Some(&desc[4..])
            }
            _ => None,
        };
        decode_quad(record, mapping, project, size, 0, page_sizes, vertices, batches)?;
    }
    if next.is_some() { return Err(Error::Invalid); }
    Ok(Header { project, mapped, size, clear, effects })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn packet(pages: &[u32]) -> Vec<u8> {
        let mut bytes: Vec<u8> = [0x31524745u32, 1, 160, 90, 0x112233ff, pages.len() as u32]
            .into_iter().flat_map(u32::to_le_bytes).collect();
        for page in pages {
            bytes.extend_from_slice(&page.to_le_bytes());
            bytes.extend_from_slice(&0xffffffffu32.to_le_bytes());
            for value in [2.0f32, 3.0, 9.0, 4.0, 1.0, 8.0, 0.0, 0.0, 1.0, 1.0] {
                bytes.extend_from_slice(&value.to_le_bytes());
            }
        }
        bytes
    }

    #[test]
    fn preserves_color_affine_corners_and_adjacent_page_order() {
        let (mut vertices, mut batches) = (Vec::new(), Vec::new());
        let h = prepare(&packet(&[0, 1, 1, 0]), &[[8, 4]; PAGE_SLOTS],
                        &mut vertices, &mut batches).unwrap();
        assert_eq!(h.clear, [17, 34, 51, 255]);
        assert_eq!(h.size, [160.0, 90.0]);
        assert_eq!(vertices[5].position, [8.0, 9.0]);
        assert_eq!(vertices[5].uv, [1.0, 1.0]);
        assert_eq!(batches.iter().map(|b| (b.page, b.first, b.count)).collect::<Vec<_>>(),
                   [(0, 0, 6), (1, 6, 12), (0, 18, 6)]);
        prepare(&packet(&[]), &[[0; 2]; PAGE_SLOTS], &mut vertices, &mut batches).unwrap();
        assert!(vertices.is_empty() && batches.is_empty());
    }

    #[test]
    fn rejects_missing_or_invalid_pages_and_inexact_wire_lengths() {
        let (mut vertices, mut batches) = (Vec::new(), Vec::new());
        let run = |b: &[u8], v: &mut Vec<Vertex>, t: &mut Vec<Batch>| {
            prepare(b, &[[0; 2]; PAGE_SLOTS], v, t).err()
        };
        assert_eq!(run(&packet(&[3]), &mut vertices, &mut batches), Some(Error::MissingPage));
        assert_eq!(run(&packet(&[256]), &mut vertices, &mut batches), Some(Error::Invalid));
        let bytes = packet(&[0]);
        for length in 0..bytes.len() {
            assert_eq!(run(&bytes[..length], &mut vertices, &mut batches), Some(Error::Invalid));
        }
        let mut invalid = bytes.clone();
        invalid.extend([0]);
        assert_eq!(run(&invalid, &mut vertices, &mut batches), Some(Error::Invalid));
        for (offset, bits) in [(0, 0), (8, 0), (12, 32768), (16, 0xff00),
                               (20, u32::MAX), (28, 0), (32, f32::NAN.to_bits()),
                               (56, f32::INFINITY.to_bits())] {
            let mut bad = bytes.clone();
            bad[offset..offset+4].copy_from_slice(&bits.to_le_bytes());
            assert_eq!(run(&bad, &mut vertices, &mut batches), Some(Error::Invalid));
        }
    }
}

#[cfg(test)]
mod project_tests {
    use super::*;

    fn project_packet() -> Vec<u8> {
        let mut bytes: Vec<u8> = [0x32524745u32, 42, 80, 64, 0x80402080, 2]
            .into_iter().flat_map(u32::to_le_bytes).collect();
        for page in [0u8, 5] {
            bytes.extend_from_slice(&[page, 255, 255, 255]);
            for v in [0.75f32, 1., 2., 5., 4., -1., 6., 0., 0., 1., 1., 1.25, 3.5, 8.25, 6.] {
                bytes.extend_from_slice(&v.to_le_bytes());
            }
        }
        bytes
    }

    fn atlas_packet(slots: &[u8], mappings: &[[u32; 6]]) -> Vec<u8> {
        let template = project_packet();
        let mut bytes = template[..HEADER_BYTES].to_vec();
        bytes[..4].copy_from_slice(b"EGR3");
        bytes[20..24].copy_from_slice(&(slots.len() as u32).to_le_bytes());
        for &slot in slots {
            let mut record = template[HEADER_BYTES + PROJECT_QUAD_BYTES..].to_vec();
            record[0] = slot;
            for (field, uv) in [0.125f32, 0.25, 0.625, 0.75].into_iter().enumerate() {
                record[32+4*field..36+4*field].copy_from_slice(&uv.to_le_bytes());
            }
            bytes.extend(record);
        }
        bytes.extend(mappings.iter().flatten().flat_map(|value| value.to_le_bytes()));
        bytes
    }

    #[test]
    fn sparse_atlas_records_keep_logical_geometry_and_batch_only_identical_mappings() {
        let bytes = atlas_packet(&[5; 5], &[
            [1, 8, 6, 1, 2, 1], [2, 8, 6, 1, 2, 1], [3, 8, 6, 1, 2, 3],
        ]);
        let (mut vertices, mut batches) = (Vec::new(), Vec::new());
        let h = prepare(&bytes, &[[8, 4]; PAGE_SLOTS], &mut vertices, &mut batches).unwrap();
        assert!(h.mapped && h.project);
        assert_eq!(batches.iter().map(|b| (b.first, b.count)).collect::<Vec<_>>(),
                   [(0, 6), (6, 12), (18, 6), (24, 6)]);
        assert_eq!(batches[0].mapping, None);
        assert_eq!(batches[1].mapping, Some(AtlasMapping {logical: [8, 6], trim: [1, 2], turn: 1}));
        assert_eq!(batches[2].mapping.unwrap().turn, 3);
        assert_eq!(batches[3].mapping, None);
        assert_eq!(batches[1].region, [0.125, 0.25, 0.625, 0.75]);
        assert_eq!(vertices[0].uv, [0.125, 0.25]);
        assert_eq!(vertices[6].uv, [0., 0.]);
        assert_eq!(vertices[11].uv, [1., 1.]);
        assert_eq!(vertices[6].position, vertices[0].position);
        assert_eq!(vertices[11].position, vertices[5].position);
    }

    #[test]
    fn invalid_atlas_suffix_ordinals_extents_and_page_generation_are_rejected() {
        let (mut vertices, mut batches) = (Vec::new(), Vec::new());
        let mut check = |bytes: &[u8], size| prepare(bytes, &[size; PAGE_SLOTS], &mut vertices, &mut batches).err();
        let desc = [0, 3, 6, 1, 2, 1]; // Rotates a 4x2 packed crop to 2x4.
        let valid = atlas_packet(&[5], &[desc]);
        assert_eq!(check(&valid, [8, 4]), None);
        assert_eq!(check(&valid, [7, 4]), Some(Error::Invalid)); // A different page size cannot represent the crop.
        assert_eq!(check(&valid, [0, 0]), Some(Error::MissingPage));
        let first = valid.len() - MAPPING_BYTES;
        for end in first..valid.len() { assert_eq!(check(&valid[..end], [8, 4]), Some(Error::Invalid)); }
        let mut legacy = valid.clone();
        legacy[..4].copy_from_slice(b"EGR2");
        assert_eq!(check(&legacy, [8, 4]), Some(Error::Invalid));
        for (index, bad) in [(0, 1), (0, u32::MAX), (1, 0), (1, 1 << 21), (2, 1 << 21),
                              (2, 5), (3, 2), (4, u32::MAX), (5, 4), (5, 0)] {
            let mut corrupt = valid.clone();
            corrupt[first+index*4..first+index*4+4].copy_from_slice(&bad.to_le_bytes());
            assert_eq!(check(&corrupt, [8, 4]), Some(Error::Invalid));
        }
        let mut solid = valid.clone();
        solid[HEADER_BYTES] = 0;
        assert_eq!(check(&solid, [8, 4]), Some(Error::Invalid));
        let mut repeated = desc;
        repeated[0] = 1;
        for mappings in [[desc, desc], [repeated, desc]] {
            assert_eq!(check(&atlas_packet(&[5, 5], &mappings), [8, 4]), Some(Error::Invalid));
        }
    }

    #[test]
    fn project_packet_preserves_order_alpha_and_fractional_clip_at_nonuniform_surface_scale() {
        let (mut vertices, mut batches) = (Vec::new(), Vec::new());
        let header = prepare(&project_packet(), &[[8, 4]; PAGE_SLOTS], &mut vertices, &mut batches).unwrap();
        assert!(header.project);
        assert_eq!(header.clear, [128, 64, 32, 128]);
        assert_eq!(vertices[5].position, [3., 8.]);
        assert_eq!(batches.len(), 2);
        assert_eq!(batches[0].opacity, 0.75);
        assert_eq!(batches[1].page, 5);
        assert_eq!(batches[1].scissor([80., 64.], [160, 64]), [2, 58, 14, 3]);
    }

    #[test]
    fn project_packet_rejects_missing_pages_bad_opacity_bounds_and_trailing_data() {
        let (mut vertices, mut batches) = (Vec::new(), Vec::new());
        let packet = project_packet();
        assert_eq!(prepare(&packet, &[[0; 2]; PAGE_SLOTS], &mut vertices, &mut batches).err(), Some(Error::MissingPage));
        for (at, bad) in [(28, f32::NAN), (28, 1.5), (72, -1.), (80, 0.), (84, 65.)] {
            let mut bytes = packet.clone();
            bytes[at..at+4].copy_from_slice(&bad.to_le_bytes());
            assert_eq!(prepare(&bytes, &[[8, 4]; PAGE_SLOTS], &mut vertices, &mut batches).err(), Some(Error::Invalid));
        }
        assert_eq!(prepare(&packet[..packet.len()-1], &[[8, 4]; PAGE_SLOTS], &mut vertices, &mut batches).err(), Some(Error::Invalid));
    }
}

#[cfg(test)]
mod indexed_tests {
    use super::*;

    fn words(dst: &mut Vec<u8>, values: &[u32]) {
        for value in values { dst.extend(value.to_le_bytes()); }
    }

    fn mesh(kind: u32, page: u32) -> Vec<u8> {
        let mut record = Vec::new();
        words(&mut record, &[kind, page, 0.5f32.to_bits()]);
        words(&mut record, &[0., 0., 64., 48., 0., 0., 1., 1.].map(f32::to_bits));
        words(&mut record, &[4, 6]);
        if kind == 3 { words(&mut record, &[8, 16, 0, 0, 1]); }
        for vertex in [[2., 4., 0., 0.], [8., 6., 1., 0.], [1., 9., 0., 1.], [9., 10., 1., 1.]] {
            words(&mut record, &vertex.map(f32::to_bits));
        }
        words(&mut record, &[0, 1, 2, 2, 1, 3]);
        record
    }

    fn packet(records: &[Vec<u8>]) -> Vec<u8> {
        let mut bytes = Vec::new();
        words(&mut bytes, &[u32::from_le_bytes(*b"EGR4"), 1, 64, 48, 255, records.len() as u32]);
        for record in records { bytes.extend(record); }
        bytes
    }

    fn parse(bytes: &[u8]) -> Result<Header, Error> {
        prepare(bytes, &[[16, 8]; PAGE_SLOTS], &mut Vec::new(), &mut Vec::new())
    }

    fn quad(mapped: bool) -> Vec<u8> {
        let mut bytes = Vec::new();
        words(&mut bytes, &[u32::from(mapped)]);
        bytes.extend([1, 255, 255, 255]);
        let coordinates = [0.5f32, 0., 0., 7., 0., 0., 3., 0., 0., 1., 1., 0., 0., 64., 48.];
        words(&mut bytes, &coordinates.map(f32::to_bits));
        if mapped { words(&mut bytes, &[8, 16, 0, 0, 1]); }
        bytes
    }

    #[test]
    fn extended_batches_keep_blend_order_and_interleaved_vertex_lights() {
        let mut shadow = quad(false);
        shadow[..4].copy_from_slice(&MULTIPLY.to_le_bytes());
        let mut puppet = mesh(2, 1);
        puppet[..4].copy_from_slice(&(2 | LINEAR).to_le_bytes());
        let plain = mesh(2, 1);
        let mut spark = plain[..52].to_vec();
        spark[..4].copy_from_slice(&(2 | ADD | VERTEX_LIGHT).to_le_bytes());
        for (i, vertex) in plain[52..116].chunks_exact(16).enumerate() {
            spark.extend(vertex);
            words(&mut spark, &[0.25, 0.5, i as f32 / 4., 0.75].map(f32::to_bits));
        }
        spark.extend(&plain[116..]);
        let mut bytes = packet(&[shadow, puppet, spark, quad(false)]);
        bytes[..4].copy_from_slice(b"EGR5");
        let (mut vertices, mut batches, mut indices, mut lights) = (Vec::new(), Vec::new(), Vec::new(), Vec::new());
        prepare_lit_frame(&bytes, &[[16,8]; PAGE_SLOTS], &mut vertices, &mut batches, &mut indices, &mut lights).unwrap();
        assert_eq!(batches.iter().map(|b| b.policy).collect::<Vec<_>>(), [MULTIPLY, LINEAR, ADD, 0]);
        assert_eq!(lights.len(), vertices.len());
        assert_eq!(lights[9], [1.; 4]);
        assert_eq!(lights[13], [0.25, 0.5, 0.75, 0.75]);
        assert_eq!(lights[14], [1.; 4]);
        for flags in [64, MULTIPLY | ADD, VERTEX_LIGHT] {
            let mut bad = bytes.clone();
            bad[24..28].copy_from_slice(&flags.to_le_bytes());
            assert!(parse(&bad).is_err());
        }
        let color = 24 + 68 + plain.len() + 52 + 16;
        bytes[color..color + 4].copy_from_slice(&f32::NAN.to_le_bytes());
        assert!(parse(&bytes).is_err());
    }

    fn effect(blur: f32) -> Vec<u8> {
        let mut record = Vec::new();
        words(&mut record, &[EFFECT_ENTER, 7]);
        words(&mut record, &[2., 1., 60., 47.].map(f32::to_bits));
        let mut matrix = [0f32; 20];
        for i in [0, 6, 12, 18] { matrix[i] = 1.; }
        matrix[4] = 31.;
        words(&mut record, &matrix.map(f32::to_bits));
        words(&mut record, &[blur.to_bits(), 4f32.to_bits(), 2f32.to_bits(), 0x987654, 0.25f32.to_bits(),
            (-3f32).to_bits(), 2f32.to_bits(), 3]);
        record
    }

    fn layered(records: &[Vec<u8>]) -> Vec<u8> {
        let mut bytes = packet(records);
        bytes[..4].copy_from_slice(b"EGR6");
        bytes
    }

    #[test]
    fn matches_boundaries_and_never_batches_across_an_isolated_group() {
        let (enter, exit) = (effect(3.), EFFECT_EXIT.to_le_bytes().to_vec());
        let records = [quad(false), enter.clone(), quad(false), enter, mesh(2, 1), exit.clone(), exit, quad(false)];
        let (mut vertices, mut batches, mut indices) = (Vec::new(), Vec::new(), Vec::new());
        let h = prepare_frame(&layered(&records), &[[16, 8]; PAGE_SLOTS], &mut vertices, &mut batches, &mut indices).unwrap();
        let batch_order: Vec<_> = batches.iter().map(|b| (b.policy, b.first, b.count)).collect();
        assert_eq!(batch_order, [(0,0,6),(EFFECT_ENTER,0,0),(0,6,6),(EFFECT_ENTER,1,0),
            (0,0,6),(EFFECT_EXIT,1,0),(EFFECT_EXIT,0,0),(0,16,6)]);
        assert_eq!(h.effects.len(), 2);
        assert_eq!(h.effects[0].matrix.unwrap()[4], 31.);
        assert_eq!(h.effects[0].clip, [2.,1.,60.,47.]);
        assert_eq!(h.effects[0].blur, 3.);
        let glow = h.effects[0].glow.as_ref().unwrap();
        assert_eq!((glow.spread, glow.strength, glow.color, glow.alpha), (4.,2.,0x987654,0.25));
        assert_eq!(glow.offset, [-3.,2.]);
        assert!(glow.inner && glow.knockout && !glow.outline);
    }

    #[test]
    fn rejects_bad_group_payloads_before_native_execution() {
        let (enter, exit) = (effect(3.), EFFECT_EXIT.to_le_bytes().to_vec());
        let good=layered(&[enter.clone(),exit.clone()]);
        for end in 0..good.len() { assert!(parse(&good[..end]).is_err()); }
        for (offset,value) in [(28,0),(32,f32::NAN.to_bits()),(48,f32::NAN.to_bits()),
                               (128,9f32.to_bits()),(132,(-1f32).to_bits()),(140,0xffffffff),(156,8)] {
            let mut bad=good.clone();
            bad[offset..offset+4].copy_from_slice(&value.to_le_bytes());
            assert!(parse(&bad).is_err(), "offset {offset}");
        }
        assert!(parse(&layered(&[quad(false)])).is_err());
        assert!(parse(&layered(std::slice::from_ref(&exit))).is_err());
        assert!(parse(&layered(std::slice::from_ref(&enter))).is_err());
        let nested=[vec![enter.clone(); 5],vec![exit.clone(); 5]].concat();
        assert!(parse(&layered(&nested)).is_err());
        let many=(0..9).flat_map(|_| [enter.clone(),exit.clone()]).collect::<Vec<_>>();
        assert!(parse(&layered(&many)).is_err());
        assert!(parse(&packet(&[enter,exit])).is_err());
    }

    #[test]
    fn mixes_quad_and_mesh_draws_with_local_indices_in_paint_order() {
        let records = [quad(false), mesh(2, 1), mesh(2, 1), mesh(3, 2), quad(true)];
        let (mut vertices, mut batches, mut indices) = (Vec::new(), Vec::new(), Vec::new());
        let pages = [[16, 8]; PAGE_SLOTS];
        let header = prepare_frame(&packet(&records), &pages, &mut vertices, &mut batches, &mut indices).unwrap();
        assert!(header.project && header.mapped);
        assert_eq!(vertices.len(), 24); // six per quad, four unique vertices per mesh
        assert_eq!(indices, [6, 7, 8, 8, 7, 9, 10, 11, 12, 12, 11, 13, 14, 15, 16, 16, 15, 17]);
        let spans: Vec<_> = batches.iter().map(|b| (b.indexed, b.page, b.first, b.count)).collect();
        assert_eq!(spans, [(false, 1, 0, 6), (true, 1, 0, 12), (true, 2, 12, 6), (false, 1, 18, 6)]);
        assert_eq!(batches[2].mapping, batches[3].mapping);
        assert_eq!(batches[2].mapping.unwrap().logical, [8, 16]);
        assert_eq!(vertices[17], Vertex { position: [9., 10.], uv: [1., 1.], color: [255; 4] });
        // The next capture, including a quad-only legacy frame, owns new draw and index ranges.
        assert!(prepare_frame(&packet(&[quad(false)]), &pages, &mut vertices, &mut batches, &mut indices).is_err());
        let mut legacy = packet(&[]);
        legacy[..4].copy_from_slice(b"EGR2");
        prepare_frame(&legacy, &pages, &mut vertices, &mut batches, &mut indices).unwrap();
        assert!(vertices.is_empty() && batches.is_empty() && indices.is_empty());
    }

    #[test]
    fn rejects_truncation_trailing_bytes_invalid_indices_and_header_fields() {
        let good = packet(&[mesh(2, 1)]);
        assert!(parse(&good).is_ok());
        for end in 0..good.len() { assert_eq!(parse(&good[..end]).err(), Some(Error::Invalid)); }
        let mut extra = good.clone();
        extra.extend([0; 4]);
        assert_eq!(parse(&extra).err(), Some(Error::Invalid));
        for (at, bad) in [(0, 4), (4, 0), (4, 256), (8, f32::NAN.to_bits()),
            (12, (-1f32).to_bits()), (20, 65f32.to_bits()), (28, 1f32.to_bits()),
            (44, 2), (44, u32::MAX), (48, 5), (48, u32::MAX),
            (52, f32::INFINITY.to_bits()), (60, (-0.1f32).to_bits()),
            (52 + 4 * 16 + 5 * 4, 4)] {
            let mut broken = good.clone();
            broken[HEADER_BYTES + at..HEADER_BYTES + at + 4].copy_from_slice(&bad.to_le_bytes());
            assert_eq!(parse(&broken).err(), Some(Error::Invalid), "bad field at {at}");
        }
        assert_eq!(parse(&packet(&[])).err(), Some(Error::Invalid));
        assert_eq!(prepare(&good, &[[0; 2]; PAGE_SLOTS], &mut Vec::new(), &mut Vec::new()).err(), Some(Error::MissingPage));
        let mut broken_mapping = mesh(3, 1);
        broken_mapping[68..72].copy_from_slice(&4u32.to_le_bytes());
        assert_eq!(parse(&packet(&[broken_mapping])).err(), Some(Error::Invalid));
    }
}
