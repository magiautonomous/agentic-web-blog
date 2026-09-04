#!/usr/bin/env node
/*
 * x402-open-graph — x402-gated "OG-tag extractor" API (Casper, CASPER-X402)
 * -------------------------------------------------------------------------
 * Eighth example of the x402 payment-protocol flow (HTTP 402 Payment Required).
 * Unpaid clients get 402 + Payment-Required metadata; after a valid payment it
 * fetches a remote URL and returns its Open Graph (og:title, og:description,
 * og:image) and Twitter card (twitter:title/description/image) meta tags, plus
 * the plain <title> and canonical href — a quick way to preview how a link will
 * show up when shared.
 *
 * Same HMAC receipt flow as the other x402 servers so clients swap cleanly.
 * Receipts are single-use (replay rejected). Fetching is server-side via Node
 * stdlib http/https (redirect + timeout + size-limit handled).
 *
 * Usage: node x402-open-graph.js [port]        (default 8793)
 *   curl -i 'http://127.0.0.1:8793/og?url=https://example.com'   (402)
 */
'use strict';

const http = require('http');
const https = require('https');
const crypto = require('crypto');

const PORT = Number(process.argv[2] || process.env.PORT || 8793);
const HOST = '127.0.0.1';
const PAYMENT_SECRET = process.env.PAYMENT_SECRET || 'dev-only-secret-change-me';

const price = { amount: '0.0002', currency: 'BTC', network: 'lightning', label: 'casper#open-graph' };
const spentReceipts = new Set();

function b64url(b) {
  return Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function sign(d, s) { return crypto.createHmac('sha256', s).update(d).digest(); }
function receiptFor(nonce) {
  const p = b64url(Buffer.from(JSON.stringify({ receipt: 'open-graph-paid', nonce, ...price })));
  return p + '.' + b64url(sign(p, PAYMENT_SECRET));
}
function verify(token) {
  const [p, s] = token.split('.');
  if (!p || !s) return null;
  if (b64url(sign(p, PAYMENT_SECRET)) !== s) return null;
  try { return JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); }
  catch { return null; }
}
function send(res, code, headers, body) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

function normalizeUrl(raw) {
  if (!raw) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw);
  let u;
  try { u = new URL(hasScheme ? raw : 'https://' + raw); }
  catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  return u.href;
}

function httpGet(url, maxBytes = 120000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'Casper-x402-open-graph/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(httpGet(normalizeUrl(res.headers.location), maxBytes));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode));
      }
      const type = (res.headers['content-type'] || '').toLowerCase();
      if (!/html|text/.test(type)) { res.resume(); return reject(new Error('non-html content: ' + type)); }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { if (data.length < maxBytes) data += c; });
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
    req.setTimeout(12000, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

// meta content grabber, case-insensitive
function meta(html, prop) {
  const re = new RegExp('<meta[^>]+(?:property|name)=["\']?' + prop.replace(/[:.]/g, '\\$&') + '["\']?[^>]*content=["\']([^"\']*)["\']', 'i');
  const m = html.match(re);
  if (m) return decodeEntities(m[1].trim());
  // attribute order may put content before property
  const re2 = new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']?' + prop.replace(/[:.]/g, '\\$&') + '["\']?', 'i');
  const m2 = html.match(re2);
  if (m2) return decodeEntities(m2[1].trim());
  return '';
}

function title(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1].replace(/\s+/g, ' ').trim()) : '';
}
function canonical(html, base) {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  if (m) return normalizeUrl(decodeEntities(m[1])) || '';
  const m2 = html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
  if (m2) return normalizeUrl(decodeEntities(m2[1])) || '';
  return base || '';
}
function description(html) {
  return meta(html, 'description');
}
function lang(html) {
  const m = html.match(/<html[^>]*\blang=["']([^"']+)["']/i);
  return m ? m[1] : '';
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&nbsp;/g, ' ')
    .trim();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || HOST}`);
  const route = url.pathname;

  if (route === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, service: 'x402-open-graph', pid: process.pid }));
  }

  if (route === '/og') {
    const target = normalizeUrl(url.searchParams.get('url'));
    if (!target) return send(res, 400, {}, { error: 'bad_url', message: 'Provide a valid ?url=' });

    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const receipt = token ? verify(token) : null;
    if (receipt && receipt.receipt === 'open-graph-paid' && !spentReceipts.has(token)) {
      spentReceipts.add(token);
      try {
        const htmlBody = await httpGet(target);
        const data = {
          url: target,
          title: title(htmlBody),
          canonical: canonical(htmlBody, target),
          description: description(htmlBody),
          lang: lang(htmlBody),
          og: {
            title: meta(htmlBody, 'og:title') || title(htmlBody),
            description: meta(htmlBody, 'og:description') || description(htmlBody),
            image: meta(htmlBody, 'og:image'),
            url: meta(htmlBody, 'og:url') || target,
            type: meta(htmlBody, 'og:type'),
            site_name: meta(htmlBody, 'og:site_name'),
          },
          twitter: {
            card: meta(htmlBody, 'twitter:card'),
            title: meta(htmlBody, 'twitter:title'),
            description: meta(htmlBody, 'twitter:description'),
            image: meta(htmlBody, 'twitter:image'),
          },
        };
        return send(res, 200, { 'cache-control': 'no-store' }, { item: 'open-graph', price, content: data });
      } catch (e) {
        return send(res, 502, { 'cache-control': 'no-store' },
          { error: 'fetch_failed', message: 'Could not fetch/parse that URL: ' + e.message, url: target });
      }
    }

    return send(res, 402, {
      'payment-required': 'true',
      'payment-required-metadata': b64url(Buffer.from(JSON.stringify(price))),
      'payment-resource': `http://${HOST}:${PORT}/pay`,
    }, { error: 'payment_required', message: 'Provide payment to extract Open Graph tags.', price, pay_here: `http://${HOST}:${PORT}/pay` });
  }

  if (route === '/pay') {
    const body = JSON.parse((await readBody(req)) || '{}');
    const token = receiptFor(body.nonce || crypto.randomBytes(8).toString('hex'));
    return send(res, 200, {}, { ok: true, paid: price, receipt_token: token,
      use_with: `curl -H "Authorization: Bearer ${token}" 'http://${HOST}:${PORT}/og?url=https://example.com'` });
  }

  return send(res, 404, {}, { error: 'not_found', routes: ['/og', '/pay', '/health'] });
});

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { if (data.length < 1e6) data += c; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

server.listen(PORT, HOST, () => {
  console.log(`x402-open-graph server listening on http://${HOST}:${PORT}`);
  console.log(`curl -i 'http://${HOST}:${PORT}/og?url=https://example.com'   (expect 402)`);
});
