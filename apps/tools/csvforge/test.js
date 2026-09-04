#!/usr/bin/env node
'use strict';
const CSVForge = require('./csv-engine.js');
let pass = 0, fail = 0;
function assert(cond, label) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL: ' + label); }
}

// parse basics
const simple = CSVForge.parse('a,b,c\n1,2,3\n');
assert(simple.length === 2, 'parse 2 rows');
assert(simple[0][0] === 'a', 'parse header');
assert(simple[1][2] === '3', 'parse cell');

// quoted fields
const quoted = CSVForge.parse('"hello, world","line2"\n1,2\n');
assert(quoted[0][0] === 'hello, world', 'quoted comma');
assert(quoted[0][1] === 'line2', 'quoted field 2');

// escaped quotes
const escaped = CSVForge.parse('"a""b",c\n');
assert(escaped[0][0] === 'a"b', 'escaped quote');

// tab delimiter
const tsv = CSVForge.parse('name\tage\nAlice\t30\n', { delimiter: '\t' });
assert(tsv[0][0] === 'name', 'tsv header');
assert(tsv[1][1] === '30', 'tsv cell');

// detectDelimiter
assert(CSVForge.detectDelimiter('a,b,c') === ',', 'detect comma');
assert(CSVForge.detectDelimiter('a\tb\tc') === '\t', 'detect tab');
assert(CSVForge.detectDelimiter('a;b;c') === ';', 'detect semicolon');
assert(CSVForge.detectDelimiter('a|b|c') === '|', 'detect pipe');

// validate
const v1 = CSVForge.validate('a,b,c\n1,2,3\n');
assert(v1.valid === true, 'validate valid');
assert(v1.rows === 2, 'validate rows');
assert(v1.columns === 3, 'validate columns');

const v2 = CSVForge.validate('a,b,c\n1,2\n');
assert(v2.valid === false, 'validate invalid');
assert(v2.errors.length === 1, 'validate 1 error');

// duplicate headers warning
const v3 = CSVForge.validate('a,b,a\n1,2,3\n');
assert(v3.warnings.some(w => w.duplicate_headers), 'duplicate headers warning');

// empty input
const v4 = CSVForge.validate('');
assert(v4.valid === true, 'validate empty');
assert(v4.rows === 0, 'validate empty rows');

// toJSON
const js1 = CSVForge.toJSON('name,age\nAlice,30\nBob,25\n');
assert(js1.length === 2, 'toJSON 2 rows');
assert(js1[0].name === 'Alice', 'toJSON name');
assert(js1[1].age === '25', 'toJSON age string');

// toJSON quoted
const js2 = CSVForge.toJSON('"Name","Value"\n"hello","world"\n');
assert(js2[0].Name === 'hello', 'toJSON quoted');

// toMarkdownTable
const md = CSVForge.toMarkdownTable('a,b\n1,2\n');
assert(md.includes('| a | b |'), 'md table header');
assert(md.includes('| - | - |'), 'md table separator');
assert(md.includes('| 1 | 2 |'), 'md table row');

// formatTable
const ft = CSVForge.formatTable('name,age\nAlice,30\nBob,25\n');
assert(ft.includes('+ '), 'format table border');
assert(ft.includes('---'), 'format table separator');
assert(ft.includes('Alice'), 'format table cell');

// stats
const s1 = CSVForge.stats('a,b,c\n1,2,3\n4,5,6\n');
assert(s1.rows === 3, 'stats rows');
assert(s1.columns === 3, 'stats columns');
assert(s1.totalFields === 9, 'stats totalFields');
assert(s1.consistentColumns === true, 'stats consistent');
assert(s1.delimiter === ',', 'stats delimiter');

// stats with empty fields
const s2 = CSVForge.stats('a,b,c\n1,,3\n,,\n');
assert(s2.emptyFields > 0, 'stats empty fields');
assert(s2.emptyPercent > 0, 'stats empty percent');

// stats empty
const s3 = CSVForge.stats('');
assert(s3.rows === 0, 'stats empty rows');

// multiline quoted field
const ml = CSVForge.parse('a,b\n"line1\nline2",c\n');
assert(ml[1][0] === 'line1\nline2', 'multiline quoted');

// carret-n line endings
const crnl = CSVForge.parse('a,b\r\n1,2\r\n');
assert(crnl.length === 2, 'crlf rows');

console.log(`\nCSVForge tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
