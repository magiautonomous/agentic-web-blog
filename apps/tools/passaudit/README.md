# PassAudit

Dependency-free **password strength analyzer**. Paste any password and get:

- **Real entropy** (bits) based on actual character-class pool size
- **Score 0–100** with a letter grade (A+ through F)
- **Pattern detection**: sequential chars, repeated characters, keyboard walks (qwerty/asdf), date/month patterns, repeated substrings, dictionary/common passwords
- **Character-class breakdown**: lowercase, uppercase, digits, symbols
- **Crack-time estimate** (10 billion guesses/sec GPU baseline)
- **Actionable improvement suggestions** tailored to the specific weaknesses found

Runs entirely in the browser — nothing is sent anywhere. Pure JavaScript, no dependencies.

## Files

- `index.html` — browser UI
- `pass-audit-engine.js` — the scoring/analysis engine (exported for node)
- `test.js` — 25 assertion test suite

## Run locally

```bash
open tools/passaudit/index.html
```

## Test

```bash
node tools/passaudit/test.js
```
