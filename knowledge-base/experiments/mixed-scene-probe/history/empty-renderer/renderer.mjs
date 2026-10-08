// Initial renderer baseline for a real failing browser run; this is research-only.
export function createLab(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error('WebGL2 unavailable');
  const clear = (color = [0, 0, 0, 0]) => { gl.clearColor(...color); gl.clear(gl.COLOR_BUFFER_BIT); };
  const read = (x, y) => { const p = new Uint8Array(4); gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p); return [...p]; };
  const readAll = () => { const p = new Uint8Array(canvas.width * canvas.height * 4); gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, p); return [...p]; };
  return { environment: { userAgent: navigator.userAgent, version: gl.getParameter(gl.VERSION) }, clear, read, readAll, ui: () => ({ drawCalls: 0 }), mesh: () => {}, bones: () => {}, scene: () => clear(), restore: async () => {} };
}
