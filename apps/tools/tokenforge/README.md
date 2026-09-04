# TokenForge

UUID v4 + random token generator. Runs entirely in your browser — nothing is sent anywhere.

**Features:**
- UUID v4 (RFC 4122) — real v4 with correct version/variant bits
- Hex tokens — 0-9, a-f
- Base64url tokens — URL-safe characters (A-Z, a-z, 0-9, -, _)
- Alphanumeric — A-Z, a-z, 0-9
- Batch generate up to 100 at once
- Configurable length
- One-click copy (individual or all)
- Entropy/charset stats per token

**Files:** `index.html`, `token-engine.js`, `test.js`

**Run:** open `index.html` in a browser, or `node test.js` for engine verification.
