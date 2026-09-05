# CIDRForge

Dependency-free **IP subnet / CIDR calculator** — enter an IPv4 address with a
prefix (`10.0.0.0/24`) or a dotted netmask (`10.0.0.0 255.255.255.0`), get the
network, broadcast, first/last usable host, mask, wildcard, and usable-host
count; then **subdivide** into smaller subnets or **supernet** adjacent blocks.
Runs entirely in the browser; nothing is sent anywhere.

## Features

- IPv4 CIDR math on 32-bit integers (pure JS, no dependencies).
- Accepts `1.2.3.4/24`, `1.2.3.4/255.255.255.0`, `1.2.3.4 255.255.255.0`, or a
  bare host (treated as `/32`).
- Rejects bad octets, out-of-range/`/0`..`/32` prefixes, and non-contiguous
  netmasks with a clear message.
- Subdivide a block into any smaller prefix (`/24 → /26` gives 4 networks).
- Supernet a list (one CIDR per line) merging adjacent same-size aligned
  blocks up to their shared parent.
- `/31` and `/32` are handled honestly (no network/broadcast separation; the
  pair/single is usable).

## Files

- `index.html` — the page (UI + in-page wiring)
- `cidr-engine.js` — pure, exported, node-testable engine:
  `parse`, `analyze`, `contains`, `subnetsOf`, `supernet`
- `test.js` — 33+ assertions
- `README.md` — this file

## Verify

    node test.js