/*
 * meta-engine.js — MetaForge engine (Casper, CASPER-X402 mission)
 * Pure, dependency-free. Loaded in-browser via <script> and testable in node:
 *   node -e "console.log(JSON.stringify(require('./meta-engine.js').metaFor('Sell handmade ceramics online.'),null,2))"
 *
 * Turns a rough description of a page/topic into:
 *   - a <title> tag (<= ~60 chars, front-loaded keyword)
 *   - 1-3 SEO meta descriptions (<= ~155 chars, actionable, keyword-aware)
 *   - a canonical/slug suggestion
 *   - extracted topic keywords
 * Engine is deterministic-ish and pure; no network.
 */
'use strict';

const STOP = new Set("a an and the or but of to in on for with at by from as is are was were be been being this that these those it its it's i you he she we they my your his her our their me him us them not no yes do does did doing have has had having will would can could should may might some any just very much more most about over into than so then when where how who what why also other such only own same so which while".split(/\s+/));

function words(s) { return (s || '').toLowerCase().replace(/[^a-z0-9'\s-]/g, ' ').split(/\s+/).filter(Boolean); }

function freqMap(text) {
  const m = new Map();
  for (const w of words(text)) {
    if (STOP.has(w)) continue;
    if (w.length < 3) continue;
    m.set(w, (m.get(w) || 0) + 1);
  }
  return m;
}

function topKeywords(text, n = 5) {
  return [...freqMap(text).entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(e => e[0])
    .filter(w => !/^(https?|www|com|net|org)$/.test(w));
}

function titleize(phrase) {
  const small = new Set('a an the and but or for nor on at to by of in with from');
  return phrase.split(' ').map((w, i) =>
    (i === 0 || !small.has(w)) ? w.charAt(0).toUpperCase() + w.slice(1) : w
  ).join(' ');
}

function sentences(text) {
  return (text || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).filter(s => s.length);
}

function stripSentence(s) { return s.replace(/[.!?]$/, '').toLowerCase(); }

function metaFor(input) {
  const raw = (input || '').trim();
  if (!raw) {
    return { error: 'empty', title: '', descriptions: [], slug: '', keywords: [] };
  }
  const sent = sentences(raw);
  const kws = topKeywords(sent.join(' '), 6);
  const primary = kws[0] || topKeywords(raw.replace(/\s+/g, ' '), 1)[0] || 'topic';

  // --- title: primary keyword front-loaded, <= ~60 chars ---
  let title = titleize(primary);
  if (sent.length) {
    const fromFirst = sent[0].toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
    const shortFromFirst = fromFirst.split(' ').slice(0, 6).join(' ');
    title = titleize((shortFromFirst && shortFromFirst.length ? shortFromFirst : fromFirst));
  }
  while (title.length > 58) {
    const parts = title.split(' ');
    if (parts.length === 1) { title = title.slice(0, 57); break; }
    parts.pop();
    title = parts.join(' ');
  }
  if (!title) title = titleize(primary);

  // --- descriptions: 3 variants, each <= ~155 chars ---
  const cleanAll = raw.replace(/\s+/g, ' ').trim();
  const d1 = buildDesc(`Discover everything about ${cleanAll}`.replace(/\.$/, ''), 155);
  const d2part = sent[0] ? stripSentence(sent[0]) : cleanAll.slice(0, 90);
  const d2 = buildDesc(`${titleize(primary)}: ${d2part}`, 155);
  const kwTail = kws.length ? kws.slice(0, 4).join(', ') : primary;
  const d3 = buildDesc(`Learn ${cleanAll} — highlights on ${kwTail}`, 155);
  const descriptions = [d1, d2, d3];

  // --- slug ---
  let slug = cleanAll.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (slug.length > 60) {
    const parts = slug.split('-').slice(0, 8).join('-');
    slug = parts.length <= 60 ? parts : parts.slice(0, 57);
  }
  if (!slug) slug = primary;

  return { title, descriptions, slug, keywords: kws, primary };
}

function buildDesc(t, max) {
  let s = t.replace(/\s+/g, ' ').trim();
  if (s.length > max) {
    s = s.slice(0, max - 1).replace(/\s+\S*$/, '');
  }
  return s;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { metaFor, topKeywords, sentences };
}
