/*
 * qr-engine.js — dependency-free QR code generator (QRForge)
 * -----------------------------------------------------------
 * Pure, dependency-free QR code generator. Implements the core of the QR
 * standard:
 *   - data encoding (numeric, alphanumeric, byte)
 *   - Reed-Solomon error correction
 *   - mask pattern selection
 *   - module placement including finder/alignment/timing patterns
 * Output is a 2D boolean matrix that the UI renders to an SVG. Version 1-6,
 * error correction L/M/Q/H. Exported for node test.
 */
'use strict';

const QREngine = (() => {

  /* ---- tables ---- */

  // GF(256) arithmetic tables
  const EXP = new Array(256), LOG = new Array(256);
  (() => {
    let x = 1;
    for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  })();
  function gmul(a, b) { if (a === 0 || b === 0) return 0; return EXP[(LOG[a] + LOG[b]) % 255]; }
  function ginv(a) { return EXP[(255 - LOG[a]) % 255]; }

  // Version -> { size, ecCodewords, dataCodewords, blocks: [{data, ec}] }
  // Computed from the QR spec for byte mode, versions 1-6, EC levels.
  const CHARACTER_CAPACITY = {
    1: { L: 17, M: 14, Q: 11, H: 7 },
    2: { L: 32, M: 26, Q: 20, H: 14 },
    3: { L: 53, M: 42, Q: 32, H: 24 },
    4: { L: 78, M: 62, Q: 46, H: 34 },
    5: { L: 106, M: 84, Q: 60, H: 44 },
    6: { L: 134, M: 106, Q: 74, H: 58 }
  };

  const ALIGNMENT = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34]
  };

  // EC codewords per block: [version][EC] = { totalCodewords, dataCodewords, blockInfo }
  const EC_TABLE = {
    1: { L: { total: 26, data: 19, blocks: 1 }, M: { total: 26, data: 16, blocks: 1 }, Q: { total: 26, data: 13, blocks: 1 }, H: { total: 26, data: 9, blocks: 1 } },
    2: { L: { total: 44, data: 34, blocks: 1 }, M: { total: 44, data: 28, blocks: 1 }, Q: { total: 44, data: 22, blocks: 1 }, H: { total: 44, data: 16, blocks: 1 } },
    3: { L: { total: 70, data: 55, blocks: 1 }, M: { total: 70, data: 44, blocks: 1 }, Q: { total: 70, data: 34, blocks: 2 }, H: { total: 70, data: 26, blocks: 2 } },
    4: { L: { total: 100, data: 80, blocks: 1 }, M: { total: 100, data: 64, blocks: 2 }, Q: { total: 100, data: 48, blocks: 2 }, H: { total: 100, data: 36, blocks: 4 } },
    5: { L: { total: 134, data: 108, blocks: 1 }, M: { total: 134, data: 86, blocks: 2 }, Q: { total: 134, data: 62, blocks: 2 }, H: { total: 134, data: 46, blocks: 4 } },
    6: { L: { total: 172, data: 136, blocks: 2 }, M: { total: 172, data: 108, blocks: 2 }, Q: { total: 172, data: 76, blocks: 4 }, H: { total: 172, data: 60, blocks: 4 } }
  };

  /* ---- bit buffer ---- */

  class BitBuffer {
    constructor() { this.bits = []; }
    write(v, len) {
      for (let i = len - 1; i >= 0; i--) this.bits.push((v >> i) & 1);
    }
    writeBits(arr) { arr.forEach(b => this.bits.push(b & 1)); }
    get length() { return this.bits.length; }
    toByteArray() {
      const out = [];
      for (let i = 0; i < this.bits.length; i += 8) {
        let byte = 0;
        for (let j = 0; j < 8; j++) byte = (byte << 1) | (this.bits[i + j] || 0);
        out.push(byte);
      }
      return out;
    }
  }

  /* ---- data encoding ---- */

  const NUMERIC = '0123456789';
  const ALPHANUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

  function encodeNumeric(str) {
    const buf = new BitBuffer();
    const groups = [];
    for (let i = 0; i < str.length; i += 3) groups.push(str.substr(i, 3));
    buf.write(1, 4); // mode numeric
    buf.write(str.length, 10);
    groups.forEach(g => {
      if (g.length === 3) buf.write(parseInt(g, 10), 10);
      else if (g.length === 2) buf.write(parseInt(g, 10), 7);
      else buf.write(parseInt(g, 10), 4);
    });
    return { buf, dataCountBits: 10 + groups.length * (groups.every(g => g.length === 3) ? 10 : groups[groups.length - 1].length === 2 ? 7 : 4) };
  }

  function encodeAlphanumeric(str) {
    const buf = new BitBuffer();
    buf.write(2, 4);
    buf.write(str.length, 9);
    const pairs = [];
    for (let i = 0; i < str.length; i += 2) pairs.push(str.substr(i, 2));
    pairs.forEach(p => {
      if (p.length === 2) {
        const v = ALPHANUM.indexOf(p[0]) * 45 + ALPHANUM.indexOf(p[1]);
        buf.write(v, 11);
      } else {
        buf.write(ALPHANUM.indexOf(p[0]), 6);
      }
    });
    return buf;
  }

  function encodeByte(str) {
    const buf = new BitBuffer();
    const bytes = Buffer.from(str, 'utf8');
    buf.write(4, 4); // mode byte
    buf.write(bytes.length, 8);
    bytes.forEach(b => buf.write(b, 8));
    return { buf, byteLen: bytes.length };
  }

  /* ---- Reed-Solomon ---- */

  function rsGeneratorPoly(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      // multiply poly by (x + α^i); in GF(256) "x + α^i" -> coefficients [α^i, 1]
      const factor = [EXP[i], 1];
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= gmul(poly[j], factor[0]);
        next[j + 1] ^= gmul(poly[j], factor[1]);
      }
      poly = next;
    }
    return poly;
  }

  function rsRemainder(data, degree) {
    const gen = rsGeneratorPoly(degree);
    const tmp = new Array(data.length + degree).fill(0);
    data.forEach((b, i) => tmp[i] = b);
    for (let i = 0; i < data.length; i++) {
      const coef = tmp[i];
      if (coef !== 0) {
        for (let j = 0; j < gen.length; j++) tmp[i + j] ^= gmul(gen[j], coef);
      }
    }
    return tmp.slice(data.length);
  }

  /* ---- matrix + placement ---- */

  function buildMatrix(size) {
    const m = [];
    for (let i = 0; i < size; i++) m.push(new Array(size).fill(null));
    return m;
  }

  function placeFinder(m, row, col) {
    const patterns = [
      [1,1,1,1,1,1,1],[1,0,0,0,0,0,1],[1,0,1,1,1,0,1],
      [1,0,1,1,1,0,1],[1,0,1,1,1,0,1],[1,0,0,0,0,0,1],[1,1,1,1,1,1,1]
    ];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) m[row + r][col + c] = patterns[r][c];
    // separators (the 8th row/column of white space around the finder)
    for (let i = 0; i < 8; i++) {
      // left column
      if (col - 1 >= 0 && row + i < m.length) m[row + i][col - 1] = 0;
      // top row
      if (row - 1 >= 0 && col + i < m.length) m[row - 1][col + i] = 0;
      // right column
      if (col + 7 < m.length && row + i < m.length) m[row + i][col + 7] = 0;
      // bottom row
      if (row + 7 < m.length && col + i < m.length) m[row + 7][col + i] = 0;
    }
  }

  function placeAlignment(m, row, col) {
    for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) {
      m[row + r][col + c] = (Math.abs(r) <= 1 && Math.abs(c) <= 1) ? 1 : 0;
    }
    m[row][col] = 1;
  }

  function placeTiming(m, size) {
    for (let i = 8; i < size - 8; i++) {
      const v = (i % 2 === 0) ? 1 : 0;
      if (m[6][i] === null) m[6][i] = v;
      if (m[i][6] === null) m[i][6] = v;
    }
  }

  function placeDarkModule(m, size) {
    m[size - 8][8] = 1;
  }

  function placeFormatInfo(m, size, ecBits, mask) {
    formatInformation(ecBits, mask).forEach((bit, i) => {
      const bitVal = bit ? 1 : 0;
      if (i < 6) m[8][i] = bitVal;
      else if (i < 8) m[8][i + 1] = bitVal;
      else if (i < 15 && i < 7) m[8][size - 15 + i] = bitVal;
      // mirrored
      if (i < 8) m[size - 1 - i][8] = bitVal;
      else if (i < 9) m[15 - i][8] = bitVal;
      else m[size - 15 + i - 8][8] = bitVal;
    });
  }

  function formatInformation(ecBits, mask) {
    // Encode EC level (2 bits) + mask (3 bits) = 5 bits -> 15 bits with BCH
    const data = (ecBits << 3) | mask;
    let d = data << 10;
    const g = 0x537; // generator
    let rem = d;
    for (let i = 14; i >= 10; i--) {
      if ((rem >> i) & 1) rem ^= g << (i - 10);
    }
    const full = ((data << 10) | rem) ^ 0x5412;
    const bits = [];
    for (let i = 14; i >= 0; i--) bits.push((full >> i) & 1);
    return bits;
  }

  /* ---- data placement (zigzag) ---- */

  function placeData(m, size, dataBytes) {
    let idx = 0;
    let r = size - 1, c = size - 1;
    let upward = true;
    const totalBits = dataBytes.length * 8;
    while (c >= 1 && idx < totalBits) {
      if (c === 6) c--; // skip timing column
      // walk this column
      while (r >= 0 && r < size) {
        if (m[r][c] === null) {
          if (idx < totalBits) { m[r][c] = (dataBytes[idx >> 3] >> (7 - (idx & 7))) & 1; idx++; }
          else m[r][c] = -1; // padding bit (masked later)
        }
        r += upward ? -1 : 1;
      }
      // move to next column pair, flip direction
      upward = !upward;
      c -= 2;
      if (c === 6) c--;
      // start new column from the correct edge
      r = upward ? (size - 1) : 0;
    }
    // any remaining null cells are non-function padding (masked later)
    for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) if (m[i][j] === null) m[i][j] = -1;
  }

  /* ---- masking ---- */

  function maskFunction(mask, r, c) {
    switch (mask) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return (r * c) % 2 + (r * c) % 3 === 0;
      case 6: return ((r * c) % 2 + (r * c) % 3) % 2 === 0;
      case 7: return ((r + c) % 2 + (r * c) % 3) % 2 === 0;
      default: return false;
    }
  }

  function applyMask(m, size, mask) {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (m[r][c] === null) {
          m[r][c] = maskFunction(mask, r, c) ? 1 : 0;
        }
      }
    }
  }

  function penaltyScore(m, size) {
    let score = 0;
    // Rule 1: adjacent modules in row/column
    for (let r = 0; r < size; r++) {
      let run = 1, runColor = m[r][0];
      for (let c = 1; c < size; c++) {
        if (m[r][c] === runColor) { run++; }
        else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1; runColor = m[r][c];
        }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
    for (let c = 0; c < size; c++) {
      let run = 1, runColor = m[0][c];
      for (let r = 1; r < size; r++) {
        if (m[r][c] === runColor) { run++; }
        else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1; runColor = m[r][c];
        }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
    // Rule 2: 2x2 blocks of same color
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        const v = m[r][c];
        if (m[r][c + 1] === v && m[r + 1][c] === v && m[r + 1][c + 1] === v) score += 3;
      }
    }
    // Rule 3: finder-like patterns 1011101 with 0000 before/after
    const finderPattern = [1,0,1,1,1,0,1,0,0,0,0];
    const finderPatternR = [0,0,0,0,1,0,1,1,1,0,1];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size - 10; c++) {
        let hit = true;
        for (let i = 0; i < 11; i++) if (m[r][c + i] !== finderPattern[i]) { hit = false; break; }
        if (!hit) { hit = true; for (let i = 0; i < 11; i++) if (m[r][c + i] !== finderPatternR[i]) { hit = false; break; } }
        if (hit) score += 40;
      }
    }
    for (let c = 0; c < size; c++) {
      for (let r = 0; r < size - 10; r++) {
        let hit = true;
        for (let i = 0; i < 11; i++) if (m[r + i][c] !== finderPattern[i]) { hit = false; break; }
        if (!hit) { hit = true; for (let i = 0; i < 11; i++) if (m[r + i][c] !== finderPatternR[i]) { hit = false; break; } }
        if (hit) score += 40;
      }
    }
    // Rule 4: proportion of dark modules
    const dark = m.flat().filter(v => v === 1).length;
    const total = size * size;
    const percent = (dark / total) * 100;
    const prev = Math.floor(Math.abs(percent - 50) / 5);
    score += prev * 10;
    return score;
  }

  /* ---- level bit mapping ---- */
  const EC_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  /* ---- main generate ---- */

  function generate(text, opts) {
    opts = opts || {};
    const ec = (opts.ec || 'M').toUpperCase();
    if (!['L', 'M', 'Q', 'H'].includes(ec)) return { error: 'Invalid EC level; use L, M, Q, or H' };
    if (!text || !text.trim()) return { error: 'Empty input' };

    // detect mode
    let bytes;
    if (/^[0-9]+$/.test(text)) {
      bytes = encodeNumeric(text).buf.toByteArray();
    } else if (/^[0-9A-Z $%*+\-./:]+$/.test(text)) {
      bytes = encodeAlphanumeric(text).toByteArray();
    } else {
      bytes = encodeByte(text).buf.toByteArray();
    }

    // choose version
    let version = 1;
    for (let v = 1; v <= 6; v++) {
      if (bytes.length <= CHARACTER_CAPACITY[v][ec]) { version = v; break; }
    }
    if (version === 1 && bytes.length > CHARACTER_CAPACITY[1][ec]) return { error: 'Input too large for version 6' };

    const table = EC_TABLE[version][ec];
    const size = 17 + version * 4;

    // pad data to data codewords
    const dataCodewords = table.data;
    while (bytes.length < dataCodewords) {
      bytes.push(bytes.length % 2 === 0 ? 0xec : 0x11);
    }

    // Reed-Solomon EC per block
    const blockCount = table.blocks;
    const dataPerBlock = Math.floor(dataCodewords / blockCount);
    const ecPerBlock = Math.floor((table.total - dataCodewords) / blockCount);
    const blocks = [];
    for (let i = 0; i < blockCount; i++) {
      const start = i * dataPerBlock;
      const blockData = bytes.slice(start, start + dataPerBlock);
      const ecBytes = rsRemainder(blockData, ecPerBlock);
      blocks.push({ data: blockData, ec: ecBytes });
    }

    // interleave
    const allData = [];
    const maxData = Math.max(...blocks.map(b => b.data.length));
    for (let i = 0; i < maxData; i++) blocks.forEach(b => { if (i < b.data.length) allData.push(b.data[i]); });
    const allEc = [];
    const maxEc = Math.max(...blocks.map(b => b.ec.length));
    for (let i = 0; i < maxEc; i++) blocks.forEach(b => { if (i < b.ec.length) allEc.push(b.ec[i]); });
    const finalBytes = allData.concat(allEc);

    // build base matrix with fixed patterns
    const m = buildMatrix(size);
    placeFinder(m, 0, 0);
    placeFinder(m, 0, size - 7);
    placeFinder(m, size - 7, 0);
    ALIGNMENT[version].forEach((co) => {
      ALIGNMENT[version].forEach((ro) => {
        if (!((co === 0 && ro === 0) || (co === 0 && ro === size - 7) || (co === size - 7 && ro === 0))) placeAlignment(m, co, ro);
      });
    });
    placeTiming(m, size);
    placeDarkModule(m, size);

    // place data into the null (function-free) cells once
    const isFunction = m.map(row => row.map(v => v !== null)); // cells occupied before data placement
    placeData(m, size, finalBytes);

    // evaluate masks: apply mask to non-function cells, place format info
    let best = null, bestMask = 0, bestScore = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const raw = m.map(r => r.slice());
      raw[size - 8][8] = 1; // dark module (re-set after format info may clobber)
      for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) {
        if (isFunction[i][j]) continue; // keep function modules as-is
        const v = raw[i][j];
        const mv = maskFunction(mask, i, j) ? 1 : 0;
        raw[i][j] = (v === -1 ? 0 : v) ^ mv; // padding treated as 0
      }
      placeFormatInfo(raw, size, EC_BITS[ec], mask);
      raw[size - 8][8] = 1; // ensure dark module survives format info
      const score = penaltyScore(raw, size);
      if (score < bestScore) { bestScore = score; best = raw; bestMask = mask; }
    }

    return { matrix: best, size, version, ec, mask: bestMask, capacity: CHARACTER_CAPACITY[version][ec] };
  }

  return {
    generate,
    test: { gmul, ginv, rsGeneratorPoly, rsRemainder, formatInformation, penaltyScore, ALIGNMENT, CHARACTER_CAPACITY }
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = QREngine;
