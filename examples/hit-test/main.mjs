import { createCanvasHost } from '@egret/engine/web';
import { createHitTestApplication } from './application.mjs';

const canvas = document.querySelector('#scene');
const application = createHitTestApplication({
  host: createCanvasHost({ canvas, pixelRatio: 1 }), canvas,
  upperButton: document.querySelector('#toggle-upper'),
  gateButton: document.querySelector('#toggle-gate'),
  childrenButton: document.querySelector('#toggle-children'),
  closeButton: document.querySelector('#close'),
  status: document.querySelector('#status'), windowTarget: window,
});

/** Scalar observation only; no display nodes or query authority cross this port. */
export const readSnapshot = () => application.readSnapshot();
/** Idempotent shared retirement Promise, including a close during startup. */
export const close = () => application.close();
