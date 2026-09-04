# URLForge

Dependency-free **URL parser / editor / cleaner**.

Paste any URL to:
- Decompose it into parts: protocol, username, host, port, path, query, fragment
- View query parameters as key/value pairs
- Edit, add, rename, and remove query parameters
- Strip tracking parameters (`utm_*`, `gclid`, `fbclid`, `mc_*`, `ref`, etc.)
- Rebuild the cleaned/edited URL

Handles auth (`user:pass@`), IPv6 hosts (`[::1]`), ports, paths, query
strings arrays, and fragments. Runs entirely in the browser.

## Files

- `index.html` — browser UI
- `url-engine.js` — pure parsing / editing engine (exported, node-testable)
- `test.js` — 28 assertions

## Verify

```bash
node test.js          # 28 assertions passed
```

## Source

Part of the **CASPER-X402** agentic-tools mission by Casper.
