// SPDX-License-Identifier: Apache-2.0
// First-party paired errors distinguish field-complete shape admission from
// checking every array type before any length. Original tokens own the oracle.
import test from 'node:test';
import * as namespace from '../dist/index.js';
import { request, meshPointer, requireFactory, legal, reject, span,
  edit, replaceMesh } from './fixtures.mjs';

const create = input => requireFactory(namespace)(input);

test('F2A14 vertices minimum and even length precede a non-array UV field', () => {
  const malformedUV = replaceMesh(
    '"uvs": [0, 1, 1, 1, 1, 0.5, 0.5, 0.5, 0.5, 0, 0, 0]',
    '"uvs": null');
  const changed = edit(malformedUV.text,
    '"vertices": [0, 0, 12, 0, 12, 4, 4, 4, 4, 12, 0, 12]',
    '"vertices": [0]');
  const expected = span(changed.text, changed.offset + '"vertices": '.length, '[');

  // legal proves fresh SP1 success for this mutant before one factory call.
  reject(legal(create, request(changed.text)), 'F2_MESH_SHAPE',
    meshPointer + '/vertices', expected);
});

test('F2A15 UV length precedes a non-array triangle field with valid vertices', () => {
  const malformedTriangles = replaceMesh(
    '"triangles": [0, 1, 3, 1, 2, 3, 0, 3, 5, 3, 4, 5]',
    '"triangles": null');
  const changed = edit(malformedTriangles.text,
    '"uvs": [0, 1, 1, 1, 1, 0.5, 0.5, 0.5, 0.5, 0, 0, 0]',
    '"uvs": [0]');
  const expected = span(changed.text, changed.offset + '"uvs": '.length, '[');

  // A type-only prepass would wrongly select triangles instead of the UV token.
  reject(legal(create, request(changed.text)), 'F2_MESH_SHAPE',
    meshPointer + '/uvs', expected);
});
