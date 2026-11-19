// SPDX-License-Identifier: Apache-2.0

use std::sync::OnceLock;

pub(crate) fn decode_srgb(code: u8) -> f64 {
    let x = f64::from(code) / 255.;
    if x <= 0.04045 { x / 12.92 } else { ((x + 0.055) / 1.055).powf(2.4) }
}

fn encode_srgb(x: f64) -> f64 {
    if x <= 0.0031308 { 12.92 * x } else { 1.055 * x.powf(1. / 2.4) - 0.055 }
}

/// Owned canonical bytes for a translucent page; opaque input is already canonical.
pub(crate) fn canonical_page(rgba: &[u8]) -> Option<Vec<u8>> {
    if rgba.chunks_exact(4).all(|p| p[3] == 255) { return None; }
    static TABLE: OnceLock<Vec<u8>> = OnceLock::new();
    let table = TABLE.get_or_init(|| {
        let linear: [f64; 256] = std::array::from_fn(|i| decode_srgb(i as u8));
        let mut lut = Vec::with_capacity(256*256);
        for alpha in 0..=255 {
            let a = f64::from(alpha) / 255.;
            let cap = linear.partition_point(|v| *v <= a) - 1;
            for &v in &linear {
                lut.push(((encode_srgb(v*a)*255.).round() as usize).min(cap) as u8);
            }
        }
        lut
    });
    let mut result = rgba.to_vec();
    for pixel in result.chunks_exact_mut(4) {
        let row = usize::from(pixel[3]) << 8;
        for c in &mut pixel[..3] { *c = table[row + usize::from(*c)]; }
    }
    Some(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonical_upload_clears_hidden_rgb_and_caps_premultiplied_linear_channels() {
        assert_eq!(canonical_page(&[255, 30, 4, 0, 255, 128, 0, 128, 13, 19, 199, 255]).unwrap(),
            [0, 0, 0, 0, 187, 93, 0, 128, 13, 19, 199, 255]);
        assert!(canonical_page(&[99, 71, 0, 255]).is_none());
    }
}
