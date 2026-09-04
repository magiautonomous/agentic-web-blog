/*
 * diff-engine.js — text diff engine (DiffForge)
 * ---------------------------------------------------------
 * Pure, dependency-free. Computes line-level and char-level diffs between two
 * texts using a dynamic-programming LCS algorithm, produces unified-diff and
 * side-by-side output, and summarizes added/removed/unchanged counts. Exported
 * for browser + node.
 */
'use strict';

const DiffEngine = (() => {
  'use strict';

  /* ---- LCS-based diff (lines or chars) ---- */

  function lcsValues(a, b) {
    // a, b arrays of tokens; returns DP table
    const n = a.length, m = b.length;
    const dp = Array(n + 1);
    for (let i = 0; i <= n; i++) {
      dp[i] = new Array(m + 1).fill(0);
    }
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
        else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    return dp;
  }

  function diffTokens(a, b) {
    // returns array of ops: {type:'equal'|'del'|'add', value}
    const n = a.length, m = b.length;
    const dp = lcsValues(a, b);
    const ops = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) {
        ops.push({ type: 'equal', value: a[i] });
        i++; j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        ops.push({ type: 'del', value: a[i] });
        i++;
      } else {
        ops.push({ type: 'add', value: b[j] });
        j++;
      }
    }
    while (i < n) { ops.push({ type: 'del', value: a[i] }); i++; }
    while (j < m) { ops.push({ type: 'add', value: b[j] }); j++; }
    return ops;
  }

  function splitLines(text) {
    if (text === '' || text === null || text === undefined) return [];
    return text.replace(/\r\n/g, '\n').split('\n');
  }

  function splitChars(text) {
    return Array.from(text || '');
  }

  /* ---- grouping equal runs (for side-by-side) ---- */

  function segment(diffOps) {
    // consolidate so that alternating del/add groups are preserved but
    // equal runs become single blocks
    const groups = [];
    for (const op of diffOps) {
      const last = groups[groups.length - 1];
      if (last && last[0].type === op.type) last.push(op);
      else groups.push([op]);
    }
    return groups;
  }

  /* ---- line diff ---- */

  function diffLines(textA, textB) {
    const la = splitLines(textA);
    const lb = splitLines(textB);
    const ops = diffTokens(la, lb);
    const added = ops.filter(o => o.type === 'add').length;
    const removed = ops.filter(o => o.type === 'del').length;
    const unchanged = ops.filter(o => o.type === 'equal').length;
    let maxLen = Math.max(la.length, lb.length);
    let similarity = maxLen === 0 ? 1 : unchanged / maxLen;
    // line-adds and del-removes that are modifications of a single line: treat
    // del + add pairs as "changed" for the summary
    let changedLines = 0;
    const groups = segment(ops);
    for (const g of groups) {
      if (g[0].type === 'del') {
        const next = ops[ops.indexOf(g[g.length - 1]) + 1];
        // simple: count del groups as changed lines
        changedLines += g.length;
      }
    }
    return {
      added,
      removed,
      changed: ops.filter(o => o.type === 'del').length,
      unchanged,
      totalLines: Math.max(la.length, lb.length),
      ops,
      groups: segment(ops)
    };
  }

  /* ---- character diff within a single line (changed lines) ---- */

  function diffInline(oldLine, newLine) {
    const ca = splitChars(oldLine);
    const cb = splitChars(newLine);
    return diffTokens(ca, cb);
  }

  /* ---- unified diff format ---- */

  function toUnified(textA, textB, opts) {
    opts = opts || {};
    const la = splitLines(textA);
    const lb = splitLines(textB);
    const ops = diffTokens(la, lb);
    let out = [];
    if (opts.withEnvelope) {
      out.push('--- ' + (opts.labelA || 'a'));
      out.push('+++ ' + (opts.labelB || 'b'));
    }
    let aLine = 0, bLine = 0;
    const hunks = [];
    let hunk = null;
    function flushHunk() {
      if (hunk) { hunks.push(hunk); hunk = null; }
    }
    let i = 0;
    while (i < ops.length) {
      const op = ops[i];
      if (op.type === 'equal') {
        if (!hunk) hunk = { aStart: aLine + 1, bStart: bLine + 1, aCount: 0, bCount: 0, lines: [], changed: false };
        hunk.lines.push(' ' + op.value);
        if (hunk.lines.length > 6) {
          // keep a rolling context window: drop the oldest context line
          if (!hunk.changed) { hunk.aStart++; hunk.bStart++; }
          else if (hunk.lines[0][0] === ' ') { hunk.lines.shift(); hunk.aCount--; hunk.bCount--; }
        }
        hunk.aCount++; hunk.bCount++;
        aLine++; bLine++;
      } else if (op.type === 'del') {
        if (!hunk) hunk = { aStart: aLine + 1, bStart: bLine + 1, aCount: 0, bCount: 0, lines: [], changed: false };
        hunk.lines.push('-' + op.value);
        hunk.aCount++;
        hunk.changed = true;
        aLine++;
      } else if (op.type === 'add') {
        if (!hunk) hunk = { aStart: aLine + 1, bStart: bLine + 1, aCount: 0, bCount: 0, lines: [], changed: false };
        hunk.lines.push('+' + op.value);
        hunk.bCount++;
        hunk.changed = true;
        bLine++;
      }
      // close hunk once we return to equal context after changes
      const isChange = op.type !== 'equal';
      const nextIsEqual = i + 1 < ops.length && ops[i + 1].type === 'equal';
      if (isChange && nextIsEqual && hunk) flushHunk();
      i++;
    }
    flushHunk();
    let anyHunks = false;
    for (const h of hunks) {
      if (!h.changed) continue;
      anyHunks = true;
      out.push('@@ -' + h.aStart + ',' + h.aCount + ' +' + h.bStart + ',' + h.bCount + ' @@');
      for (const l of h.lines) out.push(l);
    }
    if (!anyHunks) out.push('(no differences)');
    return out.join('\n');
  }

  /* ---- side-by-side rows ---- */

  function toSideBySide(textA, textB) {
    const la = splitLines(textA);
    const lb = splitLines(textB);
    const rows = [];
    const ops = diffTokens(la, lb);
    const groups = segment(ops);
    let aIdx = 0, bIdx = 0;
    for (const g of groups) {
      const type = g[0].type;
      if (type === 'equal') {
        for (const op of g) {
          rows.push({ type: 'equal' });
          op.aIndex = aIdx; op.bIndex = bIdx;
          aIdx++; bIdx++;
        }
      } else if (type === 'del') {
        for (const op of g) {
          rows.push({ type: 'del', aValue: op.value });
          op.aIndex = aIdx;
          aIdx++; bIdx--; // no b consumed
        }
      } else if (type === 'add') {
        for (const op of g) {
          rows.push({ type: 'add', bValue: op.value });
          op.bIndex = bIdx;
          bIdx++;
        }
      }
    }
    // Rebuild with proper placement: equal lines occupy one row with both sides;
    // del then add lines pair up. Simplify: emit rows where each equal -> both,
    // del-only -> left only, add-only -> right only.
    const rows2 = [];
    let ai = 0, bi = 0;
    const n = Math.max(la.length, lb.length);
    // Use diff ops to build aligned rows
    let k = 0;
    while (k < ops.length) {
      const op = ops[k];
      if (op.type === 'equal') {
        rows2.push({ type: 'equal', a: op.value, b: op.value, aLine: ai, bLine: bi });
        ai++; bi++; k++;
      } else if (op.type === 'del' && ops[k + 1] && ops[k + 1].type === 'add') {
        // modification pair
        rows2.push({ type: 'mod', a: op.value, b: ops[k + 1].value, aLine: ai, bLine: bi });
        ai++; bi++; k += 2;
      } else if (op.type === 'del') {
        rows2.push({ type: 'del', a: op.value, aLine: ai });
        ai++; k++;
      } else if (op.type === 'add') {
        rows2.push({ type: 'add', b: op.value, bLine: bi });
        bi++; k++;
      }
    }
    return rows2;
  }

  /* ---- summary ---- */

  function summary(textA, textB) {
    const d = diffLines(textA, textB);
    return {
      addedLines: d.added,
      removedLines: d.removed,
      changedLines: d.changed,
      unchangedLines: d.unchanged,
      lineCountA: splitLines(textA).length,
      lineCountB: splitLines(textB).length,
      similar: Math.round((d.unchanged / (d.totalLines || 1)) * 100)
    };
  }

  return {
    diffLines,
    diffInline,
    diffTokens,
    toUnified,
    toSideBySide,
    splitLines,
    summary
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = DiffEngine;
