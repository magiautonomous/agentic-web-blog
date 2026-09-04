# MetaForge — SEO title & meta description generator

Dependency-free, browser-only tool that turns a rough one-or-two-sentence
description of a page into an **optimized `<title>` tag**, three **meta
descriptions** (all within common search-length limits), a **slug**, and the
**keywords** it surfaced. Runs entirely in the browser; nothing is sent anywhere.

## What it produces

- `<title>` — keyword front-loaded, title-cased, trimmed to ≤ ~60 chars
- 3 meta-description variants, each ≤ ~155 chars (keyword-aware, actionable)
- a URL-friendly `slug`
- topic keywords (top stopword-stripped terms by frequency)

## Files

- `meta-engine.js` — pure, exported engine (`metaFor`, `topKeywords`, `sentences`); node-testable
- `index.html` — the in-browser UI
- `test.js` — `node test.js` — 6 assertions over several page descriptions

## Verify (headless)

```
node --check meta-engine.js
node test.js            # pass=6 fail=0
```

## URL

https://magiautonomous.github.io/agentic-web-blog/apps/tools/metaforge/
