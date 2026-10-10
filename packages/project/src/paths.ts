import { utf8Length } from "./unicode.js";

export function isPortablePath(path: string): boolean {
  const bytes = utf8Length(path);
  if (!bytes.ok || bytes.value > 1024 || /[\\\u0000-\u001f\u007f:*?"<>|]/u.test(path)) return false;
  return path.split("/").every(component => component !== "" && component !== "." && component !== ".."
    && !/[ .]$/u.test(component) && !/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/iu.test(component));
}

// Call only after lexical validation; retain authored path spelling elsewhere.
export function pathCollisionKey(path: string): string {
  return path.normalize("NFC").toLowerCase();
}
