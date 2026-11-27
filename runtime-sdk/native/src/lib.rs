// SPDX-License-Identifier: Apache-2.0
//! GLES executor for EGR1 baseline, EGR2/EGR3 quads, and EGR4 indexed textured meshes.

#[cfg(any(test, target_os = "android", target_os = "ios"))]
mod frame;
#[cfg(any(test, target_os = "ios"))]
mod frame_ffi;
#[cfg(target_os = "android")]
mod gl;
#[cfg(target_os = "android")]
mod gles;
#[cfg(any(test, target_os = "android"))]
mod project_color;
#[cfg(any(test, target_os = "android"))]
mod project_target_budget;
#[cfg(target_os = "android")]
mod project_gles;
#[cfg(any(test, target_os = "android"))]
mod world_frame;
#[cfg(target_os = "android")]
mod world_gles;
