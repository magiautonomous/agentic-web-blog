/*
 * TokenForge — engine test
 * Run: node test.js
 */
'use strict';

const TE = require('./token-engine.js');

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL: ' + msg); }
}

// UUID format: 8-4-4-4-12 hex
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// uuid4 basic
const u1 = TE.uuid4();
assert(uuidRe.test(u1), 'uuid4 format valid: ' + u1);

// uuid4 uniqueness
const u2 = TE.uuid4();
assert(u1 !== u2, 'uuid4 unique: ' + u1 + ' vs ' + u2);

// uuid4 version nibble
assert(u1[14] === '4', 'uuid4 version=4: ' + u1);

// uuid4 variant
assert('89ab'.includes(u1[19]), 'uuid4 variant: ' + u1);

// hex token length
const h = TE.hexToken(16);
assert(h.length === 32, 'hex token 16 bytes = 32 chars');
assert(/^[0-9a-f]+$/.test(h), 'hex token valid chars');

// hex token different lengths
const h2 = TE.hexToken(4);
assert(h2.length === 8, 'hex token 4 bytes = 8 chars');

// base64url token
const b = TE.base64UrlToken(24);
assert(b.length === 24, 'base64 token length: ' + b.length);
assert(/^[A-Za-z0-9\-_]+$/.test(b), 'base64url valid chars');

// alphanumeric
const a = TE.alphanumeric(32);
assert(a.length === 32, 'alpha 32 length');
assert(/^[A-Za-z0-9]+$/.test(a), 'alpha valid chars');

// generate default (uuid)
const g1 = TE.generate();
assert(g1.length === 1, 'generate default count=1');
assert(uuidRe.test(g1[0]), 'generate default uuid valid');

// generate batch
const g2 = TE.generate({ kind: 'hex', count: 5, length: 16 });
assert(g2.length === 5, 'generate batch count=5');
assert(g2.every(t => typeof t === 'string' && t.length > 0), 'generate batch non-empty');

// generate alphanum
const g3 = TE.generate({ kind: 'alphanum', count: 3, length: 20 });
assert(g3.length === 3, 'generate alphanum count=3');
assert(g3.every(t => t.length === 20), 'generate alphanum length=20');
assert(g3.every(t => /^[A-Za-z0-9]+$/.test(t)), 'generate alphanum valid chars');

// generate base64
const g4 = TE.generate({ kind: 'base64', count: 2, length: 32 });
assert(g4.length === 2, 'generate base64 count=2');
assert(g4.every(t => t.length > 0), 'generate base64 non-empty');

// generate uniqueness
const g5 = TE.generate({ kind: 'uuid', count: 10 });
assert(new Set(g5).size === 10, 'generate 10 uuids all unique');

// count clamp
const g6 = TE.generate({ count: 200 });
assert(g6.length === 100, 'count clamped to 100');

// stats
const s = TE.stats('Hello123!@#');
assert(s.length === 11, 'stats length=11');
assert(s.charset.lower === true, 'stats lower');
assert(s.charset.upper === true, 'stats upper');
assert(s.charset.digits === true, 'stats digits');
assert(s.charset.special === true, 'stats special');
assert(s.charsetSize > 0, 'stats charsetSize > 0');
assert(s.entropyBits > 0, 'stats entropy > 0');

// stats all digits
const s2 = TE.stats('123456');
assert(s2.charsetSize === 10, 'digits charsetSize=10');
assert(s2.entropyBits === Math.round(6 * Math.log2(10)), 'digits entropy correct');

// entropy for 32-char alphanumeric (62 charset)
const s3 = TE.stats(TE.alphanumeric(32));
assert(s3.length === 32, 'alphanumeric 32 length');
assert(s3.charsetSize === 62, 'alphanumeric charsetSize=62');
assert(s3.entropyBits === Math.round(32 * Math.log2(62)), 'alphanumeric 32 entropy correct');

console.log(`\nTokenForge: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
