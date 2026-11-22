// SPDX-License-Identifier: Apache-2.0
//! E3D1/2 are self-contained. E3D3/4 add a confirmed predecessor and send
//! only the changed definitions, with a complete visible draw list and overlay.
use std::collections::BTreeSet;

pub(crate) const MAGIC: u32 = u32::from_le_bytes(*b"E3D1");
pub(crate) const TEXTURED_MAGIC: u32 = u32::from_le_bytes(*b"E3D2");
pub(crate) const DELTA_MAGIC: u32 = u32::from_le_bytes(*b"E3D3");
pub(crate) const TEXTURED_DELTA_MAGIC: u32 = u32::from_le_bytes(*b"E3D4");
pub(crate) const SKIN_MAGIC: u32 = u32::from_le_bytes(*b"E3D5");
pub(crate) const SKIN_DELTA_MAGIC: u32 = u32::from_le_bytes(*b"E3D6");
pub(crate) const SKIN_STRIDE: usize = 68;
// 56 mat4 uniforms leave room for the camera and model on minimum-spec GLES3.
const MAX_JOINTS: usize = 56;
const SKIN_DRAW_BYTES: usize = 128;
pub(crate) const TEXTURED_LIMIT: usize = 2 * 1024 * 1024;
const FRAME_HEADER: usize = 160;
const DRAW_BYTES: usize = 88;
const TEXTURED_DRAW_BYTES: usize = 96;
const MAX_GEOMETRIES: usize = 64;

pub(crate) struct Geometry<'a> {
    pub id: u32,
    pub stride: usize,
    pub required_joints: usize,
    pub vertices: &'a [u8],
    pub indices: &'a [u8],
}

pub(crate) struct Draw {
    pub geometry: u32,
    pub page: usize,
    pub double_sided: bool,
    pub vertex_colors: bool,
    pub normal_page: usize,
    pub metal_rough_page: usize,
    pub normal_scale: [f32; 2],
    pub emissive: [f32; 3],
    pub palette: Option<usize>,
    pub world: [f32; 16],
    pub albedo: [f32; 3],
    pub roughness: f32,
    pub metallic: f32,
}

pub(crate) struct WorldFrame<'a> {
    pub id: u32,
    pub base: Option<u32>,
    pub format: u32,
    pub palettes: Vec<Vec<[f32; 16]>>,
    pose_bytes: usize,
    pub live_ids: BTreeSet<u32>,
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

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum DeltaError { MissingBase, OverBudget }

impl<'a> WorldFrame<'a> {
    /// Validate references and the size of the equivalent full packet before issuing any GL calls.
    pub fn validate_delta(&self, previous: Option<(u32, u32)>, resident_bytes: impl Fn(u32) -> Option<usize>) -> Result<(), DeltaError> {
        let Some(base) = self.base else { return Ok(()); };
        if previous != Some((base, self.format)) { return Err(DeltaError::MissingBase); }
        let draw_bytes = match self.format { SKIN_MAGIC => SKIN_DRAW_BYTES, TEXTURED_MAGIC => TEXTURED_DRAW_BYTES, _ => DRAW_BYTES };
        let limit = if self.format == MAGIC { crate::frame::MAX_FRAME_BYTES } else { TEXTURED_LIMIT };
        let mut size = FRAME_HEADER + self.pose_bytes + self.overlay.len() + self.draws.len() * draw_bytes;
        for &id in &self.live_ids {
            let payload = match self.geometry.iter().find(|g| g.id == id) {
                Some(g) => g.vertices.len() + g.indices.len(),
                None => resident_bytes(id).ok_or(DeltaError::MissingBase)?,
            };
            size = size.checked_add(12).and_then(|s| s.checked_add(payload)).ok_or(DeltaError::OverBudget)?;
            if size > limit { return Err(DeltaError::OverBudget); }
        }
        Ok(())
    }

    /// A pose-only delta may reference an existing vertex buffer. Check its largest
    /// joint before drawing, even when the skeleton has changed since the last frame.
    pub fn valid_palettes(&self, resident_joints: impl Fn(u32) -> Option<usize>) -> bool {
        self.draws.iter().all(|draw| {
            let Some(index) = draw.palette else { return true; };
            let required = self.geometry.iter().find(|g| g.id == draw.geometry)
                .map(|g| g.required_joints).or_else(|| resident_joints(draw.geometry));
            required.is_some_and(|count| count <= self.palettes[index].len())
        })
    }

    pub fn parse(bytes: &'a [u8]) -> Option<Self> {
        if bytes.len() < FRAME_HEADER || bytes.len() > TEXTURED_LIMIT {
            return None;
        }
        let magic = word(bytes, 0);
        let (stride, draw_bytes, format) = match magic {
            MAGIC | DELTA_MAGIC if bytes.len() <= crate::frame::MAX_FRAME_BYTES => (24, DRAW_BYTES, MAGIC),
            TEXTURED_MAGIC | TEXTURED_DELTA_MAGIC => (32, TEXTURED_DRAW_BYTES, TEXTURED_MAGIC),
            SKIN_MAGIC | SKIN_DELTA_MAGIC => (SKIN_STRIDE, SKIN_DRAW_BYTES, SKIN_MAGIC),
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
        let id = word(bytes, 4);
        let base = if matches!(magic, DELTA_MAGIC | TEXTURED_DELTA_MAGIC | SKIN_DELTA_MAGIC) {
            let (prefix, tail) = rest.split_at_checked(4)?;
            let previous = word(prefix, 0);
            if previous == id { return None; }
            rest = tail;
            Some(previous)
        } else { None };
        let mut palettes = Vec::new();
        let mut pose_bytes = 0;
        if format == SKIN_MAGIC {
            let (length, content) = rest.split_at_checked(4)?;
            let count = word(length, 0) as usize;
            let (definitions, mut pose) = content.split_at_checked(content.len().checked_sub(count)?)?;
            rest = definitions;
            pose_bytes = count + 4;
            while !pose.is_empty() {
                if palettes.len() >= draw_count { return None; }
                let (head, tail) = pose.split_at_checked(4)?;
                let joints = word(head, 0) as usize;
                if !(1..=MAX_JOINTS).contains(&joints) { return None; }
                let (bytes, tail) = tail.split_at_checked(64 * joints)?;
                palettes.push(bytes.chunks_exact(64).map(|m| floats(m, 0)).collect::<Option<Vec<_>>>()?);
                pose = tail;
            }
        }
        let mut defined = BTreeSet::new();
        let mut geometry = Vec::with_capacity(geometry_count);
        for _ in 0..geometry_count {
            let header = rest.get(..12)?;
            let id = word(header, 0);
            let vertices = word(header, 4) as usize;
            let indices = word(header, 8) as usize;
            if id == 0 || !defined.insert(id) ||
                vertices < 3 || indices < 3 || indices % 3 != 0 {
                return None;
            }
            let (data, tail) = rest[12..].split_at_checked(vertices.checked_mul(stride)?)?;
            let (elements, tail) = tail.split_at_checked(indices.checked_mul(4)?)?;
            let mut required_joints = 0;
            for vertex in data.chunks_exact(stride) {
                if format == SKIN_MAGIC {
                    floats::<8>(vertex, 0)?;
                    let channels = floats::<8>(vertex, 36)?;
                    if !channels.iter().all(|value| (0. ..=1.).contains(value)) { return None; }
                    // All four shader reads must be in range, including zero-weight lanes.
                    required_joints = required_joints.max(1 + usize::from(*vertex[32..36].iter().max()?));
                } else if vertex.chunks_exact(4).any(|v| !f32::from_bits(word(v, 0)).is_finite()) {
                    return None;
                }
            }
            if required_joints > MAX_JOINTS { return None; }
            if elements.chunks_exact(4).any(|i| word(i, 0) as usize >= vertices) { return None; }
            geometry.push(Geometry { id, stride, required_joints, vertices: data, indices: elements });
            rest = tail;
        }
        if !rest.is_empty() { return None; }
        let mut live_ids = BTreeSet::new();
        let mut draws = Vec::with_capacity(draw_count);
        for d in bytes[draw_offset..hud_offset].chunks_exact(draw_bytes) {
            let geometry_id = word(d, 0);
            let albedo = radiance(d, 68)?;
            let [roughness, metallic] = floats(d, 80)?;
            live_ids.insert(geometry_id);
            if geometry_id == 0 || live_ids.len() > MAX_GEOMETRIES ||
                (base.is_none() && !defined.contains(&geometry_id)) ||
                !albedo.iter().chain([&roughness, &metallic]).all(|v| (0. ..=1.).contains(v)) {
                return None;
            }
            let (page, flags) = if format != MAGIC { (word(d, 88) as usize, word(d, 92)) } else { (0, 0) };
            let (metal_rough_page, normal_page, palette, normal_scale) = if format == SKIN_MAGIC {
                (word(d, 96) as usize, word(d, 100) as usize, word(d, 104) as usize, floats(d, 108)?)
            } else { (0, 0, 0, [1.; 2]) };
            if [page, normal_page, metal_rough_page].into_iter().any(|p| p >= crate::frame::PAGE_SLOTS)
                || flags > (if format == SKIN_MAGIC { 3 } else { 1 }) || palette > palettes.len() { return None; }
            draws.push(Draw { geometry: geometry_id, page, double_sided: flags & 1 != 0, vertex_colors: flags & 2 != 0,
                emissive: if format == SKIN_MAGIC { radiance(d, 116)? } else { [0.; 3] },
                metal_rough_page, normal_page, normal_scale, palette: palette.checked_sub(1),
                world: floats(d, 4)?, albedo, roughness, metallic });
        }
        // Full packets historically allow a definition with no draw. A delta is bounded by
        // its complete visible set: unused definitions cannot leave hidden resident meshes.
        if base.is_some() {
            if !defined.is_subset(&live_ids) { return None; }
        } else { live_ids = defined; }
        Some(Self {
            id, base, format, live_ids, palettes, pose_bytes,
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

    fn pose_fixture(delta: bool) -> Vec<u8> {
        let source = fixture();
        let mut bytes = source[..FRAME_HEADER].to_vec();
        set(&mut bytes, 0, if delta { SKIN_DELTA_MAGIC } else { SKIN_MAGIC });
        set(&mut bytes, 12, u32::from(!delta));
        set(&mut bytes, 16, 1);
        if delta { bytes.extend(37u32.to_le_bytes()); }
        bytes.extend(68u32.to_le_bytes());
        if !delta {
            for count in [17u32, 3, 3] { bytes.extend(count.to_le_bytes()); }
            for _ in 0..3 {
                let mut vertex = [0; SKIN_STRIDE];
                set(&mut vertex, 36, 1.0f32.to_bits());
                set(&mut vertex, 52, 0.5f32.to_bits());
                bytes.extend(vertex);
            }
            for i in [0u32, 1, 2] { bytes.extend(i.to_le_bytes()); }
        }
        bytes.extend(1u32.to_le_bytes());
        for i in 0..16 { bytes.extend((if i % 5 == 0 { 1f32 } else { 0. }).to_le_bytes()); }
        let mut draw = [0; SKIN_DRAW_BYTES];
        for (at, value) in [(0,17), (88,7), (92,3), (96,8), (100,9), (104,1),
            (108,1.0f32.to_bits()), (112,0.5f32.to_bits()), (116,2.0f32.to_bits())] {
            set(&mut draw, at, value);
        }
        bytes.extend(draw);
        bytes.extend(&source[source.len()-24..]);
        bytes
    }

    #[test]
    fn full_pose_keeps_material_views_and_bounds_shader_joint_reads() {
        let bytes = pose_fixture(false);
        let frame = WorldFrame::parse(&bytes).unwrap();
        assert_eq!(frame.format, SKIN_MAGIC);
        assert_eq!(frame.palettes[0][0][15], 1.);
        assert!(frame.valid_palettes(|_| None));
        let draw = &frame.draws[0];
        assert!(draw.vertex_colors && draw.double_sided);
        assert_eq!((draw.page, draw.metal_rough_page, draw.normal_page), (7, 8, 9));
        assert_eq!(draw.normal_scale, [1., 0.5]);
        assert_eq!(draw.emissive, [2., 0., 0.]);
        let first_vertex = FRAME_HEADER + 4 + 12;
        let pose = bytes.len() - 24 - SKIN_DRAW_BYTES - 68;
        let draw = pose + 68;
        for (at, value) in [(FRAME_HEADER, u32::MAX), (first_vertex + 36, (-1f32).to_bits()),
            (first_vertex + 40, 1.1f32.to_bits()), (first_vertex + 52, f32::NAN.to_bits()),
            (first_vertex + 56, (-0.1f32).to_bits()), (first_vertex + 64, 1.1f32.to_bits()),
            (first_vertex + 32, 56), (pose, 57), (pose + 4, f32::INFINITY.to_bits()),
            (draw + 96, 256), (draw + 100, 256), (draw + 104, 2), (draw + 112, f32::NAN.to_bits()),
            (draw + 116, (-0.5f32).to_bits())] {
            let mut bad = bytes.clone();
            set(&mut bad, at, value);
            assert!(WorldFrame::parse(&bad).is_none(), "offset {at}");
        }
        let mut bad = bytes;
        bad[first_vertex + 35] = 1; // Even the fourth zero-weight lane indexes the palette.
        assert!(!WorldFrame::parse(&bad).unwrap().valid_palettes(|_| None));
    }

    #[test]
    fn pose_only_delta_checks_resident_geometry_and_budgets_full_recovery() {
        let bytes = pose_fixture(true);
        let frame = WorldFrame::parse(&bytes).unwrap();
        assert!(frame.geometry.is_empty());
        assert!(frame.valid_palettes(|id| (id == 17).then_some(1)));
        assert!(!frame.valid_palettes(|_| Some(2)));
        let max_mesh = TEXTURED_LIMIT - FRAME_HEADER - 4 - 68 - SKIN_DRAW_BYTES - 24 - 12;
        assert_eq!(frame.validate_delta(Some((37, SKIN_MAGIC)), |_| Some(max_mesh)), Ok(()));
        assert_eq!(frame.validate_delta(Some((37, SKIN_MAGIC)), |_| Some(max_mesh + 1)), Err(DeltaError::OverBudget));
        assert_eq!(frame.validate_delta(Some((37, TEXTURED_MAGIC)), |_| Some(32)), Err(DeltaError::MissingBase));
    }

    #[test]
    fn budgets_every_mip_level_including_non_square_tails() {
        assert_eq!(mip_bytes([1, 1]), 4);
        assert_eq!(mip_bytes([5, 2]), (10 + 2 + 1) * 4);
        assert_eq!(mip_bytes([1, 7]), (7 + 3 + 1) * 4);
    }

    fn set(bytes: &mut [u8], offset: usize, value: u32) { bytes[offset..offset+4].copy_from_slice(&value.to_le_bytes()); }
    // A delta keeps the complete draw order and camera/HUD, even when it carries no geometry bytes.
    fn delta_fixture(define: bool) -> Vec<u8> {
        let source = fixture();
        let geometry_end = FRAME_HEADER + 12 + 3 * 24 + 3 * 4;
        let mut packet = source[..FRAME_HEADER].to_vec();
        set(&mut packet, 0, DELTA_MAGIC);
        set(&mut packet, 12, u32::from(define));
        packet.extend(37u32.to_le_bytes());
        if define { packet.extend(&source[FRAME_HEADER..geometry_end]); }
        packet.extend(&source[geometry_end..]);
        packet
    }

    #[test]
    fn camera_only_frame_requires_confirmed_matching_format_and_resident_mesh() {
        let packet = delta_fixture(false);
        let delta = WorldFrame::parse(&packet).unwrap();
        assert_eq!(delta.id, 38);
        assert_eq!(delta.base, Some(37));
        assert!(delta.geometry.is_empty());
        assert_eq!(delta.live_ids, BTreeSet::from([17]));
        let resident = |id| (id == 17).then_some(84);
        assert_eq!(delta.validate_delta(Some((37, MAGIC)), resident), Ok(()));
        for previous in [None, Some((36, MAGIC)), Some((37, TEXTURED_MAGIC))] {
            assert_eq!(delta.validate_delta(previous, resident), Err(DeltaError::MissingBase));
        }
        assert_eq!(delta.validate_delta(Some((37, MAGIC)), |_| None), Err(DeltaError::MissingBase));
        assert_eq!(delta.validate_delta(Some((37, MAGIC)), |_| Some(usize::MAX)), Err(DeltaError::OverBudget));
        let full_bytes = fixture();
        let full = WorldFrame::parse(&full_bytes).unwrap();
        assert_eq!(full.validate_delta(None, |_| None), Ok(())); // An empty/recreated EGL generation can replay it.
        assert_eq!(delta.overlay, full.overlay);
    }

    #[test]
    fn delta_is_bounded_by_visible_definitions_even_if_little_crossed_the_bridge() {
        let packet = delta_fixture(false);
        let delta = WorldFrame::parse(&packet).unwrap();
        let overhead = FRAME_HEADER + 2 * DRAW_BYTES + 24 + 12;
        let available = crate::frame::MAX_FRAME_BYTES - overhead;
        assert_eq!(delta.validate_delta(Some((37, MAGIC)), |_| Some(available)), Ok(()));
        assert_eq!(delta.validate_delta(Some((37, MAGIC)), |_| Some(available + 1)), Err(DeltaError::OverBudget));

        let mut changed = delta_fixture(true);
        // Define one new mesh and reference the previous one in the same ordered draw list.
        set(&mut changed, FRAME_HEADER + 4, 18);
        let first_draw = changed.len() - 24 - 2 * DRAW_BYTES;
        set(&mut changed, first_draw, 18);
        let delta = WorldFrame::parse(&changed).unwrap();
        assert_eq!(delta.geometry.len(), 1);
        assert_eq!(delta.live_ids, BTreeSet::from([17, 18]));
        assert_eq!(delta.validate_delta(Some((37, MAGIC)), |id| (id == 17).then_some(84)), Ok(()));
        assert_eq!(delta.validate_delta(Some((37, MAGIC)), |_| None), Err(DeltaError::MissingBase));
        set(&mut changed, first_draw, 17);
        assert!(WorldFrame::parse(&changed).is_none()); // The changed definition is no longer referenced.
        set(&mut changed, first_draw, 18);
        set(&mut changed, FRAME_HEADER, 38);
        assert!(WorldFrame::parse(&changed).is_none()); // Reusing this frame's own token is ambiguous.
        for length in 0..packet.len() { assert!(WorldFrame::parse(&packet[..length]).is_none()); }
    }

    #[test]
    fn textured_delta_uses_the_textured_draw_layout_and_an_empty_visible_set_retires_all_meshes() {
        let source = delta_fixture(false);
        let mut bytes = source[..FRAME_HEADER + 4].to_vec();
        set(&mut bytes, 0, TEXTURED_DELTA_MAGIC);
        for draw in source[FRAME_HEADER + 4..source.len() - 24].chunks_exact(DRAW_BYTES) {
            bytes.extend(draw);
            bytes.extend(4u32.to_le_bytes());
            bytes.extend(1u32.to_le_bytes());
        }
        bytes.extend(&source[source.len() - 24..]);
        let frame = WorldFrame::parse(&bytes).unwrap();
        assert_eq!(frame.validate_delta(Some((37, TEXTURED_MAGIC)), |_| Some(108)), Ok(()));
        assert_eq!(frame.draws[0].page, 4);
        assert!(frame.draws[1].double_sided);
        let mut empty = bytes[..FRAME_HEADER + 4].to_vec();
        set(&mut empty, 16, 0);
        empty.extend(&source[source.len() - 24..]);
        let frame = WorldFrame::parse(&empty).unwrap();
        assert!(frame.live_ids.is_empty());
        assert_eq!(frame.validate_delta(Some((37, TEXTURED_MAGIC)), |_| None), Ok(()));
    }

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
