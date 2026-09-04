/*
 * pass-audit-engine.js — password strength analyzer (PassAudit)
 * --------------------------------------------------------------
 * Pure, dependency-free. Analyzes any password for real entropy, pattern
 * detection (sequential, repeated, keyboard, date), character-class
 * diversity, dictionary/common-password screening, and provides a detailed
 * breakdown with improvement suggestions. Runs entirely in the browser.
 * Exported for node + browser.
 */
'use strict';

const PassAudit = (() => {
  'use strict';

  /* ---- common / dictionary passwords (top ~100) ---- */
  const COMMON = new Set([
    'password','123456','12345678','qwerty','abc123','monkey','master',
    'dragon','111111','baseball','iloveyou','trustno1','sunshine',
    'princess','football','charlie','shadow','michael','password1',
    'letmein','welcome','admin','login','starwars','hello','freedom',
    'whatever','ninja','mustang','jesus','nassword','passw0rd',
    '1234567','12345','123456789','1234567890','000000','654321',
    '123123','696969','batman','access','thunder','superman',
    'killer','hunter','hammer','robert','daniel','andrew','joshua',
    'ashley','jessica','pepper','ranger','buster','soccer','hockey',
    'andrea','tigger','summer','taylor','matrix','william',
    'george','harley','ranger','phoenix','samsung','cookie',
    'coffee','biteme','donald','jordan','metallica','johnny',
    'secret','aaaaaa','abcdef','donald','test','guest','master',
    'qwer1234','changeme','pass','root','toor',
  ]);

  /* ---- keyboard neighbor map ---- */
  const KB_NEIGHBORS = {
    'q':'was','w':'qeas','e':'wrds','r':'etdf','r':'etdf','t':'ryfg',
    'y':'tugh','u':'yijh','i':'uojk','o':'ipkl','p':'ol',
    'a':'qwsz','s':'awedxz','d':'serfcx','f':'drtgvc','g':'ftyhbv',
    'h':'gyujnb','j':'huiknm','k':'jiolm','l':'kop',
    'z':'asx','x':'zsdc','c':'xdfv','v':'cfgb','b':'vghn','n':'bhjm',
    'm':'njk','1':'2q','2':'13qw','3':'24we','4':'35er','5':'46rt',
    '6':'57ty','7':'68yu','8':'79ui','9':'80oi','0':'9op',
  };

  /* ---- sequential patterns ---- */
  function hasSequential(pwd, run) {
    const lower = pwd.toLowerCase();
    const asc = 'abcdefghijklmnopqrstuvwxyz';
    const dig = '0123456789';
    for (let i = 0; i <= lower.length - run; i++) {
      const chunk = lower.slice(i, i + run);
      if (asc.includes(chunk) || asc.split('').reverse().join('').includes(chunk)) return true;
      if (dig.includes(chunk) || dig.split('').reverse().join('').includes(chunk)) return true;
    }
    return false;
  }

  /* ---- repeated char pattern ---- */
  function repeatedRatio(pwd) {
    if (!pwd) return 0;
    const freq = {};
    for (const c of pwd) freq[c] = (freq[c] || 0) + 1;
    const max = Math.max(...Object.values(freq));
    return max / pwd.length;
  }

  /* ---- keyboard walk detection ---- */
  function isKeyboardWalk(pwd) {
    const lower = pwd.toLowerCase();
    if (lower.length < 3) return false;
    let hits = 0;
    for (let i = 1; i < lower.length; i++) {
      const prev = KB_NEIGHBORS[lower[i - 1]];
      if (prev && prev.includes(lower[i])) hits++;
    }
    return hits / (lower.length - 1) > 0.5;
  }

  /* ---- date pattern detection ---- */
  function hasDatePattern(pwd) {
    const lower = pwd.toLowerCase();
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    for (const m of months) if (lower.includes(m)) return true;
    // 4-digit year patterns
    if (/(?:19|20)\d{2}/.test(lower)) return true;
    // DD/MM or MM/DD
    if (/\b(?:0?[1-9]|1[0-2])[\/\-](?:0?[1-9]|[12]\d|3[01])\b/.test(lower)) return true;
    return false;
  }

  /* ---- repeated substring ---- */
  function hasRepeatedSubstring(pwd) {
    const lower = pwd.toLowerCase();
    for (let len = 1; len <= Math.floor(lower.length / 2); len++) {
      const sub = lower.slice(0, len);
      if (sub.repeat(Math.ceil(lower.length / len)).slice(0, lower.length) === lower) return true;
    }
    return false;
  }

  /* ---- charset classification ---- */
  function charClasses(pwd) {
    let lower = 0, upper = 0, digit = 0, symbol = 0, other = 0;
    for (const c of pwd) {
      if (/[a-z]/.test(c)) lower++;
      else if (/[A-Z]/.test(c)) upper++;
      else if (/[0-9]/.test(c)) digit++;
      else if (/[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/.test(c)) symbol++;
      else other++;
    }
    return { lower, upper, digit, symbol, other, total: pwd.length };
  }

  /* ---- entropy calculation ---- */
  function calcEntropy(pwd) {
    const cc = charClasses(pwd);
    let poolSize = 0;
    if (cc.lower) poolSize += 26;
    if (cc.upper) poolSize += 26;
    if (cc.digit) poolSize += 10;
    if (cc.symbol) poolSize += 32;
    if (cc.other) poolSize += 64;
    if (poolSize === 0) return 0;
    return pwd.length * Math.log2(poolSize);
  }

  /* ---- scoring ---- */
  function score(pwd) {
    if (!pwd || pwd.length === 0) {
      return { entropy: 0, score: 0, grade: 'F', issues: [], suggestions: [], details: {} };
    }

    const cc = charClasses(pwd);
    const entropy = calcEntropy(pwd);
    const repRatio = repeatedRatio(pwd);
    const issues = [];
    const suggestions = [];
    let penalty = 0;

    /* Length checks */
    if (pwd.length < 8) {
      issues.push({ msg: 'Too short — under 8 characters', severity: 'critical' });
      suggestions.push('Use at least 12 characters for a strong password');
      penalty += 30;
    } else if (pwd.length < 12) {
      issues.push({ msg: 'Short — under 12 characters', severity: 'warning' });
      suggestions.push('Consider using 12+ characters');
      penalty += 10;
    }

    /* Common password check */
    if (COMMON.has(pwd.toLowerCase())) {
      issues.push({ msg: 'Common / dictionary password', severity: 'critical' });
      suggestions.push('Avoid well-known passwords');
      penalty += 40;
    }

    /* Character class diversity */
    const classCount = [cc.lower, cc.upper, cc.digit, cc.symbol].filter(n => n > 0).length;
    if (classCount <= 1) {
      issues.push({ msg: 'Uses only one character class (all ' +
        (cc.lower ? 'lowercase' : cc.upper ? 'UPPERCASE' : cc.digit ? 'digits' : 'symbols') + ')',
        severity: 'critical' });
      suggestions.push('Mix uppercase, lowercase, digits, and symbols');
      penalty += 25;
    } else if (classCount === 2) {
      issues.push({ msg: 'Only two character classes — low diversity', severity: 'warning' });
      suggestions.push('Add more character types for better diversity');
      penalty += 10;
    }

    /* Sequential */
    if (hasSequential(pwd, 4)) {
      issues.push({ msg: 'Contains 4+ sequential characters (abc, 1234, ...)', severity: 'high' });
      suggestions.push('Break up sequential runs');
      penalty += 15;
    } else if (hasSequential(pwd, 3)) {
      issues.push({ msg: 'Contains 3 sequential characters', severity: 'medium' });
      penalty += 5;
    }

    /* Repeated characters */
    if (repRatio > 0.6) {
      issues.push({ msg: `${Math.round(repRatio * 100)}% of characters are the same — highly repetitive`, severity: 'high' });
      suggestions.push('Vary your characters');
      penalty += 20;
    } else if (repRatio > 0.4) {
      issues.push({ msg: `${Math.round(repRatio * 100)}% repetition — moderately repetitive`, severity: 'medium' });
      penalty += 8;
    }

    /* Keyboard walk */
    if (isKeyboardWalk(pwd)) {
      issues.push({ msg: 'Keyboard walk pattern detected (qwerty, asdf, ...)', severity: 'high' });
      suggestions.push('Avoid adjacent keyboard patterns');
      penalty += 15;
    }

    /* Date pattern */
    if (hasDatePattern(pwd)) {
      issues.push({ msg: 'Contains a date or month pattern', severity: 'medium' });
      suggestions.push('Avoid dates in passwords');
      penalty += 5;
    }

    /* Repeated substring */
    if (hasRepeatedSubstring(pwd) && pwd.length > 4) {
      issues.push({ msg: 'Entire password is a repeated substring (ababab, ...)', severity: 'high' });
      suggestions.push('Use a more varied pattern');
      penalty += 15;
    }

    /* All lowercase or all digits */
    if (pwd.toLowerCase() === pwd && !cc.digit && !cc.symbol) {
      issues.push({ msg: 'All lowercase, no digits or symbols', severity: 'medium' });
      penalty += 8;
    }
    if (/^\d+$/.test(pwd)) {
      issues.push({ msg: 'Entirely numeric', severity: 'high' });
      suggestions.push('Add letters and symbols');
      penalty += 25;
    }

    /* Entropy-based bonus */
    let raw = 100 - penalty;
    if (entropy > 80) raw = Math.min(100, raw + 10);
    if (entropy > 100) raw = Math.min(100, raw + 5);

    const finalScore = Math.max(0, Math.min(100, Math.round(raw)));

    /* Grade */
    let grade;
    if (finalScore >= 90) grade = 'A+';
    else if (finalScore >= 80) grade = 'A';
    else if (finalScore >= 70) grade = 'B';
    else if (finalScore >= 60) grade = 'C';
    else if (finalScore >= 40) grade = 'D';
    else grade = 'F';

    /* Default suggestion */
    if (suggestions.length === 0 && finalScore < 90) {
      suggestions.push('Use a longer, more diverse passphrase');
    }

    return {
      entropy: Math.round(entropy * 10) / 10,
      score: finalScore,
      grade,
      issues,
      suggestions,
      details: {
        length: pwd.length,
        classes: cc,
        classCount,
        repeatedRatio: Math.round(repRatio * 100) + '%',
        sequential: hasSequential(pwd, 3),
        keyboardWalk: isKeyboardWalk(pwd),
        datePattern: hasDatePattern(pwd),
        commonPassword: COMMON.has(pwd.toLowerCase()),
      },
    };
  }

  /* ---- crack time estimate ---- */
  function crackTime(pwd) {
    const ent = calcEntropy(pwd);
    const guessesPerSec = 1e10; // 10 billion (modern GPU)
    const seconds = Math.pow(2, ent) / guessesPerSec;
    if (seconds < 1) return 'instant';
    if (seconds < 60) return Math.round(seconds) + ' seconds';
    if (seconds < 3600) return Math.round(seconds / 60) + ' minutes';
    if (seconds < 86400) return Math.round(seconds / 3600) + ' hours';
    if (seconds < 31536000) return Math.round(seconds / 86400) + ' days';
    const years = seconds / 31536000;
    if (years < 1000) return Math.round(years) + ' years';
    if (years < 1e6) return Math.round(years / 1000) + 'K years';
    if (years < 1e9) return Math.round(years / 1e6) + 'M years';
    return Math.round(years / 1e9) + 'B years';
  }

  return { score, crackTime, charClasses, calcEntropy };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PassAudit;
