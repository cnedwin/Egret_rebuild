// SPDX-License-Identifier: Apache-2.0
//! Bounded, backend-neutral access to the same decoded project quads used on Android.
use crate::frame::{self, Batch, Vertex, MAX_DIMENSION, MAX_FRAME_BYTES, PAGE_SLOTS};
use std::slice;

pub struct EgretFrame2D {
    pages: [[u32; 2]; PAGE_SLOTS],
    vertices: Vec<Vertex>,
    batches: Vec<Batch>,
    draws: Vec<EgretDraw2D>,
}

#[repr(C)]
pub struct EgretDraw2D {
    page: u32,
    first: u32,
    count: u32,
    opacity: f32,
    region: [f32; 4],
    scissor: [u32; 4],
}

#[repr(C)]
#[derive(Default)]
pub struct EgretDecoded2D {
    logical_size: [f32; 2],
    clear_rgba: [u8; 4],
    vertices: *const Vertex,
    draws: *const EgretDraw2D,
    vertex_count: usize,
    draw_count: usize,
}

#[no_mangle]
pub extern "C" fn egret_frame2d_create() -> *mut EgretFrame2D {
    Box::into_raw(Box::new(EgretFrame2D {
        pages: [[0; 2]; PAGE_SLOTS],
        vertices: Vec::new(),
        batches: Vec::new(),
        draws: Vec::new(),
    }))
}

#[no_mangle]
pub unsafe extern "C" fn egret_frame2d_destroy(decoder: *mut EgretFrame2D) {
    if !decoder.is_null() {
        drop(Box::from_raw(decoder));
    }
}

#[no_mangle]
pub unsafe extern "C" fn egret_frame2d_page(
    decoder: *mut EgretFrame2D, slot: u32, width: u32, height: u32,
) -> i32 {
    let Some(state) = decoder.as_mut() else { return 1; };
    if !(1..PAGE_SLOTS as u32).contains(&slot) || (width == 0) != (height == 0)
        || width > MAX_DIMENSION || height > MAX_DIMENSION {
        return 1;
    }
    state.pages[slot as usize] = [width, height];
    0
}

#[no_mangle]
pub unsafe extern "C" fn egret_frame2d_decode(
    decoder: *mut EgretFrame2D, packet: *const u8, length: usize,
    width: u32, height: u32, out: *mut EgretDecoded2D,
) -> i32 {
    let Some(output) = out.as_mut() else { return 1; };
    *output = EgretDecoded2D::default();
    let Some(state) = decoder.as_mut() else { return 1; };
    if packet.is_null() || !(frame::HEADER_BYTES..=MAX_FRAME_BYTES).contains(&length)
        || !(1..=MAX_DIMENSION).contains(&width) || !(1..=MAX_DIMENSION).contains(&height) {
        return 1;
    }
    let bytes = slice::from_raw_parts(packet, length);
    if &bytes[..4] != b"EGR2" || bytes[16] != 255 { return 1; }
    let header = match frame::prepare_lit_frame(bytes, &state.pages, &mut state.vertices, &mut state.batches,
                                                 &mut Vec::new(), &mut Vec::new()) {
        Ok(header) => header,
        Err(error) => return error as i32,
    };
    state.draws.clear();
    for batch in &state.batches {
        let [x, bottom, w, h] = batch.scissor(header.size, [width, height]);
        state.draws.push(EgretDraw2D {
            page: batch.page as u32, first: batch.first as u32, count: batch.count as u32,
            opacity: batch.opacity, region: batch.region,
            scissor: [x as u32, height - (bottom + h) as u32, w as u32, h as u32],
        });
    }
    *output = EgretDecoded2D {
        logical_size: header.size, clear_rgba: header.clear,
        vertices: state.vertices.as_ptr(), vertex_count: state.vertices.len(),
        draws: state.draws.as_ptr(), draw_count: state.draws.len(),
    };
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn admission_lifetime_and_top_left_coordinates_survive_release_and_republish() {
        assert_eq!(std::mem::size_of::<Vertex>(), 20);
        assert_eq!(std::mem::size_of::<EgretDraw2D>(), 48);
        let mut words = vec![u32::from_le_bytes(*b"EGR2"), 1, 16, 8, 0x112233ff, 1, 0xffffff01];
        words.extend([1., 0., 0., 8., 0., 0., 8., 0., 0., 1., 1., 2., 1., 6., 3.].map(f32::to_bits));
        let mut bytes: Vec<u8> = words.iter().flat_map(|w| w.to_le_bytes()).collect();
        unsafe {
            let state = egret_frame2d_create();
            let mut out = EgretDecoded2D::default();
            let run = |bytes: &[u8], out: &mut _| egret_frame2d_decode(state, bytes.as_ptr(), bytes.len(), 32, 16, out);
            assert_eq!(run(&bytes, &mut out), 2);
            assert!(out.vertices.is_null());
            for _ in 0..2 {
                assert_eq!(egret_frame2d_page(state, 1, 8, 8), 0);
                assert_eq!(run(&bytes, &mut out), 0);
                assert_eq!(out.vertex_count, 6);
                assert_eq!(out.draw_count, 1);
                assert_eq!((*out.draws).scissor, [4, 2, 8, 4]);
                assert_eq!(out.clear_rgba, [0x11, 0x22, 0x33, 0xff]);
                assert_eq!(egret_frame2d_page(state, 1, 0, 0), 0);
                assert_eq!(run(&bytes, &mut out), 2);
                assert!(out.draws.is_null());
            }
            bytes[3] = b'6';
            assert_eq!(run(&bytes, &mut out), 1);
            egret_frame2d_destroy(state);
        }
    }
}
