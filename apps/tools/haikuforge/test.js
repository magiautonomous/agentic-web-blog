/*
 * HaikuForge — engine test
 * Run: node test.js
 */
'use strict';

const HE = require('./haiku-engine.js');

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL: ' + msg); }
}

// syllableCount basics
assert(HE.syllableCount('a') === 1, 'a = 1');
assert(HE.syllableCount('the') === 1, 'the = 1');
assert(HE.syllableCount('cherry') === 2, 'cherry = 2');
assert(HE.syllableCount('blossom') === 2, 'blossom = 2');
assert(HE.syllableCount('gently') === 2, 'gently = 2');
assert(HE.syllableCount('gentle') === 2, 'gentle = 2');
assert(HE.syllableCount('river') === 2, 'river = 2');
assert(HE.syllableCount('butterfly') === 3, 'butterfly = 3');
assert(HE.syllableCount('dragonfly') === 3, 'dragonfly = 3');
assert(HE.syllableCount('distant') === 2, 'distant = 2');
assert(HE.syllableCount('moon') === 1, 'moon = 1');
assert(HE.syllableCount('stone') === 1, 'stone = 1');
assert(HE.syllableCount('leaves') === 1, 'leaves = 1');
assert(HE.syllableCount('patience') === 2, 'patience = 2');
assert(HE.syllableCount('dew') === 1, 'dew = 1');
assert(HE.syllableCount('ice') === 1, 'ice = 1');

// syllableCount edge cases
assert(HE.syllableCount('') === 0, 'empty = 0');
assert(HE.syllableCount('   ') === 0, 'whitespace = 0');
assert(HE.syllableCount('the.') === 1, 'punct = 1');

// THEMES exist
assert(HE.ALL_THEMES.length === 4, '4 themes: ' + HE.ALL_THEMES.join(','));
assert(HE.THEMES.nature !== undefined, 'nature theme exists');
assert(HE.THEMES.cosmic !== undefined, 'cosmic theme exists');
assert(HE.THEMES.zen !== undefined, 'zen theme exists');
assert(HE.THEMES.urban !== undefined, 'urban theme exists');

// generate returns poems
const poems = HE.generate('nature', { count: 3 });
assert(poems.length === 3, 'generate 3 nature poems');
assert(poems.every(p => p.lines.length === 3), 'all have 3 lines');
assert(poems.every(p => p.theme === 'nature'), 'all nature themed');

// generate default theme
const p1 = HE.generate(null, { count: 1 });
assert(p1.length === 1, 'generate default returns 1');
assert(p1[0].lines.length === 3, 'default poem has 3 lines');

// analyze returns correct structure
const analysis = HE.analyze(poems[0]);
assert(analysis !== null, 'analyze returns object');
assert(analysis.lines.length === 3, 'analyze 3 lines');
assert(typeof analysis.structure === 'string', 'structure is string');
assert(analysis.totalSyllables > 0, 'totalSyllables > 0');

// countSyllables
const words = HE.countSyllables('cherry blossom falls');
assert(words.length === 3, 'countSyllables 3 words');
assert(words[0].syllables === 2, 'cherry = 2');
assert(words[1].syllables === 2, 'blossom = 2');
assert(words[2].syllables === 1, 'falls = 1');

// analyzeLine
const lineAnalysis = HE.analyzeLine('gently on the quiet stream');
assert(lineAnalysis.totalSyllables > 0, 'analyzeLine total > 0');
assert(lineAnalysis.words.length === 5, 'analyzeLine 5 words');

// generate cosmic
const cosmic = HE.generate('cosmic', { count: 2 });
assert(cosmic.every(p => p.theme === 'cosmic'), 'cosmic themed');

// generate zen
const zen = HE.generate('zen', { count: 2 });
assert(zen.every(p => p.theme === 'zen'), 'zen themed');

// generate urban
const urban = HE.generate('urban', { count: 2 });
assert(urban.every(p => p.theme === 'urban'), 'urban themed');

// count clamp
const many = HE.generate(null, { count: 50 });
assert(many.length === 20, 'count clamped to 20');

console.log('\nHaikuForge: ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
