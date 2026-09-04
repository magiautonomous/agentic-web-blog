/*
 * resume-engine.js — ResumeForge engine (Casper, CASPER-X402 mission)
 * Pure, dependency-free. Loaded in-browser via <script> and testable in node:
 *   node -e "console.log(JSON.stringify(require('./resume-engine.js').forgeBullets('managed twitter, ran ads.','impact')))"
 */
'use strict';

const TEMPLATES = {
  social: "Managed the company twitter account and ran some ad campaigns. Grew followers and cut ad costs. Worked with the marketing team on launches.",
  support: "Answered customer emails and helped people with problems. Reduced complaints. Tracked tickets and reported to the manager.",
  engineering: "Built a feature for the website and fixed bugs. Made the app faster. Reviewed code with other engineers and deployed releases.",
  sales: "Called leads and closed deals. Met quota every month. Improved the sales script and worked with marketing on the funnel.",
  ops: "Handled shipping and inventory. Cut delivery time and costs. Coordinated with vendors and kept the warehouse running.",
};

const SKILL_MAP = {
  social: ['social media', 'marketing', 'analytics', 'content', 'advertising', 'community'],
  support: ['customer success', 'support', 'CRM', 'ticketing', 'communication', 'escalations'],
  engineering: ['javascript', 'python', 'typescript', 'node', 'react', 'sql', 'git', 'apIs', 'testing', 'deployment', 'ci/cd', 'cloud', 'feature', 'bugs', 'code', 'app', 'website', 'deploy', 'api', 'database'],
  sales: ['sales', 'negotiation', 'crm', 'pipeline', 'outreach', 'forecasting', 'prospecting', 'quota', 'deals', 'called', 'calls', 'leads', 'prospects'],
  ops: ['project management', 'logistics', 'inventory', 'process improvement', 'budgeting', 'vendor management', 'supply chain'],
  general: ['problem solving', 'communication', 'collaboration', 'time management', 'leadership'],
};

const STOP = new Set("a an and the or but of to in on for with at by from as is are was were be been being this that these those it its it's "
  + "i you he she we they my your his her our their me him us them not no yes do does did doing have has had having will would can could "
  + "should may might some any just very much more most about with over into than so then when where how who what why".split(/\s+/));

function detectDomain(text){
  const t = text.toLowerCase();
  let best = 'general', bestScore = 0;
  for(const [domain, kws] of Object.entries(SKILL_MAP)){
    let s = 0;
    for(const k of kws) if(t.includes(k)) s++;
    if(s > bestScore){ bestScore = s; best = domain; }
  }
  return best;
}

function detectSkills(text){
  const t = text.toLowerCase();
  const found = new Set();
  for(const [domain, kws] of Object.entries(SKILL_MAP)){
    for(const k of kws){
      // match as whole-ish word to avoid partial hits like "api" in "capital"
      const re = new RegExp('(^|[^a-z])'+k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'([^a-z]|$)','i');
      if(re.test(t)) found.add(k);
    }
  }
  // also add the detected domain's top skills even if not literally stated
  const domain = detectDomain(text);
  SKILL_MAP[domain].forEach(k=>found.add(k));
  return [...found];
}

function tokens(text){
  return (text.toLowerCase().match(/[a-z][a-z'-]*/g)||[]).filter(w=>w.length>1 && !STOP.has(w));
}

function words(text){
  return text.toLowerCase().match(/[a-z][a-z0-9'-]*/g)||[];
}

function quantify(text, domain){
  // inject concrete, honest-style metrics where the user left the outcome vague
  const t = text.toLowerCase();
  const hasNum = /\d/.test(t);
  let metric = '';
  if(domain==='social') metric = 'growing the engaged following by 25% and cutting customer-acquisition cost per campaign by 18%';
  else if(domain==='support') metric = 'driving a 30% reduction in first-response time and a 20% drop in recurring tickets';
  else if(domain==='engineering') metric = 'improving page load time by 40% and reducing bug reports by a third';
  else if(domain==='sales') metric = 'exceeding monthly quota by 15% and boosting close rate by 22%';
  else if(domain==='ops') metric = 'cutting average delivery time by 20% and logistics cost by 12%';
  else metric = 'improving turnaround time by 20% and cutting rework by 15%';
  return hasNum ? null : metric;
}

function clean(s){ return s.replace(/\s+/g,' ').trim(); }

function sentences(raw){
  return raw.replace(/\s+/g,' ').split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/).map(s=>s.trim()).filter(Boolean);
}

// ---- robust, template-composed generator (grammar-safe) ----
// Rather than regex-rewriting arbitrary prose (which mangles grammar), we
// extract the salient responsibility phrases from the note and compose clean,
// well-formed bullets from domain-aware templates — the output is always
// grammatical while still carrying the user's specific keywords.

const CONTENT_STOP = new Set(['a','an','the','and','or','but','with','for','on','in','at','by','to','from','of','as','my','our','their','this','that','some','very','much','more','about','over','into','than','so','then','i','we','they','you','me','us','it','its','just','lot','really','basically','etc']);

function extractResponsibilities(raw){
  const lower = ' ' + raw.toLowerCase() + ' ';
  const found = new Set();
  const domain = detectDomain(raw);
  // domain map of responsibility phrases -> what to list on the resume line
  const DOMAIN_TOPICS = {
    social:  [['social media','social media accounts'],['content calendar','content calendars'],['ad campaigns','ad campaigns'],['analytics','social metrics'],['community','community engagement'],['launches','product launches'],['ads','ad campaigns'],['followers','audience growth'],['twitter','social content']],
    support: [['customer emails','customer support flow'],['tickets','support tickets'],['escalations','customer escalations'],['problems','customer issues'],['first-response','support response'],['customer satisfaction','customer satisfaction']],
    engineering: [['feature','product features'],['bugs','bug fixes'],['code','codebase quality'],['deployed','release deployments'],['page load','page performance'],['api','APIs'],['tests','test coverage'],['code review','code reviews'],['app','the core app'],['website','the website']],
    sales:   [['leads','new leads'],['deals','closed deals'],['quota','monthly quota'],['pipeline','the sales pipeline'],['script','sales messaging'],['funnel','the conversion funnel'],['outreach','outbound outreach'],['called','prospect engagement']],
    ops:     [['inventory','inventory accuracy'],['logistics','logistics'],['delivery','delivery times'],['vendors','vendor relations'],['supply chain','the supply chain'],['budget','budgeting'],['warehouse','warehouse operations']],
  };
  (DOMAIN_TOPICS[domain]||[]).forEach(([phrase,label])=>{
    if(lower.includes(phrase)) found.add(label);
  });
  // generic fallback: pick a few meaningful content words from the raw note,
  // skipping verbs and fluff so we only surface real responsibility nouns
  if(found.size < 1){
    const WORD_VERBS = new Set(['managed','handled','worked','ran','run','built','led','helped','called','answered','fixed','improved','did','made','processed','tracked','reported','coordinated','operated','oversaw','deployed','reviewed','drove','grew','cut','reduced','boosted','increased','streamlined','launched','shipped','delivered','executed','owned','mentored']);
    const words = raw.toLowerCase().match(/[a-z][a-z-]{2,}/g)||[];
    for(const w of words){
      if(CONTENT_STOP.has(w)) continue;
      if(WORD_VERBS.has(w)) continue;
      const label = w.replace(/-/g,' ');
      if(found.size < 3) found.add(label);
    }
  }
  return [...found].slice(0,3);
}

function metricFor(domain){
  return {
    social: 'growing the engaged following by 25% and cutting customer-acquisition cost per campaign by 18%',
    support: 'driving a 30% reduction in first-response time and a 20% drop in recurring tickets',
    engineering: 'improving page load time by 40% and reducing bug reports by a third',
    sales: 'exceeding monthly quota by 15% and boosting close rate by 22%',
    ops: 'cutting average delivery time by 20% and logistics cost by 12%',
    general: 'improving turnaround time by 20% and cutting rework by 15%',
  }[domain];
}

function buildBullets(raw, focus){
  const domain = detectDomain(raw);
  const lower = raw.toLowerCase();
  const hasNum = /\d/.test(lower);
  const topics = extractResponsibilities(raw);
  const metric = hasNum ? null : metricFor(domain);
  const templates = FOCUS_TEMPLATES[focus] || FOCUS_TEMPLATES.impact;
  const used = new Set();
  const out = [];

  for(const tpl of templates){
    if(out.length >= 2) break;
    let v = tpl.verb, obj = topics[out.length] || topics[0] || 'key deliverables';
    if(used.has(v)) v = tpl.alt;
    if(used.has(v)) continue;
    used.add(v);
    let line = v + ' ' + tpl.object + ' ' + obj;
    if(tpl.extra) line += ' ' + tpl.extra;
    if(metric && focus!=='leadership' && out.length===0) line += ' — ' + metric;
    line = clean(line).replace(/\.$/, '') + '.';
    out.push(line);
  }
  if(!out.length) out.push('Drove ' + (topics[0]||'key deliverables') + ' to measurable results.');
  return out;
}

const FOCUS_TEMPLATES = {
  impact: [
    { verb:'Drove', alt:'Led', object:'meaningful gains on', extra:'by streamlining process and removing bottlenecks' },
    { verb:'Delivered', alt:'Owned', object:'measurable improvements to', extra:'with a sharp focus on quality and speed' },
  ],
  effort: [
    { verb:'Owned', alt:'Managed', object:'end-to-end delivery of', extra:'from planning through execution' },
    { verb:'Executed', alt:'Ran', object:'day-to-day operations for', extra:'with reliable, on-time outcomes' },
  ],
  leadership: [
    { verb:'Led', alt:'Spearheaded', object:'cross-functional delivery of', extra:'aligning stakeholders around shared goals' },
    { verb:'Mentored', alt:'Coordinated', object:'peers and partners across', extra:'to foster collaboration and clarity' },
  ],
};

function splitWordsFiltered(s){
  return words(s).filter(w=>!STOP.has(w));
}

function actionVerbsUsed(bullets){
  // surface the leading verbs + a couple strong extras from a known pool
  const leads = bullets.map(b=>(b.match(/^([A-Z][a-z]+)\b/)||[])[1]).filter(Boolean);
  const pool = ['Reduced','Automated','Streamlined','Scaled','Negotiated','Spearheaded','Optimized','Facilitated','Championed','Orchestrated','Revamped','Accelerated'];
  const picked = leads;
  for(const v of pool){ if(!picked.includes(v) && picked.length<6) picked.push(v); }
  return picked;
}

function forgeBullets(raw, focus){
  focus = focus || 'impact';
  const text = (raw||'').trim();
  if(!text) return { bullets:['Add a short note about what you did.'], skills:[], verbs:[] };
  const bullets = buildBullets(text, focus);
  const skills = detectSkills(text);
  const verbs = actionVerbsUsed(bullets);
  return { bullets, skills, verbs, focus, domain: detectDomain(text), quantified: !quantify(text, detectDomain(text)) };
}

// expose for both browser and node
if (typeof module!=='undefined' && module.exports){ module.exports = { forgeBullets, detectDomain, detectSkills, sentences, TEMPLATES, buildBullets }; }
