// SPDX-License-Identifier: Apache-2.0
export type IntegrationName = 'archive' | 'audio' | 'i18n' | 'ktx2' | 'physics' | 'storage' | 'tiled';
export type IntegrationErrorCode =
    | 'invalid-input'
    | 'unsupported'
    | 'limit-exceeded'
    | 'platform-unavailable'
    | 'operation-failed'
    | 'disposed'
    | 'aborted';

/** A stable application-facing error. The original vendor or host error remains available as cause. */
export class IntegrationError extends Error {
    public constructor(
        public readonly integration: IntegrationName,
        public readonly code: IntegrationErrorCode,
        message: string,
        options?: ErrorOptions,
    ) {
        super(message, options);
        this.name = 'IntegrationError';
    }
}
