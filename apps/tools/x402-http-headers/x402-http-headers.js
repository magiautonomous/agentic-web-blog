#!/usr/bin/env node
/*
 * x402-http-headers — x402 payment-protocol HTTP header analyzer API
 * ---------------------------------------------------------
 * Pay-to-call HTTP utility: fetch a URL server-side and return its response
 * headers with a per-header security/behavior analysis (dangerous, CORS,
 * security, cache, entity, hop-by-hop, cookie) and HTTP version/status. A
 * public, free GET /guides lists the header taxonomy so clients can browse
 * without paying.
 *
 * Endpoints:
 *   GET  /health          -> 200 {ok, service, price}
 *   GET  /guides          -> 200 { ok, guides:[...] }      (FREE)
 *   POST /pay {nonce?, single?} -> 200 { receipt_token, nonce, price }
 *   GET  /analyze?url=    -> 200 { ok, url, status, httpVersion, headers:[...],
 *                                  summary }
 *       once per valid bearer (single-use, replay-safe).
 *   if unpaid -> 402 + Payment-Required metadata
 *
 * Usage: node x402-http-headers.js [port]   (default 8810)
 */
'use strict';

const http = require('http');
const https = require('https');
const crypto = require('crypto');

const PORT = Number(process.argv[2] || process.env.PORT || 8810);
const HOST = '127.0.0.1';
const PAYMENT_SECRET = process.env.PAYMENT_SECRET || 'dev-only-httpheaders-secret-change-me';

const price = { amount: '0.00002', currency: 'BTC', network: 'lightning', label: 'casper#httpheaders' };
const spentReceipts = new Set();

/* ---- header taxonomy ---- */

const HEADER_GUIDES = {
  security: ['Strict-Transport-Security', 'hsts', 'Content-Security-Policy', 'csp', 'X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'X-XSS-Protection', 'X-Permitted-Cross-Domain-Policies', 'Cross-Origin-Embedder-Policy', 'Cross-Origin-Opener-Policy', 'Cross-Origin-Resource-Policy'],
  cors: ['Access-Control-Allow-Origin', 'Access-Control-Allow-Credentials', 'Access-Control-Allow-Headers', 'Access-Control-Allow-Methods', 'Access-Control-Expose-Headers', 'Access-Control-Max-Age', 'Timing-Allow-Origin'],
  cache: ['Cache-Control', 'Expires', 'ETag', 'Last-Modified', 'Age', 'Vary', 'Pragma', 'Warning'],
  entity: ['Content-Type', 'Content-Length', 'Content-Encoding', 'Content-Language', 'Content-Location', 'Content-Disposition', 'Content-Range', 'Content-MD5', 'Link'],
  cookie: ['Set-Cookie', 'Cookie'],
  hop: ['Connection', 'Keep-Alive', 'Proxy-Authenticate', 'Proxy-Authorization', 'TE', 'Trailer', 'Transfer-Encoding', 'Upgrade'],
  standard: ['Server', 'Date', 'Location', 'Retry-After', 'Allow', 'Accept-Ranges', 'WWW-Authenticate', 'Status', 'Via', 'X-Request-Id', 'X-Powered-By']
};

function classifyHeader(name) {
  const lower = name.toLowerCase();
  for (const [cat, keys] of Object.entries(HEADER_GUIDES)) {
    for (const k of keys) {
      if (lower === k.toLowerCase()) return cat;
    }
  }
  return 'other';
}

function headerNotes(name) {
  const lower = name.toLowerCase();
  const notes = [];
  const dangerous = ['set-cookie', 'server', 'x-powered-by', 'x-aspnet-version', 'x-aspnetmvc-version', 'x-runtime', 'x-version', 'x-request-id', 'x-amz-request-id'];
  if (dangerous.includes(lower)) notes.push('may expose server/version details');
  if (lower === 'content-security-policy') notes.push('XSS / injection protection — good to set');
  if (lower === 'strict-transport-security') notes.push('forces HTTPS — good to set');
  if (lower === 'x-frame-options') notes.push('clickjacking protection — good to set');
  if (lower === 'x-content-type-options') notes.push('prevents MIME sniffing — good to set');
  if (lower === 'referrer-policy') notes.push('limits referrer leakage — good to set');
  if (lower === 'cache-control') notes.push('controls caching behavior — ensure correct directives');
  if (lower === 'access-control-allow-origin') notes.push('CORS — use specific origins, avoid wildcard with credentials');
  if (lower === 'set-cookie') notes.push('ensure HttpOnly + Secure + SameSite flags');
  return notes;
}

function analyzeHeader(name, value) {
  const cat = classifyHeader(name);
  const notes = headerNotes(name);
  const entries = Object.keys(HEADER_GUIDES).find(c => HEADER_GUIDES[c].some(k => k.toLowerCase() === name.toLowerCase()));
  return {
    name,
    value,
    category: cat,
    securityRelevant: cat === 'security',
    notes
  };
}

function summary(headersArr) {
  const byCat = {};
  for (const h of headersArr) byCat[h.category] = (byCat[h.category] || 0) + 1;
  const security = headersArr.filter(h => h.category === 'security').length;
  const csp = headersArr.some(h => h.name.toLowerCase() === 'content-security-policy');
  const hsts = headersArr.some(h => ['strict-transport-security', 'hsts'].includes(h.name.toLowerCase()));
  const xfo = headersArr.some(h => h.name.toLowerCase() === 'x-frame-options');
  const ctno = headersArr.some(h => h.name.toLowerCase() === 'x-content-type-options');
  return {
    total: headersArr.length,
    byCategory: byCat,
    securityHeaders: security,
    goodSecurity: { 'Content-Security-Policy': csp, 'HSTS': hsts, 'X-Frame-Options': xfo, 'X-Content-Type-Options': ctno },
    securityScore: Math.round(([csp, hsts, xfo, ctno].filter(Boolean).length / 4) * 100)
  };
}

/* ---- fetch helper ---- */

function fetchUrl(urlString, timeoutMs) {
  return new Promise((resolve, reject) => {
    let lib;
    try {
      const u = new URL(urlString);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return reject(new Error('Unsupported protocol: ' + u.protocol));
      lib = u.protocol === 'https:' ? https : http;
    } catch (e) { return reject(new Error('Invalid URL: ' + e.message)); }
    const req = lib.get(urlString, { timeout: timeoutMs, headers: { 'User-Agent': 'Casper-x402-http-headers/1.0' } }, (res) => {
      const headers = [];
      for (const [name, value] of Object.entries(res.headers)) {
        if (Array.isArray(value)) {
          for (const v of value) headers.push(analyzeHeader(name, v));
        } else {
          headers.push(analyzeHeader(name, String(value)));
        }
      }
      let body = '';
      res.on('data', c => { if (body.length < 64 * 1024) body += c; });
      res.on('end', () => resolve({ statusCode: res.statusCode, httpVersion: res.httpVersion, headers, bodyPreview: body.slice(0, 200) }));
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', (e) => reject(e));
  });
}

/* ---- crypto helpers ---- */

function b64url(b) {
  return Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function sign(d, s) { return crypto.createHmac('sha256', s).update(d).digest(); }
function receiptFor(nonce) {
  const p = b64url(Buffer.from(JSON.stringify({ receipt: 'httpheaders-paid', nonce, ...price })));
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
    return send(res, 200, {}, { ok: true, service: 'x402-http-headers', price, pid: process.pid });
  }

  if (route === '/guides' && req.method === 'GET') {
    return send(res, 200, {}, { ok: true, guides: HEADER_GUIDES });
  }

  if (route === '/pay' && req.method === 'POST') {
    const body = parseBody(await readBody(req));
    const nonce = body.nonce || crypto.randomBytes(16).toString('hex');
    const receipt_token = receiptFor(nonce);
    return send(res, 200, {}, { receipt_token, nonce, price });
  }

  if (route === '/analyze') {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const payload = token ? verify(token) : null;
    if (!payload) {
      return send(res, 402, {
        'WWW-Authenticate': 'Bearer realm="x402-http-headers"',
        'X-Payment-Required': JSON.stringify(price)
      }, { error: 'Payment required', price, pay_endpoint: 'POST /pay' });
    }
    const target = url.searchParams.get('url');
    if (!target) {
      return send(res, 400, {}, { error: 'Missing required param: url', example: 'GET /analyze?url=https://example.com' });
    }
    try {
      const result = await fetchUrl(target, 10000);
      return send(res, 200, {}, {
        ok: true,
        target,
        status: result.statusCode,
        httpVersion: result.httpVersion,
        securityScore: summary(result.headers).securityScore,
        headerCount: result.headers.length,
        summary: summary(result.headers),
        headers: result.headers
      });
    } catch (e) {
      return send(res, 502, {}, { error: 'Failed to fetch URL: ' + e.message });
    }
  }

  send(res, 404, {}, { error: 'Not found', routes: ['GET /health', 'GET /guides (free)', 'POST /pay', 'GET /analyze?url='] });
});

server.listen(PORT, HOST, () => {
  console.log(`x402-http-headers listening on http://${HOST}:${PORT}`);
});
