// SPDX-License-Identifier: Apache-2.0
//! Optional LIT1 payload between the draw table and the existing transparent HUD.
use super::{floats, radiance, word};

#[derive(Default)]
pub(crate) struct Lighting {
    pub enabled: bool,
    pub fog_density: f32,
    pub fog_color: [f32; 3],
    pub shadow_size: u32,
    pub shadow_matrix: [f32; 16],
    pub shadow_params: [f32; 3],
    pub fill_direction: [f32; 3],
    pub fill_color: [f32; 3],
    pub points: Vec<[f32; 7]>,
}

impl Lighting {
    pub fn parse(bytes: &[u8], draws: usize) -> Option<(Self, &[u8])> {
        if bytes.is_empty() { return Some((Self::default(), &[])); }
        if bytes.len() < 128 || word(bytes, 0) != u32::from_le_bytes(*b"LIT1") { return None; }
        let count = word(bytes, 4) as usize;
        let size = word(bytes, 8);
        if count > 8 || (size != 0 && (!(64..=2048).contains(&size) || !size.is_power_of_two())) { return None; }
        let flags = 128 + count * 28;
        if bytes.len() != flags + draws.next_multiple_of(4) { return None; }
        let [density] = floats(bytes, 12)?;
        let params: [f32; 3] = floats(bytes, 28)?;
        if density < 0. || params[1] < 0. || params[2] < 0. { return None; }
        let mut points = Vec::with_capacity(count);
        for index in 0..count {
            let point: [f32; 7] = floats(bytes, 128 + index * 28)?;
            if point[3..].iter().any(|&component| component < 0.) { return None; }
            points.push(point);
        }
        let (policies, padding) = bytes[flags..].split_at(draws);
        if padding.iter().any(|&b| b != 0) || policies.iter().any(|&policy|
            policy & !15 != 0 || (policy & 8 != 0 && policy & 1 == 0) ||
            (size == 0 && policy & (1 | 2 | 8) != 0)) { return None; }
        Some((Self { enabled: true, fog_density: density, fog_color: radiance(bytes, 16)?, shadow_size: size,
            shadow_matrix: floats(bytes, 40)?, shadow_params: params, fill_direction: floats(bytes, 104)?,
            fill_color: radiance(bytes, 116)?, points }, policies))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reads_a_bounded_environment_and_refuses_truncation_nonfinite_and_invalid_draw_roles() {
        let mut bytes = vec![0u8; 128 + 28 + 4];
        bytes[..4].copy_from_slice(b"LIT1");
        bytes[4..8].copy_from_slice(&1u32.to_le_bytes());
        bytes[8..12].copy_from_slice(&1024u32.to_le_bytes());
        bytes[12..16].copy_from_slice(&0.016f32.to_le_bytes());
        bytes[140..144].copy_from_slice(&8f32.to_le_bytes());
        bytes[156..158].copy_from_slice(&[7, 9]);
        let (light, flags) = Lighting::parse(&bytes, 2).unwrap();
        assert_eq!((light.shadow_size, light.fog_density, light.points[0][3], flags), (1024, 0.016, 8., &[7,9][..]));
        for length in 1..bytes.len() { assert!(Lighting::parse(&bytes[..length], 2).is_none()); }
        for (offset, bad) in [(4, 9u32), (8, 63), (12, f32::NAN.to_bits()), (16, (-1f32).to_bits()),
                (40, f32::INFINITY.to_bits()), (140, (-2f32).to_bits()), (156, 8), (156, 0x10000)] {
            let mut copy = bytes.clone();
            copy[offset..offset+4].copy_from_slice(&bad.to_le_bytes());
            assert!(Lighting::parse(&copy, 2).is_none());
        }
    }
}
