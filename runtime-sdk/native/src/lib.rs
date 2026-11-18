// SPDX-License-Identifier: Apache-2.0
//! Android native executor for the opaque, nearest-sampled shared-frame profile.

#[cfg(any(test, target_os = "android"))]
mod frame;
#[cfg(target_os = "android")]
mod gl;
#[cfg(target_os = "android")]
mod gles;
