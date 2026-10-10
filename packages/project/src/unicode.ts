import type { ProjectValueResult } from "./public.js";

// Validate UTF-16 before counting UTF-8; no host encoder is needed by this core.
export function utf8Length(text: string): ProjectValueResult<number> {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = text.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return invalidUnicode();
      bytes += 4;
    } else if (c >= 0xdc00 && c <= 0xdfff) return invalidUnicode();
    else bytes += c < 0x80 ? 1 : c < 0x800 ? 2 : 3;
  }
  return Object.freeze({ ok: true, value: bytes, diagnostics: Object.freeze([]) });
}

function invalidUnicode(): ProjectValueResult<never> {
  return Object.freeze({ ok: false, diagnostics: Object.freeze([Object.freeze({
    code: "PROJECT_INPUT_INVALID", phase: "parse", severity: "error", jsonPointer: "",
    message: "Input contains invalid Unicode.", details: Object.freeze(Object.create(null))
  })]) });
}
