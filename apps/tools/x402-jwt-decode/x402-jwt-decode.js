#!/usr/bin/env node
/*
 * x402-jwt-decode — x402 payment-protocol JWT decoder / validator API
 * --------------------------------------------------------------------
 * Pay-to-call JWT inspection API. Unpaid -> 402 + Payment-Required
 * metadata; after a valid single-use payment it decodes any JWT, validates
 * its HMAC-SHA256 signature (if a secret is supplied), checks exp/nbf/iat
 * claims, and returns a full structured breakdown.
 *
 * Endpoints:
 *   GET  /health                          -> 200 {ok, service, price}
 *   POST /pay {nonce?, secret?}           -> 200 { receipt_token, nonce, price }
 *       .secret is optional: the signing secret to validate against.
 *   GET  /decode ?token=<jwt>&secret=<s>  -> 200 { header, payload, valid, expired, ... }
 *       Decodes the JWT header + payload, validates signature if secret is provided,
 *       reports exp/nbf/iat status.
 *   POST /decode { token, secret? }       -> same as GET
 *   if unpaid -> 402 + Payment-Required metadata
 *
 * Usage: node x402-jwt-decode.js [port]   (default 8807)
 */
'use strict';

const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.argv[2] || process.env.PORT || 8807);
const HOST = '127.0.0.1';
const PAYMENT_SECRET = process.env.PAYMENT_SECRET || 'dev-only-jwt-secret-change-me';

const price = { amount: '0.00003', currency: 'BTC', network: 'lightning', label: 'casper#jwt-decode' };
const spentReceipts = new Set();

function b64url(b) {
  return Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  return Buffer.from(t, 'base64');
}
function sign(d, s) { return crypto.createHmac('sha256', s).update(d).digest(); }

function receiptFor(nonce) {
  const p = b64url(Buffer.from(JSON.stringify({ receipt: 'jwt-decode-paid', nonce, ...price })));
  return p + '.' + b64url(sign(p, PAYMENT_SECRET));
}
function verifyReceipt(token) {
  const [p, s] = token.split('.');
  if (!p || !s) return null;
  if (b64url(sign(p, PAYMENT_SECRET)) !== s) return null;
  try {
    const payload = JSON.parse(b64urlDecode(p).toString('utf8'));
    if (spentReceipts.has(token)) return null;
    spentReceipts.add(token);
    return payload;
  } catch { return null; }
}

function send(res, code, headers, body) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { if (data.length < 1e6) data += c; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
function parseBody(raw) {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return { __raw: raw }; }
}

/* ---- JWT decoding ---- */

function decodeJwt(tokenStr, secret) {
  const parts = tokenStr.split('.');
  if (parts.length < 2 || parts.length > 3) {
    return { error: 'Invalid JWT format — expected 2 or 3 dot-separated parts', parts: parts.length };
  }

  let header, payload;
  try {
    header = JSON.parse(b64urlDecode(parts[0]).toString('utf8'));
  } catch {
    return { error: 'Failed to decode JWT header (invalid base64url JSON)' };
  }
  try {
    payload = JSON.parse(b64urlDecode(parts[1]).toString('utf8'));
  } catch {
    return { error: 'Failed to decode JWT payload (invalid base64url JSON)' };
  }

  const result = { header, payload };

  /* Algorithm & signature validation */
  const alg = (header.alg || '').toUpperCase();
  result.algorithm = alg;

  if (parts.length === 3) {
    const signingInput = parts[0] + '.' + parts[1];
    const signature = b64urlDecode(parts[2]);

    if (alg === 'none') {
      result.signatureValid = signature.length === 0 ? true : false;
      result.signatureNote = 'alg=none — signature should be empty';
    } else if (alg.startsWith('HS')) {
      if (!secret) {
        result.signatureValid = null;
        result.signatureNote = 'HMAC algorithm detected but no secret provided — cannot validate';
      } else {
        const hashAlg = alg === 'HS256' ? 'sha256' : alg === 'HS384' ? 'sha384' : alg === 'HS512' ? 'sha512' : null;
        if (!hashAlg) {
          result.signatureValid = null;
          result.signatureNote = 'Unsupported HMAC variant: ' + alg;
        } else {
          const expected = crypto.createHmac(hashAlg, secret).update(signingInput).digest();
          result.signatureValid = crypto.timingSafeEqual(signature, expected);
          result.signatureNote = result.signatureValid ? 'Signature matches' : 'Signature DOES NOT match';
        }
      }
    } else if (alg.startsWith('RS') || alg.startsWith('PS') || alg.startsWith('ES')) {
      result.signatureValid = null;
      result.signatureNote = 'Asymmetric algorithm (' + alg + ') — validation requires the public key (not supported in this demo)';
    } else {
      result.signatureValid = null;
      result.signatureNote = 'Unknown algorithm: ' + alg;
    }
  } else {
    result.signatureValid = null;
    result.signatureNote = 'No signature present (2-part JWT)';
  }

  /* Timestamp checks */
  const now = Math.floor(Date.now() / 1000);
  result.now = now;

  if (payload.exp !== undefined) {
    result.expired = now > payload.exp;
    result.expiresIn = payload.exp - now;
    result.expiresAt = new Date(payload.exp * 1000).toISOString();
  }
  if (payload.nbf !== undefined) {
    result.notBefore = new Date(payload.nbf * 1000).toISOString();
    result.nbfMet = now >= payload.nbf;
  }
  if (payload.iat !== undefined) {
    result.issuedAt = new Date(payload.iat * 1000).toISOString();
    result.age = now - payload.iat;
  }

  /* Standard claim summaries */
  if (payload.iss) result.issuer = payload.iss;
  if (payload.sub) result.subject = payload.sub;
  if (payload.aud) result.audience = payload.aud;
  if (payload.jti) result.jwtId = payload.jti;

  return result;
}

/* ---- server ---- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || HOST}`);
  const route = url.pathname;

  if (route === '/health') {
    return send(res, 200, {}, { ok: true, service: 'x402-jwt-decode', price, pid: process.pid });
  }

  if (route === '/pay' && req.method === 'POST') {
    const body = parseBody(await readBody(req));
    const nonce = body.nonce || crypto.randomBytes(16).toString('hex');
    const receipt_token = receiptFor(nonce);
    return send(res, 200, {}, { receipt_token, nonce, price });
  }

  if (route === '/decode') {
    const auth = req.headers.authorization || '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const receipt = bearer ? verifyReceipt(bearer) : null;
    if (!receipt) {
      return send(res, 402, {
        'WWW-Authenticate': 'Bearer realm="x402-jwt-decode"',
        'X-Payment-Required': JSON.stringify(price)
      }, { error: 'Payment required', price, pay_endpoint: 'POST /pay' });
    }

    let tokenStr, secret;
    if (req.method === 'POST') {
      const body = parseBody(await readBody(req));
      tokenStr = body.token;
      secret = body.secret || url.searchParams.get('secret');
    } else {
      tokenStr = url.searchParams.get('token');
      secret = url.searchParams.get('secret');
    }

    if (!tokenStr) {
      return send(res, 400, {}, { error: 'Missing token parameter', usage: 'GET /decode?token=<jwt>&secret=<optional>' });
    }

    const decoded = decodeJwt(tokenStr, secret);
    return send(res, 200, {}, { ok: true, decoded });
  }

  send(res, 404, {}, { error: 'Not found', routes: ['GET /health', 'POST /pay', 'GET /decode', 'POST /decode'] });
});

server.listen(PORT, HOST, () => {
  console.log(`x402-jwt-decode listening on http://${HOST}:${PORT}`);
});
