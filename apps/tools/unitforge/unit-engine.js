/*
 * unit-engine.js — unit converter engine (UnitForge)
 * ---------------------------------------------------------
 * Pure, dependency-free. Converts between units across length, mass,
 * temperature, time, speed, area, volume, data, energy, pressure, power,
 * angle, frequency, force, and currency-lite. Real conversion factors,
 * bidirectional, fuzzy unit matching, formatting. Exported for browser + node.
 */
'use strict';

const UnitEngine = (() => {
  'use strict';

  const CATEGORIES = {
    length: {
      name: 'Length',
      units: { m: { n: 'meter', f: 1 }, km: { n: 'kilometer', f: 1000 }, cm: { n: 'centimeter', f: 0.01 }, mm: { n: 'millimeter', f: 0.001 }, um: { n: 'micrometer', f: 1e-6 }, nmi: { n: 'nautical mile', f: 1852 }, mi: { n: 'mile', f: 1609.34 }, yd: { n: 'yard', f: 0.9144 }, ft: { n: 'foot', f: 0.3048 }, in: { n: 'inch', f: 0.0254 } }
    },
    mass: {
      name: 'Mass',
      units: { kg: { n: 'kilogram', f: 1 }, g: { n: 'gram', f: 0.001 }, mg: { n: 'milligram', f: 1e-6 }, t: { n: 'tonne', f: 1000 }, lb: { n: 'pound', f: 0.453592 }, oz: { n: 'ounce', f: 0.0283495 }, st: { n: 'stone', f: 6.35029 } }
    },
    temperature: {
      name: 'Temperature',
      units: { '°C': { n: 'celsius', f: null }, C: { n: 'celsius', f: null }, '°F': { n: 'fahrenheit', f: null }, F: { n: 'fahrenheit', f: null }, K: { n: 'kelvin', f: null } }
    },
    time: {
      name: 'Time',
      units: { s: { n: 'second', f: 1 }, ms: { n: 'millisecond', f: 0.001 }, us: { n: 'microsecond', f: 1e-6 }, min: { n: 'minute', f: 60 }, h: { n: 'hour', f: 3600 }, d: { n: 'day', f: 86400 }, wk: { n: 'week', f: 604800 }, mo: { n: 'month (30d)', f: 2592000 }, yr: { n: 'year (365d)', f: 31536000 } }
    },
    speed: {
      name: 'Speed',
      units: { 'm/s': { n: 'meter per second', f: 1 }, kmh: { n: 'kilometer per hour', f: 1 / 3.6 }, mph: { n: 'mile per hour', f: 0.44704 }, fps: { n: 'foot per second', f: 0.3048 }, kn: { n: 'knot', f: 0.514444 } }
    },
    area: {
      name: 'Area',
      units: { 'm²': { n: 'square meter', f: 1 }, m2: { n: 'square meter', f: 1 }, 'cm²': { n: 'square centimeter', f: 1e-4 }, km2: { n: 'square kilometer', f: 1e6 }, ha: { n: 'hectare', f: 10000 }, 'ft²': { n: 'square foot', f: 0.092903 }, 'in²': { n: 'square inch', f: 0.00064516 }, ac: { n: 'acre', f: 4046.86 }, 'mi²': { n: 'square mile', f: 2.58999e6 }, 'yd²': { n: 'square yard', f: 0.836127 } }
    },
    volume: {
      name: 'Volume',
      units: { 'm³': { n: 'cubic meter', f: 1 }, m3: { n: 'cubic meter', f: 1 }, L: { n: 'liter', f: 0.001 }, mL: { n: 'milliliter', f: 1e-6 }, 'cm³': { n: 'cubic centimeter', f: 1e-6 }, gal: { n: 'US gallon', f: 0.00378541 }, qt: { n: 'US quart', f: 0.000946353 }, pt: { n: 'US pint', f: 0.000473176 }, cup: { n: 'US cup', f: 0.000236588 }, floz: { n: 'US fluid ounce', f: 2.95735e-5 }, tbs: { n: 'tablespoon', f: 1.47868e-5 }, tsp: { n: 'teaspoon', f: 4.92892e-6 } }
    },
    data: {
      name: 'Data',
      units: { B: { n: 'byte', f: 1 }, KB: { n: 'kilobyte', f: 1024 }, MB: { n: 'megabyte', f: 1024 * 1024 }, GB: { n: 'gigabyte', f: 1024 ** 3 }, TB: { n: 'terabyte', f: 1024 ** 4 }, PB: { n: 'petabyte', f: 1024 ** 5 }, b: { n: 'bit', f: 1 / 8 }, Kb: { n: 'kilobit', f: 1000 / 8 }, Mb: { n: 'megabit', f: 1e6 / 8 }, Gb: { n: 'gigabit', f: 1e9 / 8 }, kib: { n: 'kibibyte', f: 1024 }, MiB: { n: 'mebibyte', f: 1024 ** 2 }, GiB: { n: 'gibibyte', f: 1024 ** 3 } }
    },
    energy: {
      name: 'Energy',
      units: { J: { n: 'joule', f: 1 }, kJ: { n: 'kilojoule', f: 1000 }, cal: { n: 'calorie', f: 4.184 }, kcal: { n: 'kilocalorie', f: 4184 }, Wh: { n: 'watt-hour', f: 3600 }, kWh: { n: 'kilowatt-hour', f: 3.6e6 }, eV: { n: 'electronvolt', f: 1.602e-19 }, BTU: { n: 'british thermal unit', f: 1055.06 } }
    },
    pressure: {
      name: 'Pressure',
      units: { Pa: { n: 'pascal', f: 1 }, kPa: { n: 'kilopascal', f: 1000 }, MPa: { n: 'megapascal', f: 1e6 }, bar: { n: 'bar', f: 100000 }, atm: { n: 'atmosphere', f: 101325 }, mmHg: { n: 'millimeter of mercury', f: 133.322 }, psi: { n: 'pound per square inch', f: 6894.76 }, Torr: { n: 'torr', f: 133.322 } }
    },
    power: {
      name: 'Power',
      units: { W: { n: 'watt', f: 1 }, mW: { n: 'milliwatt', f: 0.001 }, kW: { n: 'kilowatt', f: 1000 }, MW: { n: 'megawatt', f: 1e6 }, GW: { n: 'gigawatt', f: 1e9 }, hp: { n: 'horsepower', f: 745.7 }, hpM: { n: 'metric horsepower', f: 735.499 } }
    },
    angle: {
      name: 'Angle',
      units: { deg: { n: 'degree', f: null }, rad: { n: 'radian', f: null }, grad: { n: 'gradian', f: null }, turn: { n: 'turn', f: null }, arcmin: { n: 'arcminute', f: null }, arcsec: { n: 'arcsecond', f: null } }
    },
    frequency: {
      name: 'Frequency',
      units: { Hz: { n: 'hertz', f: 1 }, kHz: { n: 'kilohertz', f: 1000 }, MHz: { n: 'megahertz', f: 1e6 }, GHz: { n: 'gigahertz', f: 1e9 }, rpm: { n: 'rev per minute', f: 1 / 60 } }
    },
    force: {
      name: 'Force',
      units: { N: { n: 'newton', f: 1 }, kN: { n: 'kilonewton', f: 1000 }, kgf: { n: 'kilogram-force', f: 9.80665 }, lbf: { n: 'pound-force', f: 4.44822 }, dyn: { n: 'dyne', f: 1e-5 } }
    },
    currency: {
      name: 'Currency (static rates)',
      units: { USD: { n: 'US dollar', f: 1 }, EUR: { n: 'euro', f: 0.92 }, GBP: { n: 'british pound', f: 0.79 }, JPY: { n: 'japanese yen', f: 149.0 }, INR: { n: 'indian rupee', f: 83.5 }, CAD: { n: 'canadian dollar', f: 1.36 }, AUD: { n: 'australian dollar', f: 1.51 }, CHF: { n: 'swiss franc', f: 0.87 } }
    }
  };

  /* ---- unit normalization / matching ---- */

  const ALIASES = {
    m: ['meter', 'metre', 'meters', 'metres'], km: ['kilometer', 'kilometre', 'kms'], cm: ['centimeter', 'centimetre'], mm: ['millimeter', 'millimetre'], um: ['micrometer', 'micrometre', 'micron'],
    mi: ['mile', 'miles'], yd: ['yard', 'yards'], ft: ['foot', 'feet', 'ft.'], in: ['inch', 'inches'],
    kg: ['kilogram', 'kilo'], g: ['gram', 'grams'], mg: ['milligram'], t: ['tonne', 'metric ton', 'ton'], lb: ['pound', 'pounds'], oz: ['ounce', 'ounces'], st: ['stone'],
    s: ['second', 'sec', 'seconds', 'secs'], ms: ['millisecond', 'msec'], min: ['minute', 'min', 'minutes', 'mins'], h: ['hour', 'hr', 'hours', 'hrs'], d: ['day', 'days'], wk: ['week', 'weeks'], mo: ['month', 'months'], yr: ['year', 'years'],
    m2: ['sqm', 'square meter', 'square metre'], km2: ['sq km', 'square kilometer'], cm2: ['sq cm', 'square centimeter'], ha: ['hectare', 'hectares'], ac: ['acre', 'acres'], m3: ['cubic meter', 'cubic metre', 'cu m'], L: ['liter', 'litre', 'liters'], mL: ['milliliter', 'ml'], gal: ['gallon', 'gallons'], qt: ['quart', 'quarts'], pt: ['pint', 'pints'],
    B: ['byte', 'bytes'], KB: ['kilobyte', 'kb'], MB: ['megabyte', 'mb', 'meg'], GB: ['gigabyte', 'gb', 'gig'], TB: ['terabyte', 'tb'], PB: ['petabyte', 'pb'], b: ['bit', 'bits'], Kb: ['kilobit', 'kbit'],
    J: ['joule', 'joules'], kJ: ['kilojoule'], cal: ['calorie', 'calories'], kcal: ['kilocalorie', 'cal'], Wh: ['watt-hour', 'watt hour'], kWh: ['kilowatt-hour', 'kilowatt hour'],
    Pa: ['pascal'], kPa: ['kilopascal'], MPa: ['megapascal'], bar: ['bars'], atm: ['atmosphere', 'atmospheres'], psi: ['pound per square inch', 'psi'], mmHg: ['millimeter of mercury', 'mmhg'], Torr: ['torr'],
    W: ['watt', 'watts'], kW: ['kilowatt', 'kilowatts'], MW: ['megawatt'], hp: ['horsepower', 'horse power'], deg: ['degree', 'degrees', '°'], rad: ['radian', 'radians'], grad: ['gradian', 'gon'],
    Hz: ['hertz', 'hz'], kHz: ['kilohertz', 'khz'], MHz: ['megahertz', 'mhz'], GHz: ['gigahertz', 'ghz'], rpm: ['rpm', 'revolutions per minute'],
    N: ['newton', 'newtons'], kN: ['kilonewton'], kgf: ['kilogram-force', 'kgf'], lbf: ['pound-force'], dyn: ['dyne'],
    USD: ['usd', 'dollar', 'dollars'], EUR: ['eur', 'euro', 'euros'], GBP: ['gbp', 'pound sterling'], JPY: ['jpy', 'yen'], INR: ['inr', 'rupee', 'rupees'], CAD: ['cad', 'canadian dollar'], AUD: ['aud', 'australian dollar'], CHF: ['chf', 'swiss franc']
  };

  function normalizeUnit(u) {
    return String(u).trim().replace(/\s+/g, ' ').replace(/\bdeg\b/i, 'deg').toLowerCase();
  }

  function resolveUnit(u, category) {
    if (!category) return null;
    const units = CATEGORIES[category].units;
    const key = Object.keys(units).find(k => k.toLowerCase() === u.toLowerCase());
    if (key) return key;
    // search alias index by canonical unit-key -> its alias list
    for (const [canonicalKey, aliases] of Object.entries(ALIASES)) {
      if (aliases.includes(u.toLowerCase())) {
        // confirm the canonical unit is in this category
        const found = Object.keys(units).find(k => k.toLowerCase() === canonicalKey.toLowerCase());
        if (found) return found;
      }
    }
    // try matching against unit friendly names
    for (const [k, v] of Object.entries(units)) {
      if (v.n.toLowerCase() === u.toLowerCase()) return k;
    }
    return null;
  }

  function toBase(value, unitKey, category) {
    const u = CATEGORIES[category].units[unitKey];
    if (category === 'temperature') return temperatureToCelsius(value, unitKey);
    if (category === 'angle') return angleToDegrees(value, unitKey);
    return value * u.f;
  }

  function fromBase(base, unitKey, category) {
    const u = CATEGORIES[category].units[unitKey];
    if (category === 'temperature') return celsiusFrom(base, unitKey);
    if (category === 'angle') return degreesFrom(base, unitKey);
    return base / u.f;
  }

  function temperatureToCelsius(v, unit) {
    if (unit === 'K') return v - 273.15;
    if (unit === '°C' || unit === 'C') return v;
    if (unit === '°F' || unit === 'F') return (v - 32) * 5 / 9;
    throw new Error('Unknown temperature unit');
  }

  function celsiusFrom(v, unit) {
    if (unit === 'K') return v + 273.15;
    if (unit === '°C' || unit === 'C') return v;
    if (unit === '°F' || unit === 'F') return v * 9 / 5 + 32;
    throw new Error('Unknown temperature unit');
  }

  function angleToDegrees(v, unit) {
    if (unit === 'deg') return v;
    if (unit === 'rad') return v * 180 / Math.PI;
    if (unit === 'grad') return v * 0.9;
    if (unit === 'turn') return v * 360;
    if (unit === 'arcmin') return v / 60;
    if (unit === 'arcsec') return v / 3600;
    throw new Error('Unknown angle unit');
  }

  function degreesFrom(v, unit) {
    if (unit === 'deg') return v;
    if (unit === 'rad') return v * Math.PI / 180;
    if (unit === 'grad') return v / 0.9;
    if (unit === 'turn') return v / 360;
    if (unit === 'arcmin') return v * 60;
    if (unit === 'arcsec') return v * 3600;
    throw new Error('Unknown angle unit');
  }

  function formatNumber(v, maxSig = 6) {
    if (!isFinite(v)) return String(v);
    if (v === 0) return '0';
    const abs = Math.abs(v);
    let out;
    if (abs >= 1e12 || abs < 1e-6) {
      out = v.toExponential(maxSig - 1);
    } else {
      out = String(parseFloat(v.toPrecision(maxSig)));
    }
    return out;
  }

  /* ---- convert ---- */

  function convert(value, from, to, category) {
    const cat = category || findCategory(from, to);
    if (!cat) return { ok: false, error: 'Could not identify a matching category for ' + from + ' → ' + to };
    const fromKey = resolveUnit(from, cat);
    const toKey = resolveUnit(to, cat);
    if (!fromKey) return { ok: false, error: 'Unknown source unit: ' + from };
    if (!toKey) return { ok: false, error: 'Unknown target unit: ' + to };
    let v = Number(value);
    if (!isFinite(v)) return { ok: false, error: 'Invalid value: ' + value };
    const base = toBase(v, fromKey, cat);
    const result = fromBase(base, toKey, cat);
    return {
      ok: true,
      value: v,
      from: { unit: fromKey, name: CATEGORIES[cat].units[fromKey].n },
      to: { unit: toKey, name: CATEGORIES[cat].units[toKey].n },
      result,
      base,
      resultText: formatNumber(result) + ' ' + toKey,
      category: cat,
      categoryName: CATEGORIES[cat].name
    };
  }

  function findCategory(a, b) {
    for (const cat of Object.keys(CATEGORIES)) {
      const ra = resolveUnit(a, cat);
      const rb = resolveUnit(b, cat);
      if (ra && rb) return cat;
    }
    return null;
  }

  function listCategories() {
    return Object.entries(CATEGORIES).map(([key, c]) => ({
      key, name: c.name, units: Object.entries(c.units).map(([u, d]) => ({ unit: u, name: d.n }))
    }));
  }

  function getCategory(key) {
    const c = CATEGORIES[key];
    if (!c) return null;
    return { key, name: c.name, units: Object.entries(c.units).map(([u, d]) => ({ unit: u, name: d.n })) };
  }

  function detect(input) {
    // Try to parse something like "5 km to miles" or "100 lb = kg"
    const m = String(input).match(/^\s*(-?[\d.,]+)\s*([a-zA-Z°]+)\s*(?:to|in|into|->|→|=|=>)?\s*([a-zA-Z°]+)\s*$/i);
    if (!m) return null;
    const value = parseFloat(m[1].replace(/,/g, ''));
    const from = m[2];
    const to = m[3];
    const cat = findCategory(from, to);
    if (!cat) return null;
    return { value, from, to, category: cat };
  }

  return {
    convert,
    detect,
    findCategory,
    resolveUnit,
    listCategories,
    getCategory,
    formatNumber,
    ALIASES,
    CATEGORIES
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = UnitEngine;
