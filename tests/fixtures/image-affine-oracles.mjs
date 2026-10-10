// Independent dyadic affine oracles. No production imports or output-derived expectations.
export const identityTuples=[[1,0,.25,0],[1,4,.25,1],[3,0,.75,0],[3,4,.75,1]];
export const reflectedTuples=[[1,0,.75,0],[1,4,.75,1],[3,0,.25,0],[3,4,.25,1]];
export const reflectedPackedCorners=[[-.5,-1,.75,1],[-.5,1,.75,0],[.5,-1,.25,1],[.5,1,.25,0]];
// C2 geometry is adapted from the existing literal rectangle regression, with a new 1x1 image.
// B exchanges transformed local axes, so Q's attached UV changes from (1,0) to (0,1).
export const endpoint={P:[4,16],Q:[15.999999999999998,28],u:480,v:2**-46,
 clip:{matrix:{a:2**-47,b:-40,c:20,d:0,tx:15.999999999999996,ty:36},rect:{x:0,y:0,width:1,height:1}},
 variants:[{matrix:{a:11.999999999999998,b:12,c:12,d:-12,tx:4,ty:16},uv:[1,0]},
 {matrix:{a:12,b:-12,c:11.999999999999998,d:12,tx:4,ty:16},uv:[0,1]}]};
export const literalPixels=[255,0,0,255];
export const collinearAttributed=[[0,0,0,0],[1,0,.25,0],[2,0,1,0],[2,2,1,1],[0,2,0,1]];
