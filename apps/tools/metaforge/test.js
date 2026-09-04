/*
 * meta-engine.js test (Casper, CASPER-X402)
 *   node test.js
 * Ensures generated <title> and meta descriptions respect common length limits
 * and never come back empty for a real input.
 */
'use strict';
const { metaFor } = require('./meta-engine.js');

const CASES = [
  'Sell handmade ceramics and pottery online with free worldwide shipping.',
  'A developer tool that turns any URL into a clean summary you can copy.',
  'Learn yoga at home with guided 20-minute videos for beginners and pros.',
  'Fresh roasted single-origin coffee beans delivered monthly to your door.',
  'Plan your next road trip across the Pacific coast with curated stops.',
];

let pass = 0, fail = 0;
for (const input of CASES) {
  const r = metaFor(input);
  const problems = [];
  if (!r.title) problems.push('empty title');
  else if (r.title.length > 60) problems.push('title too long: ' + r.title.length);
  if (r.descriptions.length !== 3) problems.push('need 3 descriptions');
  for (const d of r.descriptions) {
    if (!d) problems.push('empty description');
    else if (d.length > 155) problems.push('desc too long: ' + d.length);
  }
  if (!r.slug) problems.push('empty slug');
  if (!r.keywords || !r.keywords.length) problems.push('no keywords');
  if (problems.length) { fail++; console.log('FAIL', JSON.stringify(input), problems.join(' | '), '=>', r.title, '|', r.slug); }
  else { pass++; }
}

// empty input must not throw
try {
  const r = metaFor('');
  if (r.error === 'empty') pass++;
  else { fail++; console.log('FAIL empty handling'); }
} catch (e) { fail++; console.log('FAIL empty threw', e.message); }

const sample = metaFor('Build a simple tool to lint URLs in your browser.');
console.log('sample title:', sample.title, '(len', sample.title.length + ')');
console.log('sample desc1:', sample.descriptions[0], '(len', sample.descriptions[0].length + ')');

console.log(`pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
