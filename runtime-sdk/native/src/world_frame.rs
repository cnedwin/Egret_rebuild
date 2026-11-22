// SPDX-License-Identifier: Apache-2.0
//! E3D1/2 are self-contained. E3D3/4 add a confirmed predecessor and send
//! only the changed definitions, with a complete visible draw list and overlay.
use std::collections::{BTreeMap, BTreeSet};

pub(crate) const MAGIC: u32 = u32::from_le_bytes(*b"E3D1");
pub(crate) const TEXTURED_MAGIC: u32 = u32::from_le_bytes(*b"E3D2");
pub(crate) const DELTA_MAGIC: u32 = u32::from_le_bytes(*b"E3D3");
pub(crate) const TEXTURED_DELTA_MAGIC: u32 = u32::from_le_bytes(*b"E3D4");
pub(crate) const SKIN_MAGIC: u32 = u32::from_le_bytes(*b"E3D5");
pub(crate) const SKIN_DELTA_MAGIC: u32 = u32::from_le_bytes(*b"E3D6");
pub(crate) const RESIDENT_MAGIC: u32 = u32::from_le_bytes(*b"E3D7");
const GEOMETRY_BATCH_MAGIC: u32 = u32::from_le_bytes(*b"E3G1");
const GEOMETRY_LIMIT: usize = 16 * 1024 * 1024;
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
    pub batches: Option<u32>,
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

fn geometry_list(mut rest: &[u8], geometry_count: usize, stride: usize) -> Option<(BTreeSet<u32>, Vec<Geometry<'_>>)> {
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
            if stride == SKIN_STRIDE {
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
    Some((defined, geometry))
}

pub(crate) struct GeometryBatch<'a> {
    pub target: u32,
    pub ordinal: u32,
    pub total: u32,
    pub geometry: Vec<Geometry<'a>>,
    ids: BTreeSet<u32>,
    definition_bytes: usize,
}

impl<'a> GeometryBatch<'a> {
    pub fn parse(bytes: &'a [u8]) -> Option<Self> {
        if !(24..=TEXTURED_LIMIT).contains(&bytes.len()) || word(bytes, 0) != GEOMETRY_BATCH_MAGIC
            || word(bytes, 20) != SKIN_MAGIC { return None; }
        let ordinal = word(bytes, 8);
        let total = word(bytes, 12);
        let count = word(bytes, 16) as usize;
        if total as usize > MAX_GEOMETRIES || ordinal >= total || !(1..=MAX_GEOMETRIES).contains(&count) { return None; }
        let (ids, geometry) = geometry_list(&bytes[24..], count, SKIN_STRIDE)?;
        Some(Self { target: word(bytes, 4), ordinal, total, ids, geometry, definition_bytes: bytes.len() - 24 })
    }
}

#[derive(Default)]
pub(crate) struct UploadSequence {
    target: u32,
    next: u32,
    total: u32,
    bytes: usize,
    ids: BTreeSet<u32>,
}

impl UploadSequence {
    // The host starts ordinal zero in an empty temporary generation. Never mix
    // definitions from interrupted frames or overwrite a duplicate identity.
    pub fn append(&mut self, batch: &GeometryBatch<'_>) -> bool {
        if batch.ordinal != self.next || (self.next != 0 && (batch.target != self.target || batch.total != self.total))
            || batch.definition_bytes > GEOMETRY_LIMIT - self.bytes || self.ids.len() + batch.ids.len() > MAX_GEOMETRIES
            || !self.ids.is_disjoint(&batch.ids) { return false; }
        self.target = batch.target;
        self.total = batch.total;
        self.next += 1;
        self.bytes += batch.definition_bytes;
        self.ids.extend(&batch.ids);
        true
    }

    pub fn complete(&self, frame: &WorldFrame<'_>) -> bool {
        frame.batches == Some(self.total) && self.next == self.total
            && (self.total == 0 || self.target == frame.id) && self.ids.is_subset(&frame.live_ids)
            && (frame.base.is_some() || self.ids == frame.live_ids)
    }
}

// This is the staging boundary used by the C entry point. A zero ordinal
// begins only an empty transaction. Any failure retires the entire candidate.
pub(crate) struct StagedMeshes<M> {
    sequence: UploadSequence,
    pub meshes: BTreeMap<u32, M>,
}

impl<M> Default for StagedMeshes<M> {
    fn default() -> Self { Self { sequence: UploadSequence::default(), meshes: BTreeMap::new() } }
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum StageError { Invalid, Upload }

impl<M> StagedMeshes<M> {
    pub fn clear_with(&mut self, destroy: impl FnMut(&M)) {
        self.meshes.values().for_each(destroy);
        self.meshes.clear();
        self.sequence = UploadSequence::default();
    }

    pub fn stage(&mut self, bytes: &[u8], mut upload: impl FnMut(&Geometry<'_>) -> Option<M>,
                 destroy: impl FnMut(&M)) -> Result<(), StageError> {
        let result = (|| {
            let batch = GeometryBatch::parse(bytes).ok_or(StageError::Invalid)?;
            if !self.sequence.append(&batch) { return Err(StageError::Invalid); }
            for definition in &batch.geometry {
                self.meshes.insert(definition.id, upload(definition).ok_or(StageError::Upload)?);
            }
            Ok(())
        })();
        if result.is_err() { self.clear_with(destroy); }
        result
    }

    pub fn complete(&self, frame: &WorldFrame<'_>) -> bool { self.sequence.complete(frame) }
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum DeltaError { MissingBase, OverBudget }

impl<'a> WorldFrame<'a> {
    /// Validate references and the size of the equivalent full packet before issuing any GL calls.
    pub fn validate_delta(&self, previous: Option<(u32, u32)>, resident_bytes: impl Fn(u32) -> Option<usize>) -> Result<(), DeltaError> {
        if let Some(base) = self.base {
            if previous != Some((base, self.format)) { return Err(DeltaError::MissingBase); }
        } else if self.batches.is_none() { return Ok(()); }
        let draw_bytes = match self.format { SKIN_MAGIC => SKIN_DRAW_BYTES, TEXTURED_MAGIC => TEXTURED_DRAW_BYTES, _ => DRAW_BYTES };
        let limit = match self.format { MAGIC => crate::frame::MAX_FRAME_BYTES, RESIDENT_MAGIC => GEOMETRY_LIMIT, _ => TEXTURED_LIMIT };
        let mut size = FRAME_HEADER + self.pose_bytes + self.overlay.len() + self.draws.len() * draw_bytes;
        // E3D7 has separate wire and residency limits and never rebuilds an oversized packet.
        if self.batches.is_some() { size = 0; }
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
            RESIDENT_MAGIC => (SKIN_STRIDE, SKIN_DRAW_BYTES, RESIDENT_MAGIC),
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
        let mut batches = None;
        let base = if format == RESIDENT_MAGIC {
            let (header, tail) = rest.split_at_checked(12)?;
            let flags = word(header, 0);
            let prior = word(header, 4);
            let count = word(header, 8);
            if geometry_count != 0 || flags > 1 || count as usize > MAX_GEOMETRIES ||
                (flags == 1 && prior != 0) || (flags == 0 && prior == id) { return None; }
            batches = Some(count);
            rest = tail;
            if flags == 0 { Some(prior) } else { None }
        } else { base };
        let mut palettes = Vec::new();
        let mut pose_bytes = 0;
        if stride == SKIN_STRIDE {
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
        let (defined, geometry) = geometry_list(rest, geometry_count, stride)?;
        let mut live_ids = BTreeSet::new();
        let mut draws = Vec::with_capacity(draw_count);
        for d in bytes[draw_offset..hud_offset].chunks_exact(draw_bytes) {
            let geometry_id = word(d, 0);
            let albedo = radiance(d, 68)?;
            let [roughness, metallic] = floats(d, 80)?;
            live_ids.insert(geometry_id);
            if geometry_id == 0 || live_ids.len() > MAX_GEOMETRIES ||
                (base.is_none() && batches.is_none() && !defined.contains(&geometry_id)) ||
                !albedo.iter().chain([&roughness, &metallic]).all(|v| (0. ..=1.).contains(v)) {
                return None;
            }
            let (page, flags) = if format != MAGIC { (word(d, 88) as usize, word(d, 92)) } else { (0, 0) };
            let (metal_rough_page, normal_page, palette, normal_scale) = if stride == SKIN_STRIDE {
                (word(d, 96) as usize, word(d, 100) as usize, word(d, 104) as usize, floats(d, 108)?)
            } else { (0, 0, 0, [1.; 2]) };
            if [page, normal_page, metal_rough_page].into_iter().any(|p| p >= crate::frame::PAGE_SLOTS)
                || flags > (if stride == SKIN_STRIDE { 3 } else { 1 }) || palette > palettes.len() { return None; }
            draws.push(Draw { geometry: geometry_id, page, double_sided: flags & 1 != 0, vertex_colors: flags & 2 != 0,
                emissive: if stride == SKIN_STRIDE { radiance(d, 116)? } else { [0.; 3] },
                metal_rough_page, normal_page, normal_scale, palette: palette.checked_sub(1),
                world: floats(d, 4)?, albedo, roughness, metallic });
        }
        // Full packets historically allow a definition with no draw. A delta is bounded by
        // its complete visible set: unused definitions cannot leave hidden resident meshes.
        if base.is_some() || batches.is_some() {
            if !defined.is_subset(&live_ids) { return None; }
        } else { live_ids = defined; }
        Some(Self {
            id, base, format, batches, live_ids, palettes, pose_bytes,
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

    // An E3D7 reset is a compact scene description: it cannot become visible
    // until every definition has arrived via ordered, independently bounded batches.
    fn batch_packet(target: u32, ordinal: u32, count: u32, geometry_id: u32) -> Vec<u8> {
        let full = pose_fixture(false);
        let mut bytes = Vec::new();
        for field in [GEOMETRY_BATCH_MAGIC, target, ordinal, count, 1, SKIN_MAGIC] {
            bytes.extend(field.to_le_bytes());
        }
        bytes.extend(&full[164..164 + 12 + 3 * SKIN_STRIDE + 12]);
        set(&mut bytes, 24, geometry_id);
        bytes
    }

    fn resident_frame(reset: bool, count: u32) -> Vec<u8> {
        let compact = pose_fixture(true);
        let mut bytes = compact[..FRAME_HEADER].to_vec();
        set(&mut bytes, 0, RESIDENT_MAGIC);
        for word in [u32::from(reset), if reset { 0 } else { 37 }, count] { bytes.extend(word.to_le_bytes()); }
        bytes.extend(&compact[FRAME_HEADER + 4..]);
        bytes
    }

    #[test]
    fn staged_packets_are_ordered_and_recover_with_a_complete_reset() {
        let bytes0 = batch_packet(38, 0, 2, 17);
        let bytes1 = batch_packet(38, 1, 2, 18);
        let first = GeometryBatch::parse(&bytes0).unwrap();
        let second = GeometryBatch::parse(&bytes1).unwrap();
        let mut sequence = UploadSequence::default();
        assert!(!sequence.append(&second));
        assert!(sequence.append(&first));
        assert!(!sequence.append(&first));
        for replacement in [batch_packet(39, 1, 2, 18), batch_packet(38, 1, 3, 18), batch_packet(38, 1, 2, 17)] {
            assert!(!sequence.append(&GeometryBatch::parse(&replacement).unwrap()));
        }
        let mut bytes = resident_frame(true, 2);
        let draw_offset = bytes.len() - 24 - SKIN_DRAW_BYTES;
        let draw2 = bytes[draw_offset..draw_offset + SKIN_DRAW_BYTES].to_vec();
        bytes.splice(draw_offset..draw_offset, draw2);
        set(&mut bytes, 16, 2);
        set(&mut bytes, draw_offset, 18);
        let scene = WorldFrame::parse(&bytes).unwrap();
        assert!(!sequence.complete(&scene));
        assert!(sequence.append(&second));
        assert!(sequence.complete(&scene));
        assert_eq!(scene.validate_delta(None, |_| Some(TEXTURED_LIMIT - 128)), Ok(()));
        assert_eq!(scene.validate_delta(None, |_| Some(GEOMETRY_LIMIT / 2 - 11)), Err(DeltaError::OverBudget));
        assert!(scene.valid_palettes(|_| Some(1)));
        let mut changed = bytes.clone();
        set(&mut changed, draw_offset, 19);
        assert!(!sequence.complete(&WorldFrame::parse(&changed).unwrap()));
        set(&mut changed, 4, 39);
        let hud = changed.len() - 24;
        set(&mut changed, hud + 4, 39);
        assert!(!sequence.complete(&WorldFrame::parse(&changed).unwrap()));
        assert!(GeometryBatch::parse(&vec![0; TEXTURED_LIMIT + 1]).is_none());
        for end in 0..bytes0.len() { assert!(GeometryBatch::parse(&bytes0[..end]).is_none()); }
    }

    #[test]
    fn c_staging_rejects_duplicate_first_packet_and_releases_only_candidate_names() {
        let first = batch_packet(38, 0, 2, 17);
        let second = batch_packet(38, 1, 2, 18);
        let mut staged = StagedMeshes::default();
        let mut retired = Vec::new();
        let mut uploaded = Vec::new();
        let mut stage = |state: &mut StagedMeshes<u32>, packet: &[u8]| state.stage(packet,
            |mesh| { uploaded.push(mesh.id); Some(mesh.id) }, |name| retired.push(*name));
        assert_eq!(stage(&mut staged, &first), Ok(()));
        assert_eq!(stage(&mut staged, &first), Err(StageError::Invalid));
        assert!(staged.meshes.is_empty());
        assert_eq!(stage(&mut staged, &second), Err(StageError::Invalid));
        assert_eq!(stage(&mut staged, &first), Ok(()));
        assert_eq!(stage(&mut staged, &second), Ok(()));
        assert_eq!(retired, [17]);
        assert_eq!(uploaded, [17, 17, 18]);
        assert_eq!(staged.meshes.len(), 2);
    }

    #[test]
    fn incremental_resident_frame_requires_exact_format_and_only_current_visible_ids() {
        let bytes = resident_frame(false, 0);
        let scene = WorldFrame::parse(&bytes).unwrap();
        assert!(UploadSequence::default().complete(&scene));
        assert_eq!(scene.validate_delta(Some((37, RESIDENT_MAGIC)), |_| Some(200)), Ok(()));
        assert_eq!(scene.validate_delta(Some((37, SKIN_MAGIC)), |_| Some(200)), Err(DeltaError::MissingBase));
        assert_eq!(scene.validate_delta(None, |_| Some(200)), Err(DeltaError::MissingBase));
        assert_eq!(scene.validate_delta(Some((37, RESIDENT_MAGIC)), |_| None), Err(DeltaError::MissingBase));
        let reset_bytes = resident_frame(true, 0);
        assert!(!UploadSequence::default().complete(&WorldFrame::parse(&reset_bytes).unwrap()));
        for (at, bad) in [(12, 1), (160, 2), (164, 38), (168, 65)] {
            let mut invalid = bytes.clone();
            set(&mut invalid, at, bad);
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
