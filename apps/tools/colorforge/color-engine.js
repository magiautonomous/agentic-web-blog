/*
 * color-engine.js — color converter / palette / contrast (ColorForge)
 * -------------------------------------------------------------------
 * Pure, dependency-free engine. Parses hex, rgb(), hsl(), and named CSS colors;
 * converts between all formats; generates complementary / analogous / triadic /
 * split-complementary / monochromatic palettes; computes WCAG contrast ratios
 * and relative luminance; produces tints and shades. Exported for browser + node.
 */
'use strict';

const ColorEngine = (() => {

  /* ---- named CSS colors (148 most common) ---- */
  const NAMES = {
    aliceblue:'#f0f8ff',antiquewhite:'#faebd7',aqua:'#00ffff',aquamarine:'#7fffd4',
    azure:'#f0ffff',beige:'#f5f5dc',bisque:'#ffe4c4',black:'#000000',
    blanchedalmond:'#ffebcd',blue:'#0000ff',blueviolet:'#8a2be2',brown:'#a52a2a',
    burlywood:'#deb887',cadetblue:'#5f9ea0',chartreuse:'#7fff00',chocolate:'#d2691e',
    coral:'#ff7f50',cornflowerblue:'#6495ed',cornsilk:'#fff8dc',crimson:'#dc143c',
    cyan:'#00ffff',darkblue:'#00008b',darkcyan:'#008b8b',darkgoldenrod:'#b8860b',
    darkgray:'#a9a9a9',darkgreen:'#006400',darkkhaki:'#bdb76b',darkmagenta:'#8b008b',
    darkolivegreen:'#556b2f',darkorange:'#ff8c00',darkorchid:'#9932cc',darkred:'#8b0000',
    darksalmon:'#e9967a',darkseagreen:'#8fbc8f',darkslateblue:'#483d8b',
    darkslategray:'#2f4f4f',darkturquoise:'#00ced1',darkviolet:'#9400d3',
    deeppink:'#ff1493',deepskyblue:'#00bfff',dimgray:'#696969',dodgerblue:'#1e90ff',
    firebrick:'#b22222',floralwhite:'#fffaf0',forestgreen:'#228b22',fuchsia:'#ff00ff',
    gainsboro:'#dcdcdc',ghostwhite:'#f8f8ff',gold:'#ffd700',goldenrod:'#daa520',
    gray:'#808080',green:'#008000',greenyellow:'#adff2f',honeydew:'#f0fff0',
    hotpink:'#ff69b4',indianred:'#cd5c5c',indigo:'#4b0082',ivory:'#fffff0',
    khaki:'#f0e68c',lavender:'#e6e6fa',lavenderblush:'#fff0f5',lawngreen:'#7cfc00',
    lemonchiffon:'#fffacd',lightblue:'#add8e6',lightcoral:'#f08080',lightcyan:'#e0ffff',
    lightgoldenrodyellow:'#fafad2',lightgray:'#d3d3d3',lightgreen:'#90ee90',
    lightpink:'#ffb6c1',lightsalmon:'#ffa07a',lightseagreen:'#20b2aa',
    lightskyblue:'#87cefa',lightslategray:'#778899',lightsteelblue:'#b0c4de',
    lightyellow:'#ffffe0',lime:'#00ff00',limegreen:'#32cd32',linen:'#faf0e6',
    magenta:'#ff00ff',maroon:'#800000',mediumaquamarine:'#66cdaa',mediumblue:'#0000cd',
    mediumorchid:'#ba55d3',mediumpurple:'#9370db',mediumseagreen:'#3cb371',
    mediumslateblue:'#7b68ee',mediumspringgreen:'#00fa9a',mediumturquoise:'#48d1cc',
    mediumvioletred:'#c71585',midnightblue:'#191970',mintcream:'#f5fffa',
    mistyrose:'#ffe4e1',moccasin:'#ffe4b5',navajowhite:'#ffdead',navy:'#000080',
    oldlace:'#fdf5e6',olive:'#808000',olivedrab:'#6b8e23',orange:'#ffa500',
    orangered:'#ff4500',orchid:'#da70d6',palegoldenrod:'#eee8aa',palegreen:'#98fb98',
    paleturquoise:'#afeeee',palevioletred:'#db7093',papayawhip:'#ffefd5',
    peachpuff:'#ffdab9',peru:'#cd853f',pink:'#ffc0cb',plum:'#dda0dd',
    powderblue:'#b0e0e6',purple:'#800080',rebeccapurple:'#663399',red:'#ff0000',
    rosybrown:'#bc8f8f',royalblue:'#4169e1',saddlebrown:'#8b4513',salmon:'#fa8072',
    sandybrown:'#f4a460',seagreen:'#2e8b57',seashell:'#fff5ee',sienna:'#a0522d',
    silver:'#c0c0c0',skyblue:'#87ceeb',slateblue:'#6a5acd',slategray:'#708090',
    snow:'#fffafa',springgreen:'#00ff7f',steelblue:'#4682b4',tan:'#d2b48c',
    teal:'#008080',thistle:'#d8bfd8',tomato:'#ff6347',turquoise:'#40e0d0',
    violet:'#ee82ee',wheat:'#f5deb3',white:'#ffffff',whitesmoke:'#f5f5f5',
    yellow:'#ffff00',yellowgreen:'#9acd32'
  };

  /* ---- parse any color to {r,g,b} 0-255 ---- */

  function parseHex(hex) {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    if (hex.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(hex)) return null;
    return { r: parseInt(hex.slice(0,2),16), g: parseInt(hex.slice(2,4),16), b: parseInt(hex.slice(4,6),16) };
  }

  function parseRgb(str) {
    const m = str.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
    if (!m) return null;
    const r = +m[1], g = +m[2], b = +m[3];
    if (r > 255 || g > 255 || b > 255) return null;
    return { r, g, b };
  }

  function parseHsl(str) {
    const m = str.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/);
    if (!m) return null;
    const h = parseFloat(m[1]), s = parseFloat(m[2]) / 100, l = parseFloat(m[3]) / 100;
    return hslToRgb(h, s, l);
  }

  function parse(input) {
    if (!input || typeof input !== 'string') return null;
    const s = input.trim().toLowerCase();
    if (NAMES[s]) return parseHex(NAMES[s]);
    if (s.startsWith('#')) return parseHex(s);
    if (s.startsWith('rgb')) return parseRgb(s);
    if (s.startsWith('hsl')) return parseHsl(s);
    return null;
  }

  /* ---- conversions ---- */

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      else if (max === g) h = ((b - r) / d + 2) * 60;
      else h = ((r - g) / d + 4) * 60;
    }
    return { h: Math.round(h * 10) / 10, s: Math.round(s * 1000) / 10, l: Math.round(l * 1000) / 10 };
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r, g, b;
    if (h < 60)      { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else               { r = c; g = 0; b = x; }
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }

  function toHex(r, g, b) {
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  function toRgbStr(r, g, b) { return `rgb(${r}, ${g}, ${b})`; }
  function toHslStr(h, s, l) { return `hsl(${h}, ${s}%, ${l}%)`; }

  function convert(input) {
    const c = parse(input);
    if (!c) return null;
    const hsl = rgbToHsl(c.r, c.g, c.b);
    return {
      hex: toHex(c.r, c.g, c.b),
      rgb: toRgbStr(c.r, c.g, c.b),
      hsl: toHslStr(hsl.h, hsl.s, hsl.l),
      r: c.r, g: c.g, b: c.b,
      h: hsl.h, s: hsl.s, l: hsl.l
    };
  }

  /* ---- WCAG contrast ---- */

  function relativeLuminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  function contrastRatio(c1, c2) {
    const a = parse(c1), b = parse(c2);
    if (!a || !b) return null;
    const l1 = relativeLuminance(a.r, a.g, a.b);
    const l2 = relativeLuminance(b.r, b.g, b.b);
    const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
    return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
  }

  function wcagGrade(ratio) {
    if (ratio >= 7) return 'AAA';
    if (ratio >= 4.5) return 'AA';
    if (ratio >= 3) return 'AA Large';
    return 'Fail';
  }

  /* ---- palette generators ---- */

  function hueShift(c, deg) {
    const hsl = rgbToHsl(c.r, c.g, c.b);
    const h = (hsl.h + deg + 360) % 360;
    const rgb = hslToRgb(h, hsl.s / 100, hsl.l / 100);
    return toHex(rgb.r, rgb.g, rgb.b);
  }

  function complementary(input) {
    const c = parse(input); if (!c) return null;
    return [input, hueShift(c, 180)];
  }

  function analogous(input) {
    const c = parse(input); if (!c) return null;
    return [-30, -15, 0, 15, 30].map(d => hueShift(c, d));
  }

  function triadic(input) {
    const c = parse(input); if (!c) return null;
    return [0, 120, 240].map(d => hueShift(c, d));
  }

  function splitComplementary(input) {
    const c = parse(input); if (!c) return null;
    return [0, 150, 210].map(d => hueShift(c, d));
  }

  function monochromatic(input, count) {
    const c = parse(input); if (!c) return null;
    count = count || 5;
    const hsl = rgbToHsl(c.r, c.g, c.b);
    const results = [];
    for (let i = 0; i < count; i++) {
      const l = Math.round(((i + 1) / (count + 1)) * 100);
      const rgb = hslToRgb(hsl.h, hsl.s / 100, l / 100);
      results.push(toHex(rgb.r, rgb.g, rgb.b));
    }
    return results;
  }

  function tintsAndShades(input, count) {
    const c = parse(input); if (!c) return null;
    count = count || 5;
    const hsl = rgbToHsl(c.r, c.g, c.b);
    const tints = [], shades = [];
    for (let i = 1; i <= count; i++) {
      const tl = Math.min(100, hsl.l + (100 - hsl.l) * (i / (count + 1)));
      const tr = hslToRgb(hsl.h, hsl.s / 100, tl / 100);
      tints.push(toHex(tr.r, tr.g, tr.b));
      const sl = Math.max(0, hsl.l - hsl.l * (i / (count + 1)));
      const sr = hslToRgb(hsl.h, hsl.s / 100, sl / 100);
      shades.push(toHex(sr.r, sr.g, sr.b));
    }
    return { tints, shades };
  }

  /* ---- color distance (CIE76-ish simplified) ---- */

  function distance(c1, c2) {
    const a = parse(c1), b = parse(c2);
    if (!a || !b) return null;
    const hsl1 = rgbToHsl(a.r, a.g, a.b), hsl2 = rgbToHsl(b.r, b.g, b.b);
    return Math.round(Math.sqrt(
      Math.pow(hsl1.h - hsl2.h, 2) + Math.pow(hsl1.s - hsl2.s, 2) * 10 + Math.pow(hsl1.l - hsl2.l, 2) * 10
    ));
  }

  return { parse, convert, toHex, toRgbStr, toHslStr, rgbToHsl, hslToRgb,
    relativeLuminance, contrastRatio, wcagGrade,
    complementary, analogous, triadic, splitComplementary, monochromatic, tintsAndShades,
    distance, NAMES };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = ColorEngine;
