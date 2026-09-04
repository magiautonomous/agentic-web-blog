#!/usr/bin/env node
'use strict';
const URLForge = require('./url-engine.js');
let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL: ' + label); }
}

// parse basic
const u1 = URLForge.parse('https://example.com/path');
assert(u1.protocol === 'https', 'parse protocol');
assert(u1.host === 'example.com', 'parse host');
assert(u1.path === '/path', 'parse path');

// parse with port
const u2 = URLForge.parse('http://localhost:3000/api');
assert(u2.port === '3000', 'parse port');
assert(u2.host === 'localhost', 'parse localhost host');

// parse with query
const u3 = URLForge.parse('https://example.com/search?q=hello+world&page=2');
assert(u3.query === 'q=hello+world&page=2', 'parse query');
assert(u3.params.q === 'hello world', 'parse query param decode');

// parse with hash
const u4 = URLForge.parse('https://example.com/page#section');
assert(u4.fragment === 'section', 'parse fragment');
assert(u4.hash === '#section', 'parse hash');

// parse with auth
const u5 = URLForge.parse('https://user:pass@example.com/');
assert(u5.username === 'user', 'parse username');
assert(u5.password === 'pass', 'parse password');

// parse without protocol
const u6 = URLForge.parse('example.com/foo');
assert(u6.host === 'example.com', 'parse host without protocol');
assert(u6.protocol === '', 'no protocol default empty');

// parse no scheme no slash
const u7 = URLForge.parse('example.com');
assert(u7.host === 'example.com', 'parse bare host');

// parse IPv6
const u8 = URLForge.parse('https://[::1]:8080/path');
assert(u8.host === '[::1]', 'parse ipv6 host');
assert(u8.port === '8080', 'parse ipv6 port');

// query params arrays
const u9 = URLForge.parse('?a=1&a=2&b=3');
assert(Array.isArray(u9.params.a) && u9.params.a.length === 2, 'parse array param');

// toString roundtrip
const orig = 'https://user:pass@example.com:8080/path/to?q=1&r=2#frag';
const u10 = URLForge.parse(orig);
assert(u10.toString() === orig, 'toString roundtrip');

// addParam
const p1 = URLForge.addParam('https://example.com/?a=1', 'b', '2');
assert(p1 === 'https://example.com/?a=1&b=2', 'addParam');

// setParam
const p2 = URLForge.setParam('https://example.com/?a=1', 'a', '5');
assert(p2 === 'https://example.com/?a=5', 'setParam');

// removeParam
const p3 = URLForge.removeParam('https://example.com/?a=1&b=2', 'a');
assert(p3 === 'https://example.com/?b=2', 'removeParam');

// removeParam last
const p4 = URLForge.removeParam('https://example.com/?a=1', 'a');
assert(p4 === 'https://example.com/', 'removeParam last param');

// removeTracking
const t1 = URLForge.removeTracking('https://example.com/?utm_source=x&utm_campaign=y&page=1');
assert(t1.removed === true, 'removeTracking detected');
assert(t1.url === 'https://example.com/?page=1', 'removeTracking url cleaned');

// queryToString
assert(URLForge.queryToString({ a: '1', b: '2 3' }) === 'a=1&b=2%203', 'queryToString encode');

// parseQuery
const q = URLForge.parseQuery('a=1&b=hello%20world&c');
assert(q.a === '1', 'parseQuery simple');
assert(q.b === 'hello world', 'parseQuery decode');
assert(q.c === '', 'parseQuery empty value');

console.log(`\nURLForge tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
