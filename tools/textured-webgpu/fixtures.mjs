// First-party Apache-2.0 prospective native literals; imports no product or oracle.
// Rational pairs describe ideal byte channels, not fitted/rounded GPU observations.
const freeze = value => { if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; };
const q = (n, d = 1) => [String(n), String(d)];
const sample = (name, x, y, rgba, bounds = [0, 0, 0, 0]) => ({ name, x, y, expected: rgba.map(value => Array.isArray(value) ? value : q(value)), bounds });
const zero = (name, x, y) => sample(name, x, y, [0, 0, 0, 0]);
const bounded = (name, x, y, rgba) => sample(name, x, y, rgba, [1, 1, 1, 1]);
const row = (id, family, phase, scenario, samples, extra = {}) => ({ id, family, phase, scenario,
  width: 32, height: 32, pixelRatio: 1, clearColor: 0, clearAlpha: 0, samples, ...extra });
export const ALPHAS = freeze([0, 1, 127, 128, 254, 255]);
export const UPLOADS = freeze([[0,0,0,0], [1,0,0,1], [127,16,4,127], [128,16,4,128], [254,32,8,254], [255,32,8,255]]);
export const ATLAS = freeze({ width: 4, height: 4, crop: { x: 1, y: 1, width: 2, height: 2 }, pixels: [
  255,0,255,255, 255,0,255,255, 255,0,255,255, 255,0,255,255,
  255,0,255,255, 255,0,0,255, 0,255,0,255, 255,0,255,255,
  255,0,255,255, 0,0,255,255, 255,255,255,255, 255,0,255,255,
  255,0,255,255, 255,0,255,255, 255,0,255,255, 255,0,255,255,
] });
export const N02_GEOMETRY = freeze({ positions: [0,0,16,0,0,16], uvs: [.5,.5,.5,.5,.5,.5],
  lightColors: [1,0,0,1, 0,1,0,.5, 0,0,1,.25], indices: [0,1,2] });
export const N06_GEOMETRY = freeze({ positions: [0,0,64,0,0,64], uvs: [.5,.5,.5,.5,.5,.5],
  lightColors: [0,0,.5,.5, 1,0,.5,.5, 0,1,.5,.5], indices: [0,1,2] });
export const N09_GEOMETRY = freeze({ positions: [0,0,1,0,1,1,0,1], uvs: [0,0,1,0,1,1,0,1],
  lightColors: [1,0,0,1, 0,1,0,.5, 0,0,1,.25, 1,1,1,.75], indices: [0,1,2,0,2,3] });
export const PUBLIC_RECIPES = freeze({
  diamond: { parent: { x:16,y:4,rotation:45,scaleX:Math.SQRT2,scaleY:Math.SQRT2,clipRect:{x:0,y:0,width:8,height:8} },
    mesh: { x:-10,y:6,rotation:-45,scaleX:1/Math.SQRT2,scaleY:1/Math.SQRT2,alpha:.5 },
    idealMesh: [1,0,0,1,0,0], idealClip: [1,1,-1,1,16,4], matrixAbsoluteBound:2**-40 },
  complement: { parent:{x:15.999999999999996,y:36,rotation:-90,scaleX:40,scaleY:20,clipRect:{x:0,y:0,width:1,height:1}},
    inverse:{x:.9,y:-.8,rotation:90,scaleX:1/20,scaleY:1/40},
    mesh:{x:4,y:16,rotation:45,scaleX:12*Math.SQRT2,scaleY:-12*Math.SQRT2,alpha:.5},
    idealMesh:[12,12,12,-12,4,16], idealClip:[0,-40,20,0,16,36], matrixAbsoluteBound:2**-38,
    exactCPUWitnessMesh:[11.999999999999998,12,12,-12,4,16],
    exactCPUWitnessClip:[2**-47,-40,20,0,15.999999999999996,36],
    scope:'Public rotation/scales approximate the fixed ideal within admission; exact CPU G06 is separate.' },
});
const palette = [sample('crop-red',15,8,[255,0,0,255]),sample('crop-green',16,8,[0,255,0,255]),
  sample('crop-blue',15,24,[0,0,255,255]),sample('crop-white',16,24,[255,255,255,255])];
const diamond = [bounded('clip-inside-top',15,8,[q(31,4),q(17,4),16,32]),
  bounded('clip-inside-left',12,11,[q(25,4),q(23,4),16,32]),
  bounded('clip-inside-right',19,11,[q(39,4),q(23,4),16,32]),
  bounded('clip-inside-bottom',15,15,[q(31,4),q(31,4),16,32]),
  zero('clip-outside-top',15,1),zero('clip-outside-left',5,11),zero('clip-outside-right',26,11),zero('clip-outside-bottom',15,22)];
const interpolation = [bounded('interpolated-rgba',3,3,[q(837,32),q(651,64),q(651,64),q(93,2)])];
const alphaExpected = [[0,0,0,0],[q(1,8),0,0,q(1,4)],[q(127,8),1,q(3,4),q(127,4)],
  [16,1,q(3,4),32],[q(127,4),2,q(3,2),q(127,2)],[q(255,8),2,q(3,2),q(255,4)]];
export const CASES = freeze([
  ...ALPHAS.map((alpha,i) => row('N01-a'+alpha,'N01','calibration','alpha',
    [sample('alpha-'+alpha,4,9,alphaExpected[i],alphaExpected[i].map(v => v === 0 ? 0 : 1))],{alpha})),
  row('N02-interpolation','N02','held-out','interpolation',interpolation,{width:16,height:16}),
  row('N03-forward','N03','calibration','painter',[sample('blue-over-red',4,9,[q(16256,255),0,128,q(48896,255)],[1,0,1,1])],{reverse:false}),
  row('N03-reversed','N03','calibration','painter',[sample('red-over-blue',4,9,[128,0,q(16256,255),q(48896,255)],[1,0,1,1])],{reverse:true}),
  row('N04-empty','N04','held-out','barriers',[sample('last-green-empty',4,9,[0,255,0,255])],{barrier:'empty'}),
  row('N04-singular','N04','held-out','barriers',[sample('last-green-singular',4,9,[0,255,0,255])],{barrier:'singular'}),
  row('N05-palette','N05','calibration','palette',palette),
  row('N05-clamp0','N05','calibration','palette',[sample('clamp-origin',4,9,[255,0,0,255])],{constantUV:0}),
  row('N05-clamp1','N05','calibration','palette',[sample('clamp-end',4,9,[255,255,255,255])],{constantUV:1}),
  row('N06-diamond','N06','held-out','diamond',diamond),
  row('N07-diamond','N07','held-out','diamond',[bounded('dpr-clip-inside',23,10,[q(47,6),q(7,2),16,32]),zero('dpr-clip-outside',23,3)],{pixelRatio:1.5}),
  row('N07-palette','N07','held-out','palette',palette,{width:64/3,height:64/3,pixelRatio:1.5}),
  row('N08-degenerate','N08','held-out','degenerate',[zero('authored-and-packed-no-contribution',2,2),zero('thin-no-contribution',8,1),sample('stable-sibling',14,7,[255,128,0,255])],{height:16}),
  row('N09-complement','N09','held-out','complement',[bounded('visible-complement-transport',20,19,[q(43,9),q(301,36),q(559,36),q(86,3)]),
    zero('complement-left-background',8,20),zero('complement-above-background',16,31),sample('stable-sibling',14,7,[255,128,0,255])],{width:48,height:40}),
  row('N10-replay02','N10','held-out','retained',interpolation,{width:16,height:16,replayOf:'N02-interpolation',resetBefore:[48,40]}),
  row('N10-replay06','N10','held-out','retained',diamond,{replayOf:'N06-diamond',resetBefore:[16,16]}),
]);
export const CALIBRATION = freeze(CASES.filter(value => value.phase === 'calibration').map(value => value.id));
export const HELD_OUT = freeze(CASES.filter(value => value.phase === 'held-out').map(value => value.id));
export function definition(id) { const value = CASES.find(item => item.id === id); if (!value) throw Error('UNKNOWN_NATIVE_CASE'); return value; }
export const RECONCILIATION = freeze([
  {family:'N06',old:[15,2],replacement:[15,1],expected:[0,0,0,0],reason:'Old diamond clearance 2/sqrt(2) < 2; new clearance 3/sqrt(2) > 2.'},
  {family:'N09',old:[16,28],replacement:[16,31],expected:[0,0,0,0],reason:'Old diagonal outside clearance 1/sqrt(2) < 2; new clearance 4/sqrt(2) > 2.'},
  {family:'N06/N09',reason:'Public rotation/scales and inverse descendants replace unconstructible literal matrix assignment; ideal sample tables unchanged and captured-matrix admission is mandatory before submission.'},
]);
