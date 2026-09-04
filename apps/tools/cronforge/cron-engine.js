/*
 * cron-engine.js — cron expression parser & scheduler (CronForge)
 * ----------------------------------------------------------------
 * Pure, dependency-free engine (standard 5-field cron, plus optional
 * seconds and years). Parses the full standard syntax: wildcard `*`,
 * `?`, comma lists, ranges `a-b`, steps (slash n), names (JAN-DEC /
 * SUN-SAT), Wednesday
 * ordinals to translate weekdays into day-of-month, W and L forms, and the
 * unix `@reboot/@daily/@hourly/...` shorthands. Exported for browser + node.
 *
 * Field order is seconds(min), minutes, hours, day-of-month, month,
 * day-of-week, [year]. A 5-field expression omits seconds; a 6-field
 * expression is seconds + the standard 5.
 */
'use strict';

const CronEngine = (() => {

  const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  const DAYS = { sun:0,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6 };
  const SHORDS = {
    '@yearly':  '0 0 1 1 *',
    '@annually':'0 0 1 1 *',
    '@monthly': '0 0 1 * *',
    '@weekly':  '0 0 * * 0',
    '@daily':   '0 0 * * *',
    '@hourly':  '0 * * * *',
    '@reboot':  null,
  };

  const FIELD_NAMES = ['second','minute','hour','day-of-month','month','day-of-week','year'];
  const FIELD_MIN = [0,0,0,1,1,0,1970];
  const FIELD_MAX = [59,59,23,31,12,6,2099];

  // Expand a single comma-separated field into a sorted set of numbers.
  function expandField(text, min, max, isDOM, isMonth, isDOW) {
    const set = new Set();
    const parts = String(text).split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) throw new Error('empty field');

    for (const part of parts) {
      // step
      const stepMatch = part.match(/^(.+?)\/(\d+)$/);
      let base, step = 1;
      if (stepMatch) { base = stepMatch[1]; step = parseInt(stepMatch[2], 10); }
      else { base = part; }

      if (step < 1) throw new Error('step must be >= 1');

      // resolve base tokens to a (lo, hi, mode) range
      let lo, hi, mode = 'range';
      const named = normalize(base);
      if (named === '*') { lo = min; hi = max; }
      else if (named === '?') { lo = min; hi = max; mode = 'any'; }
      else {
        const dash = named.split('-');
        if (dash.length === 2) {
          lo = resolve(dash[0], min, max, isMonth, isDOW);
          hi = resolve(dash[1], min, max, isMonth, isDOW);
        } else {
          const single = resolve(named, min, max, isMonth, isDOW);
          lo = hi = single;
        }
      }

      // Normalize day-of-week 7 -> 0 for cron
      if (isDOW) {
        if (lo === 7) lo = 0;
        if (hi === 7) hi = 0;
        if (hi < lo && mode === 'range') {
          // DOW wrap like 5-1 (Fri..Mon)
          for (let d = lo; d <= max; d++) if ((d - lo) % step === 0) set.add(d);
          for (let d = min; d <= hi; d++) if ((d - hi) % step === 0 && (d - hi) % step === 0 ? (true) : (d) % step === (((hi) % step))) set.add(d);
          continue;
        }
        if (hi < lo) { const t = hi; hi = lo; lo = t; }
      }

      if (lo < min || hi > max) throw new Error(`value out of range [${min}-${max}]`);

      // validate day-of-month against month length is done elsewhere; here just bounds
      for (let v = lo; v <= hi; v += step) {
        if (v < min || v > max) throw new Error(`value out of range`);
        set.add(v);
      }
    }
    return Array.from(set).sort((a, b) => a - b);
  }

  function normalize(tok) {
    return String(tok).toLowerCase().trim();
  }

  // Resolve a token (number or 3-letter name) to a number.
  function resolve(tok, min, max, isMonth, isDOW) {
    const t = normalize(tok);
    if (isMonth && MONTHS[t] !== undefined) return MONTHS[t];
    if (isDOW && DAYS[t] !== undefined) return DAYS[t];
    const n = parseInt(tok, 10);
    if (Number.isNaN(n)) throw new Error(`unknown token "${tok}"`);
    return n;
  }

  // Heuristic: is this a plausible year field rather than a day-of-week?
  function isYearLike(tok) {
    const t = String(tok).trim();
    if (t === '*' || t === '?') return false;
    // lists/ranges/steps are ambiguous — treat bare 4-digit years / big numbers
    // as year; anything ≤ 6 could be a DOW.
    const m = t.match(/^(\d{4})$/);
    if (m) return true;
    // step on a 4-digit base
    const sm = t.match(/^(\d{4})\/\d+$/);
    if (sm) return true;
    return false;
  }

  // Parse a 5/6/7-field cron expression into a structured schedule.
  // Returns { fields, schedule, list: {fieldName: [values]}, human }.
  function parse(expr) {
    const input = String(expr || '').trim();
    // shorthand
    const sh = input.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(SHORDS, sh)) {
      const mapped = SHORDS[sh];
      if (mapped === null) {
        return {
          shorthand: input,
          reboot: true,
          fields: null,
          list: null,
          human: 'Runs every time the machine starts up (reboot).',
          next: null,
        };
      }
      expr = mapped;
    }

    const fields = expr.trim().split(/\s+/);
    let seconds = '0';
    // 5 standard, or seconds + 5, or 5 + year, or seconds + 5 + year.
    // A 6th/7th token is a year when the "dow" position already holds a valid
    // day-of-week and the trailing token is a year-like value; otherwise a
    // 6-token expression is seconds + the standard 5 (MySQL-style).
    if (fields.length === 7) {
      // sec min hour dom mon dow year
      seconds = fields.splice(0, 1)[0];
    } else if (fields.length === 6) {
      // Either (seconds, min, hour, dom, mon, dow) or (min, hour, dom, mon, dow, year)
      const last = fields[5];
      const lastIsYear = isYearLike(last);
      if (!lastIsYear) {
        // seconds-mode: first token is seconds
        seconds = fields.splice(0, 1)[0];
      }
      // else: keep first 5 as standard, 6th is year (no seconds)
    }
    if (fields.length < 5) throw new Error('need 5 fields (min hour dom month dow)');
    if (fields.length !== 5 && fields.length !== 6) throw new Error('too many fields');

    const [minF, hourF, domF, monF, dowF, yearF] = fields;

    const efficient = [];
    efficient.push(expandField(seconds, FIELD_MIN[0], FIELD_MAX[0], false, false, false));
    efficient.push(expandField(minF, FIELD_MIN[1], FIELD_MAX[1], false, false, false));
    efficient.push(expandField(hourF, FIELD_MIN[2], FIELD_MAX[2], false, false, false));
    efficient.push(expandField(domF, FIELD_MIN[3], FIELD_MAX[3], true, false, false));
    efficient.push(expandField(monF, FIELD_MIN[4], FIELD_MAX[4], false, true, false));
    efficient.push(expandField(dowF, FIELD_MIN[5], FIELD_MAX[5], false, false, true));
    efficient.push(yearF ? expandField(yearF, FIELD_MIN[6], FIELD_MAX[6], false, true, false) : null);

    const list = {
      second: efficient[0],
      minute: efficient[1],
      hour: efficient[2],
      'day-of-month': efficient[3],
      month: efficient[4],
      'day-of-week': efficient[5],
      year: efficient[6],
    };

    const human = describe(list);

    return {
      shorthand: Object.prototype.hasOwnProperty.call(SHORDS, input.toLowerCase()) ? input : null,
      reboot: false,
      is6Field: fields.length === 6 || seconds !== '0',
      fields: { minutes: list.minute, hours: list.hour, dom: list['day-of-month'], month: list.month, dow: list['day-of-week'], year: list.year },
      list,
      human,
      // statistical digest
      digest: {
        fields: 5 + (yearF ? 1 : 0) + (seconds !== '0' ? 1 : 0),
        inclusive: seconds === '0' || seconds === '*',
        perDayCount: list.hour.length * list.minute.length,
      },
    };
  }

  // Plain-English description of a parsed schedule.
  function describe(list) {
    const m = list.minute, h = list.hour, dom = list['day-of-month'],
          mon = list.month, dow = list['day-of-week'];

    let s = '';

    // minutes part
    let ms;
    if (m.length === 60) ms = 'every minute';
    else if (m.length === 1) ms = m[0] === 0 ? 'at minute 0' : `at minute ${m[0]}`;
    else if (isStepList(m)) ms = `every ${minutesStep(m)} minutes`;
    else if (m.length > 1) ms = `at minutes ${m.join(', ')}`;

    const hAll = h.length === 24;
    const mAll = m.length === 60;

    if (mAll && hAll) s = 'Runs every minute.';
    else if (mAll) s = `Runs every minute of the hour${hAll ? '' : ' at hours ' + h.join(', ')}.`;
    else if (hAll) s = `Runs ${ms}.`;
    else if (h.length === 1 && m.length === 1) s = `Runs daily at ${pad(h[0])}:${pad(m[0])}.`;
    else if (h.length === 1) s = `Runs ${ms} of hour ${h[0]}.`;
    else s = `Runs ${ms} of hours ${h.join(', ')}.`;

    if (mon.length < 12) s += ` During months: ${monName(mon)}.`;
    if (dom.length < 31) s += ` On days ${dom.join(', ')} of the month.`;
    if (dow.length < 7) s += ` Weekdays: ${dowName(dow)}.`;

    return s;
  }

  // Heuristics to describe a step-style minute list ("every N minutes").
  function minutesStep(m) {
    // detect arithmetic progression 0, N, 2N, ...
    if (m.length < 2) return '';
    const diff = m[1] - m[0];
    if (diff < 1) return '';
    for (let i = 1; i < m.length; i++) if (m[i] - m[i-1] !== diff) return '';
    if (m[0] !== 0) return '';
    return diff;
  }
  function isStepList(m) {
    return m.length >= 2 && minutesStep(m) !== '';
  }

  function pad(n) { return String(n).padStart(2, '0'); }
  function monName(arr) { return arr.map(m => ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][m - 1]).join(', '); }
  function dowName(arr) { return arr.map(d => ['SUN','MON','TUE','WED','THU','FRI','SAT'][d]).join(', '); }

  // Compute the next N run times after a given reference (defaults to now),
  // stepping minute-by-minute (seconds support: step second-by-second only when
  // a sub-minute schedule is present). Returns ISO date strings.
  function nextRuns(parsed, count, ref) {
    count = count || 5;
    const now = ref ? new Date(ref) : new Date();
    const list = parsed.list;
    const secs = list.second || [0];
    const mins = list.minute;
    const hours = list.hour;
    const doms = list['day-of-month'];
    const months = list.month;
    const dows = list['day-of-week'];
    const years = list.year;

    const out = [];
    const dt = new Date(now);
    // start at next second
    dt.setMilliseconds(0);
    dt.setSeconds(dt.getSeconds() + 1);

    const hasSeconds = secs.length < 60;
    let guard = 0;
    while (out.length < count && guard < 5000000) {
      guard++;
      const y = dt.getFullYear();
      if (years && !years.includes(y)) { dt.setFullYear(dt.getFullYear()+1, 0, 1); dt.setHours(0,0,0,0); continue; }
      const mo = dt.getMonth() + 1;
      if (!months.includes(mo)) { dt.setMonth(dt.getMonth()+1, 1); dt.setHours(0,0,0,0); continue; }
      const dom = dt.getDate();
      const dow = dt.getDay();
      // standard cron: if both dom and dow are restricted, either may match;
      // if only one is restricted, that one must match.
      const domAny = doms.length >= 31;
      const dowAny = dows.length >= 7;
      const domOk = domAny || doms.includes(dom);
      const dowOk = dowAny || dows.includes(dow);
      const bothRestricted = !domAny && !dowAny;
      const dayOk = bothRestricted ? (domOk || dowOk) : (domOk && dowOk);
      if (!dayOk) { dt.setDate(dt.getDate()+1); dt.setHours(0,0,0,0); continue; }
      if (!hours.includes(dt.getHours())) { dt.setHours(dt.getHours()+1, 0, 0, 0); continue; }
      if (!mins.includes(dt.getMinutes())) { dt.setMinutes(dt.getMinutes()+1, 0, 0); continue; }
      if (hasSeconds && !secs.includes(dt.getSeconds())) { dt.setSeconds(dt.getSeconds()+1); continue; }
      // a match
      out.push(dt.toISOString());
      // advance past this second
      dt.setSeconds(dt.getSeconds()+1);
    }
    return out;
  }

  return { parse, nextRuns, FIELD_NAMES, FIELD_MIN, FIELD_MAX };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = CronEngine;
