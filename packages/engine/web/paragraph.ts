/** Explicit host-injected CPU paragraph adapter; importing performs no I/O. */
export { createCanvasKitParagraphProvider } from './CanvasKitParagraphProvider.js';
export type {
  CanvasKitParagraphModule,
  CanvasKitParagraphFont,
  CanvasKitParagraphProvider,
  CanvasKitParagraphProviderOptions
} from './CanvasKitParagraphProvider.js';

export { createCanvasKitFontSetProvider } from './CanvasKitFontSetProvider.js';
export type {
  CanvasKitFontSetProvider,
  CanvasKitFontSetProviderOptions,
  ParagraphFontSet
} from './CanvasKitFontSetProvider.js';

export { createCanvasParagraphProvider } from './CanvasParagraphProvider.js';
export type {
  CanvasParagraphCanvas,
  CanvasParagraphContext,
  CanvasParagraphProvider,
  CanvasParagraphProviderOptions
} from './CanvasParagraphProvider.js';

export { chooseParagraphProvider } from './ParagraphProviderChoice.js';
export type {
  ParagraphBackend,
  ParagraphBackendReason,
  ParagraphDevice,
  ParagraphProviderChoice,
  ParagraphProviderChoiceOptions
} from './ParagraphProviderChoice.js';
