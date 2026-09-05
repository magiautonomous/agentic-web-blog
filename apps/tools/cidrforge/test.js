'use strict';
const assert = require('assert');
const E = require('./cidr-engine.js');

let n = 0;
function t(name, fn) { fn(); n++; console.log('ok -', name); }

// --- parse ---
t('parse simple', () => {
  const p = E.parse('10.0.0.0/24');
  assert.strictEqual(p.ip, 0x0a000000);
  assert.strictEqual(p.prefix, 24);
});
t('parse host without prefix -> /32', () => {
  const p = E.parse('192.168.1.5');
  assert.strictEqual(p.prefix, 32);
});
t('parse bare prefix rejected', () => {
  assert.ok(E.parse('/24').error);
});
t('parse bad octet rejected', () => {
  assert.ok(E.parse('256.1.1.1/24').error);
});
t('parse alpha rejected', () => {
  assert.ok(E.parse('abc/24').error);
});
t('parse prefix out of range rejected', () => {
  assert.ok(E.parse('10.0.0.0/33').error);
  assert.ok(E.parse('10.0.0.0/-1').error);
});
t('parse bad prefix chars rejected', () => {
  assert.ok(E.parse('10.0.0.0/ab').error);
});
t('parse dotted netmask /255.255.255.0', () => {
  const p = E.parse('10.0.0.0/255.255.255.0');
  assert.strictEqual(p.prefix, 24);
});
t('parse whitespace netmask 10.0.0.0 255.255.255.128', () => {
  const p = E.parse('10.0.0.0 255.255.255.128');
  assert.strictEqual(p.prefix, 25);
});
t('parse /29 dotted netmask', () => {
  const p = E.parse('192.168.1.1/255.255.255.248');
  assert.strictEqual(p.prefix, 29);
});
t('parse non-contiguous netmask rejected', () => {
  assert.ok(E.parse('10.0.0.0/255.0.255.0').error);
});
t('parse bad netmask octet rejected', () => {
  assert.ok(E.parse('10.0.0.0/255.999.255.0').error);
});

// --- analyze basics ---
t('10.0.0.1/24 mask + network', () => {
  const a = E.analyze('10.0.0.1/24');
  assert.strictEqual(a.mask, '255.255.255.0');
  assert.strictEqual(a.network, '10.0.0.0');
  assert.strictEqual(a.broadcast, '10.0.0.255');
  assert.strictEqual(a.usableFirst, '10.0.0.1');
  assert.strictEqual(a.usableLast, '10.0.0.254');
  assert.strictEqual(a.usableHosts, 254);
  assert.strictEqual(a.subnetsOf32, 256);
});
t('192.168.1.0/26', () => {
  const a = E.analyze('192.168.1.128/26');
  assert.strictEqual(a.network, '192.168.1.128');
  assert.strictEqual(a.broadcast, '192.168.1.191');
  assert.strictEqual(a.mask, '255.255.255.192');
  assert.strictEqual(a.usableHosts, 62);
});
t('/8 large', () => {
  const a = E.analyze('10.0.0.0/8');
  assert.strictEqual(a.mask, '255.0.0.0');
  assert.strictEqual(a.network, '10.0.0.0');
  assert.strictEqual(a.broadcast, '10.255.255.255');
  assert.strictEqual(a.usableHosts, 16777214);
});
t('/0', () => {
  const a = E.analyze('0.0.0.0/0');
  assert.strictEqual(a.network, '0.0.0.0');
  assert.strictEqual(a.broadcast, '255.255.255.255');
  assert.strictEqual(a.mask, '0.0.0.0');
});
t('/31 usable pair', () => {
  const a = E.analyze('10.0.0.0/31');
  assert.strictEqual(a.usableHosts, 0);
  assert.strictEqual(a.usableFirst, '10.0.0.0');
  assert.strictEqual(a.usableLast, '10.0.0.1');
});
t('/32 single (loopback)', () => {
  const a = E.analyze('127.0.0.1/32');
  assert.strictEqual(a.usableHosts, 0);
  assert.strictEqual(a.usableFirst, '127.0.0.1');
  assert.strictEqual(a.usableLast, '127.0.0.1');
  assert.strictEqual(a.network, '127.0.0.1');
  assert.strictEqual(a.broadcast, '127.0.0.1');
});
t('wildcard 255.255.255.255 - /24', () => {
  assert.strictEqual(E.analyze('10.0.0.0/24').wildcard, '0.0.0.255');
});
t('host ip inside /24 stays in network', () => {
  assert.ok(E.analyze('10.0.0.200/24').network === '10.0.0.0');
});
t('analyze error propagates', () => {
  assert.ok(E.analyze('not-an-ipX').error);
});

// --- contains ---
t('contains full cidr', () => {
  assert.ok(E.contains('10.0.0.0/16', '10.0.1.0/24'));
  assert.ok(E.contains('10.0.0.0/16', '10.0.0.0/16'));
  assert.ok(!E.contains('10.0.1.0/24', '10.0.0.0/16'));
  assert.ok(!E.contains('10.0.0.0/24', '10.0.1.0/24'));
});
t('contains rejects bad input', () => {
  assert.strictEqual(E.contains('bad!!', '10.0.0.0/24'), false);
});

// --- subnetsOf ---
t('subdivide /24 into /26 = 4', () => {
  const r = E.subnetsOf('10.0.0.0/24', 26);
  assert.strictEqual(r.count, 4);
  assert.deepStrictEqual(r.list, ['10.0.0.0','10.0.0.64','10.0.0.128','10.0.0.192']);
  assert.strictEqual(r.perSubnet, 64);
});
t('subdivide /26 into /28 = 4', () => {
  const r = E.subnetsOf('10.0.0.128/26', 28);
  assert.deepStrictEqual(r.list, ['10.0.0.128','10.0.0.144','10.0.0.160','10.0.0.176']);
});
t('subnet with offset network', () => {
  const r = E.subnetsOf('172.16.0.128/25', 26);
  assert.deepStrictEqual(r.list, ['172.16.0.128','172.16.0.192']);
});
t('subdivide into /32 = 256', () => {
  const r = E.subnetsOf('192.168.0.0/24', 32);
  assert.strictEqual(r.count, 256);
  assert.strictEqual(r.list[0], '192.168.0.0');
  assert.strictEqual(r.list[255], '192.168.0.255');
});
t('subnetsOf rejects bad new prefix', () => {
  assert.ok(E.subnetsOf('10.0.0.0/24', 10).error);
  assert.ok(E.subnetsOf('10.0.0.0/24', 'x').error);
  assert.ok(E.subnetsOf('bad', 26).error);
});

// --- supernet ---
t('supernet merges two /25 into /24', () => {
  const r = E.supernet(['10.0.0.0/25', '10.0.0.128/25']);
  assert.strictEqual(r.merges, 1);
  assert.deepStrictEqual(r.list, ['10.0.0.0/24']);
});
t('supernet merges chain 4x /26 -> /24', () => {
  const r = E.supernet(['10.0.0.0/26','10.0.0.64/26','10.0.0.128/26','10.0.0.192/26']);
  assert.deepStrictEqual(r.list, ['10.0.0.0/24']);
});
t('supernet leaves non-contiguous separate', () => {
  const r = E.supernet(['10.0.0.0/25', '10.0.1.0/25']);
  assert.strictEqual(r.merges, 0);
  assert.strictEqual(r.list.length, 2);
});
t('supernet mixed prefixes keeps smaller', () => {
  const r = E.supernet(['10.0.0.0/24', '10.0.1.0/25']);
  assert.strictEqual(r.list[0], '10.0.0.0/24');
  assert.strictEqual(r.list[1], '10.0.1.0/25');
});
t('supernet rejects invalid input', () => {
  assert.ok(E.supernet(['bad']).error);
});

console.log(`\n${n} assertions passed`);