/*
 * url-engine.js test (Casper, CASPER-X402)
 *   node test.js
 * Asserts the engine returns sensible graded output across a ladder of URL shapes.
 */
'use strict';
const { lint, suggestBestFix } = require('./url-engine.js');

const CASES = [
  ['https://example.com', 'clean https', (r) => r.issues.every(i => i.severity !== 'error')],
  ['http://example.com', 'insecure http', (r) => r.issues.some(i => i.id === 'not_https')],
  ['https://sub.example.co.uk/path/to?q=1&r=2#frag', 'nested real world', (r) => r.issues.every(i => i.severity !== 'error')],
  ['example.com', 'missing scheme', (r) => r.issues.some(i => i.id === 'no_scheme')],
  ['https://', 'no host', (r) => !r.parses],
  ['javascript:alert(1)', 'non-http scheme', (r) => r.issues.some(i => i.id === 'non_http')],
  ['https://localhost:8080/admin', 'localhost + port', (r) => r.issues.some(i => i.id === 'no_dot') && r.issues.some(i => i.id === 'nondefault_port')],
  ['ftp://files.example.net/a', 'ftp scheme', (r) => r.issues.some(i => i.id === 'non_http')],
  ['https://256.256.256.256', 'bad ip', (r) => !r.parses],
  ['https://example.httpxxx', 'unknown tld', (r) => r.issues.some(i => i.id === 'uncommon_tld')],
  ['https://example.com/a b/c', 'space in path', (r) => r.issues.some(i => i.id === 'space_in_path')],
  ['https://example.com?utm_source=x&q=1&r=2&s=3&t=4&u=5&v=6&w=7&x=8', 'tracking + many params', (r) => r.issues.some(i => i.id === 'tracking_params') && r.issues.some(i => i.id === 'many_params')],
  ['', 'empty', (r) => r.issues.some(i => i.id === 'empty')],
  ['https://example.com:99999', 'bad port', (r) => !r.parses],
  ['https://ExAmPlE.com/UPPER', 'host case', (r) => r.issues.some(i => i.id === 'host_case')],
  ['https://example.com', 'clean upgradeable', (r) => r.score >= 90],
];

let pass = 0, fail = 0;
for (const [input, desc, check] of CASES) {
  const r = lint(input);
  let ok = true;
  const problems = [];
  if (!Number.isFinite(r.score) || !/^[A-F]$/.test(r.grade) || !Array.isArray(r.issues)) ok = false;
  if (ok) for (const i of r.issues) if (!i.severity || !i.id || !i.message) { ok = false; break; }
  if (ok && !check(r)) {
    ok = false;
    problems.push('condition: ' + JSON.stringify(r.issues.map(i => i.severity + ':' + i.id)));
  }
  if (ok) pass++;
  else { fail++; console.log('FAIL', desc, problems.join(' ') || 'bad shape', 'score=' + r.score); }
}

if (typeof suggestBestFix(lint('http://example.com')) === 'string') pass++;
else { fail++; console.log('FAIL bestfix-string'); }
if (suggestBestFix(lint('https://example.com')) === null) pass++;
else { fail++; console.log('FAIL bestfix-null'); }

const clean = lint('https://example.com');
console.log('sample clean:', clean.summary);
console.log('sample error:', lint('example.com').issues[0] && lint('example.com').issues[0].message);

console.log(`pass=${pass} fail=${fail}`);
process.exit(fail ? 1 : 0);
