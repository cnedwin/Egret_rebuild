// SPDX-License-Identifier: Apache-2.0
import {workload} from './workload.mjs';

const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
const point = ({globalX:x,globalY:y}) => ({x,y});
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const angle = (a,b) => Math.atan2(b.y-a.y,b.x-a.x);

export function studioTouchState() {
  return {actions:0,holds:0,cancels:0,refused:0,revision:0,camera:{x:0,y:0,scale:1,rotation:0},log:[]};
}

/** Each recognised gesture owns only its admitted public pointer session. */
export function attachStudioTouch({input,state,classify,pick,vault,onAction,invalidate}) {
  const contacts = new Map(), map = new Map();
  let movement, action, scroll;
  const record = (kind, role, notification) => {
    state.revision++;
    state.log.push({kind,role,reason:notification?.reason,revision:state.revision,
      pointer:notification?.contact.session.id,viewport:notification?.contact.viewportRevision});
    if (state.log.length > 160) state.log.shift();
  };
  function begin(notification) {
    const {contact,target} = notification;
    if (contact.buttons !== 1) return;
    const role = classify(target);
    if (!role) return;
    if ((role === 'map' && map.size === 2) || (role === 'move' && movement) ||
        (role === 'action' && action) || (role === 'vault' && scroll)) {
      state.refused++;
      record('refused',role,notification);
      return;
    }
    const session = contact.session;
    const start = point(contact);
    const row = {role,target,start,last:start,dragged:false,key:role === 'vault' ? vault.keyAt(start) : undefined};
    contacts.set(session,row);
    if (role === 'map') map.set(session,row);
    if (role === 'move') movement = session;
    if (role === 'action') action = session;
    if (role === 'vault') scroll = session;
    record('begin',role,notification);
    invalidate();
  }

  function mapMove(session, previous, next) {
    const camera = state.camera;
    const peer = [...map].find(([key]) => key !== session)?.[1].last;
    const factor = peer ? .5 : 1;
    camera.x = clamp(camera.x + (next.x-previous.x)*factor,-100,100);
    camera.y = clamp(camera.y + (next.y-previous.y)*factor,-100,100);
    if (peer) {
      const oldSpan = distance(previous,peer), span = distance(next,peer);
      if (oldSpan >= 2 && span >= 2) {
        camera.scale = clamp(camera.scale * span / oldSpan,...workload.cameraScale);
        const delta = angle(next,peer) - angle(previous,peer);
        camera.rotation = (camera.rotation + Math.atan2(Math.sin(delta),Math.cos(delta)) * 180/Math.PI + 360) % 360;
      }
    }
  }

  function update(notification) {
    const {contact,kind} = notification, {session} = contact;
    const row = contacts.get(session);
    if (!row) return;
    const next = point(contact);
    if (kind === 'move') {
      const crossed = distance(row.start,next) >= workload.dragThreshold;
      if (row.role === 'map') mapMove(session,row.last,next);
      if (row.role === 'vault' && (row.dragged || crossed)) vault.scroll((row.dragged ? row.last : row.start).y-next.y);
      row.dragged ||= crossed;
      row.last = next;
      invalidate();
      return;
    }
    contacts.delete(session);
    map.delete(session);
    if (movement === session) movement = undefined;
    if (action === session) action = undefined;
    if (scroll === session) scroll = undefined;
    if (kind === 'cancel') state.cancels++;
    else if (notification.delivered && !row.dragged && distance(row.start,next) < workload.dragThreshold && pick(next) === row.target) {
      if (row.role === 'action') {
        state.actions++;
        state.lastAction = {number:state.actions,at:contact.timestamp};
        record('action',row.role,notification);
      }
      if (row.role === 'vault' && row.key !== undefined && vault.keyAt(next) === row.key) {
        onAction(row.key);
        record('tap',row.role,notification);
      }
    }
    record(kind,row.role,notification);
    invalidate();
  }

  const unsubscribe = input.observe(notification => {
    if (notification.kind === 'begin') begin(notification);
    else update(notification);
  });
  return {
    unsubscribe,
    step() { if (movement) state.holds++; },
    moving() { return movement !== undefined; },
    inspect() {
      return {actions:state.actions,holds:state.holds,cancels:state.cancels,refused:state.refused,revision:state.revision,
        camera:{...state.camera},active:contacts.size,map:map.size,moving:movement !== undefined,
        viewport:input.viewportRevision,coreContacts:input.contacts.length,log:[...state.log]};
    }
  };
}
