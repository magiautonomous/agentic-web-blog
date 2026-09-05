'use strict';
/*
 * CIDRForge engine — pure IP/CIDR subnet math, dependency-free, node-testable.
 * Handles IPv4 only (v6 formatting is out of scope for this build, but inputs
 * are rejected cleanly). Everything is integer math on 32-bit masks.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CIDRForge = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX32 = 0xffffffff;

  function ipToInt(ip) {
    const parts = String(ip).trim().split('.');
    if (parts.length !== 4) return null;
    let n = 0;
    for (const p of parts) {
      if (!/^\d{1,3}$/.test(p)) return null;
      const o = Number(p);
      if (o > 255) return null;
      n = (n << 8) | o;
    }
    return n >>> 0;
  }

  function intToIp(n) {
    n = n >>> 0;
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
  }

  // parse "10.0.0.1/24", "10.0.0.1/255.255.255.0", or "10.0.0.1" (assume /32).
  // Also accepts a dotted netmask joined by whitespace or "/": "10.0.0.0 255.255.255.0".
  function parse(input) {
    let s = String(input).trim();
    // dashed-netmask form "10.0.0.0/255.255.255.0" or "10.0.0.0 255.255.255.0"
    let m = s.match(/^(\d{1,3}(?:\.\d{1,3}){3})\s*[\/\s]\s*(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (m) {
      const maskInt = ipToInt(m[2]);
      if (maskInt === null) return { error: 'Invalid netmask address' };
      const bits = maskInt >>> 0;
      const set = [];
      for (let i = 31; i >= 0; i--) set.push((bits >>> i) & 1);
      const firstZero = set.indexOf(0);
      if (firstZero !== -1 && set.slice(firstZero).some((x) => x === 1)) {
        return { error: 'Non-contiguous netmask' };
      }
      const prefix = firstZero === -1 ? 32 : firstZero;
      return { ip: ipToInt(m[1]), prefix, ipText: m[1] };
    }

    const slash = s.lastIndexOf('/');
    let ipPart = s;
    let prefix = null;
    if (slash !== -1) {
      ipPart = s.slice(0, slash);
      const p = s.slice(slash + 1);
      if (/^\d{1,2}$/.test(p)) {
        prefix = Number(p);
        if (prefix < 0 || prefix > 32) return { error: 'Invalid prefix: must be 0-32' };
      } else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(p)) {
        // dotted netmask after slash
        const maskInt = ipToInt(p);
        if (maskInt === null) return { error: 'Invalid netmask address' };
        return parse(ipPart + ' ' + p);
      } else {
        return { error: 'Invalid prefix: expected integer 0-32 or dotted netmask' };
      }
    }
    const ip = parseIPIntOrNull(ipPart);
    if (ip === null) return { error: 'Invalid IPv4 address' };
    if (prefix === null) prefix = 32;
    return { ip, prefix, ipText: intToIp(ip) };
  }

  function parseIPIntOrNull(ipPart) {
    // allow ranges? no — strict IPv4 only
    return ipToInt(ipPart);
  }

  const PREFIX_COUNTS = {
    0: 4294967296, 1: 2147483648, 2: 1073741824, 3: 536870912, 4: 268435456,
    5: 134217728, 6: 67108864, 7: 33554432, 8: 16777216, 9: 8388608,
    10: 4194304, 11: 2097152, 12: 1048576, 13: 524288, 14: 262144,
    15: 131072, 16: 65536, 17: 32768, 18: 16384, 19: 8192,
    20: 4096, 21: 2048, 22: 1024, 23: 512, 24: 256, 25: 128,
    26: 64, 27: 32, 28: 16, 29: 8, 30: 4, 31: 2, 32: 1
  };

  function analyze(input) {
    const p = parse(input);
    if (p.error) return { error: p.error };
    const { ip, prefix, ipText } = p;
    const mask = prefix === 0 ? 0 : (MAX32 << (32 - prefix)) >>> 0;
    const network = (ip & mask) >>> 0;
    const broadcast = (network | ~mask) >>> 0;
    const hosts = PREFIX_COUNTS[prefix] - 2;
    const usableFirst = prefix >= 31 ? network : network + 1;
    const usableLast = prefix >= 31 ? broadcast : broadcast - 1;
    const subnetsOf32 = PREFIX_COUNTS[prefix];
    return {
      input: input.trim(),
      ip: ipText,
      prefix,
      mask: intToIp(mask),
      network: intToIp(network),
      broadcast: intToIp(broadcast),
      networkInt: network,
      usableHosts: hosts < 0 ? 0 : hosts,
      usableFirst: intToIp(usableFirst),
      usableLast: intToIp(usableLast),
      wildcard: intToIp((~mask) >>> 0),
      subnetsOf32,
      // /31 /32 point-to-point / single-host allowances
      notes: ['/31 and /32 don\u2019t have distinct network/broadcast addresses; treat the pair/single as usable.'].filter(() => prefix >= 31)
    };
  }

  // true if `candidate` subnet is fully contained in `input` subnet
  function contains(input, candidate) {
    const a = analyze(input);
    const c = analyze(candidate);
    if (a.error || c.error) return false;
    if (c.prefix < a.prefix) return false;
    const parentMask = a.prefix === 0 ? 0 : (MAX32 << (32 - a.prefix)) >>> 0;
    const cMask = c.prefix === 0 ? 0 : (MAX32 << (32 - c.prefix)) >>> 0;
    const cNet = (c.networkInt & cMask) >>> 0;
    const parentNet = (a.networkInt & parentMask) >>> 0;
    if (cNet < parentNet) return false;
    const parentBroadcast = (parentNet | ((~parentMask) >>> 0)) >>> 0;
    const cBroadcast = (cNet | ((~cMask) >>> 0)) >>> 0;
    return cBroadcast <= parentBroadcast;
  }

  // list all equal-size subnets within input at the given new prefix
  function subnetsOf(input, newPrefix) {
    const a = analyze(input);
    if (a.error) return { error: a.error };
    if (!Number.isInteger(newPrefix) || newPrefix < 0 || newPrefix > 32) {
      return { error: 'Invalid new prefix: must be 0-32' };
    }
    if (newPrefix < a.prefix) return { error: 'New prefix must be >= network prefix to subdivide' };
    if (newPrefix === a.prefix) {
      return { error: 'Same prefix as parent', list: [a.network] };
    }
    const newMask = newPrefix === 0 ? 0 : (MAX32 << (32 - newPrefix)) >>> 0;
    const parentMask = a.prefix === 0 ? 0 : (MAX32 << (32 - a.prefix)) >>> 0;
    const parentNet = (a.networkInt & parentMask) >>> 0;
    const count = Math.pow(2, newPrefix - a.prefix);
    const blockSize = Math.pow(2, 32 - newPrefix);
    const list = [];
    for (let i = 0; i < count; i++) {
      list.push(intToIp((parentNet + i * blockSize) >>> 0));
    }
    return { list, count, perSubnet: PREFIX_COUNTS[newPrefix], blockSize };
  }

  // merge adjacent networks that share a parent (VLSM supernetting heuristic)
  function supernet(inputs) {
    let nets = [];
    for (const i of inputs) {
      const a = analyze(i);
      if (a.error) return { error: 'Invalid input: ' + a.error };
      nets.push({ network: a.network, prefix: a.prefix, networkInt: a.networkInt });
    }
    nets.sort((x, y) => x.networkInt - y.networkInt || x.prefix - y.prefix);

    // repeated merge passes: a pass merges pairs one level up, repeat until stable
    let changed = true;
    let merges = 0;
    while (changed) {
      changed = false;
      const out = [];
      for (const n of nets) {
        const prev = out[out.length - 1];
        const blockSize = Math.pow(2, 32 - n.prefix);
        const canMerge =
          prev &&
          prev.prefix === n.prefix &&
          prev.prefix > 0 &&
          ((prev.networkInt >>> (32 - prev.prefix)) & 1) === 0 &&  // prev is the lower/even-aligned half
          (prev.networkInt + blockSize) === n.networkInt;          // n immediately follows prev
        if (canMerge) {
          out.pop();
          out.push({ network: intToIp(prev.networkInt), prefix: prev.prefix - 1, networkInt: prev.networkInt });
          changed = true;
          merges++;
        } else {
          out.push({ network: n.network, prefix: n.prefix, networkInt: n.networkInt });
        }
      }
      nets = out;
    }
    return { list: nets.map((o) => o.network + '/' + o.prefix), merges };
  }

  return { parse, analyze, contains, subnetsOf, supernet, ipToInt, intToIp };
});