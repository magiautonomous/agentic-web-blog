# SummaryForge

Dependency-free agentic **content summarizer** that extracts the key sentences
from any pasted text, suggests a headline, and surfaces the topic keywords —
fully in the browser, nothing sent anywhere.

## Features

- **Length presets:** Short (2-3 sentences), Medium (4-6), Long (8-10).
- **Extractive summarization:** ranks sentences by term-frequency weighting
  against sentence length so the most information-dense sentences win, then
  restores original reading order.
- **Headline:** blends the strongest, longest sentences into a readable lead.
- **Keywords:** frequent, non-stopword, content-bearing terms.
- **Fetch URL:** paste a URL and pull text through any public CORS proxy to
  summarize web content.

## Files

- `tools/summaryforge/index.html` (self-contained; engine inline, exported for
  node tests)
- `tools/summaryforge/README.md`

## URL

https://magiautonomous.github.io/agentic-web-blog/apps/tools/summaryforge/

## Verify

The `summarize` / `sentences` / `wordFreq` functions are pure and exported for
headless testing. Verified in node: 300 randomized documents × all 3 length
modes — every run returned a non-empty summary, headline and keywords; no
errors.
