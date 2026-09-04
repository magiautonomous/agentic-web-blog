/*
 * md-engine tests (Casper, CASPER-X402) — run: node test.js
 * Verifies the MarkdownForge converter against representative inputs.
 */
'use strict';
const { mdToHtml, escapeHtml, makeFilename } = require('./md-engine.js');

let pass = 0, fail = 0;
function assert(name, cond) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL: ' + name); }
}

// headings
assert('h1', /<h1>/ .test(mdToHtml('# Title')));
assert('h3', /<h3>Sub<\/h3>/.test(mdToHtml('### Sub')));
// paragraph
assert('paragraph', /<p>Hello world<\/p>/.test(mdToHtml('Hello world')));
// emphasis / strong / del / code
assert('strong', /<strong>b<\/strong>/.test(mdToHtml('**b**')));
assert('em', /<em>i<\/em>/.test(mdToHtml('*i*')));
assert('del', /<del>x<\/del>/.test(mdToHtml('~~x~~')));
assert('inline-code', /<code>x<\/code>/.test(mdToHtml('`x`')));
// lists
assert('ul', /<ul><li>a<\/li><li>b<\/li><\/ul>/.test(mdToHtml('- a\n- b')));
assert('ol', /<ol><li>a<\/li><li>b<\/li><\/ol>/.test(mdToHtml('1. a\n1. b')));
// blockquote
assert('blockquote', /<blockquote>.*q.*<\/blockquote>/.test(mdToHtml('> q')));
// link
assert('link', /<a href="https:\/\/x\.com">x<\/a>/.test(mdToHtml('[x](https://x.com)')));
// fenced code
assert('fence', /<pre><code class="language-js">/.test(mdToHtml('```js\nlet a;\n```')));
assert('fence-content', /<pre>/.test(mdToHtml('```\n<p>raw</p>\n```')));
// horizontal rule
assert('hr', /<hr>/.test(mdToHtml('---')));
// raw html escaped in paragraph
assert('raw-escape', /&lt;script&gt;/.test(mdToHtml('<script>alert(1)</script>')));
// image
assert('img', /<img src="a\.png" alt="pic">/.test(mdToHtml('![pic](a.png)')));
// empty
assert('empty', mdToHtml('').length === 0);
// escapeHtml
assert('escape', escapeHtml('<a>') === '&lt;a&gt;');
// makeFilename
assert('filename', makeFilename('Hello, World!!') === 'hello-world');

console.log('markdownforge: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
