/*
 * json-engine.js — JSON formatter / validator / tree / path query (JSONForge)
 * ---------------------------------------------------------------------------
 * Pure, dependency-free engine. Parses, formats, minifies, validates (with
 * line:col error location), builds a collapsible tree model, queries simple
 * dot/bracket paths, and gathers stats. Exported for both browser + node test.
 */
'use strict';

const JsonEngine = (() => {

  /* ---- parse + validate ---- */

  function validate(raw) {
    if (typeof raw !== 'string') return { ok: false, error: 'Input must be a string', line: 0, col: 0 };
    if (!raw.trim()) return { ok: false, error: 'Empty input', line: 0, col: 0 };
    try {
      JSON.parse(raw);
      return { ok: true };
    } catch (e) {
      const msg = e.message || String(e);
      let line = 0, col = 0;
      const pos = msg.match(/position\s+(\d+)/i);
      if (pos) {
        const idx = parseInt(pos[1], 10);
        const up = raw.substring(0, idx);
        line = (up.match(/\n/g) || []).length + 1;
        col = idx - up.lastIndexOf('\n');
      } else {
        let depth = 0, inStr = false, escape = false;
        for (let i = 0; i < raw.length; i++) {
          const c = raw[i];
          if (escape) { escape = false; continue; }
          if (c === '\\' && inStr) { escape = true; continue; }
          if (c === '"') { inStr = !inStr; continue; }
          if (inStr) continue;
          if (c === '\n') { depth = 0; line++; col = 1; continue; }
          col++;
          if (c === '{' || c === '[') depth++;
          if (c === '}' || c === ']') { if (depth > 0) depth--; }
        }
        if (line === 0) { line = (raw.match(/\n/g) || []).length + 1; col = raw.length; }
      }
      return { ok: false, error: msg, line, col };
    }
  }

  /* ---- format / minify ---- */

  function format(raw, indent) {
    const v = validate(raw);
    if (!v.ok) return { formatted: null, error: v.error, line: v.line, col: v.col };
    const tab = indent === 'tab' ? '\t' : ' '.repeat(Math.max(1, Math.min(8, Number(indent) || 2)));
    return { formatted: JSON.stringify(JSON.parse(raw), null, tab) };
  }

  function minify(raw) {
    const v = validate(raw);
    if (!v.ok) return { minified: null, error: v.error, line: v.line, col: v.col };
    return { minified: JSON.stringify(JSON.parse(raw)) };
  }

  /* ---- stats ---- */

  function stats(raw) {
    const v = validate(raw);
    if (!v.ok) return { error: v.error, line: v.line, col: v.col };
    const obj = JSON.parse(raw);
    let depth = 0, keys = 0, arrays = 0, objects = 0, strings = 0, numbers = 0, booleans = 0, nulls = 0;
    (function walk(val, d) {
      if (d > depth) depth = d;
      if (val === null) { nulls++; return; }
      const t = typeof val;
      if (t === 'string') { strings++; return; }
      if (t === 'number') { numbers++; return; }
      if (t === 'boolean') { booleans++; return; }
      if (Array.isArray(val)) { arrays++; val.forEach((x) => walk(x, d + 1)); return; }
      if (t === 'object') {
        objects++;
        const ks = Object.keys(val);
        keys += ks.length;
        ks.forEach((k) => walk(val[k], d + 1));
      }
    })(obj, 0);
    return {
      size: raw.length,
      sizeBytes: new TextEncoder().encode(raw).length,
      depth, keys, arrays, objects, strings, numbers, booleans, nulls
    };
  }

  /* ---- tree model (for collapsible UI) ---- */

  function buildTree(raw) {
    const v = validate(raw);
    if (!v.ok) return { tree: null, error: v.error, line: v.line, col: v.col };
    const obj = JSON.parse(raw);
    function node(val, label) {
      if (val === null) return { type: 'null', label, value: null };
      const t = typeof val;
      if (t === 'string') return { type: 'string', label, value: val };
      if (t === 'number') return { type: 'number', label, value: val };
      if (t === 'boolean') return { type: 'boolean', label, value: val };
      if (Array.isArray(val)) {
        return {
          type: 'array', label, count: val.length,
          children: val.map((v, i) => node(v, String(i)))
        };
      }
      const ks = Object.keys(val);
      return {
        type: 'object', label, count: ks.length,
        children: ks.map((k) => node(val[k], k))
      };
    }
    return { tree: node(obj, 'root') };
  }

  /* ---- simple path query (dot + bracket notation) ---- */

  function query(raw, pathStr) {
    const v = validate(raw);
    if (!v.ok) return { error: v.error, line: v.line, col: v.col };
    if (!pathStr || !pathStr.trim()) return { error: 'Empty path' };
    const obj = JSON.parse(raw);
    const cleaned = pathStr.trim().replace(/^\$/, '').replace(/^\./, '');
    const parts = cleaned.split(/\.(?![^\[]*\])/).filter(Boolean);
    let cur = obj;
    for (const part of parts) {
      const arr = part.match(/^([^\[]*)\[(\d+|\*)\]$/);
      if (arr) {
        const key = arr[1];
        const idx = arr[2];
        if (key) {
          if (cur === null || typeof cur !== 'object') return { error: `Cannot index into non-object at "${key}"` };
          cur = cur[key];
          if (cur === undefined) return { error: `Key "${key}" not found` };
        }
        if (idx === '*') {
          if (!Array.isArray(cur)) return { error: `"${key || '$'}" is not an array` };
        } else {
          if (!Array.isArray(cur)) return { error: `"${key || '$'}" is not an array` };
          cur = cur[parseInt(idx, 10)];
          if (cur === undefined) return { error: `Index ${idx} out of bounds` };
        }
      } else {
        if (cur === null || typeof cur !== 'object') return { error: `Cannot access property on non-object` };
        cur = cur[part];
        if (cur === undefined) return { error: `Key "${part}" not found` };
      }
    }
    return { result: cur };
  }

  /* ---- format tree as indented text ---- */

  function formatTree(raw, indent) {
    const t = buildTree(raw);
    if (t.error) return { formatted: null, error: t.error, line: t.line, col: t.col };
    const tab = indent === 'tab' ? '\t' : ' '.repeat(Math.max(1, Math.min(8, Number(indent) || 2)));
    const lines = [];
    (function walk(n, depth) {
      const pad = tab.repeat(depth);
      if (n.type === 'object' || n.type === 'array') {
        const open = n.type === 'object' ? '{' : '[';
        const close = n.type === 'object' ? '}' : ']';
        if (n.label !== undefined) lines.push(`${pad}${typeof n.label === 'string' ? JSON.stringify(n.label) + ': ' : ''}${open}`);
        n.children.forEach((c) => walk(c, depth + 1));
        lines.push(`${pad}${close}`);
      } else {
        const prefix = typeof n.label === 'string' ? JSON.stringify(n.label) + ': ' : '';
        const val = n.type === 'string' ? JSON.stringify(n.value) : String(n.value);
        lines.push(`${pad}${prefix}${val}`);
      }
    })(t.tree, 0);
    return { formatted: lines.join('\n') };
  }

  return { validate, format, minify, stats, buildTree, query, formatTree };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = JsonEngine;
