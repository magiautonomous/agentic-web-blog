#!/usr/bin/env node
/*
 * base64forge test — verify base64/hex/url encoding functions
 */
'use strict';
const assert = require('assert');
const { TextEncoder, TextDecoder } = require('util');

const enc = new TextEncoder();
const dec = new TextDecoder();

function textToBytes(s) { return enc.encode(s); }
function bytesToText(b) { return dec.decode(b); }
function bytesToHex(b) { return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join(' '); }

const STANDARD_B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const URL_B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function b64Encode(bytes, table) {
  let b64 = Buffer.from(bytes).toString('base64');
  if (table === URL_B64) b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return b64;
}
function b64Decode(str, table) {
  let s = str.trim();
  if (table === URL_B64) s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return new Uint8Array(Buffer.from(s, 'base64'));
}
function hexEncode(bytes) { return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(''); }
function hexDecode(str) {
  const s = str.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(s.length / 2);
  for (let i = 0; i < s.length; i += 2) bytes[i / 2] = parseInt(s.slice(i, i + 2), 16);
  return bytes;
}
function urlEncode(bytes) {
  let r = '';
  for (const b of bytes) {
    if ((b >= 0x30 && b <= 0x39) || (b >= 0x41 && b <= 0x5A) || (b >= 0x61 && b <= 0x7A) ||
        b === 0x2D || b === 0x2E || b === 0x5F || b === 0x7E) r += String.fromCharCode(b);
    else r += '%' + b.toString(16).toUpperCase().padStart(2, '0');
  }
  return r;
}
function urlDecode(str) {
  return textToBytes(decodeURIComponent(str));
}

let pass = 0, fail = 0;
function ok(label, cond) {
  if (cond) pass++;
  else { fail++; console.error('FAIL:', label); }
}

// Base64 standard
const b1 = b64Encode(textToBytes('Hello, World!'), STANDARD_B64);
ok('b64 Hello, World! = SGVsbG8sIFdvcmxkIQ==', b1 === 'SGVsbG8sIFdvcmxkIQ==');
const d1 = b64Decode(b1, STANDARD_B64);
ok('b64 roundtrip', bytesToText(d1) === 'Hello, World!');

// Base64 URL-safe
const b2 = b64Encode(textToBytes('test?value=1&foo=bar'), URL_B64);
ok('b64url no + or /', !b2.includes('+') && !b2.includes('/'));
const d2 = b64Decode(b2, URL_B64);
ok('b64url roundtrip', bytesToText(d2) === 'test?value=1&foo=bar');

// Hex
const h1 = hexEncode(textToBytes('AB'));
ok('hex AB = 4142', h1 === '4142');
const hd1 = hexDecode('4142');
ok('hex decode AB', bytesToText(hd1) === 'AB');
const h2 = hexEncode(textToBytes('Hello'));
ok('hex Hello', h2 === '48656c6c6f');

// URL encode
const u1 = urlEncode(textToBytes('hello world'));
ok('url encode space', u1 === 'hello%20world');
const ud1 = urlDecode('hello%20world');
ok('url decode space', bytesToText(ud1) === 'hello world');
const u2 = urlEncode(textToBytes('a+b=c'));
ok('url encode special', u2 === 'a%2Bb%3Dc');

// Empty
const be = b64Encode(new Uint8Array(0), STANDARD_B64);
ok('empty b64', be === '');

// Binary data
const binary = new Uint8Array([0, 1, 2, 255, 128]);
const hb = hexEncode(binary);
ok('hex binary', hb === '000102ff80');
const hdb = hexDecode(hb);
ok('hex binary roundtrip', hdb.length === 5 && hdb[0] === 0 && hdb[4] === 128);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
