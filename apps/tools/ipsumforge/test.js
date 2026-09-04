/*
 * IpsumForge — engine test
 * Run: node test.js
 */
'use strict';

const IE = require('./ipsum-engine.js');

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL: ' + msg); }
}

// wordCount
const wc = IE.wordCount();
assert(wc.classic > 50, 'classic word bank > 50');
assert(wc.tech > 20, 'tech word bank > 20');
assert(wc.startup > 20, 'startup word bank > 20');
assert(wc.nature > 20, 'nature word bank > 20');
assert(wc.cyber > 20, 'cyber word bank > 20');

// classicSentence
const s1 = IE.classicSentence(5, 8);
assert(typeof s1 === 'string', 'classic sentence is string');
assert(s1.length > 0, 'classic sentence non-empty');
assert(s1[0] === s1[0].toUpperCase(), 'classic sentence capitalized');
assert(s1.endsWith('.'), 'classic sentence ends with .');
assert(/^[A-Z][a-z]+/.test(s1), 'classic sentence starts with word');

// themedSentence
for (const theme of ['tech', 'startup', 'nature', 'cyber']) {
  const t = IE.themedSentence(theme, 4, 8);
  assert(typeof t === 'string' && t.length > 0, theme + ' sentence non-empty');
  assert(t.endsWith('.'), theme + ' sentence ends with .');
}

// paragraph
const p1 = IE.paragraph(3, { theme: 'nature', minWords: 4, maxWords: 8 });
assert(typeof p1 === 'string', 'paragraph is string');
const sentences = p1.split('. ').filter(s => s.length > 0);
assert(sentences.length >= 3, 'paragraph has 3+ sentences');

// paragraph with classic
const p2 = IE.paragraph(2, {});
assert(typeof p2 === 'string' && p2.length > 0, 'classic paragraph non-empty');

// generate default
const g1 = IE.generate();
assert(g1.theme === 'classic', 'generate default theme=classic');
assert(g1.paragraphs.length === 1, 'generate default 1 paragraph');

// generate themed
const g2 = IE.generate({ theme: 'tech', paragraphs: 3, sentences: 4 });
assert(g2.theme === 'tech', 'generate tech theme');
assert(g2.paragraphs.length === 3, 'generate 3 paragraphs');
assert(g2.paragraphs.every(p => p.split('. ').length >= 4), 'each paragraph has 4+ sentences');

// generate invalid theme falls back to classic
const g3 = IE.generate({ theme: 'nonexistent' });
assert(g3.theme === 'classic', 'invalid theme -> classic');

// paragraph count clamp
const g4 = IE.generate({ paragraphs: 50 });
assert(g4.paragraphs.length === 20, 'paragraphs clamped to 20');

// all generated paragraphs non-empty
const g5 = IE.generate({ paragraphs: 5, sentences: 3, theme: 'cyber' });
assert(g5.paragraphs.every(p => p.length > 0), 'all paragraphs non-empty');

// capitalize
assert(IE.capitalize('hello') === 'Hello', 'capitalize hello');
assert(IE.capitalize('x') === 'X', 'capitalize single char');
assert(IE.capitalize('') === '', 'capitalize empty');

console.log('\nIpsumForge: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
