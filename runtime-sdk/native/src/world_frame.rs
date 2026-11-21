// SPDX-License-Identifier: Apache-2.0
//! An E3D1 submission contains a complete World3D scene followed by an EGR2–5
//! overlay. A dropped frame or an EGL context loss cannot orphan a mesh definition.

pub(crate) const MAGIC: u32 = u32::from_le_bytes(*b"E3D1");
pub(crate) const TEXTURED_MAGIC: u32 = u32::from_le_bytes(*b"E3D2");
pub(crate) const TEXTURED_LIMIT: usize = 2 * 1024 * 1024;
const FRAME_HEADER: usize = 160;
const DRAW_BYTES: usize = 88;
const TEXTURED_DRAW_BYTES: usize = 96;
const MAX_GEOMETRIES: usize = 64;

pub(crate) struct Geometry<'a> {
    pub id: u32,
    pub stride: usize,
    pub vertices: &'a [u8],
    pub indices: &'a [u8],
}

pub(crate) struct Draw {
    pub geometry: u32,
    pub page: usize,
    pub double_sided: bool,
    pub world: [f32; 16],
    pub albedo: [f32; 3],
    pub roughness: f32,
    pub metallic: f32,
}

pub(crate) struct WorldFrame<'a> {
    pub clear: [u8; 4],
    pub view_projection: [f32; 16],
    pub eye: [f32; 3],
    pub to_sun: [f32; 3],
    pub sun: [f32; 3],
    pub sky: [f32; 3],
    pub ground: [f32; 3],
    pub ambient: [f32; 3],
    pub geometry: Vec<Geometry<'a>>,
    pub draws: Vec<Draw>,
    pub overlay: &'a [u8],
}

fn word(bytes: &[u8], offset: usize) -> u32 {
    u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap())
}

fn floats<const N: usize>(bytes: &[u8], offset: usize) -> Option<[f32; N]> {
    let values = std::array::from_fn(|i| f32::from_bits(word(bytes, offset + 4 * i)));
    values.iter().all(|f| f.is_finite()).then_some(values)
}

// Uploaded pages already passed the common dimensions and 64 MiB source cap.
pub(crate) fn mip_bytes([mut w, mut h]: [u32; 2]) -> usize {
    let mut bytes = 0;
    loop {
        bytes += w as usize * h as usize * 4;
        if w == 1 && h == 1 { return bytes; }
        w = (w / 2).max(1);
        h = (h / 2).max(1);
    }
}

fn radiance(bytes: &[u8], offset: usize) -> Option<[f32; 3]> {
    let rgb = floats(bytes, offset)?;
    rgb.iter().all(|&v| v >= 0.).then_some(rgb)
}

impl<'a> WorldFrame<'a> {
    pub fn parse(bytes: &'a [u8]) -> Option<Self> {
        if bytes.len() < FRAME_HEADER || bytes.len() > TEXTURED_LIMIT {
            return None;
        }
        let (stride, draw_bytes) = match word(bytes, 0) {
            MAGIC if bytes.len() <= crate::frame::MAX_FRAME_BYTES => (24, DRAW_BYTES),
            TEXTURED_MAGIC => (32, TEXTURED_DRAW_BYTES),
            _ => return None,
        };
        let geometry_count = word(bytes, 12) as usize;
        let draw_count = word(bytes, 16) as usize;
        let clear = word(bytes, 20).to_be_bytes();
        if geometry_count > MAX_GEOMETRIES || draw_count > crate::frame::MAX_QUADS || clear[3] != 255 {
            return None;
        }
        let hud_offset = bytes.len().checked_sub(word(bytes, 8) as usize)?;
        let overlay = &bytes[hud_offset..];
        if !(crate::frame::HEADER_BYTES..=crate::frame::MAX_FRAME_BYTES).contains(&overlay.len())
            || !matches!(word(overlay, 0), 0x32524745 | 0x33524745 | 0x34524745 | 0x35524745)
            || word(overlay, 4) != word(bytes, 4) || word(overlay, 16) & 255 != 0 {
            return None;
        }
        let draw_offset = hud_offset.checked_sub(draw_count * draw_bytes)?;
        let mut rest = bytes.get(FRAME_HEADER..draw_offset)?;
        let mut geometry = Vec::with_capacity(geometry_count);
        for _ in 0..geometry_count {
            let header = rest.get(..12)?;
            let id = word(header, 0);
            let vertices = word(header, 4) as usize;
            let indices = word(header, 8) as usize;
            if id == 0 || geometry.iter().any(|g: &Geometry<'_>| g.id == id) ||
                vertices < 3 || indices < 3 || indices % 3 != 0 {
                return None;
            }
            let (data, tail) = rest[12..].split_at_checked(vertices.checked_mul(stride)?)?;
            let (elements, tail) = tail.split_at_checked(indices.checked_mul(4)?)?;
            if data.chunks_exact(4).any(|v| !f32::from_bits(word(v, 0)).is_finite())
                || elements.chunks_exact(4).any(|i| word(i, 0) as usize >= vertices) {
                return None;
            }
            geometry.push(Geometry { id, stride, vertices: data, indices: elements });
            rest = tail;
        }
        if !rest.is_empty() { return None; }
        let mut draws = Vec::with_capacity(draw_count);
        for d in bytes[draw_offset..hud_offset].chunks_exact(draw_bytes) {
            let geometry_id = word(d, 0);
            let albedo = radiance(d, 68)?;
            let [roughness, metallic] = floats(d, 80)?;
            if !geometry.iter().any(|g| g.id == geometry_id) ||
                !albedo.iter().chain([&roughness, &metallic]).all(|v| (0. ..=1.).contains(v)) {
                return None;
            }
            let (page, flags) = if draw_bytes == TEXTURED_DRAW_BYTES { (word(d, 88) as usize, word(d, 92)) } else { (0, 0) };
            if page >= crate::frame::PAGE_SLOTS || flags > 1 { return None; }
            draws.push(Draw { geometry: geometry_id, page, double_sided: flags == 1, world: floats(d, 4)?, albedo, roughness, metallic });
        }
        Some(Self {
            clear, view_projection: floats(bytes, 24)?, eye: floats(bytes, 88)?, to_sun: floats(bytes, 100)?,
            sun: radiance(bytes, 112)?, sky: radiance(bytes, 124)?, ground: radiance(bytes, 136)?,
            ambient: radiance(bytes, 148)?, geometry, draws, overlay,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> Vec<u8> {
        let mut bytes = vec![0; FRAME_HEADER];
        set(&mut bytes, 0, MAGIC);
        set(&mut bytes, 4, 38);
        set(&mut bytes, 8, 24);
        set(&mut bytes, 12, 1);
        set(&mut bytes, 16, 2);
        set(&mut bytes, 20, 0x0b1020ff);
        for n in [17u32, 3, 3] { bytes.extend(n.to_le_bytes()); }
        for v in [[0., 0., 0.], [1., 0., 0.], [0., 1., 0.]] {
            for f in v.into_iter().chain([0., 0., 1.]) { bytes.extend(f32::to_le_bytes(f)); }
        }
        for i in [0u32, 1, 2] { bytes.extend(i.to_le_bytes()); }
        for _ in 0..2 {
            let mut draw = [0; DRAW_BYTES];
            set(&mut draw, 0, 17);
            set(&mut draw, 80, 0.75f32.to_bits());
            bytes.extend(draw);
        }
        for i in [0x32524745u32, 38, 960, 540, 0, 0] { bytes.extend(i.to_le_bytes()); }
        bytes
    }
    #[test]
    fn textured_packet_preserves_uv_page_and_face_mode_and_rejects_corrupt_records() {
        let source = fixture();
        let mut packet = source[..FRAME_HEADER + 12].to_vec();
        set(&mut packet, 0, TEXTURED_MAGIC);
        let source_index = FRAME_HEADER + 12 + 3 * 24;
        for vertex in source[FRAME_HEADER + 12..source_index].chunks_exact(24) {
            packet.extend(vertex);
            packet.extend(0.25f32.to_le_bytes());
            packet.extend(1.25f32.to_le_bytes());
        }
        packet.extend(&source[source_index..source_index + 12]);
        let start = packet.len();
        for draw in source[source_index + 12..source.len() - 24].chunks_exact(DRAW_BYTES) {
            packet.extend(draw);
            packet.extend(255u32.to_le_bytes());
            packet.extend(1u32.to_le_bytes());
        }
        packet.extend(&source[source.len() - 24..]);
        let world = WorldFrame::parse(&packet).unwrap();
        assert_eq!(world.geometry[0].stride, 32);
        assert_eq!(world.geometry[0].vertices.len(), 96);
        assert_eq!(world.draws[0].page, 255);
        assert!(world.draws[1].double_sided);
        for (offset, bad) in [(FRAME_HEADER + 12 + 24, f32::NAN.to_bits()), (start + 88, 256), (start + 92, 2)] {
            let mut invalid = packet.clone();
            set(&mut invalid, offset, bad);
            assert!(WorldFrame::parse(&invalid).is_none());
        }
    }

    #[test]
    fn budgets_every_mip_level_including_non_square_tails() {
        assert_eq!(mip_bytes([1, 1]), 4);
        assert_eq!(mip_bytes([5, 2]), (10 + 2 + 1) * 4);
        assert_eq!(mip_bytes([1, 7]), (7 + 3 + 1) * 4);
    }

    fn set(bytes: &mut [u8], offset: usize, value: u32) { bytes[offset..offset+4].copy_from_slice(&value.to_le_bytes()); }
    #[test]
    fn self_contained_packet_shares_geometry_and_preserves_overlay() {
        let packet = fixture();
        let scene = WorldFrame::parse(&packet).unwrap();
        assert_eq!(scene.geometry.len(), 1);
        assert_eq!(scene.geometry[0].vertices.len(), 72);
        assert_eq!(scene.geometry[0].indices.len(), 12);
        assert_eq!(scene.draws.len(), 2);
        assert_eq!(scene.draws[1].geometry, 17);
        assert_eq!(scene.clear, [11,16,32,255]);
        assert_eq!(scene.overlay, &packet[packet.len()-24..]);
    }
    #[test]
    fn refuses_malformed_resources_materials_and_mismatched_hud_before_gl() {
        let packet = fixture();
        let draw = FRAME_HEADER + 12 + 72 + 12;
        let hud = packet.len() - 24;
        for (offset, invalid) in [(8,u32::MAX), (12,65), (16,u32::MAX), (20,0), (24,f32::NAN.to_bits()),
            (112,(-1f32).to_bits()), (FRAME_HEADER,0), (FRAME_HEADER+4,u32::MAX), (FRAME_HEADER+8,5),
            (FRAME_HEADER+12,f32::NAN.to_bits()), (FRAME_HEADER+84,3), (draw,18), (draw+68,2f32.to_bits()),
            (draw+84,(-1f32).to_bits()), (hud,MAGIC), (hud+4,37), (hud+16,255)] {
            let mut bad = packet.clone();
            set(&mut bad, offset, invalid);
            assert!(WorldFrame::parse(&bad).is_none(), "offset {offset}");
        }
        for length in 0..packet.len() { assert!(WorldFrame::parse(&packet[..length]).is_none()); }
    }
}
