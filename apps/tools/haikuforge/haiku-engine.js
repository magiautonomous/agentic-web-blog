/*
 * haiku-engine.js — haiku / syllable generator engine (HaikuForge)
 * ---------------------------------------------------------
 * Pure, dependency-free. Generates haikus (5-7-5 syllable structure)
 * from themed word banks using weighted random selection. Provides
 * syllable counting, theme browsing, and structured generation.
 * Exported for browser + node.
 */
'use strict';

const HaikuEngine = (() => {
  'use strict';

  // Theme banks: each word has [word, syllableCount]
  const THEMES = {
    nature: {
      lines: [
        // 5-syllable starters
        [
          ['cherry', 2], ['blossom', 2], ['petal', 2], ['willow', 2], ['gentle', 2],
          ['stream', 1], ['river', 2], ['mountain', 2], ['ocean', 2], ['forest', 2],
          ['moonlight', 2], ['sunrise', 2], ['wind', 1], ['rain', 1], ['snow', 1],
          ['garden', 2], ['dragonfly', 3], ['firefly', 3], ['pebble', 2], ['spider', 2],
          ['cricket', 2], ['autumn', 2], ['summer', 2], ['winter', 2], ['spring', 1],
          ['morning', 2], ['evening', 2], ['twilight', 2], ['starlight', 2], ['frost', 1],
          ['bamboo', 2], ['cedar', 2], ['pines', 1], ['leaves', 1], ['roots', 1],
          ['moss', 1], ['fern', 1], ['lotus', 2], ['iris', 2], ['iris', 2],
          ['stone', 1], ['cliff', 1], ['valley', 2], ['canyon', 2], ['hill', 1],
          ['wave', 1], ['tide', 1], ['shore', 1], ['reef', 1], ['cove', 1],
          ['bird', 1], ['hawk', 1], ['swan', 1], ['crane', 1], ['crow', 1],
          ['wolf', 1], ['fox', 1], ['deer', 1], ['hare', 1], ['owl', 1],
          ['cloud', 1], ['mist', 1], ['fog', 1], ['dew', 1], ['ice', 1],
          ['flame', 1], ['ash', 1], ['ember', 2], ['dust', 1], ['soil', 1],
        ],
        // 7-syllable starters
        [
          ['wandering', 3], ['ancient', 2], ['silent', 2], ['distant', 2], ['fragile', 2],
          ['autumn', 2], ['winter', 2], ['summer', 2], ['morning', 2], ['evening', 2],
          ['golden', 2], ['silver', 2], ['crystal', 2], ['velvet', 2], ['shadow', 2],
          ['beneath', 2], ['beyond', 2], ['between', 2], ['across', 2], ['towards', 2],
          ['temple', 2], ['garden', 2], ['forest', 2], ['meadow', 2], ['mountain', 2],
          ['dragonfly', 3], ['firefly', 3], ['butterfly', 3], ['whisper', 2], ['breeze', 1],
          ['stillness', 2], ['darkness', 2], ['warmth', 1], ['cold', 1], ['light', 1],
          ['river', 2], ['ocean', 2], ['raindrop', 2], ['thunder', 2], ['lightning', 2],
          ['petal', 2], ['blossom', 2], ['pebble', 2], ['candle', 2], ['harbor', 2],
          ['sunrise', 2], ['moonrise', 2], ['starlight', 2], ['frost', 1], ['snowfall', 2],
        ],
        // 5-syllable closers
        [
          ['silence', 2], ['stillness', 2], ['patience', 2], ['wonder', 2], ['beauty', 2],
          ['tranquil', 2], ['serene', 2], ['gentle', 2], ['softly', 2], ['slowly', 2],
          ['fading', 2], ['drifting', 2], ['melting', 2], ['growing', 2], ['rising', 2],
          ['falling', 2], ['turning', 2], ['returning', 3], ['lingering', 3], ['waiting', 2],
          ['listening', 3], ['dreaming', 2], ['breathing', 2], ['settling', 2], ['resting', 2],
          ['water', 2], ['stone', 1], ['earth', 1], ['sky', 1], ['light', 1],
          ['leaves', 1], ['petals', 2], ['branches', 2], ['roots', 1], ['seeds', 1],
          ['echo', 2], ['whisper', 2], ['shadows', 2], ['sunlight', 2], ['moonlight', 2],
          ['cold', 1], ['dark', 1], ['deep', 1], ['wild', 1], ['clear', 1],
          ['peace', 1], ['joy', 1], ['love', 1], ['hope', 1], ['home', 1],
        ],
      ],
      connectors: [
        ['on', 1], ['in', 1], ['near', 1], ['by', 1], ['from', 1],
        ['through', 1], ['over', 2], ['under', 2], ['with', 1], ['and', 1],
        ['between', 2], ['among', 2], ['beyond', 2], ['across', 2], ['upon', 2],
        ['of', 1], ['the', 1], ['a', 1], ['my', 1], ['your', 1],
      ],
    },
    cosmic: {
      lines: [
        [
          ['star', 1], ['moon', 1], ['sun', 1], ['sky', 1], ['void', 1],
          ['nebula', 3], ['galaxy', 3], ['comet', 2], ['planet', 2], ['orbit', 2],
          ['cosmos', 2], ['universe', 3], ['stellar', 2], ['solar', 2], ['lunar', 2],
          ['eclipse', 2], ['aurora', 3], ['infinity', 4], ['gravity', 3], ['satellite', 3],
          ['astronaut', 3], ['telescope', 3], ['supernova', 4], ['asteroid', 3], ['meteor', 2],
          ['radiant', 3], ['luminous', 3], ['celestial', 4], ['infinite', 3], ['eternal', 3],
        ],
        [
          ['drifting', 2], ['spinning', 2], ['burning', 2], ['shining', 2], ['fading', 2],
          ['unfolding', 3], ['exploding', 3], ['collapsing', 3], ['emerging', 3], ['crossing', 2],
          ['between', 2], ['beyond', 2], ['throughout', 2], ['within', 2], ['across', 2],
          ['the', 1], ['this', 1], ['that', 1], ['every', 2], ['all', 1],
          ['endless', 2], ['silent', 2], ['ancient', 2], ['vast', 1], ['deep', 1],
        ],
        [
          ['silence', 2], ['void', 1], ['darkness', 2], ['cold', 1], ['light', 1],
          ['infinite', 3], ['eternal', 3], ['forever', 3], ['always', 2], ['nothing', 2],
          ['emptiness', 3], ['vastness', 2], ['stillness', 2], ['silence', 2], ['warmth', 1],
          ['dust', 1], ['ashes', 2], ['remains', 2], ['echoes', 2], ['whispers', 2],
        ],
      ],
      connectors: [
        ['through', 1], ['across', 2], ['beyond', 2], ['within', 2], ['between', 2],
        ['among', 2], ['above', 2], ['below', 2], ['around', 2], ['near', 1],
        ['in', 1], ['of', 1], ['the', 1], ['a', 1], ['from', 1],
      ],
    },
    zen: {
      lines: [
        [
          ['empty', 2], ['still', 1], ['calm', 1], ['soft', 1], ['deep', 1],
          ['temple', 2], ['garden', 2], ['bamboo', 2], ['incense', 2], ['meditation', 4],
          ['breath', 1], ['mind', 1], ['soul', 1], ['spirit', 2], ['silence', 2],
          ['awareness', 3], ['compassion', 3], ['enlighten', 3], ['harmony', 3], ['wisdom', 2],
          ['circle', 2], ['mandala', 3], ['prayer', 2], ['chanting', 2], ['bowing', 2],
          ['sitting', 2], ['walking', 2], ['sweeping', 2], ['pouring', 2], ['waiting', 2],
        ],
        [
          ['in', 1], ['within', 2], ['through', 1], ['among', 2], ['beyond', 2],
          ['the', 1], ['this', 1], ['that', 1], ['each', 1], ['every', 2],
          ['silent', 2], ['gentle', 2], ['patient', 2], ['humble', 2], ['sacred', 2],
          ['ancient', 2], ['simple', 2], ['quiet', 2], ['still', 1], ['pure', 1],
          ['bell', 1], ['bell', 1], ['bell', 1], ['bowl', 1], ['leaf', 1],
        ],
        [
          ['remains', 2], ['endures', 2], ['persists', 2], ['returns', 2], ['awaits', 2],
          ['dissolves', 2], ['settles', 2], ['breathes', 1], ['listens', 2], ['waits', 1],
          ['silence', 2], ['stillness', 2], ['patience', 2], ['calm', 1], ['peace', 1],
          ['stone', 1], ['water', 2], ['earth', 1], ['sky', 1], ['wind', 1],
          ['home', 1], ['way', 1], ['path', 1], ['here', 1], ['now', 1],
        ],
      ],
      connectors: [
        ['in', 1], ['of', 1], ['the', 1], ['a', 1], ['and', 1],
        ['with', 1], ['from', 1], ['through', 1], ['beyond', 2], ['within', 2],
      ],
    },
    urban: {
      lines: [
        [
          ['city', 2], ['street', 1], ['road', 1], ['lane', 1], ['gate', 1],
          ['tower', 2], ['bridge', 1], ['subway', 2], ['neon', 2], ['chrome', 1],
          ['traffic', 2], ['concrete', 2], ['asphalt', 2], ['graffiti', 3], ['billboard', 2],
          ['rain', 1], ['fog', 1], ['night', 1], ['dawn', 1], ['dusk', 1],
          ['crowd', 1], ['taxi', 2], ['signal', 2], ['siren', 2], ['corner', 2],
          ['window', 2], ['rooftop', 2], ['alley', 2], ['harbor', 2], ['market', 2],
        ],
        [
          ['between', 2], ['among', 2], ['beneath', 2], ['behind', 2], ['across', 2],
          ['the', 1], ['this', 1], ['that', 1], ['each', 1], ['every', 2],
          ['silent', 2], ['lonely', 2], ['bright', 1], ['dark', 1], ['busy', 2],
          ['hollow', 2], ['frozen', 2], ['broken', 2], ['golden', 2], ['empty', 2],
          ['echoes', 2], ['shadows', 2], ['rain', 1], ['wind', 1], ['smoke', 1],
        ],
        [
          ['waits', 1], ['breathes', 1], ['dreams', 1], ['fades', 1], ['glows', 1],
          ['settles', 2], ['lingers', 2], ['flickers', 2], ['hums', 1], ['calls', 1],
          ['silence', 2], ['patience', 2], ['distance', 2], ['stillness', 2], ['longing', 2],
          ['neon', 2], ['steel', 1], ['glass', 1], ['stone', 1], ['rain', 1],
          ['home', 1], ['road', 1], ['night', 1], ['dark', 1], ['sky', 1],
        ],
      ],
      connectors: [
        ['in', 1], ['on', 1], ['of', 1], ['the', 1], ['a', 1],
        ['and', 1], ['with', 1], ['from', 1], ['near', 1], ['by', 1],
        ['between', 2], ['across', 2], ['beneath', 2], ['through', 1], ['around', 2],
      ],
    },
  };

  const ALL_THEMES = Object.keys(THEMES);

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Known syllable counts for the words in our banks + common words
  // (the banks hardcode counts; this handles arbitrary user text decently).
  const KNOWN = {
    quiet: 2, gently: 2, gentle: 2, river: 2, patience: 2, meditation: 4,
    blossom: 2, cherry: 2, distant: 2, wandering: 3, dragonfly: 3,
    butterfly: 3, firefly: 3, stillness: 2, silence: 2, tranquil: 2,
    serene: 2, harmony: 3, celestial: 4, universe: 3, astronaut: 3,
    telescope: 3, lightning: 2, thunder: 2, raindrop: 2, snowfall: 2,
    moonlight: 2, sunlight: 2, starlight: 2, morning: 2, evening: 2,
    twilight: 2, sunrise: 2, moonrise: 2, gravity: 3, infinity: 4,
    'the': 1, off: 1, on: 1, one: 1, of: 1, our: 1, out: 1, or: 1, sometimes: 2,
    beautiful: 3, truth: 1, their: 1, there: 2,
  };

  function syllableCount(word) {
    if (!word) return 0;
    const clean = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!clean) return 0;
    if (KNOWN[clean] !== undefined) return KNOWN[clean];
    if (clean.length <= 3) return 1;
    // Simple count of vowel groups (consecutive vowels = 1 group)
    let count = 0;
    let prevVowel = false;
    const vowels = new Set('aeiouy');
    for (let i = 0; i < clean.length; i++) {
      const isVowel = vowels.has(clean[i]);
      if (isVowel && !prevVowel) count++;
      prevVowel = isVowel;
    }

    // Silent e (not when it forms -le, e.g. "table")
    if (clean.endsWith('e') && !clean.endsWith('le') && count > 1) count--;

    // -ed / -es often 1 syllable in longer words
    if (clean.endsWith('ed') && clean.length > 4 && count > 1) {
      const b = clean.slice(0, -2);
      if (!b.endsWith('t') && !b.endsWith('d')) count--;
    }
    if (clean.endsWith('es') && clean.length > 4 && count > 1) {
      const b = clean.slice(0, -2);
      if (!b.endsWith('s') && !b.endsWith('x') && !b.endsWith('z') && !b.endsWith('ch') && !b.endsWith('sh')) count--;
    }

    return Math.max(1, count);
  }

  function buildLine(wordPool, targetSyllables, connectors) {
    const attempts = 50;
    for (let a = 0; a < attempts; a++) {
      // Pick 2-4 words from pool, check if any combination hits target
      const pool = [];
      for (const w of wordPool) {
        if (w[1] <= targetSyllables) pool.push(w);
      }
      if (pool.length === 0) continue;

      // Build line with connectors
      let syllables = 0;
      const parts = [];
      let usedConnectors = 0;
      const maxConnectors = 2;

      while (syllables < targetSyllables) {
        const remaining = targetSyllables - syllables;
        // Try to pick a word that fits
        const fits = pool.filter(w => w[1] <= remaining);
        if (fits.length === 0 && usedConnectors < maxConnectors && connectors.length > 0) {
          // Try a connector
          const connFits = connectors.filter(c => c[1] <= remaining);
          if (connFits.length === 0) break;
          const c = pickRandom(connFits);
          parts.push(c[0]);
          syllables += c[1];
          usedConnectors++;
          continue;
        }
        if (fits.length === 0) break;
        const w = pickRandom(fits);
        parts.push(w[0]);
        syllables += w[1];
      }

      if (syllables === targetSyllables && parts.length >= 1) {
        return parts.join(' ');
      }
    }
    return null;
  }

  function generate(theme, opts) {
    opts = opts || {};
    const count = Math.max(1, Math.min(20, Number(opts.count) || 1));
    const themes = theme && THEMES[theme] ? [theme] : ALL_THEMES;
    const poems = [];

    for (let i = 0; i < count; i++) {
      const t = pickRandom(themes);
      const data = THEMES[t];
      let poem = null;

      for (let attempt = 0; attempt < 100; attempt++) {
        const line1 = buildLine(data.lines[0], 5, data.connectors);
        const line2 = buildLine(data.lines[1], 7, data.connectors);
        const line3 = buildLine(data.lines[2], 5, data.connectors);
        if (line1 && line2 && line3) {
          poem = { lines: [line1, line2, line3], theme: t };
          break;
        }
      }

      if (!poem) {
        poem = {
          lines: ['cherry blossom falls', 'gently on the quiet stream', 'spring returns once more'],
          theme: t,
        };
      }
      poems.push(poem);
    }
    return poems;
  }

  function countSyllables(text) {
    if (!text) return [];
    return text.toLowerCase().split(/\s+/).filter(Boolean).map(w => ({
      word: w.replace(/[^a-z]/g, ''),
      syllables: syllableCount(w),
    }));
  }

  function analyzeLine(line) {
    const words = countSyllables(line);
    return {
      text: line,
      words,
      totalSyllables: words.reduce((s, w) => s + w.syllables, 0),
    };
  }

  function analyze(poem) {
    if (!poem) return null;
    const lines = poem.lines.map(analyzeLine);
    return {
      theme: poem.theme,
      lines,
      totalSyllables: lines.reduce((s, l) => s + l.totalSyllables, 0),
      structure: lines.map(l => l.totalSyllables).join('-'),
      isValid: lines.map(l => l.totalSyllables).join('-') === '5-7-5',
    };
  }

  return { THEMES, ALL_THEMES, generate, syllableCount, countSyllables, analyzeLine, analyze };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = HaikuEngine;
