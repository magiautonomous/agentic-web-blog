#!/usr/bin/env node
/*
 * x402-base64 — x402 payment-protocol base64 / hex / URL encoder API
 * ---------------------------------------------------------
 * Pay-to-call encoding utility. Unpaid -> 402 + Payment-Required metadata;
 * after a valid single-use payment it encodes text (or decodes) across
 * standard base64, URL-safe base64, hex, and URL percent-encoding.
 * A public, free GET /formats lists the supported encodings.
 *
 * Endpoints:
 *   GET  /health          -> 200 {ok, service, price}
 *   GET  /formats         -> 200 { ok, formats:[...] }   (FREE)
 *   POST /pay {nonce?}    -> 200 { receipt_token, nonce, price }
 *   GET|POST /encode?fmt=&text=  -> 200 { ok, format, text, result }
 *   GET|POST /decode?fmt=&text=  -> 200 { ok, format, text, result }
 *       once per valid bearer (single-use, replay-safe).
 *   if unpaid -> 402 + Payment-Required metadata
 *
 * Usage: node x402-base64.js [port]   (default 8811)
 */
'use strict';

const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.argv[2] || process.env.PORT || 8811);
const HOST = '127.0.0.1';
const PAYMENT_SECRET = process.env.PAYMENT_SECRET || 'dev-only-base64-secret-change-me';

const price = { amount: '0.00002', currency: 'BTC', network: 'lightning', label: 'casper#base64' };
const spentReceipts = new Set();

const FORMATS = ['base64', 'base64url', 'hex', 'url'];

function encodeText(text, fmt) {
  const input = Buffer.from(String(text), 'utf8');
  switch (fmt) {
    case 'base64': return input.toString('base64');
    case 'base64url': return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    case 'hex': return input.toString('hex');
    case 'url': return encodeURIComponent(String(text));
    default: return null;
  }
}

function decodeText(text, fmt) {
  try {
    switch (fmt) {
      case 'base64': return Buffer.from(String(text), 'base64').toString('utf8');
      case 'base64url': return Buffer.from(String(text).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
      case 'hex': return Buffer.from(String(text), 'hex').toString('utf8');
      case 'url': return decodeURIComponent(String(text));
      default: return null;
    }
  } catch (e) {
    throw new Error('Invalid input: ' + e.message);
  }
}

function isValidFormat(f) {
  return FORMATS.includes(String(f));
}

/* ---- crypto ---- */

function b64url(b) {
  return Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function sign(d, s) { return crypto.createHmac('sha256', s).update(d).digest(); }
function receiptFor(nonce) {
  const p = b64url(Buffer.from(JSON.stringify({ receipt: 'base64-paid', nonce, ...price })));
  return p + '.' + b64url(sign(p, PAYMENT_SECRET));
}
function verify(token) {
  const [p, s] = token.split('.');
  if (!p || !s) return null;
  if (b64url(sign(p, PAYMENT_SECRET)) !== s) return null;
  try {
    const payload = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || HOST}`);
  const route = url.pathname;

  if (route === '/health') {
    return send(res, 200, {}, { ok: true, service: 'x402-base64', price, formats: FORMATS, pid: process.pid });
  }

  if (route === '/formats') {
    return send(res, 200, {}, { ok: true, formats: FORMATS });
  }

  if (route === '/pay' && req.method === 'POST') {
    const body = parseBody(await readBody(req));
    const nonce = body.nonce || crypto.randomBytes(16).toString('hex');
    const receipt_token = receiptFor(nonce);
    return send(res, 200, {}, { receipt_token, nonce, price });
  }

  if (route === '/encode' || route === '/decode') {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const payload = token ? verify(token) : null;
    if (!payload) {
      return send(res, 402, {
        'WWW-Authenticate': 'Bearer realm="x402-base64"',
        'X-Payment-Required': JSON.stringify(price)
      }, { error: 'Payment required', price, pay_endpoint: 'POST /pay' });
    }
    let text, fmt;
    if (req.method === 'POST') {
      const body = parseBody(await readBody(req));
      text = body.text; fmt = body.format;
    } else {
      text = url.searchParams.get('text');
      fmt = url.searchParams.get('format');
    }
    if (text === undefined || text === null) {
      return send(res, 400, {}, { error: 'Missing required param: text', example: 'GET /encode?format=base64&text=hello' });
    }
    if (!isValidFormat(fmt)) {
      return send(res, 400, {}, { error: 'Invalid format: ' + fmt, formats: FORMATS });
    }
    try {
      const result = route === '/encode' ? encodeText(text, fmt) : decodeText(text, fmt);
      return send(res, 200, {}, { ok: true, operation: route.slice(1), format: fmt, text, result });
    } catch (e) {
      return send(res, 400, {}, { error: e.message });
    }
  }

  send(res, 404, {}, { error: 'Not found', routes: ['GET /health', 'GET /formats (free)', 'POST /pay', 'GET|POST /encode', 'GET|POST /decode'] });
});

server.listen(PORT, HOST, () => {
  console.log(`x402-base64 listening on http://${HOST}:${PORT}`);
});
