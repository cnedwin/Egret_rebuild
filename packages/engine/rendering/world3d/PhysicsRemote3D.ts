// SPDX-License-Identifier: Apache-2.0
// Physics on another thread. The world lives behind a message port - in a worker,
// say - and the page keeps light stand-ins for its bodies: it sends what it wants
// done, asks for a step, and receives where everything is. Nothing here names a
// worker or the DOM; both ends only need something that can post and receive
// messages, so the same code runs over a Worker, a MessagePort or a test loopback.
import {World3DError, requireFinite3D} from './core3D.js';
import type {Object3D} from './Object3D.js';
import {createConvexHullShape3D} from './PhysicsHull3D.js';
import {PhysicsWorld3D, type BodyType3D, type JointType3D, type PhysicsWorldOptions3D, type RigidBody3D, type ShapeDefinition3D, type Joint3D} from './Physics3D.js';

/** A Worker, a worker's global scope, a MessagePort: anything that posts and receives messages. */
export interface PhysicsPort3D {
    postMessage(message: unknown, transfer?: never): void;
    addEventListener(type: 'message', listener: (event: {readonly data: unknown}) => void): void;
    removeEventListener(type: 'message', listener: (event: {readonly data: unknown}) => void): void;
    /** A MessagePort delivers nothing until it is started; workers have no such step. */
    start?(): void;
}
/** Shapes that can be described in a message. A convex hull is given by its corner points. */
export type RemoteShape3D =
    | {readonly type: 'sphere'; readonly radius: number}
    | {readonly type: 'box'; readonly halfExtents: readonly [number, number, number]}
    | {readonly type: 'capsule'; readonly radius: number; readonly halfHeight: number}
    | {readonly type: 'plane'}
    | {readonly type: 'convex'; readonly points: readonly number[]}
    | {readonly type: 'compound'; readonly children: readonly {readonly shape: Exclude<RemoteShape3D, {type: 'plane' | 'compound'}>; readonly position?: readonly [number, number, number]; readonly quaternion?: readonly [number, number, number, number]}[]};
export interface RemoteBodyOptions3D {
    readonly type?: BodyType3D;
    readonly shape: RemoteShape3D;
    readonly mass?: number;
    readonly position?: readonly [number, number, number];
    readonly quaternion?: readonly [number, number, number, number];
    readonly restitution?: number;
    readonly friction?: number;
    readonly linearDamping?: number;
    readonly angularDamping?: number;
    readonly isTrigger?: boolean;
    readonly layer?: number;
    readonly mask?: number;
    readonly fixedRotation?: boolean;
    readonly continuous?: boolean;
    /** Scene node moved to the body by update(). It stays on this side; it is not sent. */
    readonly node?: Object3D;
    readonly userData?: unknown;
}
export interface RemoteJointOptions3D {
    readonly type: JointType3D;
    readonly bodyA: RemoteBody3D;
    readonly bodyB?: RemoteBody3D;
    readonly anchor?: readonly [number, number, number];
    readonly anchorB?: readonly [number, number, number];
    readonly axis?: readonly [number, number, number];
    readonly limits?: readonly [number, number];
    readonly motorSpeed?: number;
    readonly maxMotorTorque?: number;
    readonly maxMotorForce?: number;
    readonly coneLimit?: number;
    readonly length?: number;
    readonly rope?: boolean;
    readonly stiffness?: number;
    readonly damping?: number;
    readonly collideConnected?: boolean;
}
export interface RemoteRaycastHit3D {
    readonly body: RemoteBody3D;
    readonly distance: number;
    readonly point: readonly [number, number, number];
    readonly normal: readonly [number, number, number];
}

type Message = {readonly t: string} & Record<string, unknown>;
const triple = (value: unknown, field: string): [number, number, number] => {
    const list = value as ArrayLike<number> | undefined;
    if (!list || list.length !== 3) throw new World3DError('WORLD3D_INPUT_INVALID', field);
    return [requireFinite3D(list[0], field), requireFinite3D(list[1], field), requireFinite3D(list[2], field)];
};

function localShape(shape: RemoteShape3D): ShapeDefinition3D {
    if (shape?.type === 'convex') return {type: 'convex', hull: createConvexHullShape3D(shape.points)};
    if (shape?.type === 'compound') return {type: 'compound', children: shape.children.map(child => ({...child, shape: localShape(child.shape) as never}))};
    return shape as ShapeDefinition3D;
}

/**
 * Run a physics world on this end of a port and answer the messages of a
 * PhysicsClient3D. In a worker this is the whole script:
 *     import {servePhysics3D} from '@egret/engine/world3d';
 *     servePhysics3D(self);
 * Returns the world, for a host that wants to add to it directly.
 */
export function servePhysics3D(port: PhysicsPort3D, options: PhysicsWorldOptions3D = {}): PhysicsWorld3D {
    if (!port || typeof port.postMessage !== 'function') throw new World3DError('WORLD3D_INPUT_INVALID', 'port');
    let world = new PhysicsWorld3D(options);
    const bodies = new Map<number, RigidBody3D>(), ids = new Map<RigidBody3D, number>(), joints = new Map<number, Joint3D>();
    let began: number[] = [], ended: number[] = [];
    const listen = (target: PhysicsWorld3D): void => {
        target.onContactBegin = (a, b) => { const x = ids.get(a), y = ids.get(b); if (x !== undefined && y !== undefined) began.push(x, y); };
        target.onContactEnd = (a, b) => { const x = ids.get(a), y = ids.get(b); if (x !== undefined && y !== undefined) ended.push(x, y); };
    };
    listen(world);
    const body = (id: unknown): RigidBody3D => { const found = bodies.get(id as number); if (!found) throw new World3DError('WORLD3D_INPUT_INVALID', 'unknown body ' + String(id)); return found; };
    const handle = (m: Message): void => {
        switch (m.t) {
            case 'world': if (bodies.size === 0) { world = new PhysicsWorld3D(m['options'] as PhysicsWorldOptions3D); listen(world); } break;
            case 'body': {
                const o = m['options'] as RemoteBodyOptions3D, made = world.createBody({...o, shape: localShape(o.shape)});
                bodies.set(m['id'] as number, made); ids.set(made, m['id'] as number);
                break;
            }
            case 'remove': { const found = bodies.get(m['id'] as number); if (found) { world.removeBody(found); bodies.delete(m['id'] as number); ids.delete(found); } break; }
            case 'joint': {
                const o = m['options'] as Record<string, unknown>;
                joints.set(m['id'] as number, world.createJoint({...o, bodyA: body(o['bodyA']), ...(o['bodyB'] === undefined ? {} : {bodyB: body(o['bodyB'])})} as never));
                break;
            }
            case 'unjoint': { const found = joints.get(m['id'] as number); if (found) { world.removeJoint(found); joints.delete(m['id'] as number); } break; }
            case 'set': {
                const target = body(m['id']);
                if (m['position']) { const p = triple(m['position'], 'position'); target.setPosition(p[0], p[1], p[2]); }
                if (m['quaternion']) { const q = m['quaternion'] as number[]; target.setQuaternion(q[0]!, q[1]!, q[2]!, q[3]!); }
                if (m['linearVelocity']) { const v = triple(m['linearVelocity'], 'linearVelocity'); target.setLinearVelocity(v[0], v[1], v[2]); }
                if (m['angularVelocity']) { const w = triple(m['angularVelocity'], 'angularVelocity'); target.setAngularVelocity(w[0], w[1], w[2]); }
                break;
            }
            case 'impulse': { const i = triple(m['impulse'], 'impulse'); body(m['id']).applyImpulse(i[0], i[1], i[2], m['point'] as number[] | undefined); break; }
            case 'force': { const f = triple(m['force'], 'force'); body(m['id']).applyForce(f[0], f[1], f[2]); break; }
            // A change of gravity is felt by everything, including what had come to rest.
            case 'gravity': world.gravity.set(triple(m['value'], 'gravity')); for (const one of bodies.values()) one.wake(); break;
            case 'step': {
                world.step(requireFinite3D(m['dt'], 'dt'));
                // Everything that can move, in one block: an id, then position and orientation, for each body.
                let count = 0;
                for (const one of bodies.values()) if (one.type !== 'static') count++;
                const who = new Int32Array(count), poses = new Float32Array(count * 7), asleep = new Uint8Array(count);
                let at = 0;
                for (const [id, one] of bodies) {
                    if (one.type === 'static') continue;
                    who[at] = id; poses.set(one.position, at * 7); poses.set(one.quaternion, at * 7 + 3); asleep[at] = one.isSleeping ? 1 : 0;
                    at++;
                }
                const state = {t: 'state', frame: m['frame'], ids: who, poses, asleep, began, ended};
                began = []; ended = [];
                port.postMessage(state, [who.buffer, poses.buffer, asleep.buffer] as never);
                break;
            }
            case 'raycast': {
                const hit = world.raycast(triple(m['origin'], 'origin'), triple(m['direction'], 'direction'), (m['maxDistance'] as number | undefined) ?? Infinity, (m['mask'] as number | undefined) ?? -1);
                port.postMessage({t: 'ray', request: m['request'], hit: hit && ids.has(hit.body) ? {id: ids.get(hit.body), distance: hit.distance, point: hit.point, normal: hit.normal} : null});
                break;
            }
            default: throw new World3DError('WORLD3D_INPUT_INVALID', 'unknown physics message ' + String(m.t));
        }
    };
    port.addEventListener('message', (event) => {
        const message = event.data as Message;
        // A request that cannot be carried out is reported back rather than left to stop the worker.
        try { handle(message); } catch (error) { port.postMessage({t: 'error', about: message?.t, message: error instanceof Error ? error.message : String(error)}); }
    });
    port.start?.();
    return world;
}

/** The page's stand-in for a body that lives behind the port. */
export class RemoteBody3D {
    readonly id: number;
    readonly type: BodyType3D;
    /** Where the body was after the latest step this side has heard of. */
    readonly position = new Float32Array(3);
    readonly quaternion = new Float32Array([0, 0, 0, 1]);
    /** @internal Where it was the step before, for blending between the two. */
    readonly previous = new Float32Array([0, 0, 0, 0, 0, 0, 1]);
    isSleeping = false;
    node: Object3D | undefined;
    userData: unknown;
    readonly #client: PhysicsClient3D;
    #alive = true;
    /** @internal */
    constructor(client: PhysicsClient3D, id: number, options: RemoteBodyOptions3D) {
        this.#client = client; this.id = id; this.type = options.type ?? (options.shape.type === 'plane' ? 'static' : 'dynamic');
        if (options.position) this.position.set(options.position);
        if (options.quaternion) this.quaternion.set(options.quaternion);
        this.previous.set(this.position); this.previous.set(this.quaternion, 3);
        this.node = options.node; this.userData = options.userData;
    }
    get removed(): boolean { return !this.#alive; }
    private send(message: Record<string, unknown>): void { if (this.#alive) this.#client.post({...message, id: this.id}); }
    /** Move the body there at once; this side shows it there straight away. */
    setPosition(x: number, y: number, z: number): this {
        this.position[0] = requireFinite3D(x, 'x'); this.position[1] = requireFinite3D(y, 'y'); this.position[2] = requireFinite3D(z, 'z'); this.previous.set(this.position);
        this.send({t: 'set', position: [x, y, z]});
        return this;
    }
    setQuaternion(x: number, y: number, z: number, w: number): this {
        this.quaternion[0] = x; this.quaternion[1] = y; this.quaternion[2] = z; this.quaternion[3] = w; this.previous.set(this.quaternion, 3);
        this.send({t: 'set', quaternion: [x, y, z, w]});
        return this;
    }
    setLinearVelocity(x: number, y: number, z: number): this { this.send({t: 'set', linearVelocity: [requireFinite3D(x, 'x'), requireFinite3D(y, 'y'), requireFinite3D(z, 'z')]}); return this; }
    setAngularVelocity(x: number, y: number, z: number): this { this.send({t: 'set', angularVelocity: [requireFinite3D(x, 'x'), requireFinite3D(y, 'y'), requireFinite3D(z, 'z')]}); return this; }
    applyImpulse(x: number, y: number, z: number, point?: ArrayLike<number>): void { this.send({t: 'impulse', impulse: [x, y, z], ...(point ? {point: [point[0], point[1], point[2]]} : {})}); }
    /** A force for the next step only, as with a local body. */
    applyForce(x: number, y: number, z: number): void { this.send({t: 'force', force: [x, y, z]}); }
    remove(): void { if (!this.#alive) return; this.send({t: 'remove'}); this.#alive = false; this.#client.forget(this); }
}
export class RemoteJoint3D {
    readonly id: number;
    readonly #client: PhysicsClient3D;
    #alive = true;
    /** @internal */
    constructor(client: PhysicsClient3D, id: number) { this.#client = client; this.id = id; }
    remove(): void { if (this.#alive) { this.#alive = false; this.#client.post({t: 'unjoint', id: this.id}); } }
}

/**
 * The page's end of a remote physics world. Create bodies and joints as with a
 * local world, call step() once per frame, and update() to place the nodes.
 * Positions arrive a moment after they are asked for, so what is shown trails
 * the simulation by about one step; update(alpha) blends the last two steps
 * to hide the difference between the step rate and the frame rate.
 */
export class PhysicsClient3D {
    readonly #port: PhysicsPort3D;
    readonly #bodies = new Map<number, RemoteBody3D>();
    readonly #rays = new Map<number, (hit: RemoteRaycastHit3D | undefined) => void>();
    #next = 1;
    #frame = 0;
    #answered = 0;
    #closed = false;
    readonly #listener = (event: {readonly data: unknown}): void => this.receive(event.data as Message);
    /** Steps asked for and not yet answered. */
    get pending(): number { return this.#frame - this.#answered; }
    /** Number of the latest step whose result has arrived. */
    get frame(): number { return this.#answered; }
    onContactBegin: ((a: RemoteBody3D, b: RemoteBody3D) => void) | undefined;
    onContactEnd: ((a: RemoteBody3D, b: RemoteBody3D) => void) | undefined;
    /** Called when the other end could not carry out a request. */
    onError: ((message: string, about: string) => void) | undefined;
    /** Called after the result of a step has been taken in. */
    onStep: ((frame: number) => void) | undefined;

    constructor(port: PhysicsPort3D, options?: PhysicsWorldOptions3D) {
        if (!port || typeof port.postMessage !== 'function') throw new World3DError('WORLD3D_INPUT_INVALID', 'port');
        this.#port = port;
        port.addEventListener('message', this.#listener);
        port.start?.();
        if (options) this.post({t: 'world', options});
    }
    get bodies(): IterableIterator<RemoteBody3D> { return this.#bodies.values(); }
    /** @internal */ post(message: Record<string, unknown>): void { if (!this.#closed) this.#port.postMessage(message); }
    /** @internal */ forget(body: RemoteBody3D): void { this.#bodies.delete(body.id); }
    createBody(options: RemoteBodyOptions3D): RemoteBody3D {
        if (!options?.shape) throw new World3DError('WORLD3D_INPUT_INVALID', 'shape');
        const {node, userData, ...sent} = options, body = new RemoteBody3D(this, this.#next++, options);
        void node; void userData;
        this.#bodies.set(body.id, body);
        this.post({t: 'body', id: body.id, options: sent});
        if (body.node) { body.node.position.set(body.position); body.node.quaternion.set(body.quaternion); body.node.markTransformDirty(); }
        return body;
    }
    createJoint(options: RemoteJointOptions3D): RemoteJoint3D {
        if (!(options?.bodyA instanceof RemoteBody3D) || (options.bodyB !== undefined && !(options.bodyB instanceof RemoteBody3D))) throw new World3DError('WORLD3D_INPUT_INVALID', 'joint bodies');
        const joint = new RemoteJoint3D(this, this.#next++);
        this.post({t: 'joint', id: joint.id, options: {...options, bodyA: options.bodyA.id, ...(options.bodyB ? {bodyB: options.bodyB.id} : {})}});
        return joint;
    }
    setGravity(x: number, y: number, z: number): void { this.post({t: 'gravity', value: [requireFinite3D(x, 'x'), requireFinite3D(y, 'y'), requireFinite3D(z, 'z')]}); }
    /**
     * Ask for the world to advance. If `maxPending` earlier steps are still
     * unanswered the request is not sent and false is returned, so a slow
     * worker falls behind in time instead of piling up work.
     */
    step(deltaSeconds: number, maxPending = 2): boolean {
        requireFinite3D(deltaSeconds, 'deltaSeconds');
        if (this.#closed || this.pending >= maxPending) return false;
        this.post({t: 'step', dt: deltaSeconds, frame: ++this.#frame});
        return true;
    }
    /** The nearest solid body on a ray, as the world stands when the request arrives. */
    raycast(origin: ArrayLike<number>, direction: ArrayLike<number>, maxDistance?: number, mask?: number): Promise<RemoteRaycastHit3D | undefined> {
        const request = this.#next++;
        return new Promise((resolve) => {
            if (this.#closed) { resolve(undefined); return; }
            this.#rays.set(request, resolve);
            this.post({t: 'raycast', request, origin: [origin[0], origin[1], origin[2]], direction: [direction[0], direction[1], direction[2]], ...(maxDistance === undefined ? {} : {maxDistance}), ...(mask === undefined ? {} : {mask})});
        });
    }
    private receive(m: Message): void {
        if (m?.t === 'state') {
            const who = m['ids'] as Int32Array, poses = m['poses'] as Float32Array, asleep = m['asleep'] as Uint8Array;
            for (let i = 0; i < who.length; i++) {
                const body = this.#bodies.get(who[i]!);
                if (!body) continue;
                body.previous.set(body.position); body.previous.set(body.quaternion, 3);
                body.position[0] = poses[i * 7]!; body.position[1] = poses[i * 7 + 1]!; body.position[2] = poses[i * 7 + 2]!;
                body.quaternion[0] = poses[i * 7 + 3]!; body.quaternion[1] = poses[i * 7 + 4]!; body.quaternion[2] = poses[i * 7 + 5]!; body.quaternion[3] = poses[i * 7 + 6]!;
                body.isSleeping = asleep[i] === 1;
            }
            this.#answered = Math.max(this.#answered, m['frame'] as number);
            const pairs = (list: number[], call: ((a: RemoteBody3D, b: RemoteBody3D) => void) | undefined): void => {
                if (!call) return;
                for (let i = 0; i + 1 < list.length; i += 2) { const a = this.#bodies.get(list[i]!), b = this.#bodies.get(list[i + 1]!); if (a && b) call(a, b); }
            };
            pairs(m['began'] as number[], this.onContactBegin); pairs(m['ended'] as number[], this.onContactEnd);
            this.onStep?.(this.#answered);
        } else if (m?.t === 'ray') {
            const resolve = this.#rays.get(m['request'] as number), hit = m['hit'] as {id: number; distance: number; point: [number, number, number]; normal: [number, number, number]} | null;
            this.#rays.delete(m['request'] as number);
            const body = hit ? this.#bodies.get(hit.id) : undefined;
            resolve?.(hit && body ? {body, distance: hit.distance, point: hit.point, normal: hit.normal} : undefined);
        } else if (m?.t === 'error') this.onError?.(String(m['message']), String(m['about']));
    }
    /**
     * Place every body's node. `alpha` runs from 0, the step before last, to 1,
     * the latest step; pass how far the frame is between two steps to smooth
     * motion when frames and steps do not line up.
     */
    update(alpha = 1): void {
        const t = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
        for (const body of this.#bodies.values()) {
            const node = body.node;
            if (!node || body.type === 'static') continue;
            const from = body.previous, p = body.position, q = body.quaternion;
            node.position[0] = from[0]! + (p[0]! - from[0]!) * t; node.position[1] = from[1]! + (p[1]! - from[1]!) * t; node.position[2] = from[2]! + (p[2]! - from[2]!) * t;
            // Blend the orientations along the shorter way round and bring the result back to unit length.
            const facing = from[3]! * q[0]! + from[4]! * q[1]! + from[5]! * q[2]! + from[6]! * q[3]! < 0 ? -1 : 1;
            const x = from[3]! + (q[0]! * facing - from[3]!) * t, y = from[4]! + (q[1]! * facing - from[4]!) * t, z = from[5]! + (q[2]! * facing - from[5]!) * t, w = from[6]! + (q[3]! * facing - from[6]!) * t;
            const size = Math.hypot(x, y, z, w) || 1;
            node.quaternion[0] = x / size; node.quaternion[1] = y / size; node.quaternion[2] = z / size; node.quaternion[3] = w / size;
            node.markTransformDirty();
        }
    }
    /** Stop listening and answer every waiting ray with nothing. The worker itself is the caller's to end. */
    dispose(): void {
        this.#closed = true; this.#port.removeEventListener('message', this.#listener);
        for (const resolve of this.#rays.values()) resolve(undefined);
        this.#rays.clear(); this.#bodies.clear();
    }
}

export function connectPhysics3D(port: PhysicsPort3D, options?: PhysicsWorldOptions3D): PhysicsClient3D { return new PhysicsClient3D(port, options); }
