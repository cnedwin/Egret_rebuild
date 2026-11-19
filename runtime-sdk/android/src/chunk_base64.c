// SPDX-License-Identifier: Apache-2.0
#include <jni.h>
#include <stdint.h>
#include <stdlib.h>

#if defined(__aarch64__)
#include <arm_neon.h>
#endif

static const uint8_t alphabet[] =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static void encode_ascii(const uint8_t *input, size_t length, uint8_t *output) {
#if defined(__aarch64__)
    if (length >= 48) {
        const uint8x16x4_t table = vld1q_u8_x4(alphabet);
        do {
            // Sixteen independent triples become sixteen four-character groups.
            uint8x16x3_t triple = vld3q_u8(input);
            uint8x16_t a = triple.val[0], b = triple.val[1], c = triple.val[2];
            uint8x16x4_t encoded;
            encoded.val[0] = vqtbl4q_u8(table, vshrq_n_u8(a, 2));
            encoded.val[1] = vqtbl4q_u8(table, vorrq_u8(
                vshlq_n_u8(vandq_u8(a, vdupq_n_u8(3)), 4), vshrq_n_u8(b, 4)));
            encoded.val[2] = vqtbl4q_u8(table, vorrq_u8(
                vshlq_n_u8(vandq_u8(b, vdupq_n_u8(15)), 2), vshrq_n_u8(c, 6)));
            encoded.val[3] = vqtbl4q_u8(table, vandq_u8(c, vdupq_n_u8(63)));
            vst4q_u8(output, encoded);
            input += 48;
            output += 64;
            length -= 48;
        } while (length >= 48);
    }
#endif
    while (length >= 3) {
        uint32_t bits = ((uint32_t)input[0] << 16) | ((uint32_t)input[1] << 8) | input[2];
        output[0] = alphabet[bits >> 18];
        output[1] = alphabet[(bits >> 12) & 63];
        output[2] = alphabet[(bits >> 6) & 63];
        output[3] = alphabet[bits & 63];
        input += 3;
        output += 4;
        length -= 3;
    }
    if (length != 0) {
        uint8_t a = input[0], b = length == 2 ? input[1] : 0;
        output[0] = alphabet[a >> 2];
        output[1] = alphabet[((a & 3) << 4) | (b >> 4)];
        output[2] = length == 2 ? alphabet[(b & 15) << 2] : '=';
        output[3] = '=';
    }
}

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
    encode_ascii(input, (size_t)length, output);
    (*env)->ReleasePrimitiveArrayCritical(env, source, (void *)input, JNI_ABORT);
    jbyteArray result = (*env)->NewByteArray(env, (jsize)size);
    if (result != NULL) (*env)->SetByteArrayRegion(env, result, 0, (jsize)size, (const jbyte *)output);
    free(output);
    return (*env)->ExceptionCheck(env) ? NULL : result;
}
