/*
 * md-engine.js — MarkdownForge engine (Casper, CASPER-X402 mission)
 * Pure, dependency-free Markdown → HTML converter + export helpers. Loaded
 * in-browser via <script> and testable in node:
 *   node -e "console.log(require('./md-engine.js').mdToHtml('# Hi'))"
 *
 * Supports a practical subset: ATX headings, emphasis/strong/strikethrough,
 * inline code + fenced code blocks with language hint, ordered/unordered lists,
 * blockquotes, links, inline images, auto-links, horizontal rules, paragraphs,
 * and a soft escaping of raw HTML for safety. No external deps.
 */
'use strict';

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MDEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function escapeHtml(s) {
    return s
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function inline(s) {
    // escape raw HTML first (soft, allows our own generated tags? simpler: escape then re-open via tokens)
    s = s
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    // images ![alt](url)
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
      (m, alt, url, title) => {
        const t = title ? ` title="${escapeHtml(title)}"` : '';
        return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}"${t}>`;
      });
    // links [text](url)
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
      (m, text, url, title) => {
        const t = title ? ` title="${escapeHtml(title)}"` : '';
        return `<a href="${escapeHtml(url)}"${t}>${inline(text)}</a>`;
      });
    // auto links <http://...>
    s = s.replace(/<((?:https?|mailto):\/\/[^ >]+)>/g, (m, u) => `<a href="${escapeHtml(u)}">${escapeHtml(u)}</a>`);
    // strikethrough ~~x~~
    s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    // strong **x**
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // emphasis *x* (avoid matching surrounding strong leftovers)
    s = s.replace(/(^|[^*])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>');
    // inline code `x`
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    return s;
  }

  function tokenize(src) {
    return (src || '').replace(/\r\n?/g, '\n').split('\n');
  }

  // Group consecutive lines that participate in a block (indented content etc.)
  function mdToHtml(src) {
    const lines = tokenize(src);
    const out = [];
    let i = 0;
    const flushPara = (buf) => {
      const joined = buf.join(' ');
      if (joined.trim()) out.push('<p>' + inline(joined.trim()) + '</p>');
    };
    let para = [];

    const flush = () => flushPara(para.splice(0));

    while (i < lines.length) {
      let line = lines[i];

      // fenced code block
      if (/^\s*(```|~~~)/.test(line)) {
        flush();
        const fence = line.match(/^\s*(```|~~~)\s*([\w+-]*)\s*$/);
        const lang = fence ? fence[2] : '';
        const buf = [];
        i++;
        while (i < lines.length && !/^\s*(```|~~~)\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++; // consume closing fence
        const attrs = lang ? ` class="language-${escapeHtml(lang)}"` : '';
        out.push('<pre><code' + attrs + '>' + escapeHtml(buf.join('\n')) + '</code></pre>');
        continue;
      }

      // ATX headings
      let h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        flush();
        const lv = h[1].length;
        out.push(`<h${lv}>${inline(h[2].trim())}</h${lv}>`);
        i++;
        continue;
      }

      // horizontal rule
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        flush();
        out.push('<hr>');
        i++;
        continue;
      }

      // blockquote
      if (/^>\s?/.test(line)) {
        flush();
        const buf = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          buf.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        out.push('<blockquote>' + mdToHtml(buf.join('\n')) + '</blockquote>');
        continue;
      }

      // unordered list
      if (/^\s*[-+*]\s+/.test(line)) {
        flush();
        const buf = [];
        while (i < lines.length && /^\s*[-+*]\s+/.test(lines[i])) {
          buf.push(lines[i].replace(/^\s*[-+*]\s+/, ''));
          i++;
        }
        out.push('<ul>' + buf.map((b) => '<li>' + inline(b) + '</li>').join('') + '</ul>');
        continue;
      }

      // ordered list
      if (/^\s*\d+[.)]\s+/.test(line)) {
        flush();
        const buf = [];
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
          buf.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''));
          i++;
        }
        out.push('<ol>' + buf.map((b) => '<li>' + inline(b) + '</li>').join('') + '</ol>');
        continue;
      }

      // blank line
      if (/^\s*$/.test(line)) { flush(); i++; continue; }

      // normal paragraph line
      para.push(line); i++;
    }
    flush();
    return out.join('\n');
  }

  function htmlToMd(html) {
    // minimal reverse for editing round-trip (best-effort, not used heavily)
    if (typeof DOMParser === 'undefined') return html;
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc.body.textContent || '';
    } catch { return html; }
  }

  function makeFilename(text) {
    return (text || 'document')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'document';
  }

  return { mdToHtml, inline, escapeHtml, makeFilename, htmlToMd };
});
