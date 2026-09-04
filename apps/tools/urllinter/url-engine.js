/*
 * url-engine.js — URL Linter engine (Casper, CASPER-X402 mission)
 * Pure, dependency-free. Loaded in-browser via <script> and testable in node:
 *   node -e "console.log(JSON.stringify(require('./url-engine.js').lint('https://example.com'),null,2))"
 *
 * Lints a single URL string component-by-component (scheme, host, port, path,
 * query, fragment) against a rules ladder and returns:
 *   - url        the normalized input
 *   - score      0-100 health score
 *   - grade      A/B/C/D/F
 *   - issues[]   list of {severity:'error'|'warn'|'info', id, message, fix}
 *   - parses     whether URL() succeeded at all
 *   - parts      decoded components for display/fixing
 */
'use strict';

// Registry of valid public suffix-ish TLDs (top handful; not exhaustive — a lint hint only)
const COMMON_TLDS = new Set([
  'com','org','net','edu','gov','io','co','ai','app','dev','me','info','biz','xyz',
  'tv','so','fm','ly','today','tech','cloud','site','news','blog','shop','store','online',
  'pro','name','museum','int','mil','us','uk','de','fr','jp','cn','in','br','ca','au',
  'nl','ch','se','no','dk','fi','ru','es','it','pl','be','at','eu','za','mx','ar','nz'
]);

const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

function lint(raw) {
  const url = (raw || '').trim();
  const report = { url, parses: false, score: 0, grade: 'F', issues: [], parts: {} };
  if (!url) {
    report.issues.push({ severity: 'error', id: 'empty', message: 'No URL provided.' });
    return finish(report);
  }

  let parsed;
  try { parsed = new URL(url); }
  catch { /* handled below */ }

  // --- structural errors ---
  if (!url.includes('://')) {
    report.issues.push({ severity: 'error', id: 'no_scheme', message: 'Missing scheme (https://…). Add one before the host.', fix: `https://${url}` });
  } else if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    report.issues.push({ severity: 'error', id: 'bad_scheme', message: 'Scheme must start with a letter and be followed by ://.' });
  }

  if (!parsed) {
    report.issues.push({ severity: 'error', id: 'unparseable', message: 'Not a valid URL — could not be parsed.' });
    report.parses = false;
    return finish(report);
  }
  report.parses = true;

  const { protocol, hostname, host, port, pathname, search, hash } = parsed;
  report.parts = { protocol, hostname, host, port, pathname, search, hash };
  report.parts.ipv4 = IPV4_RE.test(hostname);
  report.parts.labelCount = report.parts.ipv4 ? 0 : hostname.split('.').length;
  report.parts.sld = report.parts.ipv4 ? null : (hostname.split('.').slice(-2).join('.') || null);
  report.parts.tld = report.parts.ipv4 ? null : (hostname.split('.').pop() || '').toLowerCase();

  // --- scheme / protocol checks ---
  if (!/^https?:$/.test(protocol)) {
    report.issues.push({ severity: 'error', id: 'non_http', message: `${protocol}// is not HTTP(S). Use https:// for web content.` });
  } else if (protocol !== 'https:') {
    report.issues.push({ severity: 'warn', id: 'not_https', message: 'Using http:// (insecure). Prefer https://.', fix: url.replace(/^http:/, 'https:') });
  }

  // --- host checks ---
  if (report.parts.ipv4) {
    const octets = hostname.split('.').map(Number);
    const bad = octets.some(o => o < 0 || o > 255);
    if (bad) {
      report.issues.push({ severity: 'error', id: 'bad_ip', message: 'IPv4 octets out of range (0-255).' });
    } else {
      report.issues.push({ severity: 'info', id: 'ip_host', message: 'Host is a raw IP — no domain/TLD. Consider a real hostname.' });
    }
  } else {
    if (!hostname.includes('.')) {
      report.issues.push({ severity: 'error', id: 'no_dot', message: 'Host has no dot — likely a local name (e.g. localhost).', fix: hostname === 'localhost' ? 'Use a domain for public URLs.' : undefined });
    }
    if (!COMMON_TLDS.has(report.parts.tld)) {
      report.issues.push({ severity: 'warn', id: 'uncommon_tld', message: `TLD ".${report.parts.tld || ''}" is not in the common set — double-check spelling.` });
    }
    if (report.parts.tld === 'http' || report.parts.tld === 'https') {
      report.issues.push({ severity: 'error', id: 'tld_scheme_typo', message: 'Looks like a pasted-style typo (.http/.https).' });
    }
    const labels = hostname.split('.');
    if (labels.some(l => !l || l.length > 63)) {
      report.issues.push({ severity: 'warn', id: 'host_label', message: 'A host label is empty or longer than 63 chars.' });
    }
    // URL() lowercases hostname automatically, so check the raw input's host for case
    const rawHost = (rawMatchedHost(url) || hostname);
    if (/[A-Z]/.test(rawHost)) {
      report.issues.push({ severity: 'info', id: 'host_case', message: 'Uppercase letters in the host are unusual; lowercase is conventional.', fix: rawHost.toLowerCase() });
    }
  }

  // --- port checks ---
  if (port) {
    const p = Number(port);
    if (!Number.isInteger(p) || p < 1 || p > 65535) {
      report.issues.push({ severity: 'error', id: 'bad_port', message: `Port "${port}" is not a valid 1-65535 integer.` });
    } else {
      report.issues.push({ severity: 'info', id: 'nondefault_port', message: `Non-default port ${port}.` });
    }
  }

  // --- path checks ---
  const cleanPath = decodeURIComponentSafe(pathname);
  if (/%20|%[0-9a-fA-F]{2}/.test(pathname) && /\s/.test(cleanPath)) {
    report.issues.push({ severity: 'warn', id: 'space_in_path', message: 'Raw/encoded spaces in the path; replace them with %20 or underscores.', fix: pathname.replace(/\s+/g, '%20') });
  }
  if (/[<>"`{}|\\^]/.test(pathname)) {
    report.issues.push({ severity: 'error', id: 'bad_path_chars', message: 'Path contains characters that are not safe in a URL.' });
  }
  if (cleanPath && cleanPath.length > 200) {
    report.issues.push({ severity: 'info', id: 'long_path', message: 'Path is very long (>200 chars).' });
  }
  if (cleanPath === '' && hash === '' && search === '') {
    report.issues.push({ severity: 'info', id: 'bare_root', message: 'URL points at the bare root (no path, query, or hash).' });
  }

  // --- query checks ---
  if (search) {
    const qs = search.replace(/^\?/, '');
    if (qs.includes(' ')) {
      report.issues.push({ severity: 'warn', id: 'space_in_query', message: 'Encoded space in query; use + or %20.' });
    }
    const paramCount = qs.split('&').length;
    if (paramCount > 8) {
      report.issues.push({ severity: 'info', id: 'many_params', message: `${paramCount} query params — consider simplifying or server-side pagination.` });
    }
    if (/(?:[?&]utm_|fbclid=|gclid=)/i.test(url)) {
      report.issues.push({ severity: 'info', id: 'tracking_params', message: 'Tracking params (utm_*/fbclid/gclid) present — fine to share, just noisy.' });
    }
  }

  // --- fragment ---
  if (hash && hash.length > 1 && search === '' && cleanPath === '/') {
    report.issues.push({ severity: 'info', id: 'hash_root', message: 'A bare fragment with no content path.' });
  }

  return finish(report);
}

// score: start at 100, penalize errors/warns/info, then map to grade
function finish(report) {
  const err = report.issues.filter(i => i.severity === 'error').length;
  const warn = report.issues.filter(i => i.severity === 'warn').length;
  const info = report.issues.filter(i => i.severity === 'info').length;
  let score = 100 - err * 28 - warn * 10 - info * 3;
  score = Math.max(0, Math.min(100, Math.round(score)));
  report.score = score;
  report.grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
  report.summary = `${report.url || '(empty)'} — ${report.grade} (${score}/100), ${err} error${err===1?'':'s'}, ${warn} warn${warn===1?'':'s'}, ${info} note${info===1?'':'s'}`;
  return report;
}

function decodeURIComponentSafe(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

// pull the raw host (any case) out of the original string before URL() lowercases it
function rawMatchedHost(url) {
  const m = url.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i);
  return m ? m[1].replace(/:.*$/, '') : null;
}

// convenience: fastest fix suggestion (first error with a fix, else first warn fix)
function suggestBestFix(report) {
  for (const i of report.issues) if (i.severity === 'error' && i.fix) return i.fix;
  for (const i of report.issues) if (i.severity === 'warn' && i.fix) return i.fix;
  return null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { lint, suggestBestFix, COMMON_TLDS };
}
