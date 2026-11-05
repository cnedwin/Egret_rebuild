// SPDX-License-Identifier: Apache-2.0
import {admitResourceManifest} from '@egret/contracts/resources';
import {createManifestFontContentLoader} from '@egret/engine/web/resources';
import {createCanvasKitFontSetProvider} from '@egret/engine/web/paragraph';
export async function openFontResources(engine,scope,canvasKit,buildIdentity,configPath){
 if(!/^work\/font-resources\/run-[A-Za-z0-9]{6}\/browser-config\.json$/.test(configPath))throw Error('EXAMPLE_FONT_CONFIG');
 const configUrl=new URL('/'+configPath,location.origin),configResponse=await fetch(configUrl);if(!configResponse.ok)throw Error('EXAMPLE_FONT_CONFIG_HTTP');const config=await configResponse.json();
 if(config.format!=='egret.font-example/1'||!/^build\/generations\/[a-f0-9]{64}\/manifest\.json$/.test(config.manifestPath))throw Error('EXAMPLE_FONT_CONFIG');
 const baseUrl=new URL('./',configUrl),response=await fetch(new URL(config.manifestPath,baseUrl));if(!response.ok)throw Error('EXAMPLE_FONT_MANIFEST_HTTP');const bytes=new Uint8Array(await response.arrayBuffer());
 const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');if(sha!==config.manifestSha256)throw Error('EXAMPLE_FONT_MANIFEST_HASH');
 const parsed=admitResourceManifest(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));if(!parsed.ok)throw Error('EXAMPLE_FONT_MANIFEST');
 const transport=createManifestFontContentLoader(engine,parsed.value,{baseUrl:baseUrl.href,deadlineMs:30000}),provider=createCanvasKitFontSetProvider({canvasKit,buildIdentity});
 let current;
 try{current=await provider.load(scope,transport.loader,config.initial);}catch(cause){await provider.close();await transport.close();throw cause;}
 return {provider,current,config,transport,load(candidateScope,alternate){return provider.load(candidateScope,transport.loader,alternate?config.alternate:config.initial);},async close(){try{await provider.close();}finally{await transport.close();}}};
}
