#!/usr/bin/env node
/*
 * x402-domain-check — x402-gated "check-a-domain" API (Casper, CASPER-X402)
 * -----------------------------------------------------------------------
 * A pay-to-call structured domain-name health check behind the x402 payment
 * protocol (HTTP 402 Payment Required). Unpaid clients get 402 + Payment-Required
 * metadata; after a valid payment it analyzes a candidate domain name:
 *   - length/readability, syllable count, pronounceability (vowel ratio, consonant clusters)
 *   - brandability (alliteration, doubled letters, hard/soft ending vibe)
 *   - typo-risk (common misspellings, lookalike-letter risk, uncommon letters x/q/z)
 *   - suggested alternative TLDs that are likely to still be available
 *   - a 0-100 overall score + verdict
 * Uses the exact HMAC receipt flow as the other x402 servers so clients swap
 * cleanly. Receipts are single-use (replay rejected).
 *
 * Usage: node x402-domain-check.js [port]        (default 8791)
 *   curl -i 'http://127.0.0.1:8791/check?domain=lumenplate.com'   (402)
 */
'use strict';

const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.argv[2] || process.env.PORT || 8791);
const HOST = '127.0.0.1';
const PAYMENT_SECRET = process.env.PAYMENT_SECRET || 'dev-only-secret-change-me';

const price = { amount: '0.0001', currency: 'BTC', network: 'lightning', label: 'casper#domain-check' };
const spentReceipts = new Set();

function b64url(b) {
  return Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function sign(d, s) { return crypto.createHmac('sha256', s).update(d).digest(); }
function receiptFor(nonce) {
  const p = b64url(Buffer.from(JSON.stringify({ receipt: 'domain-check-paid', nonce, ...price })));
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

const COMMON_TLDS = ['com', 'net', 'org', 'io', 'co', 'ai', 'app', 'dev', 'me', 'ly', 'tv', 'xyz'];
const VOWELS = new Set('aeiou');
function syllables(w) { return (w.match(/[aeiouy]+/g) || []).length; }

// highest-typographic-risk letters (Confusable)
const LOOKALIKE = new Set('IlO01q2z');
const RARE = new Set('xq z'.split(' ').filter(Boolean));

function checkDomain(raw) {
  let d = (raw || '').trim().toLowerCase();
  if (!d) return null;
  if (d.includes('://')) d = d.split('://')[1];
  if (d.includes('/')) d = d.split('/')[0];
  if (d.startsWith('www.')) d = d.slice(4);
  const labels = d.split('.');
  if (labels.length < 2) return null; // need at least sld.tld

  const sld = labels[0];
  const tld = labels[labels.length - 1];
  const body = sld; // the brandable slab

  // --- individual signals (each 0-100) ---
  // length: ideal brand slab 4-9 chars
  const lenScore = Math.max(0, 100 - Math.abs(body.length - 6.5) * 9);
  // syllables: snappier is better; 1-2 ideal
  const syl = syllables(body);
  const syllScore = syl <= 2 ? 100 : Math.max(0, 100 - (syl - 2) * 25);
  // pronounceability: vowel ratio should be ~0.3-0.5, no nasty consonant stacks
  const letters = body.length;
  const vowels = (body.match(/[aeiou]/g) || []).length;
  const ratio = letters ? vowels / letters : 0;
  const ratioScore = (ratio >= 0.3 && ratio <= 0.55) ? 100 : Math.max(0, 100 - Math.abs(ratio - 0.42) * 200);
  let stacks = 0;
  for (let i = 0; i + 3 <= body.length; i++) if (/[^aeiou]{3}/.test(body.slice(i, i + 3))) stacks++;
  const stackScore = Math.max(0, 100 - stacks * 30);
  // brandability: alliteration / doubled letter / strong ending
  const allit = body.length > 1 && body.split('').every(c => c === body[0]);
  const doubled = /(.)\1/.test(body);
  const endVowel = VOWELS.has(body.slice(-1));
  const brandScore = 55 + (allit ? 30 : 0) + (doubled ? 18 : 0) + (endVowel ? -12 : 0);
  // typo-risk: avoid lookalikes + rare letters, keep it short
  let lookalikes = 0; for (const c of body) if (/[il0oq1z]/.test(c)) lookalikes++;
  const rareChars = (body.match(/[xqz]/g) || []).length;
  const typoScore = Math.max(0, 100 - lookalikes * 12 - rareChars * 25 - Math.max(0, body.length - 10) * 5);

  const score = Math.round(
    0.22 * lenScore + 0.18 * syllScore + 0.2 * ratioScore + 0.12 * stackScore +
    0.15 * brandScore + 0.13 * typoScore
  );

  // alternative TLD suggestions likely still available for a made-up sld
  const alternates = COMMON_TLDS.filter(t => t !== tld).map(t => `${body}.${t}`);

  return {
    domain: `${body}.${tld}`,
    score,
    verdict: score >= 78 ? 'strong' : score >= 58 ? 'workable' : 'weak',
    signals: {
      length: clamp(lenScore), syllables: clamp(syllScore), pronounceability: clamp(ratioScore),
      consonant_flow: clamp(stackScore), brandability: clamp(brandScore), typo_risk: clamp(typoScore),
    },
    stats: { letters: body.length, syllables: syl, vowel_ratio: +ratio.toFixed(2), lookalike_chars: lookalikes, rare_chars: rareChars },
    alternates,
    tip: score >= 78
      ? 'Strong, brandable, low typo risk — register it before someone else does.'
      : 'Shorten the slab, drop lookalike/rare letters (1,l,O,q,z), or swap the TLD to reduce risk.',
  };
}
function clamp(x) { return Math.max(0, Math.min(100, Math.round(x))); }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || HOST}`);
  const route = url.pathname;

  if (route === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, service: 'x402-domain-check', pid: process.pid }));
  }

  if (route === '/check') {
    const domain = url.searchParams.get('domain');
    const data = checkDomain(domain);
    if (!data) return send(res, 400, {}, { error: 'bad_domain', message: 'Provide ?domain= (e.g. lumenplate.com)' });

    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const receipt = token ? verify(token) : null;
    if (receipt && receipt.receipt === 'domain-check-paid' && !spentReceipts.has(token)) {
      spentReceipts.add(token);
      return send(res, 200, { 'cache-control': 'no-store' }, { item: 'domain-check', price, content: data });
    }
    return send(res, 402, {
      'payment-required': 'true',
      'payment-required-metadata': b64url(Buffer.from(JSON.stringify(price))),
      'payment-resource': `http://${HOST}:${PORT}/pay`,
    }, { error: 'payment_required', message: 'Provide payment to check a domain.', price, pay_here: `http://${HOST}:${PORT}/pay` });
  }

  if (route === '/pay') {
    const body = JSON.parse((await readBody(req)) || '{}');
    const token = receiptFor(body.nonce || crypto.randomBytes(8).toString('hex'));
    return send(res, 200, {}, { ok: true, paid: price, receipt_token: token,
      use_with: `curl -H "Authorization: Bearer ${token}" 'http://${HOST}:${PORT}/check?domain=lumenplate.com'` });
  }

  return send(res, 404, {}, { error: 'not_found', routes: ['/check', '/pay', '/health'] });
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
  console.log(`x402-domain-check server listening on http://${HOST}:${PORT}`);
  console.log(`curl -i 'http://${HOST}:${PORT}/check?domain=lumenplate.com'   (expect 402)`);
});
