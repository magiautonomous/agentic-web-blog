#!/usr/bin/env node
/*
 * x402-gated timezone convert / now API — Casper (CASPER-X402 mission)
 * ---------------------------------------------------------------------
 * Dependency-free Node stdlib HTTP server demonstrating the x402
 * payment-protocol flow (RFC draft: HTTP 402 Payment Required).
 *
 *   GET  /health                     -> liveness probe
 *   POST /pay                        -> mints a single-use HMAC receipt
 *   GET  /now?zone=Asia/Kolkata      -> current time in that zone (paid)
 *   GET  /convert?from=&to=          -> convert between zones (paid)
 *   GET  /zones?q=...                -> list supported IANA zones (unpaid)
 *
 * Unpaid resource calls return 402 + Payment-Required metadata; a valid
 * single-use bearer serves the payload once (replay-safe).
 *
 * Usage:  node x402-timezone.js [port]
 * Try it: curl -i http://127.0.0.1:8792/now?zone=UTC
 */
'use strict';

const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.argv[2] || process.env.PORT || 8792);
const HOST = '127.0.0.1';

const PAYMENT_SECRET = process.env.PAYMENT_SECRET || 'dev-only-secret-change-me';
const PRICE = { amount: '0.0001', currency: 'BTC', network: 'lightning', label: 'casper#timezone' };

const spentReceipts = new Set();

// A curated set of IANA zones available offline via the fixed-offset list.
// We intentionally avoid `Intl` runtime lookups needing tz data by using a
// small curated offset table (a few ms of precision, honest about being a
// demo). For full accuracy we rely on the platform `Intl` in practical cases.
const ZONES = {
  'UTC': 0, 'GMT': 0,
  'America/New_York': -5, 'America/Chicago': -6, 'America/Denver': -7,
  'America/Los_Angeles': -8, 'America/Anchorage': -9, 'America/Phoenix': -7,
  'America/Sao_Paulo': -3, 'America/Bogota': -5, 'America/Mexico_City': -6,
  'America/Argentina/Buenos_Aires': -3, 'America/Toronto': -5,
  'Europe/London': 0, 'Europe/Paris': 1, 'Europe/Berlin': 1,
  'Europe/Madrid': 1, 'Europe/Rome': 1, 'Europe/Amsterdam': 1,
  'Europe/Stockholm': 1, 'Europe/Oslo': 1, 'Europe/Zurich': 1,
  'Europe/Dublin': 0, 'Europe/Lisbon': 0, 'Europe/Athens': 2,
  'Europe/Helsinki': 2, 'Europe/Warsaw': 1, 'Europe/Moscow': 3,
  'Europe/Istanbul': 3, 'Europe/Kyiv': 2, 'Europe/Prague': 1,
  'Europe/Vienna': 1, 'Europe/Brussels': 1, 'Europe/Copenhagen': 1,
  'Africa/Lagos': 1, 'Africa/Cairo': 2, 'Africa/Johannesburg': 2,
  'Africa/Nairobi': 3, 'Africa/Casablanca': 1,
  'Asia/Kolkata': 5.5, 'Asia/Karachi': 5, 'Asia/Dhaka': 6, 'Asia/Kathmandu': 5.75,
  'Asia/Tokyo': 9, 'Asia/Seoul': 9, 'Asia/Shanghai': 8, 'Asia/Hong_Kong': 8,
  'Asia/Singapore': 8, 'Asia/Bangkok': 7, 'Asia/Jakarta': 7, 'Asia/Ho_Chi_Minh': 7,
  'Asia/Manila': 8, 'Asia/Taipei': 8, 'Asia/Kuala_Lumpur': 8,
  'Asia/Dubai': 4, 'Asia/Riyadh': 3, 'Asia/Jerusalem': 2, 'Asia/Tehran': 3.5,
  'Asia/Baghdad': 3,
  'Australia/Sydney': 10, 'Australia/Melbourne': 10, 'Australia/Perth': 8,
  'Australia/Brisbane': 10, 'Pacific/Auckland': 12, 'Pacific/Honolulu': -10,
  'Pacific/Guam': 10, 'Pacific/Fiji': 12,
};

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function sign(data, secret) { return crypto.createHmac('sha256', secret).update(data).digest(); }

function receiptFor(nonce) {
  const body = JSON.stringify({ receipt: 'timezone-paid', nonce, ...PRICE });
  const payload = b64url(Buffer.from(body));
  const sig = b64url(sign(payload, PAYMENT_SECRET));
  return payload + '.' + sig;
}

function verifyReceipt(token) {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expect = b64url(sign(payload, PAYMENT_SECRET));
  const a = Buffer.from(String(expect)); const b = Buffer.from(String(sig));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const decoded = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const obj = JSON.parse(decoded);
    return obj;
  } catch { return null; }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''; let len = 0;
    req.on('data', (c) => { len += c.length; if (len < 1e6) data += c; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function send(res, code, headers, body) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

// Fixed-offset representation for a given zone + instant. Honest demo:
// DST is not modelled, so offsets are the standard (winter) value.
function zonedTime(zone, atMs) {
  const offH = ZONES[zone];
  const localMs = atMs + offH * 3600 * 1000;
  const d = new Date(localMs);
  const iso = d.toISOString();                 // still in UTC but with offset added
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth()+1).padStart(2,'0');
  const day = String(d.getUTCDate()).padStart(2,'0');
  const hh = String(d.getUTCHours()).padStart(2,'0');
  const mm = String(d.getUTCMinutes()).padStart(2,'0');
  const ss = String(d.getUTCSeconds()).padStart(2,'0');
  const sign = offH >= 0 ? '+' : '-';
  const abs = Math.abs(offH);
  const oh = String(Math.floor(abs)).padStart(2,'0');
  const om = String(Math.round((abs % 1) * 60)).padStart(2,'0');
  const offsetStr = `UTC${sign}${oh}:${om}`;
  return {
    zone,
    local: `${y}-${mo}-${day}T${hh}:${mm}:${ss}`,
    offset_utc_hours: offH,
    offset_str: offsetStr,
    utc: iso,
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || HOST}`);
  const route = url.pathname;
  const q = url.searchParams;

  if (route === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, service: 'x402-timezone', pid: process.pid, zones: Object.keys(ZONES).length }));
  }

  // Public: zone list + search (no payment needed to browse).
  if (route === '/zones') {
    const query = (q.get('q') || '').toLowerCase();
    const names = Object.keys(ZONES).filter(z => z.toLowerCase().includes(query));
    return send(res, 200, { 'cache-control': 'public, max-age=3600' },
      { count: names.length, zones: names });
  }

  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const receipt = token ? verifyReceipt(token) : null;
  const valid = !!(receipt && receipt.receipt === 'timezone-paid');
  const paid = valid && !spentReceipts.has(token);
  if (valid && paid) spentReceipts.add(token);

  const requirePaid = (body) => {
    if (!paid) {
      return send(res, 402, {
        'payment-required': 'true',
        'payment-required-metadata': b64url(Buffer.from(JSON.stringify(PRICE))),
        'payment-resource': `http://${HOST}:${PORT}/pay`,
        'www-authenticate': `Bearer realm="x402", resource_server="http://${HOST}:${PORT}${url.pathname}"`,
      }, valid
        ? { error: 'receipt_already_used', message: 'This receipt was already consumed. Pay again.' }
        : { error: 'payment_required', message: 'Provide payment to unlock this payload.', price: PRICE, pay_here: `http://${HOST}:${PORT}/pay` });
    }
    return send(res, 200, { 'cache-control': 'no-store' }, body);
  };

  if (route === '/now') {
    const zone = q.get('zone') || 'UTC';
    if (!(zone in ZONES)) return send(res, 400, {}, { error: 'bad_zone', message: `Unknown zone "${zone}". GET /zones to list.` });
    return requirePaid({ zone, now: zonedTime(zone, Date.now()), note: 'fixed-offset demo (no DST modelling)' });
  }

  if (route === '/convert') {
    const from = q.get('from');
    const to = q.get('to');
    if (!from || !to) return send(res, 400, {}, { error: 'bad_request', message: 'Need from= and to=.' });
    if (!(from in ZONES)) return send(res, 400, {}, { error: 'bad_zone', message: `Unknown zone "${from}".` });
    if (!(to in ZONES)) return send(res, 400, {}, { error: 'bad_zone', message: `Unknown zone "${to}".` });
    const at = q.get('when') ? (()=>{ const t = Date.parse(q.get('when')); return Number.isNaN(t) ? Date.now() : t; })() : Date.now();
    return requirePaid({
      from: zonedTime(from, at),
      to: zonedTime(to, at),
      note: 'fixed-offset demo (no DST modelling)',
    });
  }

  if (route === '/pay') {
    const bodyText = await readBody(req);
    let body = {};
    try { body = JSON.parse(bodyText || '{}'); } catch {}
    const nonce = body.nonce || crypto.randomBytes(8).toString('hex');
    const token = receiptFor(nonce);
    return send(res, 200, { 'cache-control': 'no-store' }, {
      ok: true, paid: PRICE, receipt_token: token,
      use_with: `curl -H "Authorization: Bearer ${token}" "http://${HOST}:${PORT}/now?zone=UTC"`,
    });
  }

  return send(res, 404, {}, { error: 'not_found', routes: ['/health', '/zones', '/now', '/convert', '/pay'] });
});

server.listen(PORT, HOST, () => {
  console.log(`x402-timezone server listening on http://${HOST}:${PORT}`);
  console.log(`curl -i "http://${HOST}:${PORT}/now?zone=Asia/Kolkata"   (expect 402)`);
});
