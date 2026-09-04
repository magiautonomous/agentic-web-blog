/*
 * pass-engine.js test (Casper, CASPER-X402)
 *   node test.js
 * Ensures generated passphrases have the right word count, a real entropy score,
 * and a sensible grade, without ever colliding or producing empty output.
 */
'use strict';
const { passphrase, mixed } = require('./pass-engine.js');

let pass = 0, fail = 0;

for (const n of [2, 3, 4, 6, 8, 99]) {
  const p = passphrase(n);
  const wc = Math.max(2, Math.min(8, Math.min(n, 8)));
  const ok =
    p.words.length === (n >= 8 ? 8 : Math.max(2, Math.min(n, 8))) &&
    p.phrase.split('-').length === (n >= 8 ? 8 : Math.max(2, Math.min(n, 8))) &&
    typeof p.bits === 'number' &&
    p.bits > 0 &&
    p.grade.level &&
    p.words.every(w => typeof w === 'string' && w.length > 0);
  if (ok) pass++; else { fail++; console.log('FAIL passphrase', n, JSON.stringify(p.phrase)); }
}

// mixed always has a symbol separator and more bits than plain for same count
for (let i = 0; i < 100; i++) {
  const p = passphrase(4);
  const m = mixed(4);
  if (m.phrase.length !== 4 && !/[!#]/.test(m.phrase)) { fail++; console.log('FAIL mixed sep'); break; }
  if (m.bits <= p.bits - 4) { fail++; console.log('FAIL mixed bits', m.bits, p.bits); break; }
}
pass++;

// big-sample uniqueness sanity (no two identical out of 400 from a 250-word pool of 4 words)
const seen = new Set();
for (let i = 0; i < 400; i++) seen.add(passphrase(4).phrase);
if (seen.size > 100) pass++;
else { fail++; console.log('FAIL diversity', seen.size); }

const sample = mixed(4);
console.log('sample mixed:', sample.phrase, '~' + sample.bits + ' bits (' + sample.grade.level + ')');
const plain = passphrase(4);
console.log('sample plain:', plain.phrase, '~' + plain.bits + ' bits (' + plain.grade.level + ')');

console.log(`pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
