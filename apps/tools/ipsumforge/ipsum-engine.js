/*
 * ipsum-engine.js — lorem ipsum / filler text generator (IpsumForge)
 * ---------------------------------------------------------
 * Pure, dependency-free. Generates classic Lorem Ipsum or themed filler
 * text (tech, startup, nature, cyber) with configurable paragraph/word/
 * sentence counts. Exported for browser + node.
 */
'use strict';

const IpsumEngine = (() => {
  'use strict';

  const CLASSIC = [
    'lorem','ipsum','dolor','sit','amet','consectetur','adipiscing','elit','sed','do',
    'eiusmod','tempor','incididunt','ut','labore','et','dolore','magna','aliqua','enim',
    'ad','minim','veniam','quis','nostrud','exercitation','ullamco','laboris','nisi',
    'aliquip','ex','ea','commodo','consequat','duis','aute','irure','in','reprehenderit',
    'voluptate','velit','esse','cillum','fugiat','nulla','pariatur','excepteur','sint',
    'occaecat','cupidatat','non','proident','sunt','culpa','qui','officia','deserunt',
    'mollit','anim','id','est','laborum',
  ];

  const THEMES = {
    tech: [
      'cloud','server','pipeline','deploy','container','monitor','queue','cache',
      'endpoint','module','payload','latency','bandwidth','throughput','replica',
      'shard','index','schema','migration','rollback','provision','orchestrate',
      'instrument','aggregate','debounce','serialize','compress','encrypt','authenticate',
      'scalable','resilient','idempotent','stateless','asynchronous','distributed',
      'observable','redundant','fault','tolerant','zero','downtime','continuous','delivery',
      'backpressure','timeseries','websocket','microservice','ingress','egress','etl',
    ],
    startup: [
      'disrupt','scale','pivot','moat','leverage','synergy','velocity','roadmap',
      'product','market','fit','growth','hack','metric','acquisition','retention',
      'activation','churn','funnel','conversion','onboarding','unit','economics',
      'venture','capital','angel','round','valuation','burn','rate','runway','go','to',
      'market','bootstrap','freemium','revenue','recurring','daily','active','users',
      'net','promoter','score','sprint','mvp','iterative','founder','vision','mission',
      'traction','momentum','team','culture','hockey','stick','forgone','outcome',
    ],
    nature: [
      'forest','river','mountain','ocean','meadow','valley','ridge','canyon','cliff',
      'stream','brook','spring','waterfall','glacier','tundra','savanna','desert','oasis',
      'prairie','woodland','marsh','bog','dell','grove','thicket','hollow','summit',
      'peak','foothill','pelican','osprey','heron','kingfisher','badger','otter','lynx',
      'violet','heather','poppy','clover','thistle','sedge','rush','lichen','moss',
      'gneiss','basalt','granite','quartz','amber','feldspar','driftwood','sediment',
      'moraine','escarpment','hedgerow','meander','eddy','rapids','runnel','dew','mist',
    ],
    cyber: [
      'zero','day','exploit','payload','backdoor','rootkit','botnet','phishing',
      'ransomware','malware','worm','trojan','sploit','firewall','intrusion','detection',
      'sandbox','honeypot','encrypt','cipher','cryptograph','keypair','nonce','hashmap',
      'checksum','signature','token','credential','oath','shard','breach','audit','log',
      'forensic','incident','response','threat','intel','vulnerability','patch','hardening',
      'pivot','lateral','movement','exfiltrate','c2','channel','obfuscate','tor','vpn',
      'tunnel','probe','scan','footprint','implant','beacon','dgaf','duration','sniff',
    ],
  };

  const CLASSIC_SENTENCES = [
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
    'Duis aute irure dolor in reprehenderit in voluptate velit esse.',
    'Excepteur sint occaecat cupidatat non proident sunt culpa qui officia.',
  ];

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function classicWord() {
    return pick(CLASSIC);
  }

  function sentenceFromWords(words, minWords, maxWords) {
    const n = minWords + Math.floor(Math.random() * (maxWords - minWords + 1));
    const parts = [];
    for (let i = 0; i < n; i++) parts.push(pick(words));
    return capitalize(parts.join(' ')) + '.';
  }

  // Generate a "lorem ipsum" style sentence (classic words)
  function classicSentence(minWords, maxWords) {
    return sentenceFromWords(CLASSIC, minWords, maxWords);
  }

  // Generate a themed sentence
  function themedSentence(theme, minWords, maxWords) {
    const words = THEMES[theme] ? THEMES[theme] : THEMES.tech;
    return sentenceFromWords(words, minWords, maxWords);
  }

  function paragraph(sentences, options) {
    const opts = options || {};
    const theme = opts.theme && THEMES[opts.theme] ? opts.theme : null;
    const minWords = opts.minWords || opts.minWords === 0 ? opts.minWords : 5;
    const maxWords = opts.maxWords || opts.maxWords === 0 ? opts.maxWords : 10;
    const list = [];
    for (let i = 0; i < sentences; i++) {
      list.push(theme ? themedSentence(theme, minWords, maxWords) : classicSentence(minWords, maxWords));
    }
    return list.join(' ');
  }

  function generate(opts) {
    opts = opts || {};
    const paragraphs = Math.max(1, Math.min(20, Number(opts.paragraphs) || 1));
    const sentences = Math.max(1, Math.min(10, Number(opts.sentences) || 5));
    const theme = opts.theme && THEMES[opts.theme] ? opts.theme : null;
    const minWords = Number(opts.minWords) >= 1 ? Number(opts.minWords) : 5;
    const maxWords = Number(opts.maxWords) > minWords ? Number(opts.maxWords) : minWords + 5;
    const body = [];
    for (let p = 0; p < paragraphs; p++) {
      body.push(paragraph(sentences, { theme, minWords, maxWords }));
    }
    return { theme: theme || 'classic', paragraphs: body };
  }

  function wordCount() {
    return {
      classic: CLASSIC.length,
      tech: THEMES.tech.length,
      startup: THEMES.startup.length,
      nature: THEMES.nature.length,
      cyber: THEMES.cyber.length,
    };
  }

  return { THEMES, generate, classicSentence, themedSentence, paragraph, wordCount, capitalize };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = IpsumEngine;
