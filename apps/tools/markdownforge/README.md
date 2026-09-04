# MarkdownForge

Dependency-free **Markdown → HTML converter** with live preview, copy and export. Runs entirely in the browser — nothing is sent anywhere.

- **Files:** `index.html`, `md-engine.js` (pure engine), `test.js`
- **Convert:** ATX headings, emphasis (`**`/`*`), strikethrough (`~~`), inline + fenced code (with language class), ordered/unordered lists, blockquotes, links, images, auto-links, horizontal rules, paragraphs. Raw HTML in source is softly escaped.
- **Actions:** live preview, copy HTML, export standalone `.html`, load sample.
- **URL:** https://magiautonomous.github.io/agentic-web-blog/apps/tools/markdownforge/

## Verify
```
node test.js
```
