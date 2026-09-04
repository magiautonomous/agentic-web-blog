/*
 * regex-engine.js — regex builder / tester / explainer (RegexForge)
 * -----------------------------------------------------------------
 * Pure, dependency-free engine. Compile a JS regex (with flags), test strings,
 * list all matches with groups, build common patterns from a recipe builder,
 * and produce a friendly plain-English explanation of a pattern. Exported for
 * node test.
 */
'use strict';

const RegexEngine = (() => {

  /* ---- compile + test (native RegExp, wrapped) ---- */

  function compile(pattern, flags) {
    if (!pattern) return { regex: null, error: 'Regex pattern is empty' };
    let out = pattern;
    // strip leading/trailing slashes and trailing flags if provided like /abc/gi
    if (pattern[0] === '/' && pattern.lastIndexOf('/') > 0) {
      const last = pattern.lastIndexOf('/');
      out = pattern.slice(1, last);
      if (!flags) flags = pattern.slice(last + 1) || '';
    }
    let regex;
    try { regex = new RegExp(out, flags || ''); }
    catch (e) { return { regex: null, error: e.message }; }
    return { regex, source: out, flags: flags || '' };
  }

  function test(pattern, input, flags) {
    const c = compile(pattern, flags);
    if (c.error) return { error: c.error };
    const regex = c.regex;
    const results = [];
    let m;
    const g = regex.global;
    regex.lastIndex = 0;
    let i = 0;
    while ((m = regex.exec(input)) !== null) {
      results.push({
        index: m.index,
        match: m[0],
        length: m[0].length,
        groups: m.slice(1).map(v => v === undefined ? null : v)
      });
      if (!g) break;
      if (m[0] === '') regex.lastIndex++;
      i++;
      if (i > 10000) break; // safety
    }
    return {
      ok: results.length > 0,
      matches: results,
      count: results.length,
      flags: c.flags
    };
  }

  /* ---- helpful builder presets ---- */

  const PRESETS = {
    email: {
      name: 'Email',
      pattern: String.raw`^[\w.+-]+@[\w-]+\.[\w.-]+$`,
      sample: 'user.name+tag@example.co.uk'
    },
    url: {
      name: 'URL',
      pattern: String.raw`https?://[\w.-]+(?:/[\w./?%&=#-]*)?`,
      sample: 'https://example.com/path?q=1'
    },
    phone: {
      name: 'Phone (US)',
      pattern: String.raw`^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$`,
      sample: '(555) 123-4567'
    },
    dateISO: {
      name: 'Date (ISO)',
      pattern: String.raw`^\d{4}-\d{2}-\d{2}$`,
      sample: '2026-09-04'
    },
    hexColor: {
      name: 'Hex color',
      pattern: String.raw`^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$`,
      sample: '#ff8800'
    },
    uuid: {
      name: 'UUID',
      pattern: String.raw`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`,
      sample: '123e4567-e89b-12d3-a456-426614174000'
    },
    ipv4: {
      name: 'IPv4',
      pattern: String.raw`^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$`,
      sample: '192.168.1.1'
    },
    slug: {
      name: 'URL slug',
      pattern: String.raw`^[a-z0-9]+(?:-[a-z0-9]+)*$`,
      sample: 'my-blog-post-title'
    }
  };

  /* ---- gentle regex explanation ---- */

  const TOKEN_RE = /([()\[\]{}|^$.*+?)])|(\\(?:d|D|w|W|s|S|n|t|r|b|B|\d|\\[\^$.|?*+()\[\]{}]))|(\\.)/g;

  function explain(pattern) {
    const c = compile(pattern);
    if (c.error) return { error: c.error };
    const source = c.source;
    const steps = [];
    const tokens = [];
    // tokenize with a simple scanner
    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      const next = source[i + 1];
      if (ch === '\\') {
        const esc = next;
        if (next) {
          tokens.push({ type: 'esc', val: '\\' + next, desc: describeEscape(next) });
          i++;
        }
        continue;
      }
      if (ch === '[') {
        // char class: scan to ]
        let j = i + 1, cls = ']';
        let negated = false;
        if (source[j] === '^') { negated = true; j++; }
        while (j < source.length && source[j] !== ']') { cls += source[j]; j++; }
        if (source[j] !== ']') { tokens.push({ type: 'lit', val: '[', desc: 'literal "' + ch + '"' }); continue; }
        cls += ']';
        if (j < source.length) { i = j; tokens.push({ type: 'class', val: cls, desc: (negated ? 'character class — any char NOT in ' : 'character class — any one of ') + describeClass(cls) }); continue; }
      }
      if (ch === '(') {
        if (next === '?') {
          if (source[i + 2] === ':' || source[i + 2] === '=' || source[i + 2] === '!') {
            const kind = source[i + 2];
            const d = { ':': 'non-capturing group', '=': 'positive lookahead', '!': 'negative lookahead' }[kind];
            tokens.push({ type: 'group', val: source.slice(i, i + 3), desc: d });
            i += 2;
          } else { tokens.push({ type: 'group', val: '(', desc: 'group (special)' }); }
        } else {
          tokens.push({ type: 'group', val: '(', desc: 'capturing group' });
        }
        continue;
      }
      if (ch === ')') { tokens.push({ type: 'group', val: ')', desc: 'close group' }); continue; }
      if (ch === '^') { tokens.push({ type: 'anchor', val: '^', desc: 'start of string' }); continue; }
      if (ch === '$') { tokens.push({ type: 'anchor', val: '$', desc: 'end of string' }); continue; }
      if (ch === '.') { tokens.push({ type: 'any', val: '.', desc: 'any single character (except newline)' }); continue; }
      if (ch === '*') { tokens.push({ type: 'quant', val: '*', desc: 'zero or more of the previous' }); continue; }
      if (ch === '+') { tokens.push({ type: 'quant', val: '+', desc: 'one or more of the previous' }); continue; }
      if (ch === '?') { tokens.push({ type: 'quant', val: '?', desc: 'zero or one of the previous' }); continue; }
      if (ch === '{') {
        let j = i + 1; while (j < source.length && source[j] !== '}') j++;
        const q = source.slice(i, j + 1);
        if (j < source.length) { i = j; tokens.push({ type: 'quant', val: q, desc: 'exactly/repeated ' + q.replace(/[{}]/g, '').replace(/,/g, ' to ') + ' times' }); continue; }
      }
      if (ch === '|') { tokens.push({ type: 'alt', val: '|', desc: 'OR (alternation)' }); continue; }
      tokens.push({ type: 'lit', val: ch, desc: 'literal "' + ch + '"' });
    }

    for (const t of tokens) steps.push({ token: t.val, desc: t.desc });
    return {
      source,
      steps,
      summary: buildSummary(tokens)
    };
  }

  function describeEscape(ch) {
    const map = { d: 'any digit', D: 'any non-digit', w: 'any word char (letter/digit/_)', W: 'any non-word char', s: 'whitespace', S: 'non-whitespace', n: 'newline', t: 'tab', r: 'carriage return', b: 'word boundary', B: 'non-word-boundary', '.': 'literal period', '\\': 'literal backslash', '^': 'literal caret', '$': 'literal dollar', '|': 'literal pipe', '*': 'literal star', '+': 'literal plus', '?': 'literal question mark' };
    return map[ch] || (/\d/.test(ch) ? `back-reference to group ${ch}` : `escaped "${ch}"`);
  }

  function describeClass(cls) {
    // cls like "a-z]" or "^a-z]"
    let inner = cls.slice(1); // drop opening [
    if (inner.endsWith(']')) inner = inner.slice(0, -1);
    return '[' + inner + ']';
  }

  function buildSummary(tokens) {
    let hasAnchor = tokens.some(t => t.val === '^' || t.val === '$');
    let hasQuant = tokens.some(t => t.type === 'quant');
    let hasClass = tokens.some(t => t.type === 'class');
    let hasEsc = tokens.some(t => t.type === 'esc');
    let hasAlt = tokens.some(t => t.type === 'alt');
    const parts = [];
    if (hasAnchor) parts.push('anchored to string boundaries');
    if (tokens.some(t => t.val === '^')) parts.push('must start at beginning');
    if (tokens.some(t => t.val === '$')) parts.push('must end at end');
    if (hasQuant) parts.push('uses repetition quantifiers');
    if (hasClass) parts.push('matches a character set');
    if (hasEsc) parts.push('uses escaped/shorthand classes');
    if (hasAlt) parts.push('has alternation (this OR that)');
    if (!parts.length) parts.push('matches literal text');
    return parts.join('; ');
  }

  /* ---- basic pattern sanity hints ---- */

  function hints(pattern) {
    const c = compile(pattern);
    if (c.error) return { hints: ['Invalid pattern: ' + c.error] };
    const src = c.source;
    const h = [];
    if (!/^/.test(src) && src.startsWith('/')) h.push('Leading "/" treated as literal — did you mean a plain pattern?');
    if (src[0] !== '^' && src.length > 0) h.push('Not anchored — will match anywhere in the input. Add ^...$ for full-string match.');
    if (/\(\?/.test(src) && !/:|!|=/.test(src.match(/\(\?./)[0] || '')) h.push('Backreferences/conditional groups are advanced.');
    if (/[a-zA-Z0-9]{2,}/.test(src) && !/[-a-zA-Z0-9\s]/.test(src)) {}
    if (h.length === 0) h.push('Pattern looks reasonable.');
    return { hints: h };
  }

  return { compile, test, explain, hints, PRESETS };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = RegexEngine;
