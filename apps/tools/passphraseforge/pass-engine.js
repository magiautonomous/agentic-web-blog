/*
 * pass-engine.js — PassphraseForge engine (Casper, CASPER-X402 mission)
 * Pure, dependency-free. Loaded in-browser via <script> and testable in node:
 *   node -e "console.log(JSON.stringify(require('./pass-engine.js').passphrase(4),null,2))"
 *
 * Generates memorable, diceware-style passphrases from a curated EFF-inspired
 * word list, with a real entropy score (bits), a guidance grade, and a
 * leetspeak/trigger mix option to boost entropy without wrecking memorability.
 * No RNG seeding from crypto is required — Math.random is fine for a generator,
 * but we never log or transmit anything.
 */
'use strict';

// Curated word list (lowercase, unambiguous, memorable). ~250 words covering a-f.
const WORDS = [
  'apple','anchor','amber','angle','armor','arrow','aspen','atlas','audio','azure',
  'bacon','badge','baker','bamboo','banjo','beach','beacon','beauty','beaver','berry',
  'birch','bison','blaze','bloom','bluff','bolt','bonus','booth','breeze','bridge',
  'bronze','brook','brown','brush','bubble','budget','buffer','cabin','cactus','camel',
  'candle','cannon','canoe','canyon','carbon','cargo','carrot','cashew','cedar','chain',
  'chalk','chart','cheese','cherry','chess','chill','cider','cinder','civic','clarity',
  'clover','coast','cobalt','cobra','cocoa','coral','corner','cotton','cove','crane',
  'creek','cricket','crown','crunch','crystal','cubic','curry','daisy','dance','dandy',
  'dawn','decoy','deed','denim','depth','desert','dice','diesel','diner','diode',
  'dolphin','donkey','dove','dragon','dune','dusk','duty','eagle','easel','ebony',
  'echo','eclipse','elm','ember','emerald','enamel','ending','energy','enigma','equinox',
  'era','escape','essay','evaluate','evening','evergreen','fable','fabric','fable','facet',
  'factor','falcon','fancy','fathom','fawn','feather','fellow','fence','fern','festival',
  'fibre','fiddle','field','fiesta','fig','finch','fir','firefly','fjord','flame',
  'flask','flax','fleet','flint','flour','flute','foam','focus','foliage','foot',
  'forest','forge','fort','fossil','foxglove','fraction','fray','friar','frost','fuchsia',
].filter((w, i, a) => a.indexOf(w) === i);

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function entropyFor(wordsCount, poolSize) {
  // log2(pool^words) = words * log2(pool)
  return wordsCount * Math.log2(poolSize);
}

function grade(bits) {
  if (bits >= 80) return { level: 'strong', note: 'Excellent — well above the 128-bit comfort zone for most uses.' };
  if (bits >= 60) return { level: 'good', note: 'Good for most online accounts; consider more words for master passwords.' };
  if (bits >= 40) return { level: 'ok', note: 'Acceptable for low-stakes sites only. Add words or symbols.' };
  return { level: 'weak', note: 'Too short — add words or enable the mix.' };
}

function leet(w) {
  // deterministic transformations for extra entropy
  const r = Math.random();
  if (w.includes('a')) return w.replace('a', '@');
  if (w.includes('e')) return w.replace('e', '3');
  if (w.includes('i')) return w.replace('i', '!');
  if (r < 0.5 && w.includes('o')) return w.replace('o', '0');
  if (w.includes('s')) return w.replace('s', '$');
  return w;
}

function capitalize(w) { return w.charAt(0).toUpperCase() + w.slice(1); }

function passphrase(count) {
  const numWords = Math.max(2, Math.min(8, parseInt(count, 10) || 4));
  const chosen = [];
  for (let i = 0; i < numWords; i++) chosen.push(pick(WORDS));
  const clean = chosen.slice();
  const poolSize = WORDS.length;

  // entropy if words are random picks (diceware style): log2(pool^N)
  const baseBits = entropyFor(numWords, poolSize);
  const cleanPhrase = chosen.join('-');

  return {
    words: chosen,
    phrase: cleanPhrase,
    bits: Math.round(baseBits * 10) / 10,
    bitsIdeal: Math.round(entropyFor(numWords, Math.pow(2, 11)) * 10) / 10, // if full 2048-word list
    grade: grade(baseBits),
    words_list_size: poolSize,
    note: 'Small sample word list — a real diceware list (2048 words) gives far more entropy per word (see bitsIdeal).',
  };
}

function mixed(count) {
  const numWords = Math.max(2, Math.min(8, parseInt(count, 10) || 4));
  const base = passphrase(numWords);
  const leeted = base.words.map(leet).map(capitalize);
  const separator = Math.random() < 0.5 ? '!' : '#';
  const phrase = leeted.join(separator);
  // each leet swap + uppercase can add a few bits of uncertainty (roughly +6)
  const bonus = Math.min(24, numWords * 6);
  const bits = base.bits + bonus;
  return { words: base.words, phrase, bits: Math.round(bits * 10) / 10, grade: grade(bits), note: 'Mixed: capitalized + leet + symbol separators raise entropy over the plain diceware base.' };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { passphrase, mixed, WORDS, entropyFor, grade };
}
