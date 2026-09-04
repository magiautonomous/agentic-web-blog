#!/usr/bin/env node
/*
 * pass-audit test — verify pass-audit-engine.js
 */
'use strict';
const assert = require('assert');
const P = require('./pass-audit-engine.js');

let pass = 0, fail = 0;
function ok(label, cond) {
  if (cond) { pass++; }
  else { fail++; console.error('FAIL:', label); }
}

// 1. Empty input
const e0 = P.score('');
ok('empty score 0', e0.score === 0);
ok('empty grade F', e0.grade === 'F');
ok('empty entropy 0', e0.entropy === 0);

// 2. Common password
const c1 = P.score('password');
ok('common password penalty', c1.score < 40);
ok('common detected', c1.details.commonPassword === true);
ok('common grade F or D', c1.grade === 'F' || c1.grade === 'D');

// 3. All digits
const c2 = P.score('12345678');
ok('all-digits penalty', c2.score < 50);
ok('has digit-only issue', c2.issues.some(i => i.msg.includes('numeric')));

// 4. Short password
const c3 = P.score('Ab1!');
ok('short penalty', c3.score < 75);
ok('has short issue', c3.issues.some(i => i.msg.includes('short')));

// 5. Strong password
const c4 = P.score('Tr0ub4dor&3xK9!');
ok('strong >= 70', c4.score >= 70);
ok('strong grade >= C', ['A+','A','B','C'].includes(c4.grade));
ok('strong entropy > 60', c4.entropy > 60);

// 6. Sequential detection
const c5 = P.score('abcdef12');
ok('sequential detected', c5.issues.some(i => i.msg.includes('sequential')));

// 7. Keyboard walk
const c6 = P.score('qwerty');
ok('keyboard walk detected', c6.issues.some(i => i.msg.includes('Keyboard walk')));

// 8. Repeated characters
const c7 = P.score('aaaaaaaab');
ok('repetition detected', c7.issues.some(i => i.msg.includes('repetit')));

// 9. Date pattern
const c8 = P.score('jan2025!');
ok('date pattern detected', c8.issues.some(i => i.msg.includes('date')));

// 10. One class only (uppercase)
const c9 = P.score('HELLO');
ok('single class detected', c9.issues.some(i => i.msg.includes('one character class')));

// 11. Crack time
const ct1 = P.crackTime('password');
ok('common pw crack instant', ct1 === 'instant' || ct1.includes('seconds'));
const ct2 = P.crackTime('Tr0ub4dor&3xK9!');
ok('strong pw crack > hours', ct2.includes('years') || ct2.includes('days') || ct2.includes('hours'));

// 12. Repeated substring
const c10 = P.score('ababababab');
ok('repeated substring', c10.issues.some(i => i.msg.includes('repeated substring')));

// 13. charClasses
const cc = P.charClasses('Ab1!');
ok('4 classes', cc.lower === 1 && cc.upper === 1 && cc.digit === 1 && cc.symbol === 1);

// 14. calcEntropy basic
const ent = P.calcEntropy('abc');
ok('entropy positive', ent > 0);

// 15. Excellent password
const c11 = P.score('x7$Kp!2mQ@w9R#nL');
ok('excellent >= 80', c11.score >= 80);
ok('excellent grade A+', c11.grade === 'A+' || c11.grade === 'A');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
