// SPDX-License-Identifier: Apache-2.0
//! Base64 for one bounded package-reader chunk. Both the scalar and arm64 paths
//! write directly into the caller's destination; neither allocates or appends a NUL.

use core::mem::MaybeUninit;

const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const MAX_INPUT: usize = 64 * 1024;

fn scalar(input: &[u8], output: &mut [MaybeUninit<u8>]) {
    let mut chunks = input.chunks_exact(3);
    let mut dest = output.chunks_exact_mut(4);
    for triple in chunks.by_ref() {
        let a = triple[0];
        let b = triple[1];
        let c = triple[2];
        let out = dest.next().unwrap();
        out[0].write(ALPHABET[(a >> 2) as usize]);
        out[1].write(ALPHABET[(((a & 3) << 4) | (b >> 4)) as usize]);
        out[2].write(ALPHABET[(((b & 15) << 2) | (c >> 6)) as usize]);
        out[3].write(ALPHABET[(c & 63) as usize]);
    }
    let tail = chunks.remainder();
    if let Some(&a) = tail.first() {
        let b = tail.get(1).copied().unwrap_or(0);
        let out = dest.next().unwrap();
        out[0].write(ALPHABET[(a >> 2) as usize]);
        out[1].write(ALPHABET[(((a & 3) << 4) | (b >> 4)) as usize]);
        out[2].write(if tail.len() == 2 {
            ALPHABET[((b & 15) << 2) as usize]
        } else {
            b'='
        });
        out[3].write(b'=');
    }
}

#[cfg(target_arch = "aarch64")]
#[target_feature(enable = "neon")]
unsafe fn encode(input: &[u8], output: &mut [MaybeUninit<u8>]) {
    use core::arch::aarch64::*;
    let blocks = input.len() / 48;
    if blocks != 0 {
        let table = vld1q_u8_x4(ALPHABET.as_ptr());
        // Each iteration reads sixteen triples and stores sixteen Base64 quads.
        for i in 0..blocks {
            let uint8x16x3_t(a, b, c) = vld3q_u8(input.as_ptr().add(i * 48));
            let indices = uint8x16x4_t(
                vqtbl4q_u8(table, vshrq_n_u8::<2>(a)),
                vqtbl4q_u8(
                    table,
                    vorrq_u8(
                        vshlq_n_u8::<4>(vandq_u8(a, vdupq_n_u8(3))),
                        vshrq_n_u8::<4>(b),
                    ),
                ),
                vqtbl4q_u8(
                    table,
                    vorrq_u8(
                        vshlq_n_u8::<2>(vandq_u8(b, vdupq_n_u8(15))),
                        vshrq_n_u8::<6>(c),
                    ),
                ),
                vqtbl4q_u8(table, vandq_u8(c, vdupq_n_u8(63))),
            );
            vst4q_u8(output.as_mut_ptr().add(i * 64).cast::<u8>(), indices);
        }
    }
    scalar(&input[blocks * 48..], &mut output[blocks * 64..]);
}

/// # Safety
/// For a nonempty valid request, source and output must be disjoint
/// readable/writable ranges of at least length and encoded length, respectively.
#[no_mangle]
pub unsafe extern "C" fn egret_chunk_encode_base64(
    source: *const u8,
    length: usize,
    output: *mut u8,
    capacity: usize,
) -> i32 {
    if length > MAX_INPUT {
        return 1;
    }
    let required = length.div_ceil(3) * 4;
    if required == 0 {
        return 0;
    }
    if source.is_null() || output.is_null() || capacity < required {
        return 1;
    }
    let input = core::slice::from_raw_parts(source, length);
    let dest = core::slice::from_raw_parts_mut(output.cast::<MaybeUninit<u8>>(), required);
    // Advanced SIMD is part of Android's arm64-v8a ABI and Apple's arm64 ABI.
    #[cfg(target_arch = "aarch64")]
    encode(input, dest);
    #[cfg(not(target_arch = "aarch64"))]
    scalar(input, dest);
    0
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ptr::{null, null_mut};

    fn encode_bytes(bytes: &[u8]) -> Vec<u8> {
        let size = bytes.len().div_ceil(3) * 4;
        let mut dest = vec![0xd5; size + 2];
        let result = unsafe {
            egret_chunk_encode_base64(bytes.as_ptr(), bytes.len(), dest[1..].as_mut_ptr(), size)
        };
        assert_eq!(result, 0);
        assert_eq!((dest[0], dest[size + 1]), (0xd5, 0xd5));
        dest[1..1 + size].to_vec()
    }

    #[test]
    fn standard_vectors_and_unaligned_prefixes() {
        for (input, expected) in [
            ("", ""),
            ("f", "Zg=="),
            ("fo", "Zm8="),
            ("foo", "Zm9v"),
            ("foob", "Zm9vYg=="),
            ("fooba", "Zm9vYmE="),
            ("foobar", "Zm9vYmFy"),
        ] {
            assert_eq!(encode_bytes(input.as_bytes()), expected.as_bytes());
        }
        let data: Vec<u8> = (0..MAX_INPUT + 1).map(|i| (i * 73 + i / 7) as u8).collect();
        for n in (0..=257).chain(MAX_INPUT - 64..=MAX_INPUT) {
            let input = &data[1..1 + n];
            let actual = encode_bytes(input);
            let mut expected = vec![0u8; actual.len()];
            // The scalar reference also accepts uninitialized foreign destinations.
            let reference = unsafe {
                core::slice::from_raw_parts_mut(
                    expected.as_mut_ptr().cast::<MaybeUninit<u8>>(),
                    expected.len(),
                )
            };
            scalar(input, reference);
            assert_eq!(actual, expected);
        }
    }

    #[test]
    fn rejects_bad_ranges_before_reading_or_writing() {
        let input = [0u8; 3];
        let mut dest = [0x7c; 4];
        unsafe {
            assert_eq!(egret_chunk_encode_base64(null(), 0, null_mut(), 0), 0);
            assert_eq!(
                egret_chunk_encode_base64(input.as_ptr(), 3, dest.as_mut_ptr(), 3),
                1
            );
            assert_eq!(
                egret_chunk_encode_base64(null(), 1, dest.as_mut_ptr(), 4),
                1
            );
            assert_eq!(
                egret_chunk_encode_base64(input.as_ptr(), 3, null_mut(), 4),
                1
            );
            assert_eq!(
                egret_chunk_encode_base64(
                    input.as_ptr(),
                    MAX_INPUT + 1,
                    dest.as_mut_ptr(),
                    usize::MAX
                ),
                1
            );
            assert_eq!(
                egret_chunk_encode_base64(null(), usize::MAX, null_mut(), usize::MAX),
                1
            );
        }
        assert_eq!(dest, [0x7c; 4]);
    }
}
