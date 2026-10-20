// SPDX-License-Identifier: Apache-2.0
// Genuine built public frames with owned GL ports; no native rendering/recovery acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hosted, glPorts, createSharedWebGL2Host, code, outcome, pending, turn, until,
  signalPort, taskUploadMeter, uploadRows, visibleRows, MiB } from './shared-frame-upload-gl-fixture.mjs';
import { fixture as candidateFixture, candidate } from './candidate-shared-frame-fixture.mjs';

test('GLU00 stage and ordinary work share exactly two pending records', async () => hosted(async f => {
  const a = f.stage(), b = f.stage();
  assert.equal(f.host.getStatus().pendingFrames,2);
  const before = f.ports.events.length;
  assert.throws(() => f.stage(), code('BACKPRESSURE'));
  assert.throws(() => f.host.renderSharedFrame(f.frame()), code('BACKPRESSURE'));
  assert.equal(f.ports.events.length,before);
  await Promise.all([a.ready,b.ready]);
  assert.equal(f.host.getStatus().pendingFrames,2); assert.equal(f.host.getStatus().lastSerial,1);
  const submission = a.submit(); assert.equal(submission.serial,2);
  assert.equal(f.host.getStatus().pendingFrames,2,'submit transfers the original charged record');
  await submission.completed; b.dispose();
  await until(() => f.host.getStatus().pendingFrames === 0);
  f.ports.autoSignal = false; f.host.renderSharedFrame(f.frame()); const held = f.stage();
  assert.equal(f.host.getStatus().pendingFrames,2);
  assert.throws(() => f.stage(),code('BACKPRESSURE'));
  held.dispose(); f.ports.autoSignal = true; f.ports.signalAll();
}));

test('GLU00 configured one-record limit also binds a ready held stage', async () => hosted(async f => {
  const a = f.stage(); await a.ready;
  const before = f.ports.events.length;
  assert.throws(() => f.host.renderSharedFrame(f.frame()),code('BACKPRESSURE'));
  assert.throws(() => f.stage(),code('BACKPRESSURE'));
  assert.equal(f.ports.events.length,before); a.dispose();
}, {options:{maxPendingFrames:1}}));

for (const [name,options,make,expected] of [
  ['upload',{maxUploadBytes:2048},async f => { for (let i=0;i<5;i++) f.sprite.graphics.beginFill(0x00ff00).drawRect(0,0,4,4).endFill(); const frame=f.frame(); assert.equal(frame.commands.filter(c => c.kind === 'rect').length,6); return frame; },'FRAME_BUDGET'],
  ['pending upload',{maxPendingUploadBytes:2048},async f => { for (let i=0;i<5;i++) f.sprite.graphics.beginFill(0x00ff00).drawRect(0,0,4,4).endFill(); const frame=f.frame(); assert.equal(frame.commands.filter(c => c.kind === 'rect').length,6); return frame; },'BACKPRESSURE'],
  ['readback envelope',{maxReadbackBytes:512},async f => f.frame(16,16),'FRAME_BUDGET'],
  ['backing target',{maxBackingPixels:64},async f => f.frame(16,16),'BACKING_LIMIT'],
  ['prepared geometry',{maxPreparedVertices:6},async f => { f.sprite.graphics.beginFill(0x00ff00).drawRect(5,0,2,2).endFill(); return f.frame(); },'GEOMETRY_RANGE'],
  ['frame geometry',{maxFrameGeometryBytes:1},async f => { await f.mesh(); return f.frame(); },'FRAME_BUDGET'],
  ['pending geometry',{maxPendingGeometryBytes:1},async f => { await f.mesh(); return f.frame(); },'BACKPRESSURE'],
]) test('GLU00 '+name+' refuses before native work', async () => hosted(async f => {
  const frame = await make(f), before = f.ports.events.length, status = f.host.getStatus();
  assert.throws(() => f.stage(frame),code(expected));
  assert.equal(f.ports.events.length,before); assert.equal(f.host.getStatus().pendingFrames,0);
  assert.equal(f.host.getStatus().lastSerial,status.lastSerial);
}, {options}));

test('GLU00 two genuine frames keep pending canonical pages plus original copy within 32 MiB', async () => hosted(async f => {
  // Each public frame stays within Engine's 16 MiB source cap. The first holds
  // 16 MiB; second admission needs 16 MiB canonical plus a 4 MiB original copy.
  const firstPages = await f.images(4), firstFrame = f.frame(); assert.equal(firstFrame.pages.length,4);
  const held = f.stage(firstFrame); await held.ready;
  assert.equal(f.host.getSharedStatus().pendingCanonicalBytes,16 * MiB);
  for (const node of firstPages.nodes) f.engine.stage.removeChild(node);
  await f.images(4); const frame = f.frame(), before = f.ports.events.length;
  assert.equal(frame.pages.length,4); assert.notEqual(frame.pages[0].source,firstFrame.pages[0].source);
  assert.throws(() => f.stage(frame),code('BACKPRESSURE'));
  assert.equal(f.ports.events.length,before); assert.equal(f.host.getStatus().pendingFrames,1);
}));

test('GLU01 aggregate scheduled upload tasks stay at 4 MiB with whole rows and original geometry units', async () => hosted(async f => {
  await f.images(3); const frame = f.frame(), meter = taskUploadMeter(f.ports);
  try {
    const ticket = f.stage(frame); await ticket.ready; await meter.finish();
    assert.ok(meter.groups.length >= 3,'multiple actual markers must separate the aggregate payload');
    assert.ok(meter.groups.every(group => group.bytes > 0 && group.bytes <= 4 * MiB));
    const rows = meter.groups.flatMap(group => group.rows);
    const imageRows = rows.filter(row => row.name === 'texSubImage2D');
    assert.equal(imageRows.reduce((n,row) => n + row.args[4] * row.args[5] * 4,0),12 * MiB);
    assert.ok(imageRows.every(({args}) => args[4] === 1024 && Number.isInteger(args[3]) && Number.isInteger(args[5]) && args[5] > 0));
    assert.ok(rows.some(row => row.name === 'bufferSubData'));
    // A bounded implementation may put whole pages in separate tasks. This
    // control requires the aggregate cap, not a particular packing order.
    for (const {name,args} of rows) if (name === 'bufferSubData' && args[0] === f.ports.gl.ARRAY_BUFFER) {
      assert.equal(args[1] % 44,0); assert.equal(args[2].byteLength % 44,0);
    }
    const before = uploadRows(f.ports.events).length; await ticket.submit().completed;
    assert.equal(uploadRows(f.ports.events).length,before,'submit reuses the admitted uploaded resources');
  } finally { await meter.finish(); }
}, {ports:glPorts({alignment:12})}));

test('GLU02 upload ready waits for a real controlled fence and never changes the visible target', async () => {
  const ports = glPorts(), sizes = []; let width = ports.canvas.width, height = ports.canvas.height;
  Object.defineProperties(ports.canvas, {
    width:{configurable:true,get:() => width,set:value => { sizes.push(['width',value]); width = value; }},
    height:{configurable:true,get:() => height,set:value => { sizes.push(['height',value]); height = value; }},
  });
  await hosted(async f => {
    f.ports.autoSignal = false; const before = f.ports.events.length, sizeBefore = sizes.length;
    const frame = f.frame(16,12), ticket = f.stage(frame);
    assert.throws(() => ticket.submit(),code('UPLOAD_NOT_READY'));
    await until(() => f.ports.events.slice(before).some(row => row[0] === 'fenceSync'));
    await pending(ticket.ready); assert.equal(f.host.getStatus().pendingFrames,1);
    assert.deepEqual(visibleRows(f.ports.events.slice(before)),[]); assert.equal(sizes.length,sizeBefore);
    assert.deepEqual([ports.canvas.width,ports.canvas.height],[8,8]);
    f.ports.autoSignal = true; f.ports.signalAll(); const ready = await ticket.ready;
    assert.deepEqual(ready,{generation:1,frameId:frame.frameId}); assert.ok(Object.isFrozen(ready));
    assert.deepEqual(visibleRows(f.ports.events.slice(before)),[]); assert.equal(sizes.length,sizeBefore);
    const uploads = uploadRows(f.ports.events).length, submitted = ticket.submit(); assert.ok(Object.isFrozen(submitted));
    assert.deepEqual([submitted.frameId,submitted.generation,submitted.serial],[frame.frameId,1,2]);
    await submitted.completed; assert.equal(uploadRows(f.ports.events).length,uploads);
    assert.deepEqual([ports.canvas.width,ports.canvas.height],[16,12]);
    assert.equal(visibleRows(f.ports.events.slice(before)).filter(row => row[0] === 'drawArrays').length,2);
    assert.throws(() => ticket.submit(),code('UPLOAD_USED')); ticket.dispose();
  },{ports});
});

test('GLU03 stage reserves the full enabled readback envelope and binds a request only on submit', async () => hosted(async f => {
  const frame = f.frame(16,12), before = f.ports.events.length, ticket = f.stage(frame);
  assert.equal(f.host.getStatus().pendingReadbackBytes,16 * 12 * 8);
  await ticket.ready; assert.equal(f.ports.events.slice(before).some(row => row[0] === 'readPixels'),false);
  const readback = f.host.requestReadback(); await pending(readback);
  const submitted = ticket.submit(), pixels = await readback; await submitted.completed;
  assert.deepEqual([pixels.width,pixels.height,pixels.serial,pixels.frameId,pixels.generation],[16,12,2,frame.frameId,1]);
  await f.host.whenIdle(); assert.equal(f.host.getStatus().pendingReadbackBytes,0);
}));

test('GLU03 ordinary readback wins its earlier request while the ready stage binds a later request', async () => hosted(async f => {
  const staged = f.stage(f.frame(16,12)); await staged.ready;
  f.ports.autoSignal = false; const first = f.host.requestReadback(), ordinary = f.frame();
  f.host.renderSharedFrame(ordinary); f.ports.autoSignal = true; f.ports.signalAll();
  const firstPixels = await first; assert.equal(firstPixels.frameId,ordinary.frameId);
  const later = f.host.requestReadback(), submission = staged.submit(), laterPixels = await later;
  await submission.completed; assert.equal(laterPixels.frameId,submission.frameId); assert.notEqual(laterPixels.frameId,ordinary.frameId);
  assert.deepEqual([laterPixels.width,laterPixels.height],[16,12]);
}));

test('GLU04 opaque upload methods refuse copied and detached receivers without effects', async () => hosted(async f => {
  const ticket = f.stage(); await ticket.ready; const copy = {...ticket}, before = f.ports.events.length;
  assert.throws(() => copy.submit(),code('UPLOAD_INVALID'));
  assert.throws(() => copy.dispose(),code('UPLOAD_INVALID'));
  const submit = ticket.submit, dispose = ticket.dispose;
  assert.throws(() => submit(),code('UPLOAD_INVALID')); assert.throws(() => dispose(),code('UPLOAD_INVALID'));
  assert.equal(f.ports.events.length,before); assert.equal(f.host.getStatus().pendingFrames,1);
  ticket.dispose(); ticket.dispose(); assert.throws(() => ticket.submit(),code('UPLOAD_DISPOSED'));
}));

test('GLU04 genuine frame authentication precedes options; healthy thrown undefined keeps its cause', async () => hosted(async f => {
  let read = 0; const options = {get signal(){read++; throw undefined;}}, before = f.ports.events.length;
  assert.throws(() => f.stage({...f.frame()},options),code('FRAME_PROFILE_UNSUPPORTED')); assert.equal(read,0);
  assert.throws(() => f.stage(f.frame(),options),error => code('UPLOAD_OPTIONS_INVALID')(error) && Object.hasOwn(error,'cause') && error.cause === undefined);
  assert.equal(read,1); assert.equal(f.ports.events.length,before); assert.equal(f.host.getStatus().pendingFrames,0);
}));

test('GLU04 signal reads are captured; a late subscription abort is detected with its first reason', async () => hosted(async f => {
  const owned = signalPort(), reason = Object.freeze({lateAbort:true}); owned.onAdd = () => owned.mark(reason);
  const before = f.ports.events.length;
  assert.throws(() => f.stage(f.frame(),{signal:owned.signal}),error => code('UPLOAD_ABORTED')(error) && error.cause === reason);
  assert.equal(owned.trace.filter(row => row === 'add').length,1); assert.equal(owned.trace.filter(row => row === 'remove').length,1);
  assert.equal(owned.trace.filter(row => row === 'reason').length,1); assert.ok(owned.trace.filter(row => row === 'aborted').length >= 2);
  assert.equal(owned.trace.filter(row => row === 'unsubscribe').length,1); assert.equal(owned.count(),0);
  assert.equal(f.host.getStatus().pendingFrames,0); assert.equal(f.ports.events.length,before);
}));

test('GLU04 pre-abort reads its reason once before a charged record or native work', async () => hosted(async f => {
  const owned = signalPort(), reason = Object.freeze({preAbort:true}); owned.mark(reason);
  const before = f.ports.events.length;
  assert.throws(() => f.stage(f.frame(),{signal:owned.signal}),error => code('UPLOAD_ABORTED')(error) && error.cause === reason);
  assert.equal(owned.trace.filter(row => row === 'reason').length,1); assert.equal(owned.count(),0);
  assert.equal(owned.trace.includes('subscribe'),false);
  assert.equal(f.host.getStatus().pendingFrames,0); assert.equal(f.ports.events.length,before);
}));

test('GLU04 healthy signal never reads reason and abort after submission cannot cancel transferred work', async () => hosted(async f => {
  const owned = signalPort(), ticket = f.stage(f.frame(),{signal:owned.signal}); await ticket.ready;
  assert.equal(owned.trace.includes('reason'),false); assert.equal(owned.trace.filter(row => row === 'aborted').length,2);
  assert.equal(owned.trace.filter(row => row === 'add').length,1); assert.equal(owned.trace.filter(row => row === 'remove').length,1);
  f.ports.autoSignal = false; const submitted = ticket.submit();
  owned.abort({tooLate:true}); ticket.dispose(); await pending(submitted.completed);
  assert.equal(owned.count(),0); assert.equal(owned.trace.filter(row => row === 'unsubscribe').length,1);
  assert.equal(owned.trace.includes('reason'),false);
  f.ports.signalAll(); await submitted.completed;
}));

for (const fault of ['recursive event','throw undefined','close']) test('GLU04 first abort reason '+fault+' is latched before reentry', async () => hosted(async f => {
  const owned = signalPort(), originalReason = {}, laterReason = {}; let closing;
  owned.onAdd = () => owned.abort(originalReason);
  owned.onRead = key => {
    if (key !== 'reason') return;
    if (fault === 'recursive event') owned.abort(laterReason);
    else if (fault === 'throw undefined') throw undefined;
    else closing = f.host.close();
  };
  const before = f.ports.events.length;
  assert.throws(() => f.stage(f.frame(),{signal:owned.signal}),error => fault === 'close' ? code('CLOSED')(error)
    : fault === 'throw undefined' ? code('UPLOAD_OPTIONS_INVALID')(error) && Object.hasOwn(error,'cause') && error.cause === undefined
    : code('UPLOAD_ABORTED')(error) && error.cause === laterReason);
  // The fixture getter returns its current reason after the reentrant callback;
  // the SDK must capture that one actual getter result, never read again.
  assert.equal(owned.trace.filter(row => row === 'reason').length,1);
  assert.equal(f.host.getStatus().pendingFrames,0);
  assert.equal(uploadRows(f.ports.events.slice(before)).length,0);
  if (closing) await closing;
}));

for (const action of ['abort','stop','throw undefined']) test('GLU04 subscription '+action+' unwinds its already charged record synchronously', async () => hosted(async f => {
  const owned = signalPort(), reason = {}; let observedRecord = false;
  owned.onAdd = () => {
    observedRecord = f.host.getStatus().pendingFrames === 1;
    assert.throws(() => f.stage(),code('REENTRANT'));
    if (action === 'abort') owned.abort(reason);
    else if (action === 'stop') f.host.stop();
    else throw undefined;
  };
  const before = f.ports.events.length;
  assert.throws(() => f.stage(f.frame(),{signal:owned.signal}),error => action === 'abort' ? code('UPLOAD_ABORTED')(error) && error.cause === reason
    : action === 'stop' ? code('STOPPED')(error)
    : code('UPLOAD_OPTIONS_INVALID')(error) && Object.hasOwn(error,'cause') && error.cause === undefined);
  assert.equal(observedRecord,true); assert.equal(owned.count(),0);
  assert.equal(owned.trace.filter(row => row === 'unsubscribe').length,1);
  assert.equal(f.host.getStatus().pendingFrames,0); assert.equal(f.ports.events.length,before);
}));

test('GLU04 dispose removal reentry cannot repeat removal or publish work after close', async () => hosted(async f => {
  const owned = signalPort(), ticket = f.stage(f.frame(),{signal:owned.signal}); await ticket.ready;
  let closing; owned.onRemove = () => { closing = f.host.close(); owned.abort({duringRemove:true}); };
  const before = f.ports.events.length;
  ticket.dispose(); await closing;
  assert.equal(owned.trace.filter(row => row === 'unsubscribe').length,1); assert.equal(owned.count(),0);
  assert.deepEqual(visibleRows(f.ports.events.slice(before)),[]);
  const copy = {...ticket}; assert.throws(() => copy.submit(),code('UPLOAD_INVALID')); assert.throws(() => copy.dispose(),code('UPLOAD_INVALID'));
}));

test('GLU04 removed and retired listeners never read a late abort reason', async () => hosted(async f => {
  let retained, reasons = 0, removals = 0;
  const signal = {
    aborted:false,
    get reason() { reasons++; throw undefined; },
    addEventListener(type, listener) { assert.equal(this,signal); assert.equal(type,'abort'); retained = listener; },
    removeEventListener(type, listener) {
      assert.equal(this,signal); assert.equal(type,'abort'); assert.equal(listener,retained);
      removals++; retained.call(signal);
    },
  };
  const ticket = f.stage(f.frame(),{signal}); await ticket.ready;
  ticket.dispose(); assert.equal(reasons,0); assert.equal(removals,1);
  await until(() => f.host.getStatus().pendingFrames === 0);
  const before = f.ports.events.length;
  retained.call(signal); assert.equal(reasons,0); assert.equal(removals,1);
  assert.equal(f.ports.events.length,before); assert.throws(() => ticket.submit(),code('UPLOAD_DISPOSED'));
}));

for (const action of ['stop','close','throw']) test('GLU04 submit removal '+action+' refuses before changing a differently sized canvas', async () => {
  const ports = glPorts(), sizes = []; let width = ports.canvas.width, height = ports.canvas.height;
  Object.defineProperties(ports.canvas, {
    width:{configurable:true,get:() => width,set:value => { sizes.push(['width',value]); width = value; }},
    height:{configurable:true,get:() => height,set:value => { sizes.push(['height',value]); height = value; }},
  });
  await hosted(async f => {
    const owned = signalPort(), ticket = f.stage(f.frame(16,12),{signal:owned.signal}); await ticket.ready;
    let closing;
    owned.onRemove = () => { if (action === 'close') closing = f.host.close(); else if (action === 'stop') f.host.stop(); throw undefined; };
    const before = f.ports.events.length, sizeBefore = sizes.length;
    assert.throws(() => ticket.submit(),error => action === 'throw'
      ? code('UPLOAD_OPTIONS_INVALID')(error) && Object.hasOwn(error,'cause') && error.cause === undefined
      : code(action === 'close' ? 'CLOSED' : 'STOPPED')(error));
    if (closing) await closing;
    await until(() => f.host.getStatus().pendingFrames === 0);
    assert.equal(sizes.length,sizeBefore); assert.deepEqual([width,height],[8,8]);
    assert.deepEqual(visibleRows(f.ports.events.slice(before)),[]);
    assert.equal(owned.trace.filter(row => row === 'unsubscribe').length,1); assert.equal(owned.count(),0);
  },{ports});
});

for (const boundary of ['signal getter','subscription']) test('GLU04 close during '+boundary+' revokes admission before native allocation', async () => hosted(async f => {
  let closing; const cause = {}, owned = signalPort();
  const options = boundary === 'signal getter' ? {get signal(){closing = f.host.close(); throw cause;}} : {signal:owned.signal};
  if (boundary === 'subscription') owned.onAdd = () => { closing = f.host.close(); throw cause; };
  const before = f.ports.events.length;
  assert.throws(() => f.stage(f.frame(),options),code('CLOSED'));
  await closing; assert.equal(f.host.getStatus().pendingFrames,0); assert.equal(owned.count(),0);
  assert.equal(uploadRows(f.ports.events.slice(before)).length,0);
  assert.equal(f.ports.events.slice(before).some(row => /^create/.test(row[0])),false);
}));

test('GLU05 abort after an actual upload write promptly rejects ready while proof keeps the record charged', async () => hosted(async f => {
  await f.images(2); const controller = new AbortController(), reason = {}, before = f.ports.events.length;
  f.ports.autoSignal = false; let aborted = false;
  f.ports.onCall = (name) => { if (!aborted && name === 'texSubImage2D') { aborted = true; controller.abort(reason); } };
  const ticket = f.stage(f.frame(),{signal:controller.signal});
  await assert.rejects(ticket.ready,error => code('UPLOAD_ABORTED')(error) && error.cause === reason);
  assert.equal(aborted,true); assert.ok(uploadRows(f.ports.events.slice(before)).length > 0);
  assert.equal(f.host.getStatus().pendingFrames,1);
  const idle = outcome(f.host.whenIdle()); await pending(idle);
  f.ports.onCall = undefined; f.ports.autoSignal = true; f.ports.signalAll();
  const settled = await idle; assert.ok(code('UPLOAD_ABORTED')(settled.error));
  assert.equal(f.host.getStatus().pendingFrames,0);
}));

test('GLU05 a ready held ticket expires at the fixed actual ten-second deadline', {timeout:15000}, async () => hosted(async f => {
  const ticket = f.stage(); await ticket.ready; const idle = outcome(f.host.whenIdle()); await pending(idle);
  // Deliberate wall-clock wait: no clock/scheduler/global interception or shorter product deadline.
  await new Promise(resolve => setTimeout(resolve,10100));
  assert.throws(() => ticket.submit(),code('UPLOAD_EXPIRED'));
  const settled = await idle; assert.ok(code('UPLOAD_EXPIRED')(settled.error));
  assert.equal(f.host.getStatus().pendingFrames,0); await ticket.ready;
}));

test('GLU06 ready stage pins a resident page through more than 32 MiB of competing residency', async () => hosted(async f => {
  const {nodes} = await f.images(1,512,512), saved = f.frame(); let bound, resident;
  f.ports.onCall = (name,args) => {
    if (name === 'bindTexture') bound = args[1];
    if (name === 'texSubImage2D') resident = bound;
  };
  f.host.renderSharedFrame(saved); await f.host.whenIdle(); f.ports.onCall = undefined; assert.ok(resident);
  const warmWrites = uploadRows(f.ports.events).filter(row => row[0] === 'texSubImage2D').length;
  const held = f.stage(saved); await held.ready;
  assert.equal(uploadRows(f.ports.events).filter(row => row[0] === 'texSubImage2D').length,warmWrites,'current READY pages are reused');
  assert.equal(f.host.getStatus().pendingFrames,1); assert.ok(f.host.getStatus().pendingUploadBytes > 0);
  f.engine.stage.removeChild(nodes[0]);
  const pressure = [];
  for (let batch = 0; batch < 5; batch++) {
    const pages = await f.images(8,512,512); pressure.push(...pages.nodes);
    f.host.renderSharedFrame(f.frame());
    await until(() => f.host.getStatus().pendingFrames === 1,'ordinary pressure record retires while stage remains held');
    for (const node of pages.nodes) f.engine.stage.removeChild(node);
    assert.equal(resident.deleted,false,'ready-stage pin prevents eviction of its page');
  }
  assert.equal(pressure.length,40); assert.ok(f.ports.owners.some(owner => owner.kind === 'Texture' && owner.deleted));
  const before = uploadRows(f.ports.events).length; await held.submit().completed; await f.host.whenIdle();
  assert.equal(uploadRows(f.ports.events).length,before); assert.equal(f.host.getStatus().pendingFrames,0);
}));

test('GLU07 native completion and synchronous readback extraction failure remain separate', async () => hosted(async f => {
  const ticket = f.stage(); await ticket.ready;
  const readback = outcome(f.host.requestReadback()), cause = Object.freeze({extract:true});
  f.closeMode = 'safe-or-accounted-unsafe';
  f.ports.fail = {name:'getBufferSubData',cause}; const submission = ticket.submit(), idle = outcome(f.host.whenIdle());
  await submission.completed;
  const pixels = await readback; assert.ok(code('READBACK_FAILED')(pixels.error)); assert.equal(pixels.error.cause,cause);
  const settled = await idle; assert.ok(code('READBACK_FAILED')(settled.error));
  assert.equal(f.host.getStatus().pendingFrames,0);
}));

test('GLU07 committed CPU bindings remain committed after staged candidate submit fails', async () => candidateFixture(async c => hosted(async f => {
  const prepared = await c.prepare(), saved = candidate(c,prepared.ticket), upload = f.stage(saved);
  await upload.ready; assert.equal(c.target.textureLease,c.old.lease);
  prepared.ticket.commit(); assert.equal(c.target.textureLease,prepared.lease);
  f.ports.fail = {name:'drawArrays',cause:{drawFailure:true}}; f.closeMode = 'safe-or-accounted-unsafe';
  assert.throws(() => upload.submit(),code('RENDER_FAILED'));
  assert.equal(c.target.textureLease,prepared.lease,'Host failure does not roll back CPU commit');
  const ordinary = c.capture(); assert.equal(ordinary.pages[0].source,prepared.image);
}))); // Controlled command failure establishes no presented pixels.

test('GLU08 scene staging uses complete alignment-12 arenas and preserves scene/overlay order at submit', async () => hosted(async f => {
  const before = f.ports.events.length, ticket = f.stageScene();
  const status = f.host.getSceneStatus();
  assert.ok(status.pendingSceneBytes > 0 && status.pendingUniformBytes > 0 && status.pendingDepthBytes > 0);
  assert.equal(f.host.getStatus().pendingReadbackBytes,8*8*8);
  await ticket.ready; assert.deepEqual(visibleRows(f.ports.events.slice(before)),[]);
  const uploads = uploadRows(f.ports.events).length; await ticket.submit().completed; await f.host.whenIdle();
  const events = f.ports.events.slice(before), draws = events.filter(row => row[0] === 'drawElements' || row[0] === 'drawArrays');
  assert.deepEqual(draws.map(row => row[0]),['drawElements','drawArrays','drawArrays']);
  assert.deepEqual(draws[0].slice(1),[f.ports.gl.TRIANGLES,3,f.ports.gl.UNSIGNED_INT,0]);
  assert.equal(uploadRows(f.ports.events).length,uploads);
  const ranges = events.filter(row => row[0] === 'bindBufferRange' && row[3] !== null);
  assert.ok(ranges.some(row => row[4] === 132 && row[5] === 64));
  assert.ok(ranges.every(row => row[4] % 12 === 0));
  assert.deepEqual([f.host.getSceneStatus().pendingSceneBytes,f.host.getSceneStatus().pendingUniformBytes,f.host.getSceneStatus().pendingDepthBytes],[0,0,0]);
}, {scene:true,ports:glPorts({alignment:12})}));

test('GLU08 scene and overlay are genuine inputs before options and profile checks', async () => hosted(async f => {
  let reads = 0; const options = {get signal(){reads++; throw Error('unreachable');}}, before = f.ports.events.length;
  assert.throws(() => f.stageScene({...f.scene},f.frame(),options),code('FRAME_INVALID'));
  assert.equal(reads,0); assert.equal(f.ports.events.length,before);
  assert.throws(() => f.stageScene(f.scene,{...f.frame()},options),code('FRAME_PROFILE_UNSUPPORTED'));
  assert.equal(reads,0); assert.equal(f.ports.events.length,before);
  const wrong = f.engine.captureSharedFrame({width:8,height:8});
  assert.throws(() => f.stageScene(f.scene,wrong),code('FRAME_PROFILE_UNSUPPORTED'));
  assert.equal(f.ports.events.length,before);
}, {scene:true}));

test('GLU08 genuine scene depth charge rejects before native allocation', async () => hosted(async f => {
  const overlay = f.frame(2049,2048), before = f.ports.events.length;
  assert.throws(() => f.stageScene(f.scene,overlay),code('FRAME_BUDGET'));
  assert.equal(f.ports.events.length,before); assert.equal(f.host.getStatus().pendingFrames,0);
}, {scene:true,options:{enableReadback:false}}));

test('GLH01 session status projects existing GL state and restoration barriers', async () => hosted(async f => {
  const status = f.host.getSessionStatus(); assert.ok(Object.isFrozen(status));
  assert.deepEqual(status,{state:'ready',generation:1,attempt:0,firstFailure:null,generationFailure:null});
  assert.equal('recover' in f.host,false);
  const emptyIdle = f.host.whenIdle(); f.ports.syntheticLoss();
  assert.equal(f.host.getSessionStatus().state,'ready');
  f.ports.lose(); await emptyIdle;
  const barrier = f.host.whenReady(); assert.equal(f.host.whenReady(),barrier);
  assert.equal(f.host.getSessionStatus().state,'lost');
  f.ports.restore(); assert.equal(f.host.getSessionStatus().state,'restoring');
  await barrier;
  const fresh = f.host.getSessionStatus(); assert.equal(fresh.state,'ready'); assert.equal(fresh.generation,2); assert.equal(fresh.attempt,1);
  assert.equal(fresh.firstFailure.code,'WEBGL2_CONTEXT_LOST'); assert.equal(fresh.generationFailure,null);
  await f.host.whenIdle(); f.host.stop(); assert.equal(f.host.getSessionStatus().state,'stopped');
  await assert.rejects(f.host.start(),code('STOPPED')); await assert.rejects(f.host.whenReady(),code('STOPPED'));
}));

test('GLH01 initial session states and close are finite with no GL recover method', async () => hosted(async () => {
  const ports = glPorts(), host = createSharedWebGL2Host({canvas:ports.canvas});
  try {
    assert.equal(host.getSessionStatus().state,'new'); assert.equal(host.getSessionStatus().attempt,0);
    const start = host.start(); assert.equal(host.start(),start); assert.equal(host.whenReady(),start);
    assert.equal(host.getSessionStatus().state,'starting'); await start;
    const closing = host.close(); assert.equal(host.getSessionStatus().state,'closing'); await closing;
    assert.equal(host.getSessionStatus().state,'closed'); assert.equal(ports.listenerCount(),0);
  } finally { await host.close(); }
}));

test('GLH01 existing restoration timeout projects failed without another readiness attempt', async () => hosted(async f => {
  f.ports.lose(); const ready = f.host.whenReady();
  await assert.rejects(ready,code('RESTORE_TIMEOUT'));
  const status = f.host.getSessionStatus(); assert.equal(status.state,'failed');
  assert.equal(status.firstFailure.code,'WEBGL2_CONTEXT_LOST');
  await assert.rejects(f.host.whenReady(),code('FAILED'));
  const before = f.ports.events.length; f.ports.restore();
  assert.equal(f.host.getSessionStatus().state,'failed'); assert.equal(f.ports.events.length,before);
}, {options:{restoreTimeoutMs:15}}));

for (const scene of [false,true]) test('GLH06/H07 stale held stage revokes on loss; fresh '+(scene ? 'scene' : 'ordinary')+' readiness is independent', async () => hosted(async f => {
  const ticket = scene ? f.stageScene() : f.stage(); await ticket.ready;
  const oldIdle = outcome(f.host.whenIdle()); await pending(oldIdle);
  f.ports.lose(); const barrier = f.host.whenReady();
  const lost = await oldIdle; assert.ok(code('CONTEXT_LOST')(lost.error));
  f.ports.restore(); await barrier;
  assert.throws(() => ticket.submit(),code('UPLOAD_STALE')); await ticket.ready;
  const fresh = scene ? f.stageScene() : f.stage(); const ready = await fresh.ready; assert.equal(ready.generation,2);
  await fresh.submit().completed; await f.host.whenIdle(); assert.equal(f.host.getStatus().pendingFrames,0);
}, {scene}));

test('GLH06 old held upload fence cannot publish ready or pixels into a restored generation', async () => hosted(async f => {
  f.ports.autoSignal = false; const before = f.ports.events.length;
  const upload = f.stage(), oldReady = outcome(upload.ready), oldIdle = outcome(f.host.whenIdle());
  await until(() => f.ports.events.slice(before).some(row => row[0] === 'fenceSync'));
  f.ports.lose(); const restored = f.host.whenReady();
  assert.ok(code('CONTEXT_LOST')((await oldReady).error)); assert.ok(code('CONTEXT_LOST')((await oldIdle).error));
  f.ports.autoSignal = true; f.ports.restore(); await restored;
  assert.equal(f.host.getSessionStatus().generation,2); assert.equal(f.host.getStatus().pendingFrames,0);
  const after = f.ports.events.length; f.ports.signalAll(); await turn();
  assert.deepEqual(visibleRows(f.ports.events.slice(after)),[]);
  assert.throws(() => upload.submit(),code('UPLOAD_STALE'));
  const fresh = f.stage(); assert.equal((await fresh.ready).generation,2); await fresh.submit().completed;
}));

test('GLH07 idle snapshots include held ready records and exclude later admissions', async () => hosted(async f => {
  const first = f.stage(); await first.ready; const snapshot = outcome(f.host.whenIdle());
  const later = f.stage(); await later.ready; await pending(snapshot);
  first.dispose(); const prior = await snapshot; assert.ok(code('UPLOAD_DISPOSED')(prior.error));
  assert.equal(f.host.getStatus().pendingFrames,1);
  const remaining = outcome(f.host.whenIdle()); await pending(remaining);
  later.dispose(); const last = await remaining; assert.ok(code('UPLOAD_DISPOSED')(last.error));
}));

for (const action of ['stop','close']) test('GLH07 '+action+' revokes held stages but drains an already submitted record', async () => hosted(async f => {
  const held = f.stage(), submitted = f.stage(); await Promise.all([held.ready,submitted.ready]);
  f.ports.autoSignal = false; const completion = submitted.submit().completed, idle = outcome(f.host.whenIdle());
  const closing = action === 'close' ? f.host.close() : (f.host.stop(),undefined);
  if (closing) void outcome(closing);
  assert.throws(() => held.submit(),code(action === 'close' ? 'CLOSED' : 'STOPPED'));
  await pending(completion); f.ports.signalAll(); await completion;
  const done = await idle; assert.ok(code(action === 'close' ? 'CLOSED' : 'STOPPED')(done.error));
  if (closing) await closing;
  assert.equal(f.host.getStatus().pendingFrames,0);
}));

test('GLH05 unknown cleanup cannot be forgiven by later controlled context loss', async () => hosted(async f => {
  const ticket = f.stage(); await ticket.ready;
  const idle = outcome(f.host.whenIdle()), cause = Object.freeze({deleteFailure:true});
  f.ports.fail = {name:'deleteBuffer',cause}; ticket.dispose(); await idle;
  const before = f.host.getSharedStatus().retention;
  assert.ok(before.unknownBytes > 0 || before.unknownNativeBytes > 0 || before.unknownNativeObjects > 0);
  f.ports.lose(); const after = f.host.getSharedStatus().retention;
  assert.ok(after.unknownBytes >= before.unknownBytes && after.unknownNativeBytes >= before.unknownNativeBytes);
  f.closeMode = 'unsafe';
}));

test('GLH05 controlled loss before fence rejection invalidates only still-known owners', async () => hosted(async f => {
  const before = f.ports.events.length; f.ports.autoSignal = false;
  const ticket = f.stage(), ready = outcome(ticket.ready), idle = outcome(f.host.whenIdle());
  await until(() => f.ports.events.slice(before).some(row => row[0] === 'fenceSync'));
  let lost = false;
  f.ports.fail = {name:'clientWaitSync',cause:{afterLoss:true}};
  f.ports.onCall = name => { if (name === 'clientWaitSync' && !lost) { lost = true; f.ports.lose(); } };
  const settled = await ready; assert.ok(code('CONTEXT_LOST')(settled.error));
  assert.ok(code('CONTEXT_LOST')((await idle).error)); assert.equal(lost,true);
  f.ports.onCall = undefined;
  const ledger = f.host.getSharedStatus().retention;
  assert.equal(ledger.unknownBytes,0); assert.equal(ledger.unknownNativeBytes,0); assert.equal(ledger.unknownNativeObjects,0);
}));
