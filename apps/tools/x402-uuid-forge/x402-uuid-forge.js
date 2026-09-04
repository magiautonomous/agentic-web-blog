#!/usr/bin/env node
/*
 * x402-uuid-forge — x402 payment-protocol batch UUID / token generator API
 * ---------------------------------------------------------------------------
 * Pay-to-call identifier minting API. Unpaid -> 402 + Payment-Required
 * metadata; after a valid single-use payment it returns a batch of RFC 4122
 * v4 UUIDs and/or cryptographically random short tokens.
 *
 * Endpoints:
 *   GET  /health              -> 200 {ok, service, price}
 *   POST /pay {nonce?, count} -> 200 { receipt_token, nonce, price }
 *       .count is optional: the count is fixed at payment time (<=32) so
 *       the client pays for exactly what it consumes.
 *   GET  /mint ?count=&kind=  -> 200 { ok, list:[...] }
 *       .kind  = uuid|token|both   (default uuid)
 *       .count = 1..32             (default 1; cannot exceed paid count)
 *   if unpaid -> 402 + Payment-Required metadata
 *
 * Usage: node x402-uuid-forge.js [port]   (default 8796)
 */
'use strict';

const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.argv[2] || process.env.PORT || 8796);
const HOST = '127.0.0.1';
const PAYMENT_SECRET = process.env.PAYMENT_SECRET || 'dev-only-uuid-secret-change-me';

const price = { amount: '0.00003', currency: 'BTC', network: 'lightning', label: 'casper#uuid-forge' };
const spentReceipts = new Set();

function b64url(b) {
  return Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function sign(d, s) { return crypto.createHmac('sha256', s).update(d).digest(); }
function receiptFor(nonce, count) {
  const p = b64url(Buffer.from(JSON.stringify({ receipt: 'uuid-forge-paid', nonce, count, ...price })));
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

/* ---- identifier minting ---- */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function uuid4() {
  const b = crypto.randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function token(len) {
  const bytes = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += B64[bytes[i] % 64];
  return s;
}

function mint(kind, count) {
  const list = [];
  for (let i = 0; i < count; i++) {
    if (kind === 'uuid') list.push(uuid4());
    else if (kind === 'token') list.push(token(22));
    else list.push({ uuid: uuid4(), token: token(22) });
  }
  return list;
}

/* ---- server ---- */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || HOST}`);
  const route = url.pathname;

  if (route === '/health') {
    return send(res, 200, {}, { ok: true, service: 'x402-uuid-forge', price, pid: process.pid });
  }

  if (route === '/pay' && req.method === 'POST') {
    const body = parseBody(await readBody(req));
    const nonce = body.nonce || crypto.randomBytes(16).toString('hex');
    const count = Math.max(1, Math.min(32, Number(body.count) || 1));
    const receipt_token = receiptFor(nonce, count);
    return send(res, 200, {}, { receipt_token, nonce, count, price });
  }

  if (route === '/mint') {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const payload = token ? verify(token) : null;
    if (!payload) {
      return send(res, 402, {
        'WWW-Authenticate': 'Bearer realm="x402-uuid-forge"',
        'X-Payment-Required': JSON.stringify(price)
      }, { error: 'Payment required', price, pay_endpoint: 'POST /pay' });
    }
    const kind = (url.searchParams.get('kind') || 'uuid').toLowerCase();
    const count = Math.max(1, Math.min(payload.count, Number(url.searchParams.get('count')) || payload.count));
    const list = mint(kind, count);
    return send(res, 200, {}, { ok: true, kind, count: list.length, list });
  }

  send(res, 404, {}, { error: 'Not found', routes: ['GET /health', 'POST /pay', 'GET /mint'] });
});

server.listen(PORT, HOST, () => {
  console.log(`x402-uuid-forge listening on http://${HOST}:${PORT}`);
});
