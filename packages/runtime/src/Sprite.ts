import { DisplayObjectContainer } from './DisplayObjectContainer.js';
import { Graphics } from './Graphics.js';
/** Stable drawing facade; a Sprite never shares or rebinds its Graphics. */
export class Sprite extends DisplayObjectContainer { public readonly graphics:Graphics; public constructor(){super();this.graphics=new Graphics(this);Object.defineProperty(this,"graphics",{value:this.graphics,writable:false,configurable:false});} }


