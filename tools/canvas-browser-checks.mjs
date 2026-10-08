import { createEngine, Sprite } from '@egret/engine';
import { createCanvasHost } from '@egret/engine/web';
export async function verifyPixels(noop = false) {
  const results = [];
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  const host = createCanvasHost({ canvas });
  const engine = await createEngine({ host });
  const context = canvas.getContext('2d');
  const render = options => noop ? engine.captureFrame(options) : engine.renderFrame(options);
  const options = { width: 100, height: 100, clearColor: 0, clearAlpha: 1 };
  function pixel(x, y, expected, name) {
    const actual = [...context.getImageData(x, y, 1, 1).data];
    if (actual.some((v, i) => Math.abs(v - expected[i]) > 2)) throw Error(`${name}: ${actual} != ${expected}`);
    results.push({ name, actual, expected });
  }
  const red = engine.stage.addChild(new Sprite());
  red.graphics.beginFill(0xff0000, .5).drawRect(10, 10, 40, 40);
  const blue = engine.stage.addChild(new Sprite());
  blue.graphics.beginFill(0x0000ff, .5).drawRect(20, 20, 40, 40);
  render(options);
  pixel(30, 30, [64, 0, 128, 255], 'literal overlap');
  // Reset must remove externally introduced clip, shadows and filters at equal size.
  context.beginPath(); context.rect(0, 0, 1, 1); context.clip();
  context.shadowColor = 'red'; context.shadowBlur = 40; context.filter = 'blur(10px)';
  render(options); pixel(30, 30, [64, 0, 128, 255], 'incoming state reset');
  red.graphics.clear(); blue.graphics.clear();
  const parent = engine.stage.addChild(new Sprite()); parent.alpha = .5;
  const child = parent.addChild(new Sprite()); child.graphics.beginFill(0x00ff00, .5).drawRect(5, 5, 10, 10);
  render(options); pixel(10, 10, [0, 64, 0, 255], 'ancestor alpha');
  parent.alpha = 1; child.graphics.clear(); parent.x = 50; parent.y = 20; parent.scaleX = 2; child.rotation = 90;
  child.graphics.beginFill(0xff0000).drawRect(0, 0, 10, 10);
  render(options); pixel(40, 25, [255, 0, 0, 255], 'translated rotated scaled'); pixel(55, 25, [0, 0, 0, 255], 'transform outside');
  parent.x = 50; parent.y = 50; parent.scaleX = 1; parent.rotation = 45; child.rotation = 0;
  parent.clipRect = { x: -10, y: -10, width: 20, height: 20 };
  child.graphics.clear(); child.graphics.beginFill(0x00ff00).drawRect(-30, -30, 60, 60);
  const sibling = engine.stage.addChild(new Sprite()); sibling.graphics.beginFill(0x0000ff).drawRect(80, 80, 10, 10);
  render(options); pixel(50, 50, [0, 255, 0, 255], 'rotated clip inside'); pixel(62, 62, [0, 0, 0, 255], 'rotated clip outside'); pixel(85, 85, [0, 0, 255, 255], 'sibling clip isolation');
  parent.visible = false; sibling.visible = false; render(options); pixel(50, 50, [0, 0, 0, 255], 'frame clearing');
  const before = canvas.toDataURL();
  const invalid = structuredClone(engine.captureFrame(options)); invalid.commands.push({ kind: 'rect', matrix: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }, rect: { x: 0, y: 0, width: 2, height: 2 }, color: 0, alpha: NaN, clips: [] });
  try { host.renderFrame(invalid); throw Error('invalid accepted'); } catch (e) { if(e.code !== 'CANVAS_FRAME_INVALID') throw e; }
  if(before !== canvas.toDataURL()) throw Error('invalid frame mutated bitmap'); results.push({name:'invalid before mutation'});
  await engine.dispose();
  try { host.renderFrame(invalid); throw Error('closed accepted'); } catch(e) {if(e.code !== 'CANVAS_HOST_CLOSED') throw e;} results.push({name:'terminal close'});
  const dprCanvas = document.createElement('canvas'); document.body.append(dprCanvas);
  const dpr = await createEngine({host:createCanvasHost({canvas:dprCanvas,pixelRatio:1.5})});
  const square = dpr.stage.addChild(new Sprite()); square.graphics.beginFill(0xff0000).drawRect(2,2,4,4);
  dpr.renderFrame({width:10.1,height:8.1,clearColor:0,clearAlpha:1});
  if(dprCanvas.width!==16 || dprCanvas.height!==13) throw Error('DPR dimensions');
  const actual=[...dprCanvas.getContext('2d').getImageData(5,5,1,1).data];
  if(actual.join()!=='255,0,0,255') throw Error(`DPR pixels ${actual}`);
  results.push({name:'DPR ceil dimensions and pixels',dimensions:[16,13],actual}); await dpr.dispose();
  // Tiny-area probes distinguish the configured budget from native allocation limits.
  for (const width of [32768, 65536]) {
    const probe = document.createElement('canvas');
    const adapter = createCanvasHost({canvas:probe});
    adapter.start();
    let error;
    let pixels;
    const probeContext = probe.getContext('2d');
    try {
      adapter.renderFrame({frameId:1,width,height:1,clearColor:0xff0000,clearAlpha:1,commands:[]});
      pixels = [...probeContext.getImageData(0,0,1,1).data];
    } catch (cause) { error = {code:cause.code,message:cause.message}; }
    const lost = probeContext.isContextLost?.();
    if (lost && error?.code !== 'CANVAS_CONTEXT_LOST') throw Error('Native allocation loss was silently accepted');
    results.push({name:'native narrow allocation probe',requested:[width,1],assigned:[probe.width,probe.height],contextLost:lost,pixels,error});
    await adapter.close();
    probe.width = 1; probe.height = 1;
  }
  return results;
}
