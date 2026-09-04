/*
 * csv-engine.js — dependency-free CSV parser / formatter / validator / converter
 * (Casper, CASPER-X402)
 */
'use strict';

const CSVForge = (() => {
  function detectDelimiter(input) {
    const first = (input || '').split('\n').slice(0, 5).join('\n');
    const counts = { ',': 0, '\t': 0, ';': 0, '|': 0 };
    for (let i = 0; i < first.length; i++) {
      const c = first[i];
      if (c === '"') { i++; while (i < first.length && first[i] !== '"') i++; continue; }
      if (counts[c] !== undefined) counts[c]++;
    }
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return best[0][1] > 0 ? best[0][0] : ',';
  }

  function parse(input, opts = {}) {
    const raw = input || '';
    const delim = opts.delimiter || detectDelimiter(raw);
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    let i = 0;
    while (i < raw.length) {
      const ch = raw[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < raw.length && raw[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            inQuotes = false;
            i++;
          }
        } else {
          field += ch;
          i++;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
          i++;
        } else if (ch === delim) {
          row.push(field);
          field = '';
          i++;
        } else if (ch === '\r') {
          i++;
          if (i < raw.length && raw[i] === '\n') i++;
          row.push(field);
          field = '';
          rows.push(row);
          row = [];
        } else if (ch === '\n') {
          i++;
          row.push(field);
          field = '';
          rows.push(row);
          row = [];
        } else {
          field += ch;
          i++;
        }
      }
    }
    if (field || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  function validate(input, opts = {}) {
    const rows = parse(input, opts);
    if (!rows.length) return { valid: true, rows: 0, columns: 0, errors: [], warnings: ['empty_input'] };
    const colCounts = rows.map(r => r.length);
    const expected = colCounts[0];
    const errors = [];
    const warnings = [];
    for (let i = 1; i < colCounts.length; i++) {
      if (colCounts[i] !== expected) {
        errors.push({ row: i + 1, expected, got: colCounts[i], message: `Row ${i + 1} has ${colCounts[i]} columns, expected ${expected}` });
      }
    }
    const header = rows[0];
    const dupes = [];
    const seen = new Set();
    for (let i = 0; i < header.length; i++) {
      const h = header[i];
      if (h && seen.has(h)) dupes.push(h);
      if (h) seen.add(h);
    }
    if (dupes.length) warnings.push({ duplicate_headers: dupes });
    const blanks = rows[0].filter(f => !f.trim()).length;
    if (blanks) warnings.push({ blank_headers: blanks, message: `${blanks} blank header(s) — row 1` });
    return {
      valid: errors.length === 0,
      rows: rows.length,
      columns: expected,
      delimiter: opts.delimiter || detectDelimiter(input),
      errors,
      warnings,
    };
  }

  function toJSON(input, opts = {}) {
    const rows = parse(input, opts);
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ''; });
      return obj;
    });
  }

  function toMarkdownTable(input, opts = {}) {
    const rows = parse(input, opts);
    if (!rows.length) return '';
    const widths = [];
    for (const row of rows) {
      for (let i = 0; i < row.length; i++) {
        widths[i] = Math.max(widths[i] || 0, String(row[i]).length);
      }
    }
    const lines = [];
    for (let r = 0; r < rows.length; r++) {
      const cells = rows[r].map((c, i) => String(c).padEnd(widths[i]));
      lines.push('| ' + cells.join(' | ') + ' |');
      if (r === 0) {
        lines.push('| ' + widths.map(w => '-'.repeat(w)).join(' | ') + ' |');
      }
    }
    return lines.join('\n');
  }

  function stats(input, opts = {}) {
    const rows = parse(input, opts);
    if (!rows.length) return { rows: 0, columns: 0, totalFields: 0, emptyFields: 0, avgRowLength: 0, delimiter: opts.delimiter || ',' };
    const colCounts = rows.map(r => r.length);
    const allFields = rows.flat();
    const emptyFields = allFields.filter(f => !f.trim()).length;
    const charCount = input.length;
    return {
      rows: rows.length,
      columns: Math.max(...colCounts),
      totalFields: allFields.length,
      emptyFields,
      emptyPercent: allFields.length ? +((emptyFields / allFields.length) * 100).toFixed(1) : 0,
      charCount,
      avgRowLength: rows.length ? +(charCount / rows.length).toFixed(1) : 0,
      delimiter: opts.delimiter || detectDelimiter(input),
      consistentColumns: new Set(colCounts).size === 1,
    };
  }

  function formatTable(input, opts = {}) {
    const rows = parse(input, opts);
    if (!rows.length) return '';
    const widths = [];
    for (const row of rows) {
      for (let i = 0; i < row.length; i++) {
        widths[i] = Math.max(widths[i] || 0, String(row[i]).length);
      }
    }
    return rows.map((row, ri) => {
      const cells = row.map((c, i) => String(c).padEnd(widths[i]));
      const line = '+ ' + cells.join(' | ') + ' |';
      if (ri === 0) {
        const sep = '+ ' + widths.map(w => '-'.repeat(w)).join('-+-') + '-+';
        return line + '\n' + sep;
      }
      return line;
    }).join('\n');
  }

  return { parse, detectDelimiter, validate, toJSON, toMarkdownTable, formatTable, stats };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = CSVForge;
