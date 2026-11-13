// SPDX-License-Identifier: Apache-2.0
// A strict consumer of the skin states: the state of drawn controls gives the name, and five things it may not write.
import {createUiTheme,selectUiSkin} from '@egret/engine/ui';
import type {ActionControl,HoverControl,ToggleControl,UiSkinState,UiSkinStateName,UiTheme,UiThemeSkin} from '@egret/engine/ui';
declare const action:ActionControl,hover:HoverControl,toggle:ToggleControl,focused:boolean;
const theme:UiTheme=createUiTheme({id:'dark',skins:{button:{default:'idle',hover:'over',pressed:'down',disabled:'off'}}});
const skin:UiThemeSkin|undefined=theme.skins['button'];
if(skin!==undefined){
 const state:UiSkinState={disabled:!action.enabled,pressed:action.pressed,hover:hover.hovered,focus:focused,checked:toggle.checked};
 const name:string=selectUiSkin(skin,state);void name;
 const order:readonly UiSkinStateName[]=['disabled','hover'];
 const other:string=selectUiSkin(skin,state,order);void other;
 const rest:string=selectUiSkin(skin);void rest;
 // @ts-expect-error the default is not a state
 selectUiSkin(skin,state,['default']);
 // @ts-expect-error a state holds or does not
 selectUiSkin(skin,{hover:'yes'});
 // @ts-expect-error a state is one of the seven
 selectUiSkin(skin,{dragged:true});
 // @ts-expect-error a skin has a default
 selectUiSkin({hover:'over'},state);
}
// @ts-expect-error the default entry does not have the function
import {selectUiSkin as leaked} from '@egret/engine';
void leaked;
