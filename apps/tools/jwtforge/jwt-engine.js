/*
 * jwt-engine.js — JWT encoder / decoder / validator engine (JWTForge)
 * ---------------------------------------------------------
 * Pure, dependency-free. Decodes any JWT, encodes new tokens with custom
 * headers/payloads, signs with HMAC-SHA256/384/512, verifies signatures,
 * checks timestamps (exp/nbf/iat), and surfaces standard claims. Preset
 * payloads for common scenarios. Exported for browser + node.
 */
'use strict';

const JWTEngine = (() => {
  'use strict';

  /* ---- base64url helpers ---- */

  function b64urlFromBytes(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64urlDecode(str) {
    const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function b64urlEncode(input) {
    let bytes;
    if (typeof input === 'string') {
      bytes = new Uint8Array(input.length);
      for (let i = 0; i < input.length; i++) bytes[i] = input.charCodeAt(i) & 0xff;
    } else if (input instanceof Uint8Array || Array.isArray(input)) {
      bytes = new Uint8Array(input);
    } else {
      throw new Error('b64urlEncode: expected string or byte array');
    }
    return b64urlFromBytes(bytes);
  }

  function b64urlEncodeJSON(obj) {
    return b64urlEncode(JSON.stringify(obj));
  }

  /* ---- HMAC signing (SubtleCrypto in browser, crypto in node) ---- */

  const ALG_MAP = { HS256: 'SHA-256', HS384: 'SHA-384', HS512: 'SHA-512' };
  const ALG_NAMES = Object.keys(ALG_MAP);

  async function importKey(secret, alg) {
    const enc = new TextEncoder();
    const keyData = enc.encode(typeof secret === 'string' ? secret : JSON.stringify(secret));
    return crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: ALG_MAP[alg] }, false, ['sign', 'verify']);
  }

  async function hmacSign(data, secret, alg) {
    const key = await importKey(secret, alg);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    return b64urlFromBytes(new Uint8Array(sig));
  }

  async function hmacVerify(data, signature, secret, alg) {
    const key = await importKey(secret, alg);
    const sigBytes = b64urlDecode(signature);
    return crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data));
  }

  /* ---- JWT decode ---- */

  function decode(token) {
    const parts = token.trim().split('.');
    if (parts.length < 2 || parts.length > 3) {
      return { valid: false, error: 'Invalid JWT format — expected 2 or 3 dot-separated parts' };
    }
    try {
      const header = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0])));
      const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
      const signature = parts[2] || null;
      return { valid: true, header, payload, signature, raw: token.trim() };
    } catch (e) {
      return { valid: false, error: 'Failed to decode JWT: ' + e.message };
    }
  }

  /* ---- JWT encode ---- */

  function encode(header, payload, signatureBase64url) {
    const h = b64urlEncodeJSON(header);
    const p = b64urlEncodeJSON(payload);
    return h + '.' + p + (signatureBase64url ? '.' + signatureBase64url : '');
  }

  /* ---- full sign (async) ---- */

  async function sign(header, payload, secret, alg) {
    alg = alg || header.alg || 'HS256';
    if (!ALG_MAP[alg]) throw new Error('Unsupported algorithm: ' + alg + '. Use one of: ' + ALG_NAMES.join(', '));
    const encoded = encode(header, payload);
    const sig = await hmacSign(encoded, secret, alg);
    return encoded + '.' + sig;
  }

  /* ---- full verify (async) ---- */

  async function verify(token, secret) {
    const dec = decode(token);
    if (!dec.valid) return { valid: false, error: dec.error, token: dec };
    if (!dec.signature) return { valid: false, error: 'No signature present — this is an unsigned JWT', token: dec };
    const alg = dec.header.alg;
    if (!ALG_MAP[alg]) return { valid: false, error: 'Unsupported algorithm: ' + alg, token: dec };
    if (!secret) return { valid: false, error: 'Secret required for verification', token: dec };
    try {
      const signed = dec.raw.substring(0, dec.raw.lastIndexOf('.'));
      const ok = await hmacVerify(signed, dec.signature, secret, alg);
      return { valid: ok, error: ok ? null : 'Signature mismatch', token: dec };
    } catch (e) {
      return { valid: false, error: 'Verification error: ' + e.message, token: dec };
    }
  }

  /* ---- timestamp analysis ---- */

  function analyzeTimestamps(payload) {
    const now = Math.floor(Date.now() / 1000);
    const result = { now };
    if (payload.exp !== undefined) {
      result.exp = payload.exp;
      result.expired = now > payload.exp;
      result.expiresIn = payload.exp - now;
      result.expiresHuman = humanDuration(payload.exp - now);
    }
    if (payload.nbf !== undefined) {
      result.nbf = payload.nbf;
      result.notYetValid = now < payload.nbf;
      result.validIn = payload.nbf - now;
    }
    if (payload.iat !== undefined) {
      result.iat = payload.iat;
      result.age = now - payload.iat;
      result.ageHuman = humanDuration(now - payload.iat);
    }
    return result;
  }

  function humanDuration(seconds) {
    if (seconds < 0) return 'expired ' + humanDuration(-seconds).replace(/^/, '') + ' ago';
    if (seconds < 60) return seconds + 's';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ' + (seconds % 60) + 's';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ' + Math.floor((seconds % 3600) / 60) + 'm';
    return Math.floor(seconds / 86400) + 'd ' + Math.floor((seconds % 86400) / 3600) + 'h';
  }

  /* ---- standard claims ---- */

  const STANDARD_CLAIMS = {
    iss: 'Issuer — who created the JWT',
    sub: 'Subject — who the JWT is about',
    aud: 'Audience — who the JWT is intended for',
    exp: 'Expiration Time — Unix timestamp when the JWT expires',
    nbf: 'Not Before — Unix timestamp when the JWT becomes valid',
    iat: 'Issued At — Unix timestamp when the JWT was created',
    jti: 'JWT ID — unique identifier for the token',
    azp: 'Authorized Party — the party authorized to receive the token',
    scope: 'Space-separated list of scopes',
    roles: 'Array of role strings',
    email: 'Email address of the subject',
    name: 'Full name of the subject',
    picture: 'URL to the subject\'s profile picture',
    locale: 'Subject\'s locale (BCP 47)',
    updated_at: 'Timestamp of last profile update'
  };

  function identifyClaims(payload) {
    const identified = {};
    for (const [key, desc] of Object.entries(STANDARD_CLAIMS)) {
      if (payload[key] !== undefined) {
        identified[key] = { value: payload[key], description: desc };
      }
    }
    const custom = {};
    for (const key of Object.keys(payload)) {
      if (!STANDARD_CLAIMS[key]) custom[key] = payload[key];
    }
    if (Object.keys(custom).length > 0) identified._custom = custom;
    return identified;
  }

  /* ---- preset payloads ---- */

  const PRESETS = {
    auth: {
      header: { alg: 'HS256', typ: 'JWT' },
      payload: { sub: 'user-1234', name: 'Alice', role: 'admin', iat: () => Math.floor(Date.now() / 1000), exp: () => Math.floor(Date.now() / 1000) + 3600 }
    },
    api: {
      header: { alg: 'HS256', typ: 'JWT' },
      payload: { iss: 'api-gateway', sub: 'client-5678', aud: 'api.example.com', scope: 'read write', iat: () => Math.floor(Date.now() / 1000), exp: () => Math.floor(Date.now() / 1000) + 7200 }
    },
    session: {
      header: { alg: 'HS256', typ: 'JWT' },
      payload: { sub: 'user-9012', name: 'Bob', email: 'bob@example.com', iat: () => Math.floor(Date.now() / 1000), exp: () => Math.floor(Date.now() / 1000) + 86400, jti: () => crypto.randomUUID ? crypto.randomUUID() : b64urlFromBytes(crypto.getRandomValues(new Uint8Array(16))) }
    },
    reset: {
      header: { alg: 'HS256', typ: 'JWT' },
      payload: { sub: 'user-3456', purpose: 'password-reset', iat: () => Math.floor(Date.now() / 1000), exp: () => Math.floor(Date.now() / 1000) + 1800 }
    },
    shortlived: {
      header: { alg: 'HS256', typ: 'JWT' },
      payload: { sub: 'temp-7890', purpose: 'one-time-access', iat: () => Math.floor(Date.now() / 1000), exp: () => Math.floor(Date.now() / 1000) + 300 }
    }
  };

  function applyPreset(name) {
    const p = PRESETS[name];
    if (!p) return null;
    const payload = {};
    for (const [k, v] of Object.entries(p.payload)) {
      payload[k] = typeof v === 'function' ? v() : v;
    }
    return { header: { ...p.header }, payload };
  }

  /* ---- full analysis (decode + timestamps + claims) ---- */

  function analyze(token) {
    const dec = decode(token);
    if (!dec.valid) return { valid: false, error: dec.error };
    const timestamps = analyzeTimestamps(dec.payload);
    const claims = identifyClaims(dec.payload);
    return {
      valid: true,
      header: dec.header,
      payload: dec.payload,
      hasSignature: !!dec.signature,
      algorithm: dec.header.alg || 'none',
      timestamps,
      claims,
      toString: () => token
    };
  }

  /* ---- exports ---- */

  return {
    decode,
    encode,
    sign,
    verify,
    analyze,
    analyzeTimestamps,
    identifyClaims,
    applyPreset,
    PRESETS,
    STANDARD_CLAIMS,
    ALG_NAMES,
    b64urlEncode,
    b64urlDecode,
    b64urlEncodeJSON
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = JWTEngine;
