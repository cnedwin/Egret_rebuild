# SPDX-License-Identifier: Apache-2.0
cmake_minimum_required(VERSION 3.24)
project(EgretIosPlayer LANGUAGES C OBJC)
if(NOT CMAKE_SYSTEM_NAME STREQUAL "iOS" OR NOT CMAKE_GENERATOR STREQUAL "Xcode")
  message(FATAL_ERROR "Use the Xcode generator with -DCMAKE_SYSTEM_NAME=iOS.")
endif()
set(EGRET_BUNDLE_ID "org.egret.runtime.ios.sample" CACHE STRING "Signing bundle identifier")
set(EGRET_SCENE_DIR "" CACHE PATH "Prepared scene resources")
set(EGRET_RUST_LIBRARY "" CACHE FILEPATH "Rust archive compiled for this exact Apple target")
if(NOT EXISTS "${EGRET_RUST_LIBRARY}" OR NOT EXISTS "${EGRET_SCENE_DIR}/scene.js")
  message(FATAL_ERROR "Build the Rust target and prepare the scene bundle first.")
endif()
set(resources)
foreach(file scene.js bootstrap.js Quad.metal.txt LICENSE NOTICE robust-predicates.LICENSE)
  list(APPEND resources "${EGRET_SCENE_DIR}/${file}")
endforeach()
# The sample compiles its bundled Metal library once at open or renderer reconstruction.
set_source_files_properties(${resources} PROPERTIES MACOSX_PACKAGE_LOCATION Resources)
add_executable(EgretPlayer MACOSX_BUNDLE app/main.m app/GameHost.m app/MetalFrame.m ${resources})
set_target_properties(EgretPlayer PROPERTIES
  MACOSX_BUNDLE_INFO_PLIST "${CMAKE_CURRENT_SOURCE_DIR}/app/Info.plist"
  XCODE_ATTRIBUTE_PRODUCT_BUNDLE_IDENTIFIER "${EGRET_BUNDLE_ID}"
  XCODE_ATTRIBUTE_TARGETED_DEVICE_FAMILY "1,2"
  XCODE_ATTRIBUTE_CLANG_ENABLE_OBJC_ARC YES
  XCODE_GENERATE_SCHEME YES)
target_include_directories(EgretPlayer PRIVATE "../native/include")
target_link_libraries(EgretPlayer PRIVATE "${EGRET_RUST_LIBRARY}" "-framework UIKit" "-framework Foundation"
  "-framework QuartzCore" "-framework JavaScriptCore" "-framework Metal" "-framework MetalKit" "-framework Security"
  "-framework CoreFoundation" "-liconv")
