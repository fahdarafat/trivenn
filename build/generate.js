// Trivenn build pipeline.
// Reads data/countries.js + data/predicates.js (+ data/flags*.js when present),
// derives the name-based predicates, validates every roster, enumerates all
// rule triples whose intersection over the 197-country canon is EXACTLY one
// country, scores difficulty/spice, schedules 730+ days, and emits the static
// site data (site/countries.js, site/puzzles.js).
//
// The build FAILS LOUDLY on any data inconsistency: this is the layer that
// guarantees "exactly one country fits all three rules" is always true.
'use strict';
const fs = require('fs');
const path = require('path');
const { COUNTRIES } = require('../data/countries');
const { PREDICATES } = require('../data/predicates');

const EPOCH = '2026-06-10'; // puzzle #1 = this local date
const DAYS_TO_SCHEDULE = 730;
const OBFUSCATION_SEED = 0x5eedba5e;

// ---------- helpers ----------
function fail(msg) { console.error('BUILD FAILED: ' + msg); process.exit(1); }
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function flagEmoji(a2) {
  return String.fromCodePoint(...[...a2.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65));
}
function normalizeName(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
function lettersOnly(s) { return normalizeName(s).replace(/[^a-z]/g, ''); }

// ---------- canon checks ----------
const byId = new Map();
for (const c of COUNTRIES) {
  if (byId.has(c.id)) fail('duplicate country id ' + c.id);
  byId.set(c.id, c);
}
if (COUNTRIES.length !== 197) fail('canon must have 197 countries, has ' + COUNTRIES.length);
const a2seen = new Set();
for (const c of COUNTRIES) {
  if (!/^[A-Z]{2}$/.test(c.a2)) fail('bad a2 for ' + c.id);
  if (a2seen.has(c.a2)) fail('duplicate a2 ' + c.a2);
  a2seen.add(c.a2);
}

// ---------- assemble predicates (incl. agent-authored flag files) ----------
const allPreds = [...PREDICATES];
for (const f of ['flags1.js', 'flags2.js', 'flags3.js']) {
  const p = path.join(__dirname, '..', 'data', f);
  if (fs.existsSync(p)) {
    const mod = require(p);
    const arr = mod[Object.keys(mod)[0]];
    allPreds.push(...arr);
  } else {
    console.warn('WARNING: missing ' + f + ' (flag predicates not yet authored) â€” building without it');
  }
}

// ---------- derivations ----------
function derivedMembers(pred) {
  const d = pred.derive;
  if (d.startsWith('region:')) {
    const r = d.slice(7);
    return COUNTRIES.filter(c => c.region === r).map(c => c.id);
  }
  if (d.startsWith('name-contains:')) {
    const sub = d.slice('name-contains:'.length);
    return COUNTRIES.filter(c => lettersOnly(c.name).includes(sub)).map(c => c.id);
  }
  if (d.startsWith('name-ends:')) {
    const suf = d.slice('name-ends:'.length);
    return COUNTRIES.filter(c => lettersOnly(c.name).endsWith(suf)).map(c => c.id);
  }
  if (d.startsWith('name-short:')) {
    const n = parseInt(d.slice('name-short:'.length), 10);
    return COUNTRIES.filter(c => lettersOnly(c.name).length <= n).map(c => c.id);
  }
  if (d === 'name-double') {
    return COUNTRIES.filter(c =>
      normalizeName(c.name).split(/[^a-z]+/).some(w => /(.)\1/.test(w))
    ).map(c => c.id);
  }
  if (d === 'cap-same-letter') {
    return COUNTRIES.filter(c => lettersOnly(c.capital)[0] === lettersOnly(c.name)[0]).map(c => c.id);
  }
  if (d === 'name-same-letter') {
    return COUNTRIES.filter(c => {
      const l = lettersOnly(c.name);
      return l.length > 1 && l[0] === l[l.length - 1];
    }).map(c => c.id);
  }
  if (d === 'cap-shares') {
    // whole-word containment in either direction, accent-insensitive
    const wordsOf = s => normalizeName(s).split(/[^a-z]+/).filter(Boolean);
    const containsAsWords = (haystack, needle) => {
      const h = wordsOf(haystack), n = wordsOf(needle);
      if (n.length === 0 || n.length > h.length) return false;
      for (let i = 0; i + n.length <= h.length; i++) {
        if (n.every((w, j) => h[i + j] === w)) return true;
      }
      return false;
    };
    return COUNTRIES.filter(c =>
      containsAsWords(c.capital, c.name) || containsAsWords(c.name, c.capital)
    ).map(c => c.id);
  }
  fail('unknown derive ' + d);
}

const preds = [];
for (const p of allPreds) {
  const members = p.derive ? derivedMembers(p) : p.members;
  const set = new Set();
  for (const id of members) {
    if (!byId.has(id)) fail(`predicate ${p.key}: unknown country id ${id}`);
    if (set.has(id)) fail(`predicate ${p.key}: duplicate member ${id}`);
    set.add(id);
  }
  if (p.expect > 0 && set.size !== p.expect) {
    fail(`predicate ${p.key}: expected ${p.expect} members, got ${set.size}` +
      (p.derive ? ` (derived: ${[...set].join(',')})` : ''));
  }
  if (set.size < 7 || set.size > 60) {
    fail(`predicate ${p.key}: size ${set.size} outside sane range 7..60`);
  }
  preds.push({ ...p, set, size: set.size });
}
const keySeen = new Set();
for (const p of preds) {
  if (keySeen.has(p.key)) fail('duplicate predicate key ' + p.key);
  keySeen.add(p.key);
}
console.log(`predicates: ${preds.length} (${preds.filter(p => p.tier === 'expert').length} expert)`);
for (const p of preds) console.log(`  ${p.key.padEnd(12)} ${String(p.size).padStart(3)}  ${p.tier.padEnd(6)} ${p.category}`);

// ---------- enumerate valid triples ----------
const ids = COUNTRIES.map(c => c.id);
const candidates = [];
for (let i = 0; i < preds.length; i++) {
  for (let j = i + 1; j < preds.length; j++) {
    const ab = intersect(preds[i].set, preds[j].set);
    if (ab.length < 2 || ab.length > 24) continue;
    for (let k = j + 1; k < preds.length; k++) {
      const A = preds[i], B = preds[j], C = preds[k];
      const expertCount = [A, B, C].filter(p => p.tier === 'expert').length;
      if (expertCount > 1) continue;
      const cats = new Set([A.category, B.category, C.category]);
      if (cats.size < 2) continue;
      const bc = intersect(B.set, C.set);
      if (bc.length < 2 || bc.length > 24) continue;
      const ac = intersect(A.set, C.set);
      if (ac.length < 2 || ac.length > 24) continue;
      const abc = ab.filter(id => C.set.has(id));
      if (abc.length !== 1) continue;
      const center = abc[0];
      // spice: countries satisfying exactly two of the three rules
      const twoLamp = new Set([...ab, ...bc, ...ac]);
      twoLamp.delete(center);
      const spice = [...twoLamp].filter(id =>
        (A.set.has(id) ? 1 : 0) + (B.set.has(id) ? 1 : 0) + (C.set.has(id) ? 1 : 0) === 2
      ).length;
      if (spice < 4 || spice > 28) continue;
      const centerTier = byId.get(center).tier;
      const minSize = Math.min(A.size, B.size, C.size);
      // difficulty 1 (gentle) .. 4 (brutal)
      let score = expertCount * 2 + (centerTier - 1) + (spice < 8 ? 1 : 0) + (minSize < 10 ? 1 : 0);
      const diff = Math.max(1, Math.min(4, 1 + score));
      candidates.push({ a: i, b: j, c: k, center, spice, diff, expertCount, centerTier });
    }
  }
}
function intersect(s1, s2) {
  const out = [];
  for (const id of s1) if (s2.has(id)) out.push(id);
  return out;
}
console.log(`valid triples: ${candidates.length}`);
// A triple may repeat after TRIPLE_GAP days, so the pool can cover a longer
// schedule — but never fewer distinct triples than a full year.
const TRIPLE_GAP = 400;
if (candidates.length < 365) fail(`only ${candidates.length} valid triples; need at least 365 distinct`);
const diffHist = {};
for (const c of candidates) diffHist[c.diff] = (diffHist[c.diff] || 0) + 1;
console.log('difficulty histogram:', JSON.stringify(diffHist));

// ---------- schedule ----------
// EPOCH is a Wednesday (2026-06-10). Difficulty by weekday:
// Mon 1, Tue 1, Wed 2, Thu 2, Fri 3, Sat 4, Sun 2-3 wildcard.
const epochDate = new Date(EPOCH + 'T00:00:00');
const targetByDow = { 1: [1], 2: [1], 3: [2], 4: [2], 5: [3], 6: [4], 0: [2, 3] };
const rand = mulberry32(0xc0ffee);
const shuffled = [...candidates].sort(() => rand() - 0.5);

const schedule = [];
const centerLastUsed = new Map(); // center id -> day index
const predLastUsed = new Map(); // pred index -> day index
const tripleLastUsed = new Map(); // triple key -> day index
for (let day = 0; day < DAYS_TO_SCHEDULE; day++) {
  const dow = new Date(epochDate.getTime() + day * 86400000).getDay();
  const targets = targetByDow[dow];
  let pick = null;
  // progressively relaxed passes: [difficulty slack, center gap, predicate gap]
  for (const [relax, centerGap, predGap] of [[0, 60, 6], [1, 60, 6], [99, 60, 6], [99, 30, 4], [99, 14, 2]]) {
    let best = null, bestScore = -1;
    for (const cand of shuffled) {
      const tkey = `${cand.a},${cand.b},${cand.c}`;
      const tLast = tripleLastUsed.get(tkey);
      if (tLast !== undefined && day - tLast < TRIPLE_GAP) continue;
      const dOk = relax === 99 || targets.some(t => Math.abs(cand.diff - t) <= relax);
      if (!dOk) continue;
      // easy days need recognizable centers
      if (targets[0] <= 2 && relax === 0 && cand.centerTier === 3) continue;
      const cLast = centerLastUsed.get(cand.center);
      const centerAge = cLast === undefined ? Infinity : day - cLast;
      if (centerAge < centerGap) continue;
      const pOk = [cand.a, cand.b, cand.c].every(pi => {
        const last = predLastUsed.get(pi);
        return last === undefined || day - last >= predGap;
      });
      if (!pOk) continue;
      // prefer the center that has rested longest, to spread centers evenly
      if (centerAge > bestScore) { bestScore = centerAge; best = { cand, tkey }; }
      if (centerAge === Infinity) break;
    }
    if (best) { pick = best; break; }
  }
  if (!pick) fail(`could not schedule day ${day} - pool exhausted under constraints`);
  tripleLastUsed.set(pick.tkey, day);
  centerLastUsed.set(pick.cand.center, day);
  for (const pi of [pick.cand.a, pick.cand.b, pick.cand.c]) predLastUsed.set(pi, day);
  schedule.push(pick.cand);
}
console.log(`scheduled ${schedule.length} days`);

// ---------- facts ----------
let FACTS = {};
const factsPath = path.join(__dirname, '..', 'data', 'facts.js');
if (fs.existsSync(factsPath)) {
  FACTS = require(factsPath).FACTS;
  const missing = COUNTRIES.filter(c => !FACTS[c.id]);
  if (missing.length) console.warn('WARNING: missing facts for ' + missing.map(c => c.id).join(','));
} else {
  console.warn('WARNING: data/facts.js not present â€” shipping without fun facts');
}

// ---------- emit ----------
// per-day record: rules (name/policy/count), lamp table (197 x 3 bits in canon order),
// center id, difficulty, fact.
function lampBytes(cand) {
  const A = preds[cand.a].set, B = preds[cand.b].set, C = preds[cand.c].set;
  const bits = new Uint8Array(Math.ceil((197 * 3) / 8));
  COUNTRIES.forEach((c, idx) => {
    const v = (A.has(c.id) ? 1 : 0) | (B.has(c.id) ? 2 : 0) | (C.has(c.id) ? 4 : 0);
    for (let b = 0; b < 3; b++) {
      if (v & (1 << b)) {
        const bit = idx * 3 + b;
        bits[bit >> 3] |= 1 << (bit & 7);
      }
    }
  });
  return bits;
}
function xorObfuscate(bytes, n) {
  const rng = mulberry32(OBFUSCATION_SEED ^ n);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ Math.floor(rng() * 256);
  return out;
}
const dayRecords = schedule.map((cand, day) => {
  const rec = {
    n: day + 1,
    ruleIdx: [cand.a, cand.b, cand.c],
    lamps: Buffer.from(lampBytes(cand)).toString('base64'),
    center: cand.center,
    diff: cand.diff,
    fact: FACTS[cand.center] || '',
  };
  const plain = Buffer.from(JSON.stringify(rec), 'utf8');
  const obf = Buffer.from(xorObfuscate(plain, day)).toString('base64');
  // round-trip check
  const back = Buffer.from(xorObfuscate(Buffer.from(obf, 'base64'), day)).toString('utf8');
  if (back !== plain.toString('utf8')) fail('obfuscation round-trip failed for day ' + day);
  // uniqueness re-check from the emitted lamp table itself
  const lb = lampBytes(cand);
  let full = 0, centerHasAll = false;
  COUNTRIES.forEach((c, idx) => {
    let v = 0;
    for (let b = 0; b < 3; b++) {
      const bit = idx * 3 + b;
      if (lb[bit >> 3] & (1 << (bit & 7))) v |= 1 << b;
    }
    if (v === 7) { full++; if (c.id === cand.center) centerHasAll = true; }
  });
  if (full !== 1 || !centerHasAll) fail('uniqueness violated in emitted lamps, day ' + day);
  return obf;
});

const siteDir = path.join(__dirname, '..', 'site');
fs.mkdirSync(siteDir, { recursive: true });

const clientCountries = COUNTRIES.map(c => ({
  id: c.id, name: c.name, aliases: c.aliases, flag: flagEmoji(c.a2), a2: c.a2.toLowerCase(),
}));
fs.writeFileSync(path.join(siteDir, 'countries.js'),
  '// generated by build/generate.js â€” do not edit\n' +
  'window.TRIVENN_COUNTRIES = ' + JSON.stringify(clientCountries) + ';\n');

// the rule pool ships in cleartext - the daily secret is WHICH three apply,
// and that lives inside the obfuscated day records
const rulePool = preds.map(p => ({ name: p.name, policy: p.policy, count: p.size, cat: p.category }));
fs.writeFileSync(path.join(siteDir, 'puzzles.js'),
  '// generated by build/generate.js - do not edit\n' +
  'window.TRIVENN_PUZZLES = ' + JSON.stringify({ epoch: EPOCH, preds: rulePool, days: dayRecords }) + ';\n');

const total = dayRecords.reduce((s, d) => s + d.length, 0);
console.log(`emitted site/puzzles.js (${(total / 1024).toFixed(0)}KB of day records) and site/countries.js`);
console.log('first 7 days:');
schedule.slice(0, 7).forEach((cand, day) => {
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(epochDate.getTime() + day * 86400000).getDay()];
  console.log(`  #${day + 1} ${dow} diff${cand.diff} spice${cand.spice} center=${cand.center}: ` +
    [cand.a, cand.b, cand.c].map(pi => preds[pi].name).join(' Â· '));
});

