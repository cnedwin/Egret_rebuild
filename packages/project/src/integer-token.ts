import type { NumericToken } from "./internal.js";

// Called only for scanner-confirmed JSON numeric tokens. Saturation depends on
// token length, never exponent magnitude; no powers or exponent-sized BigInts.
export function classifyIntegerToken(raw: string, offset: number): NumericToken {
  const negative = raw[0] === "-";
  let i = negative ? 1 : 0, fraction = 0, afterPoint = false, digits = "";
  while (i < raw.length && raw[i] !== "e" && raw[i] !== "E") {
    const c = raw[i++]!;
    if (c === ".") afterPoint = true;
    else { digits += c; if (afterPoint) fraction++; }
  }
  digits = digits.replace(/^0+/u, "");
  const zero = digits.length === 0;
  const result = (integerSafe: boolean): NumericToken => Object.freeze({ offset, length: raw.length, integerSafe, negativeZero: negative && zero });
  // A zero coefficient stays exactly zero even with a 4096-digit exponent.
  if (zero) return result(!negative);
  if (negative) return result(false);
  let exponent = 0;
  if (i < raw.length) {
    i++;
    const exponentNegative = raw[i] === "-";
    if (raw[i] === "+" || raw[i] === "-") i++;
    const saturation = raw.length + 17;
    for (; i < raw.length; i++) exponent = Math.min(saturation, exponent * 10 + raw.charCodeAt(i) - 48);
    if (exponentNegative) exponent = -exponent;
  }
  let scale = exponent - fraction;
  let end = digits.length;
  while (end > 0 && digits[end - 1] === "0") { end--; scale++; }
  digits = digits.slice(0, end);
  if (scale < 0) return result(false);
  const magnitude = digits.length + scale;
  if (magnitude < 16) return result(true);
  if (magnitude > 16) return result(false);
  // At most 16 characters are ever padded for the safe-integer comparison.
  return result(digits + "0".repeat(scale) <= "9007199254740991");
}
