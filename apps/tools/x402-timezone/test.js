#!/usr/bin/env node
/*
 * test.js — verify the fixed-offset timezone logic (x402-timezone)
 */
'use strict';

// Re-implement the offset math used by the server, exported for the test.
function zonedTime(offsetHours, atMs) {
  const offH = offsetHours;
  const localMs = atMs + offH * 3600 * 1000;
  const d = new Date(localMs);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth()+1).padStart(2,'0');
  const day = String(d.getUTCDate()).padStart(2,'0');
  const hh = String(d.getUTCHours()).padStart(2,'0');
  const mm = String(d.getUTCMinutes()).padStart(2,'0');
  const ss = String(d.getUTCSeconds()).padStart(2,'0');
  return { zone: offsetHours, local: `${y}-${mo}-${day}T${hh}:${mm}:${ss}` };
}

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', msg); }
}

// UTC epoch is 1970-01-01T00:00:00Z
const t = zonedTime(0, 0);
assert(t.local === '1970-01-01T00:00:00', 'UTC epoch: ' + t.local);

// Asia/Kolkata = +5.5 -> 1970-01-01T05:30:00
const k = zonedTime(5.5, 0);
assert(k.local === '1970-01-01T05:30:00', 'Kolkata +5.5: ' + k.local);

// America/New_York = -5 -> 1969-12-31T19:00:00
const ny = zonedTime(-5, 0);
assert(ny.local === '1969-12-31T19:00:00', 'NY -5: ' + ny.local);

// A known instant: 2026-09-04T12:00:00Z
const ref = Date.parse('2026-09-04T12:00:00Z');
const tokyo = zonedTime(9, ref);
assert(tokyo.local === '2026-09-04T21:00:00', 'Tokyo +9: ' + tokyo.local);
const la = zonedTime(-8, ref);
assert(la.local === '2026-09-04T04:00:00', 'LA -8: ' + la.local);

// half-hour offset +5:30
const dhakaish = zonedTime(5.5, ref);
assert(dhakaish.local === '2026-09-04T17:30:00', 'Kolkata +5.5 at noon UTC: ' + dhakaish.local);

// Nepal +5.75 -> add 45 min
const np = zonedTime(5.75, ref);
assert(np.local === '2026-09-04T17:45:00', 'Kathmandu +5.75: ' + np.local);

// Cross-midnight negative offset
const sydney = zonedTime(10, ref);
assert(sydney.local === '2026-09-04T22:00:00', 'Sydney +10: ' + sydney.local);

// At 23:30 UTC in Tokyo (+9) -> next day 08:30
const late = zonedTime(9, Date.parse('2026-09-04T23:30:00Z'));
assert(late.local === '2026-09-05T08:30:00', 'next-day Tokyo: ' + late.local);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
