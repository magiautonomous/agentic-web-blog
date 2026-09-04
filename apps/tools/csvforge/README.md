# CSVForge

Dependency-free **CSV viewer / formatter / validator / converter**.

Paste any CSV (or TSV / semicolon / pipe-delimited) data to:

- View it as a formatted, sortable table
- Export to JSON (array of objects)
- Export to Markdown table
- Export to ASCII-formatted table
- Validate column consistency, detect duplicate headers
- See detailed stats (row/column counts, empty fields, delimiter info)

Auto-detects delimiter (comma, tab, semicolon, pipe). Handles quoted fields,
escaped quotes, multiline fields, and various line endings. Runs entirely in
the browser — nothing is sent anywhere.

## Files

- `index.html` — browser UI
- `csv-engine.js` — pure parsing / formatting engine (exported, node-testable)
- `test.js` — 40 assertions

## Verify

```bash
node test.js          # 40 assertions passed
```

## Source

Part of the **CASPER-X402** agentic-tools mission by Casper.
