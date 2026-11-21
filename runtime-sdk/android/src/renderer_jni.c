// SPDX-License-Identifier: Apache-2.0
#include <jni.h>
#include <limits.h>
#include <stdint.h>
#include "egret_runtime.h"

// Both Android hosts compile the same buffer checks. Each library exports its own JNI namespace.
#ifdef EGRET_ANDROID_PLAYER
#define METHOD(name) Java_org_egret_runtime_player_PlayerGpu_##name
#else
#define METHOD(name) Java_org_egret_runtime_sample_Gpu_##name
#endif

JNIEXPORT jlong JNICALL METHOD(create)(JNIEnv *env, jclass cls) {
    return (jlong)(intptr_t)egret_renderer_create();
}

JNIEXPORT void JNICALL METHOD(destroy)(JNIEnv *env, jclass cls, jlong handle, jboolean current) {
    if (current) egret_renderer_destroy((EgretRenderer *)(intptr_t)handle);
    else egret_renderer_abandon((EgretRenderer *)(intptr_t)handle);
}

JNIEXPORT jint JNICALL METHOD(upload)(JNIEnv *env, jclass cls, jlong handle, jint page,
                                      jint width, jint height, jobject bytes) {
    if (!bytes || page <= 0 || width <= 0 || height <= 0) return -1;
    void *data = (*env)->GetDirectBufferAddress(env, bytes);
    jlong length = (*env)->GetDirectBufferCapacity(env, bytes);
    if (!data || length < 0 || (uint64_t)length > SIZE_MAX) return -1;
    return egret_renderer_upload((EgretRenderer *)(intptr_t)handle, page, width, height, data, (size_t)length);
}

#ifdef EGRET_ANDROID_PLAYER
JNIEXPORT jint JNICALL METHOD(prepareWorldPage)(JNIEnv *env, jclass cls, jlong handle, jint page, jobject bytes) {
    if (!bytes || page <= 0) return -1;
    void *data = (*env)->GetDirectBufferAddress(env, bytes);
    jlong length = (*env)->GetDirectBufferCapacity(env, bytes);
    if (!data || length < 0 || (uint64_t)length > SIZE_MAX) return -1;
    return egret_renderer_prepare_world_page((EgretRenderer *)(intptr_t)handle, page, data, (size_t)length);
}
#endif

JNIEXPORT jint JNICALL METHOD(release)(JNIEnv *env, jclass cls, jlong handle, jint page) {
    return egret_renderer_release((EgretRenderer *)(intptr_t)handle, page);
}

JNIEXPORT jint JNICALL METHOD(draw)(JNIEnv *env, jclass cls, jlong handle, jobject bytes,
                                    jint offset, jint length, jint width, jint height) {
    if (!bytes || offset < 0 || length <= 0 || width <= 0 || height <= 0) return -1;
    const uint8_t *data = (*env)->GetDirectBufferAddress(env, bytes);
    jlong capacity = (*env)->GetDirectBufferCapacity(env, bytes);
    if (!data || (jlong)offset + length > capacity) return -1;
    return egret_renderer_draw((EgretRenderer *)(intptr_t)handle, data + offset,
                               (size_t)length, width, height);
}
