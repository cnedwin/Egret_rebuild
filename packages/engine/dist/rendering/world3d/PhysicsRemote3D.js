// SPDX-License-Identifier: Apache-2.0
// Physics on another thread. The world lives behind a message port - in a worker,
// say - and the page keeps light stand-ins for its bodies: it sends what it wants
// done, asks for a step, and receives where everything is. Nothing here names a
// worker or the DOM; both ends only need something that can post and receive
// messages, so the same code runs over a Worker, a MessagePort or a test loopback.
import { World3DError, requireFinite3D } from './core3D.js';
import { createConvexHullShape3D } from './PhysicsHull3D.js';
import { PhysicsWorld3D } from './Physics3D.js';
const ownsBody = Symbol('remote physics body ownership');
const triple = (value, field) => {
    const list = value;
    if (!list || list.length !== 3)
        throw new World3DError('WORLD3D_INPUT_INVALID', field);
    return [requireFinite3D(list[0], field), requireFinite3D(list[1], field), requireFinite3D(list[2], field)];
};
function localShape(shape) {
    if (shape?.type === 'convex')
        return { type: 'convex', hull: createConvexHullShape3D(shape.points) };
    if (shape?.type === 'compound')
        return {
            type: 'compound',
            children: shape.children.map(child => ({ ...child, shape: localShape(child.shape) }))
        };
    return shape;
}
/**
 * Run a physics world on this end of a port and answer the messages of a
 * PhysicsClient3D. In a worker this is the whole script:
 *     import {servePhysics3D} from '@egret/engine/world3d';
 *     servePhysics3D(self);
 * Returns the world, for a host that wants to add to it directly.
 */
export function servePhysics3D(port, options = {}) {
    if (!port || typeof port.postMessage !== 'function')
        throw new World3DError('WORLD3D_INPUT_INVALID', 'port');
    const world = new PhysicsWorld3D(options);
    const bodies = new Map(), ids = new Map(), joints = new Map();
    let began = [], ended = [], startup = true;
    world.onContactBegin = (a, b) => {
        const x = ids.get(a), y = ids.get(b);
        if (x !== undefined && y !== undefined)
            began.push(x, y);
    };
    world.onContactEnd = (a, b) => {
        const x = ids.get(a), y = ids.get(b);
        if (x !== undefined && y !== undefined)
            ended.push(x, y);
    };
    const body = (id) => {
        const found = bodies.get(id);
        if (!found)
            throw new World3DError('WORLD3D_INPUT_INVALID', 'unknown body ' + String(id));
        return found;
    };
    const handle = (m) => {
        if (m.t === 'world') {
            if (!startup)
                throw new World3DError('WORLD3D_INPUT_INVALID', 'world options are only accepted at startup');
            const requested = m['options'];
            if (!requested ||
                typeof requested !== 'object' ||
                (requested.allowSleep !== undefined && typeof requested.allowSleep !== 'boolean')) {
                throw new World3DError('WORLD3D_INPUT_INVALID', 'world options');
            }
            const gravity = requested.gravity === undefined ? undefined : triple(requested.gravity, 'gravity');
            // Validate the configuration as a unit and keep the host's world and objects in place.
            const config = new PhysicsWorld3D(requested);
            if (!Number.isFinite(config.maxSubSteps) ||
                !Number.isFinite(config.iterations) ||
                !Number.isFinite(config.solverSteps)) {
                throw new World3DError('WORLD3D_INPUT_INVALID', 'world solver options');
            }
            if (requested.fixedStep !== undefined)
                world.fixedStep = config.fixedStep;
            if (requested.maxSubSteps !== undefined)
                world.maxSubSteps = config.maxSubSteps;
            if (requested.iterations !== undefined)
                world.iterations = config.iterations;
            if (requested.solverSteps !== undefined)
                world.solverSteps = config.solverSteps;
            if (requested.allowSleep !== undefined)
                world.allowSleep = config.allowSleep;
            if (gravity) {
                world.gravity.set(gravity);
                for (const one of world.bodies)
                    one.wake();
            }
            startup = false;
            return;
        }
        startup = false;
        switch (m.t) {
            case 'body': {
                const o = m['options'], made = world.createBody({ ...o, shape: localShape(o.shape) });
                bodies.set(m['id'], made);
                ids.set(made, m['id']);
                break;
            }
            case 'remove': {
                const found = bodies.get(m['id']);
                if (found) {
                    world.removeBody(found);
                    bodies.delete(m['id']);
                    ids.delete(found);
                }
                break;
            }
            case 'joint': {
                const o = m['options'];
                joints.set(m['id'], world.createJoint({
                    ...o,
                    bodyA: body(o['bodyA']),
                    ...(o['bodyB'] === undefined ? {} : { bodyB: body(o['bodyB']) })
                }));
                break;
            }
            case 'unjoint': {
                const found = joints.get(m['id']);
                if (found) {
                    world.removeJoint(found);
                    joints.delete(m['id']);
                }
                break;
            }
            case 'set': {
                const target = body(m['id']);
                if (m['position']) {
                    const p = triple(m['position'], 'position');
                    target.setPosition(p[0], p[1], p[2]);
                }
                if (m['quaternion']) {
                    const q = m['quaternion'];
                    target.setQuaternion(q[0], q[1], q[2], q[3]);
                }
                if (m['linearVelocity']) {
                    const v = triple(m['linearVelocity'], 'linearVelocity');
                    target.setLinearVelocity(v[0], v[1], v[2]);
                }
                if (m['angularVelocity']) {
                    const w = triple(m['angularVelocity'], 'angularVelocity');
                    target.setAngularVelocity(w[0], w[1], w[2]);
                }
                break;
            }
            case 'impulse': {
                const i = triple(m['impulse'], 'impulse');
                body(m['id']).applyImpulse(i[0], i[1], i[2], m['point']);
                break;
            }
            case 'force': {
                const f = triple(m['force'], 'force');
                body(m['id']).applyForce(f[0], f[1], f[2]);
                break;
            }
            // A change of gravity is felt by everything, including what had come to rest.
            case 'gravity':
                world.gravity.set(triple(m['value'], 'gravity'));
                for (const one of bodies.values())
                    one.wake();
                break;
            case 'step': {
                world.step(requireFinite3D(m['dt'], 'dt'));
                // Everything that can move, in one block: an id, then position and orientation, for each body.
                let count = 0;
                for (const one of bodies.values())
                    if (one.type !== 'static')
                        count++;
                const who = new Int32Array(count), poses = new Float32Array(count * 7), asleep = new Uint8Array(count);
                let at = 0;
                for (const [id, one] of bodies) {
                    if (one.type === 'static')
                        continue;
                    who[at] = id;
                    poses.set(one.position, at * 7);
                    poses.set(one.quaternion, at * 7 + 3);
                    asleep[at] = one.isSleeping ? 1 : 0;
                    at++;
                }
                const state = { t: 'state', frame: m['frame'], ids: who, poses, asleep, began, ended };
                began = [];
                ended = [];
                port.postMessage(state, [who.buffer, poses.buffer, asleep.buffer]);
                break;
            }
            case 'raycast': {
                const hit = world.raycast(triple(m['origin'], 'origin'), triple(m['direction'], 'direction'), m['maxDistance'] ?? Infinity, m['mask'] ?? -1);
                port.postMessage({
                    t: 'ray',
                    request: m['request'],
                    hit: hit && ids.has(hit.body)
                        ? { id: ids.get(hit.body), distance: hit.distance, point: hit.point, normal: hit.normal }
                        : null
                });
                break;
            }
            default:
                throw new World3DError('WORLD3D_INPUT_INVALID', 'unknown physics message ' + String(m.t));
        }
    };
    port.addEventListener('message', event => {
        const message = event.data;
        // A request that cannot be carried out is reported back rather than left to stop the worker.
        try {
            handle(message);
        }
        catch (error) {
            const text = error instanceof Error ? error.message : String(error);
            if (message?.t !== 'raycast') {
                port.postMessage({ t: 'error', about: message?.t, message: text });
                return;
            }
            const invalid = error instanceof World3DError && error.code === 'WORLD3D_INPUT_INVALID';
            port.postMessage({
                t: 'error',
                about: 'raycast',
                message: text,
                request: message['request'],
                code: invalid ? error.code : 'WORLD3D_RESOURCE_FAILED',
                detail: invalid ? error.detail : text
            });
        }
    });
    port.start?.();
    return world;
}
/** The page's stand-in for a body that lives behind the port. */
export class RemoteBody3D {
    id;
    type;
    /** Where the body was after the latest step this side has heard of. */
    position = new Float32Array(3);
    quaternion = new Float32Array([0, 0, 0, 1]);
    /** @internal Where it was the step before, for blending between the two. */
    previous = new Float32Array([0, 0, 0, 0, 0, 0, 1]);
    isSleeping = false;
    node;
    userData;
    #client;
    #alive = true;
    /** @internal */
    constructor(client, id, options) {
        this.#client = client;
        this.id = id;
        this.type = options.type ?? (options.shape.type === 'plane' ? 'static' : 'dynamic');
        if (options.position)
            this.position.set(options.position);
        if (options.quaternion)
            this.quaternion.set(options.quaternion);
        this.previous.set(this.position);
        this.previous.set(this.quaternion, 3);
        this.node = options.node;
        this.userData = options.userData;
    }
    get removed() {
        return !this.#alive;
    }
    send(message) {
        if (this.#alive && this.#client[ownsBody](this))
            this.#client.post({ ...message, id: this.id });
    }
    /** Move the body there at once; this side shows it there straight away. */
    setPosition(x, y, z) {
        this.position[0] = requireFinite3D(x, 'x');
        this.position[1] = requireFinite3D(y, 'y');
        this.position[2] = requireFinite3D(z, 'z');
        this.previous.set(this.position);
        this.send({ t: 'set', position: [x, y, z] });
        return this;
    }
    setQuaternion(x, y, z, w) {
        this.quaternion[0] = x;
        this.quaternion[1] = y;
        this.quaternion[2] = z;
        this.quaternion[3] = w;
        this.previous.set(this.quaternion, 3);
        this.send({ t: 'set', quaternion: [x, y, z, w] });
        return this;
    }
    setLinearVelocity(x, y, z) {
        this.send({
            t: 'set',
            linearVelocity: [requireFinite3D(x, 'x'), requireFinite3D(y, 'y'), requireFinite3D(z, 'z')]
        });
        return this;
    }
    setAngularVelocity(x, y, z) {
        this.send({
            t: 'set',
            angularVelocity: [requireFinite3D(x, 'x'), requireFinite3D(y, 'y'), requireFinite3D(z, 'z')]
        });
        return this;
    }
    applyImpulse(x, y, z, point) {
        this.send({ t: 'impulse', impulse: [x, y, z], ...(point ? { point: [point[0], point[1], point[2]] } : {}) });
    }
    /** A force for the next step only, as with a local body. */
    applyForce(x, y, z) {
        this.send({ t: 'force', force: [x, y, z] });
    }
    remove() {
        if (!this.#alive)
            return;
        this.send({ t: 'remove' });
        this.#alive = false;
        this.#client.forget(this);
    }
}
export class RemoteJoint3D {
    id;
    #client;
    #alive = true;
    /** @internal */
    constructor(client, id) {
        this.#client = client;
        this.id = id;
    }
    remove() {
        if (this.#alive) {
            this.#alive = false;
            this.#client.post({ t: 'unjoint', id: this.id });
        }
    }
}
/**
 * The page's end of a remote physics world. Create bodies and joints as with a
 * local world, call step() once per frame, and update() to place the nodes.
 * Positions arrive a moment after they are asked for, so what is shown trails
 * the simulation by about one step; update(alpha) blends the last two steps
 * to hide the difference between the step rate and the frame rate.
 */
export class PhysicsClient3D {
    #port;
    #bodies = new Map();
    #rays = new Map();
    #next = 1;
    #frame = 0;
    #answered = 0;
    #closed = false;
    #listener = (event) => this.receive(event.data);
    /** Steps asked for and not yet answered. */
    get pending() {
        return this.#frame - this.#answered;
    }
    /** Number of the latest step whose result has arrived. */
    get frame() {
        return this.#answered;
    }
    onContactBegin;
    onContactEnd;
    /** Called when the other end could not carry out a request. */
    onError;
    /** Called after the result of a step has been taken in. */
    onStep;
    constructor(port, options) {
        if (!port || typeof port.postMessage !== 'function')
            throw new World3DError('WORLD3D_INPUT_INVALID', 'port');
        this.#port = port;
        port.addEventListener('message', this.#listener);
        port.start?.();
        if (options)
            this.post({ t: 'world', options });
    }
    get bodies() {
        return this.#bodies.values();
    }
    /** @internal */ post(message) {
        if (!this.#closed)
            this.#port.postMessage(message);
    }
    [ownsBody](body) {
        return body instanceof RemoteBody3D && this.#bodies.get(body.id) === body;
    }
    /** @internal */ forget(body) {
        if (this[ownsBody](body))
            this.#bodies.delete(body.id);
    }
    createBody(options) {
        if (!options?.shape)
            throw new World3DError('WORLD3D_INPUT_INVALID', 'shape');
        const { node, userData, ...sent } = options, body = new RemoteBody3D(this, this.#next++, options);
        void node;
        void userData;
        this.#bodies.set(body.id, body);
        this.post({ t: 'body', id: body.id, options: sent });
        if (body.node) {
            body.node.position.set(body.position);
            body.node.quaternion.set(body.quaternion);
            body.node.markTransformDirty();
        }
        return body;
    }
    createJoint(options) {
        if (!options)
            throw new World3DError('WORLD3D_INPUT_INVALID', 'joint bodies');
        const { bodyA, bodyB, ...rest } = options;
        if (!this[ownsBody](bodyA) || (bodyB !== undefined && !this[ownsBody](bodyB)))
            throw new World3DError('WORLD3D_INPUT_INVALID', 'joint bodies');
        const joint = new RemoteJoint3D(this, this.#next++);
        this.post({
            t: 'joint',
            id: joint.id,
            options: { ...rest, bodyA: bodyA.id, ...(bodyB ? { bodyB: bodyB.id } : {}) }
        });
        return joint;
    }
    setGravity(x, y, z) {
        this.post({ t: 'gravity', value: [requireFinite3D(x, 'x'), requireFinite3D(y, 'y'), requireFinite3D(z, 'z')] });
    }
    /**
     * Ask for the world to advance. If `maxPending` earlier steps are still
     * unanswered the request is not sent and false is returned, so a slow
     * worker falls behind in time instead of piling up work.
     */
    step(deltaSeconds, maxPending = 2) {
        requireFinite3D(deltaSeconds, 'deltaSeconds');
        if (this.#closed || this.pending >= maxPending)
            return false;
        this.post({ t: 'step', dt: deltaSeconds, frame: ++this.#frame });
        return true;
    }
    /** The nearest solid body on a ray, as the world stands when the request arrives. */
    raycast(origin, direction, maxDistance, mask) {
        const request = this.#next++;
        return new Promise((resolve, reject) => {
            if (this.#closed) {
                resolve(undefined);
                return;
            }
            this.#rays.set(request, { resolve, reject });
            try {
                this.post({
                    t: 'raycast',
                    request,
                    origin: [origin[0], origin[1], origin[2]],
                    direction: [direction[0], direction[1], direction[2]],
                    ...(maxDistance === undefined ? {} : { maxDistance }),
                    ...(mask === undefined ? {} : { mask })
                });
            }
            catch (error) {
                this.#rays.delete(request);
                reject(error);
            }
        });
    }
    receive(m) {
        if (m?.t === 'state') {
            const who = m['ids'], poses = m['poses'], asleep = m['asleep'];
            for (let i = 0; i < who.length; i++) {
                const body = this.#bodies.get(who[i]);
                if (!body)
                    continue;
                body.previous.set(body.position);
                body.previous.set(body.quaternion, 3);
                body.position[0] = poses[i * 7];
                body.position[1] = poses[i * 7 + 1];
                body.position[2] = poses[i * 7 + 2];
                body.quaternion[0] = poses[i * 7 + 3];
                body.quaternion[1] = poses[i * 7 + 4];
                body.quaternion[2] = poses[i * 7 + 5];
                body.quaternion[3] = poses[i * 7 + 6];
                body.isSleeping = asleep[i] === 1;
            }
            this.#answered = Math.max(this.#answered, m['frame']);
            const pairs = (list, call) => {
                if (!call)
                    return;
                for (let i = 0; i + 1 < list.length; i += 2) {
                    const a = this.#bodies.get(list[i]), b = this.#bodies.get(list[i + 1]);
                    if (a && b)
                        call(a, b);
                }
            };
            pairs(m['began'], this.onContactBegin);
            pairs(m['ended'], this.onContactEnd);
            this.onStep?.(this.#answered);
        }
        else if (m?.t === 'ray') {
            const ray = this.#rays.get(m['request']), hit = m['hit'];
            this.#rays.delete(m['request']);
            const body = hit ? this.#bodies.get(hit.id) : undefined;
            ray?.resolve(hit && body ? { body, distance: hit.distance, point: hit.point, normal: hit.normal } : undefined);
        }
        else if (m?.t === 'error') {
            if (m['about'] === 'raycast') {
                const request = m['request'], ray = this.#rays.get(request);
                this.#rays.delete(request);
                const detail = typeof m['detail'] === 'string' ? m['detail'] : undefined;
                ray?.reject(new World3DError(m['code'] === 'WORLD3D_INPUT_INVALID' ? 'WORLD3D_INPUT_INVALID' : 'WORLD3D_RESOURCE_FAILED', detail));
            }
            this.onError?.(String(m['message']), String(m['about']));
        }
    }
    /**
     * Place every body's node. `alpha` runs from 0, the step before last, to 1,
     * the latest step; pass how far the frame is between two steps to smooth
     * motion when frames and steps do not line up.
     */
    update(alpha = 1) {
        const t = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
        for (const body of this.#bodies.values()) {
            const node = body.node;
            if (!node || body.type === 'static')
                continue;
            const from = body.previous, p = body.position, q = body.quaternion;
            node.position[0] = from[0] + (p[0] - from[0]) * t;
            node.position[1] = from[1] + (p[1] - from[1]) * t;
            node.position[2] = from[2] + (p[2] - from[2]) * t;
            // Blend the orientations along the shorter way round and bring the result back to unit length.
            const facing = from[3] * q[0] + from[4] * q[1] + from[5] * q[2] + from[6] * q[3] < 0 ? -1 : 1;
            const x = from[3] + (q[0] * facing - from[3]) * t, y = from[4] + (q[1] * facing - from[4]) * t, z = from[5] + (q[2] * facing - from[5]) * t, w = from[6] + (q[3] * facing - from[6]) * t;
            const size = Math.hypot(x, y, z, w) || 1;
            node.quaternion[0] = x / size;
            node.quaternion[1] = y / size;
            node.quaternion[2] = z / size;
            node.quaternion[3] = w / size;
            node.markTransformDirty();
        }
    }
    /** Stop listening and answer every waiting ray with nothing. The worker itself is the caller's to end. */
    dispose() {
        this.#closed = true;
        this.#port.removeEventListener('message', this.#listener);
        for (const ray of this.#rays.values())
            ray.resolve(undefined);
        this.#rays.clear();
        this.#bodies.clear();
    }
}
export function connectPhysics3D(port, options) {
    return new PhysicsClient3D(port, options);
}
//# sourceMappingURL=PhysicsRemote3D.js.map