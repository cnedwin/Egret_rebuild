// SPDX-License-Identifier: Apache-2.0
//! Admission uses physical attachment bytes before any GLES allocation or draw.
use crate::frame::{Batch, ProjectEffect, EFFECT_ENTER, EFFECT_EXIT};

const WORKING_SET_BYTES: u64 = 64 * 1024 * 1024;

/// Return the required and maximum cacheable auxiliary color planes. After the last
/// child has finished, its slot can be reused as scratch for the enclosing group.
pub(crate) fn capacity(
    physical: [u32; 2],
    world_depth: bool,
    effects: &[ProjectEffect],
    batches: &[Batch],
) -> Option<(usize, usize)> {
    let plane_bytes = u64::from(physical[0])
        .checked_mul(u64::from(physical[1]))?
        .checked_mul(4)?;
    let available = (WORKING_SET_BYTES.checked_div(plane_bytes)? as usize)
        .checked_sub(1 + usize::from(world_depth))?;
    let (mut active, mut needed) = (0usize, 0usize);
    if !effects.is_empty() {
        for batch in batches {
            match batch.policy {
                EFFECT_ENTER => {
                    let effect = effects.get(batch.first as usize)?;
                    active += 1;
                    needed =
                        needed.max(active + usize::from(effect.blur > 0. || effect.glow.is_some()));
                }
                EFFECT_EXIT => active = active.checked_sub(1)?,
                _ => {}
            }
        }
    }
    if active == 0 && needed <= available {
        Some((needed, available))
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn marker(policy: u32, first: i32) -> Batch {
        Batch {
            policy,
            first,
            page: 0,
            opacity: 1.,
            clip: [0.; 4],
            region: [0.; 4],
            mapping: None,
            indexed: false,
            count: 0,
        }
    }
    fn effect(blur: f32) -> ProjectEffect {
        ProjectEffect {
            clip: [0., 0., 1., 1.],
            matrix: None,
            blur,
            glow: None,
        }
    }
    #[test]
    fn siblings_reuse_targets_and_outer_blur_borrows_the_ended_child() {
        let groups = [effect(1.), effect(0.), effect(0.)];
        let batches = [
            marker(EFFECT_ENTER, 0),
            marker(EFFECT_ENTER, 1),
            marker(EFFECT_EXIT, 1),
            marker(EFFECT_ENTER, 2),
            marker(EFFECT_EXIT, 2),
            marker(EFFECT_EXIT, 0),
        ];
        assert_eq!(
            capacity([2048, 2048], true, &groups, &batches),
            Some((2, 2))
        );
        let inside_blurred = [effect(1.), effect(1.), effect(0.)];
        assert_eq!(
            capacity([2048, 2048], true, &inside_blurred, &batches),
            None
        );
        assert_eq!(
            capacity([2048, 2048], false, &inside_blurred, &batches),
            Some((3, 3))
        );
    }
    #[test]
    fn ordinary_frames_and_zero_surfaces_keep_the_original_limits() {
        assert_eq!(capacity([4096, 4096], false, &[], &[]), Some((0, 0)));
        assert_eq!(capacity([4096, 4096], true, &[], &[]), None);
        assert_eq!(capacity([4097, 4096], false, &[], &[]), None);
        assert_eq!(capacity([0, 10], false, &[], &[]), None);
    }
}
