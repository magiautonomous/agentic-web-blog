/*
 * token-engine.js — UUID / random token generator engine (TokenForge)
 * ---------------------------------------------------------
 * Pure, dependency-free. Generates RFC 4122 v4 UUIDs, random hex tokens,
 * base64url tokens, and alphanumeric strings using crypto.getRandomValues
 * (browser) or crypto.randomBytes (node). Exported for browser + node.
 */
'use strict';

const TokenEngine = (() => {
  'use strict';

  const HEX = '0123456789abcdef';
  const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const ALPHA_NUM = ALPHA + '0123456789';
  const BASE64_URL = ALPHA_NUM + '-_';

  function randomBytes(n) {
    if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
      const buf = new Uint8Array(n);
      globalThis.crypto.getRandomValues(buf);
      return buf;
    }
    const nodeCrypto = typeof require !== 'undefined' && require('crypto');
    if (nodeCrypto) return nodeCrypto.randomBytes(n);
    throw new Error('No secure random source available');
  }

  function uuid4() {
    const b = randomBytes(16);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  function hexToken(bytes) {
    const b = randomBytes(bytes);
    return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
  }

  function base64UrlToken(bytes) {
    const b = randomBytes(bytes);
    let s = '';
    for (let i = 0; i < b.length; i++) s += BASE64_URL[b[i] % 64];
    return s;
  }

  function alphanumeric(len) {
    const b = randomBytes(len);
    let s = '';
    for (let i = 0; i < b.length; i++) s += ALPHA_NUM[b[i] % ALPHA_NUM.length];
    return s;
  }

  function generate(opts) {
    opts = opts || {};
    const kind = (opts.kind || 'uuid').toLowerCase();
    const count = Math.max(1, Math.min(100, Number(opts.count) || 1));
    const length = Math.max(4, Math.min(128, Number(opts.length) || 24));

    const results = [];
    for (let i = 0; i < count; i++) {
      if (kind === 'uuid') results.push(uuid4());
      else if (kind === 'hex') results.push(hexToken(Math.ceil(length / 2)));
      else if (kind === 'base64') results.push(base64UrlToken(Math.ceil(length * 3 / 4)));
      else if (kind === 'alpha') results.push(alphanumeric(length));
      else if (kind === 'alphanum') results.push(alphanumeric(length));
      else results.push(uuid4());
    }
    return results;
  }

  function stats(token) {
    const hasLower = /[a-z]/.test(token);
    const hasUpper = /[A-Z]/.test(token);
    const hasDigit = /[0-9]/.test(token);
    const hasSpecial = /[^a-zA-Z0-9]/.test(token);
    const charsetSize = (hasLower ? 26 : 0) + (hasUpper ? 26 : 0) + (hasDigit ? 10 : 0) + (hasSpecial ? 2 : 0);
    const entropy = charsetSize > 0 ? Math.round(token.length * Math.log2(charsetSize)) : 0;
    return {
      length: token.length,
      charset: { lower: hasLower, upper: hasUpper, digits: hasDigit, special: hasSpecial },
      charsetSize,
      entropyBits: entropy,
    };
  }

  return { uuid4, hexToken, base64UrlToken, alphanumeric, generate, stats, randomBytes };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = TokenEngine;
