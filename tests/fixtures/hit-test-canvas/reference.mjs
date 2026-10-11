// Independent native Canvas recipe. No Egret imports, query, frame or bounds input.
export function paintReference(context,{upperVisible=true,gateVisible=true,feedbackColor=0x404040}={}){
  context.save();
  try{
    context.setTransform(1,0,0,1,0,0);context.globalAlpha=1;context.globalCompositeOperation='source-over';
    context.clearRect(0,0,320,200);
    // Public FRAME clear alpha is one: fill explicitly, never infer from CSS.
    context.fillStyle='#000000';context.fillRect(0,0,320,200);
    context.fillStyle='#ff0000';context.fillRect(16,16,80,80);
    if(upperVisible){context.fillStyle='#0000ff';context.fillRect(48,32,64,64);}
    if(gateVisible){context.save();try{context.beginPath();context.rect(160,24,48,48);context.clip();context.fillStyle='#00ff00';context.fillRect(160,24,80,80);}finally{context.restore();}}
    context.fillStyle='#ff00ff';context.fillRect(16,128,32,32);
    context.fillStyle='#ffff00';context.fillRect(48,128,32,32);
    context.fillStyle='#'+feedbackColor.toString(16).padStart(6,'0');context.fillRect(272,16,24,24);
  }finally{context.restore();}
}
export function sampleReference(context,points){return points.map(point=>({point:[...point],rgba:Array.from(context.getImageData(point[0],point[1],1,1).data)}));}
