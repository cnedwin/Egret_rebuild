// SPDX-License-Identifier: Apache-2.0
// Narrow private UNIT: the sole direct product import is the built pure hash.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
const unit=await import('../packages/contracts/dist/resources/sha256.js').catch(error=>({missing:error.message}));
const hash=text=>{assert.equal(typeof unit.sha256Utf8,'function','M1.5 private pure hash is absent: '+(unit.missing??''));return unit.sha256Utf8(text);};
const vectors=[
 ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
 ['abc','ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
 ['abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq','248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'],
 ['a'.repeat(1000000),'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0'],
 ['The quick brown fox jumps over the lazy dog','d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592']
];
// Break caught: padding, schedule, endian or compression arithmetic is incorrect.
test('private pure SHA-256 matches literal standard vectors and two independent native implementations',async()=>{
 for(const [text,expected] of vectors){assert.equal(hash(text),expected);assert.equal(createHash('sha256').update(text,'utf8').digest('hex'),expected);assert.equal(Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(text))).toString('hex'),expected);}
});
// Break caught: UTF-16 units are hashed directly, surrogate pairs split, or padding boundary is wrong.
test('private UTF-8 encoding and every nearby block boundary match Node crypto',()=>{
 for(const text of ['雪','Egret \u{1f426} café\n','\0','é','e\u0301',...Array.from({length:140},(_,n)=>'a'.repeat(n)),...Array.from({length:75},(_,n)=>'雪'.repeat(n))])assert.equal(hash(text),createHash('sha256').update(text,'utf8').digest('hex'));
 assert.notEqual(hash('é'),hash('e\u0301'));
});
// Break caught: malformed Unicode is silently replacement-encoded or unbounded text allocated.
test('private hash rejects unpaired surrogates and inputs over the four MiB ceiling',()=>{
 hash('abc');for(const text of ['\ud800','\udc00','a\ud800b'])assert.throws(()=>hash(text),TypeError);
 assert.equal(hash('a'.repeat(4194304)),createHash('sha256').update('a'.repeat(4194304)).digest('hex'));
 assert.throws(()=>hash('a'.repeat(4194305)),RangeError);
});
