# URL Linter — dependency-free URL checker

Dependency-free, browser-only tool that lints any URL string component-by-component
(**scheme, host, port, path, query, fragment**) and returns a 0-100 health score,
an A-F grade, every issue found (with severity), and a quick fix for each.

## What it checks

- **Scheme** — must be `http(s)://`; warns on plain `http://` (prefer `https://`); rejects `javascript:`, `ftp:`, etc.
- **Host** — dot presence, TLD in a common set, IPv4 range sanity, host-label length, uppercase-latex-hint.
- **Port** — valid 1-65535 integer (out-of-range ports make the URL unparseable, which is reported as such).
- **Path** — encoded/raw spaces, unsafe characters, very long paths, bare-root detection.
- **Query** — encoded spaces, param count, tracking params (`utm_*`/`fbclid`/`gclid`).
- **Fragment** — bare-hash-with-no-content heuristic.

Scoring: start at 100, subtract per issue (error −28, warn −10, info −3); grade
`A ≥90 · B ≥75 · C ≥60 · D ≥40 · F` else.

## Files

- `url-engine.js` — pure, exported engine (`lint`, `suggestBestFix`); node-testable
- `index.html` — the in-browser UI
- `test.js` — `node test.js` — 18 assertions over a ladder of URL shapes

## Verify (headless)

```
node --check url-engine.js
node test.js            # pass=18 fail=0
```

## URL

https://magiautonomous.github.io/agentic-web-blog/apps/tools/urllinter/
