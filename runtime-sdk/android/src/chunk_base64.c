// SPDX-License-Identifier: Apache-2.0
#include <jni.h>
#include <stdint.h>
#include <stdlib.h>

#include "egret_runtime.h"

static jbyteArray fail(JNIEnv *env, const char *type, const char *message) {
    jclass exception = (*env)->FindClass(env, type);
    if (exception != NULL) (*env)->ThrowNew(env, exception, message);
    return NULL;
}

JNIEXPORT jbyteArray JNICALL Java_org_egret_runtime_player_PlayerChunkCodec_encodeAscii(
    JNIEnv *env, jclass cls, jbyteArray source, jint length) {
    (void)cls;
    if (source == NULL) return fail(env, "java/lang/NullPointerException", "Missing chunk buffer");
    if (length < 0 || length > 65536 || length > (*env)->GetArrayLength(env, source))
        return fail(env, "java/lang/IllegalArgumentException", "Invalid chunk length");
    if (length == 0) return (*env)->NewByteArray(env, 0);

    // One full chunk needs 87,384 ASCII bytes. No terminator crosses the JNI boundary.
    size_t size = (size_t)((length + 2) / 3) * 4;
    uint8_t *output = malloc(size);
    if (output == NULL) return fail(env, "java/lang/OutOfMemoryError", "Cannot allocate encoded chunk");
    const uint8_t *input = (*env)->GetPrimitiveArrayCritical(env, source, NULL);
    if (input == NULL) {
        free(output);
        if ((*env)->ExceptionCheck(env)) return NULL;
        return fail(env, "java/lang/OutOfMemoryError", "Cannot access chunk buffer");
    }
    int32_t status = egret_chunk_encode_base64(input, (size_t)length, output, size);
    (*env)->ReleasePrimitiveArrayCritical(env, source, (void *)input, JNI_ABORT);
    if (status != 0) {
        free(output);
        return fail(env, "java/lang/IllegalStateException", "Invalid encoded chunk buffers");
    }
    jbyteArray result = (*env)->NewByteArray(env, (jsize)size);
    if (result != NULL) (*env)->SetByteArrayRegion(env, result, 0, (jsize)size, (const jbyte *)output);
    free(output);
    return (*env)->ExceptionCheck(env) ? NULL : result;
}
