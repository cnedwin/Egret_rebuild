// SPDX-License-Identifier: Apache-2.0
//! EGR1 (opaque baseline) and EGR2 (normal-alpha project quads), in painter's order.
pub(crate) const HEADER_BYTES: usize = 24;
pub(crate) const QUAD_BYTES: usize = 48;
const PROJECT_QUAD_BYTES: usize = 64;
pub(crate) const MAX_QUADS: usize = 4096;
pub(crate) const MAX_FRAME_BYTES: usize = HEADER_BYTES + MAX_QUADS * PROJECT_QUAD_BYTES;
pub(crate) const PAGE_SLOTS: usize = 256;
pub(crate) const MAX_DIMENSION: u32 = 16384;

#[derive(Debug, PartialEq)]
pub(crate) enum Error {
    Invalid = 1,
    MissingPage = 2,
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
    pub first: i32,
    pub count: i32,
}

impl Batch {
    /// A logical half-open interval contains precisely these physical pixel centers.
    pub fn scissor(&self, logical: [f32; 2], physical: [u32; 2]) -> [i32; 4] {
        let edge = |v: f32, axis: usize| {
            ((f64::from(v) * f64::from(physical[axis]) / f64::from(logical[axis]) - 0.5).ceil() as i32)
                .clamp(0, physical[axis] as i32)
        };
        let [left, top, right, bottom] = self.clip;
        let (x, y, r, b) = (edge(left, 0), edge(top, 1), edge(right, 0), edge(bottom, 1));
        [x, physical[1] as i32 - b, r - x, b - y]
    }
}

pub(crate) struct Header {
    pub project: bool,
    pub size: [f32; 2],
    pub clear: [u8; 4],
}

fn word(bytes: &[u8], offset: usize) -> u32 {
    // Callers have already checked the full header or record length.
    u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap())
}

pub(crate) fn prepare(
    bytes: &[u8],
    resident: &[u32; PAGE_SLOTS],
    vertices: &mut Vec<Vertex>,
    batches: &mut Vec<Batch>,
) -> Result<Header, Error> {
    vertices.clear();
    batches.clear();
    if !(HEADER_BYTES..=MAX_FRAME_BYTES).contains(&bytes.len()) {
        return Err(Error::Invalid);
    }
    let (project, stride) = match word(bytes, 0) {
        0x31524745 => (false, QUAD_BYTES),
        0x32524745 => (true, PROJECT_QUAD_BYTES),
        _ => return Err(Error::Invalid),
    };
    let width = word(bytes, 8);
    let height = word(bytes, 12);
    let clear = word(bytes, 16).to_be_bytes();
    let count = word(bytes, 20) as usize;
    if !(1..=MAX_DIMENSION).contains(&width)
        || !(1..=MAX_DIMENSION).contains(&height)
        || (!project && clear[3] != 255)
        || count > MAX_QUADS
        || bytes.len() != HEADER_BYTES + count * stride
    {
        return Err(Error::Invalid);
    }
    let size = [width as f32, height as f32];
    for record in bytes[HEADER_BYTES..].chunks_exact(stride) {
        let (page, color, opacity, clip) = if project {
            let opacity = f32::from_bits(word(record, 4));
            let clip = [48, 52, 56, 60].map(|at| f32::from_bits(word(record, at)));
            let [left, top, right, bottom] = clip;
            if !(0.0..=1.0).contains(&opacity) || !(0.0..=size[0]).contains(&left)
                || !(0.0..=size[1]).contains(&top) || !(left..=size[0]).contains(&right)
                || !(top..=size[1]).contains(&bottom)
            {
                return Err(Error::Invalid);
            }
            (record[0] as usize, [record[1], record[2], record[3], 255], opacity, clip)
        } else {
            let color = word(record, 4).to_be_bytes();
            if color[3] != 255 { return Err(Error::Invalid); }
            (word(record, 0) as usize, color, 1.0, [0., 0., size[0], size[1]])
        };
        if page >= PAGE_SLOTS || (page != 0 && color != [255; 4]) { return Err(Error::Invalid); }
        if page != 0 && resident[page] == 0 {
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
        let corner = |x, y, u, v| Vertex { position: [x, y], uv: [u, v], color };
        let a = corner(x0, y0, u0, v0);
        let b = corner(x1, y1, u1, v0);
        let c = corner(x2, y2, u0, v1);
        let d = corner(x1 + x2 - x0, y1 + y2 - y0, u1, v1);
        let first = vertices.len() as i32;
        vertices.extend_from_slice(&[a, b, c, c, b, d]);
        match batches.last_mut() {
            Some(last) if last.page == page && last.opacity == opacity && last.clip == clip && last.region == region => last.count += 6,
            _ => batches.push(Batch { page, first, count: 6, opacity, clip, region }),
        }
    }
    Ok(Header { project, size, clear })
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
        let h = prepare(&packet(&[0, 1, 1, 0]), &[42; PAGE_SLOTS],
                        &mut vertices, &mut batches).unwrap();
        assert_eq!(h.clear, [17, 34, 51, 255]);
        assert_eq!(h.size, [160.0, 90.0]);
        assert_eq!(vertices[5].position, [8.0, 9.0]);
        assert_eq!(vertices[5].uv, [1.0, 1.0]);
        assert_eq!(batches.iter().map(|b| (b.page, b.first, b.count)).collect::<Vec<_>>(),
                   [(0, 0, 6), (1, 6, 12), (0, 18, 6)]);
        prepare(&packet(&[]), &[0; PAGE_SLOTS], &mut vertices, &mut batches).unwrap();
        assert!(vertices.is_empty() && batches.is_empty());
    }

    #[test]
    fn rejects_missing_or_invalid_pages_and_inexact_wire_lengths() {
        let (mut vertices, mut batches) = (Vec::new(), Vec::new());
        let run = |b: &[u8], v: &mut Vec<Vertex>, t: &mut Vec<Batch>| {
            prepare(b, &[0; PAGE_SLOTS], v, t).err()
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

    #[test]
    fn project_packet_preserves_order_alpha_and_fractional_clip_at_nonuniform_surface_scale() {
        let (mut vertices, mut batches) = (Vec::new(), Vec::new());
        let header = prepare(&project_packet(), &[1; PAGE_SLOTS], &mut vertices, &mut batches).unwrap();
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
        assert_eq!(prepare(&packet, &[0; PAGE_SLOTS], &mut vertices, &mut batches).err(), Some(Error::MissingPage));
        for (at, bad) in [(28, f32::NAN), (28, 1.5), (72, -1.), (80, 0.), (84, 65.)] {
            let mut bytes = packet.clone();
            bytes[at..at+4].copy_from_slice(&bad.to_le_bytes());
            assert_eq!(prepare(&bytes, &[1; PAGE_SLOTS], &mut vertices, &mut batches).err(), Some(Error::Invalid));
        }
        assert_eq!(prepare(&packet[..packet.len()-1], &[1; PAGE_SLOTS], &mut vertices, &mut batches).err(), Some(Error::Invalid));
    }
}
