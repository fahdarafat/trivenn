/* Trivenn — game client. No backend, no build deps; state lives in localStorage. */
'use strict';
(function () {
  // ---------- constants ----------
  const MAX_GUESSES = 6;
  const OBFUSCATION_SEED = 0x5eedba5e;
  const SHARE_URL = 'fahdarafat.github.io/trivenn';
  const STATE_KEY = 'trivenn.state.v1';
  const STATS_KEY = 'trivenn.stats.v1';
  const CATS = ['MAP', 'FLAG', 'NAME', 'SOCIETY', 'SPORT'];
  const CAT_LABELS = { MAP: 'Map', FLAG: 'Flags', NAME: 'Names', SOCIETY: 'Society', SPORT: 'Sport' };
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LAMP_STAGGER = REDUCED ? 0 : 300;

  const COUNTRIES = window.TRIVENN_COUNTRIES;
  const PUZZLES = window.TRIVENN_PUZZLES;
  const byId = new Map(COUNTRIES.map((c, i) => [c.id, { ...c, idx: i }]));

  // ---------- daily seeding ----------
  function startOfLocalDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
  function todayIndex() {
    const epoch = new Date(PUZZLES.epoch + 'T00:00:00');
    return Math.round((startOfLocalDay(new Date()) - startOfLocalDay(epoch)) / 86400000);
  }

  // ---------- puzzle decoding ----------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function decodePuzzle(dayIdx) {
    const wrapped = dayIdx % PUZZLES.days.length; // far-future fallback, mirrors the build plan
    const bytes = b64ToBytes(PUZZLES.days[wrapped]);
    const rng = mulberry32(OBFUSCATION_SEED ^ wrapped);
    const plain = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) plain[i] = bytes[i] ^ Math.floor(rng() * 256);
    const rec = JSON.parse(new TextDecoder().decode(plain));
    rec.rules = rec.ruleIdx.map(i => PUZZLES.preds[i]);
    rec.lampBytes = b64ToBytes(rec.lamps);
    return rec;
  }
  function lampsFor(rec, countryId) {
    const idx = byId.get(countryId).idx;
    const out = [];
    for (let b = 0; b < 3; b++) {
      const bit = idx * 3 + b;
      out.push((rec.lampBytes[bit >> 3] >> (bit & 7)) & 1);
    }
    return out;
  }

  // ---------- storage ----------
  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
  }
  function saveJSON(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
  function freshStats() {
    return {
      played: 0, wins: 0, currentStreak: 0, maxStreak: 0, lastCompletedN: 0,
      dist: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, L: 0 },
      cat: Object.fromEntries(CATS.map(c => [c, { appeared: 0, won: 0, guessSum: 0 }])),
    };
  }

  // ---------- game state ----------
  let state;           // {n, guesses:[], finished, won}
  let stats = loadJSON(STATS_KEY, freshStats());
  let puzzle;          // decoded record for state's day
  let animating = false;
  let acItems = [];    // current autocomplete results
  let acActive = -1;

  function initState() {
    const tIdx = todayIndex();
    if (tIdx < 0) { showComingSoon(); return false; }
    const saved = loadJSON(STATE_KEY, null);
    if (saved && !saved.finished && saved.guesses.length > 0) {
      state = saved; // finish the puzzle you started, even past midnight
    } else if (saved && saved.n === tIdx + 1) {
      state = saved; // today's, possibly finished
    } else {
      state = { n: tIdx + 1, guesses: [], finished: false, won: false };
      saveJSON(STATE_KEY, state);
    }
    puzzle = decodePuzzle(state.n - 1);
    return true;
  }
  function showComingSoon() {
    document.getElementById('game').innerHTML =
      '<div style="margin:auto;text-align:center;color:var(--muted)"><div style="font-size:40px">🌍</div><p>Trivenn launches soon.</p></div>';
  }

  // ---------- dom ----------
  const $ = id => document.getElementById(id);
  const rowsEl = $('rows'), pipsEl = $('pips'), inputEl = $('guessInput'),
    probeBtn = $('btnProbe'), acList = $('acList'), srLive = $('srLive');

  function track(name, props) {
    try { if (window.posthog) window.posthog.capture(name, props); } catch { /* analytics must never break the game */ }
  }

  function toast(msg, ms = 1800) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.hidden = true; }, ms);
  }

  // ---------- flag rendering (Windows desktop shows letter pairs, not emoji flags) ----------
  const FLAGS_OK = (() => {
    try {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 20;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.font = '16px sans-serif';
      ctx.fillText('🇯🇵', 0, 16);
      const d = ctx.getImageData(0, 0, 20, 20).data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] > 0 && (d[i] !== d[i + 1] || d[i + 1] !== d[i + 2])) return true;
      }
      return false;
    } catch { return true; }
  })();
  function flagHTML(c) {
    if (FLAGS_OK) return `<span class="flag">${c.flag}</span>`;
    return `<img class="flag fimg" src="https://flagcdn.com/40x30/${c.a2}.png" alt="" loading="lazy">`;
  }
  function flagSVG(c, x, y, size) {
    if (FLAGS_OK) return `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}">${c.flag}</text>`;
    const w = Math.round(size * 1.35), h = size;
    return `<image href="https://flagcdn.com/40x30/${c.a2}.png" x="${x - w / 2}" y="${y - h + 2}" width="${w}" height="${h}"/>`;
  }

  // ---------- text helpers ----------
  function norm(s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, '').trim();
  }
  function resolveCountry(text) {
    const q = norm(text);
    if (!q) return null;
    for (const c of COUNTRIES) {
      if (norm(c.name) === q) return c;
      for (const a of c.aliases) if (norm(a) === q) return c;
    }
    return null;
  }
  function searchCountries(text) {
    const q = norm(text);
    if (!q) return [];
    const starts = [], includes = [];
    for (const c of COUNTRIES) {
      const names = [c.name, ...c.aliases];
      if (names.some(n => norm(n).startsWith(q))) starts.push(c);
      else if (names.some(n => norm(n).includes(q))) includes.push(c);
    }
    return [...starts, ...includes].slice(0, 5);
  }

  // ---------- rendering ----------
  function renderPips() {
    pipsEl.innerHTML = '';
    for (let i = 0; i < MAX_GUESSES; i++) {
      const d = document.createElement('div');
      d.className = 'pip' + (i < state.guesses.length ? ' used' : '');
      pipsEl.appendChild(d);
    }
  }
  function buildRow(countryId, lamps, isWin, animate) {
    const c = byId.get(countryId);
    const li = document.createElement('li');
    li.className = 'row';
    const lampHtml = lamps.map((lit, i) =>
      `<div class="lamp ${animate ? 'flip' : ''} ${lit ? (isWin ? 'lit-' + i + ' win' : 'lit-' + i) : ''}">${lit ? '✓' : ''}</div>`
    ).join('');
    li.innerHTML = `${flagHTML(c)}<span class="cname">${c.name}</span><div class="lamps">${lampHtml}</div>`;
    if (isWin) li.classList.add('win-row');
    return li;
  }
  function renderRows() {
    rowsEl.innerHTML = '';
    rowsEl.classList.toggle('compact', state.guesses.length > 4);
    if (state.guesses.length === 0 && !state.finished) {
      rowsEl.innerHTML =
        `<li class="empty-state">
          <p><b>Today's three rules are secret.</b> Exactly one country on Earth fits all of them.</p>
          <p>Probe any country below — each lamp that lights up
            (<span class="dot d-a"></span> <span class="dot d-b"></span> <span class="dot d-c"></span>)
            means it satisfies one of the hidden rules.</p>
          <p>Work out the rules from the pattern. Find the country. <b>6 probes.</b></p>
        </li>`;
      return;
    }
    state.guesses.forEach(id => {
      const lamps = lampsFor(puzzle, id);
      rowsEl.appendChild(buildRow(id, lamps, id === puzzle.center, false));
    });
  }
  function renderStreakChip() {
    const chip = $('streakChip');
    if (stats.currentStreak >= 1) {
      chip.textContent = '🔥' + stats.currentStreak;
      chip.hidden = false;
    } else chip.hidden = true;
  }
  function renderHint() {
    // the pre-game explainer lives in the empty state; this chip nudges new
    // players while their first rows come in
    $('hintChip').hidden = !(stats.played === 0 && state.guesses.length >= 1 && state.guesses.length < 3 && !state.finished);
  }
  function pulseRings(lamps) {
    ['ringA', 'ringB', 'ringC'].forEach((id, i) => {
      const r = $(id);
      r.classList.toggle('pulse', !!lamps[i]);
    });
  }
  function renderAll() {
    renderRows(); renderPips(); renderStreakChip(); renderHint();
    if (state.guesses.length) pulseRings(lampsFor(puzzle, state.guesses[state.guesses.length - 1]));
    if (state.finished) {
      inputEl.disabled = true; probeBtn.disabled = true;
      markWinRings(state.won);
    }
  }
  function markWinRings(won) {
    if (!won) return;
    ['ringA', 'ringB', 'ringC'].forEach(id => $(id).classList.add('won'));
    const vc = $('vennCenter');
    if (FLAGS_OK) {
      vc.textContent = byId.get(puzzle.center).flag;
      vc.setAttribute('opacity', '1');
    } else {
      $('vennSvg').insertAdjacentHTML('beforeend', flagSVG(byId.get(puzzle.center), 180, 86, 22));
    }
  }

  // ---------- autocomplete ----------
  function renderAc() {
    if (!acItems.length) { acList.hidden = true; inputEl.setAttribute('aria-expanded', 'false'); return; }
    acList.innerHTML = '';
    acItems.forEach((c, i) => {
      const li = document.createElement('li');
      li.className = 'ac-item' + (i === acActive ? ' active' : '');
      li.setAttribute('role', 'option');
      li.innerHTML = `${flagHTML(c)}<span>${c.name}</span>`;
      li.addEventListener('pointerdown', e => { e.preventDefault(); pickCountry(c); });
      acList.appendChild(li);
    });
    acList.hidden = false;
    inputEl.setAttribute('aria-expanded', 'true');
  }
  function pickCountry(c) {
    inputEl.value = c.name;
    acItems = []; acActive = -1; renderAc();
    probeBtn.disabled = !resolveCountry(inputEl.value) || state.finished || animating;
    inputEl.focus();
  }
  inputEl.addEventListener('input', () => {
    acItems = searchCountries(inputEl.value);
    acActive = -1;
    renderAc();
    probeBtn.disabled = !resolveCountry(inputEl.value) || state.finished || animating;
  });
  inputEl.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' && acItems.length) { acActive = (acActive + 1) % acItems.length; renderAc(); e.preventDefault(); }
    else if (e.key === 'ArrowUp' && acItems.length) { acActive = (acActive - 1 + acItems.length) % acItems.length; renderAc(); e.preventDefault(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (acActive >= 0) pickCountry(acItems[acActive]);
      else if (resolveCountry(inputEl.value)) probe();
      else if (acItems.length === 1) pickCountry(acItems[0]);
    } else if (e.key === 'Escape') { acItems = []; renderAc(); }
  });
  document.addEventListener('pointerdown', e => {
    if (!acList.contains(e.target) && e.target !== inputEl) { acItems = []; renderAc(); }
  });
  probeBtn.addEventListener('click', probe);

  // ---------- probe flow ----------
  function probe() {
    if (state.finished || animating) return;
    const c = resolveCountry(inputEl.value);
    if (!c) return;
    if (state.guesses.includes(c.id)) { toast('Already probed'); return; }

    state.guesses.push(c.id);
    saveJSON(STATE_KEY, state);
    if (state.guesses.length === 1) track('trivenn_game_started', { puzzle: state.n, diff: puzzle.diff });
    inputEl.value = ''; acItems = []; renderAc(); probeBtn.disabled = true;

    const lamps = lampsFor(puzzle, c.id);
    const isWin = c.id === puzzle.center;
    const lit = lamps.reduce((a, b) => a + b, 0);

    animating = true;
    rowsEl.classList.toggle('compact', state.guesses.length > 4);
    const row = buildRow(c.id, lamps, isWin, true);
    rowsEl.appendChild(row);
    renderPips(); renderHint();

    const lampEls = row.querySelectorAll('.lamp');
    lampEls.forEach((el, i) => setTimeout(() => el.classList.remove('flip'), 150 + i * LAMP_STAGGER));
    const animDone = 150 + 3 * LAMP_STAGGER + 100;

    const ruleNames = ['A', 'B', 'C'];
    srLive.textContent = `${c.name}: ` + lamps.map((l, i) => `rule ${ruleNames[i]} ${l ? 'yes' : 'no'}`).join(', ');

    setTimeout(() => {
      pulseRings(lamps);
      animating = false;
      probeBtn.disabled = !resolveCountry(inputEl.value);
      if (isWin) { finish(true); return; }
      if (state.guesses.length >= MAX_GUESSES) { finish(false); return; }
      if (lit === 2) row.classList.add('near-miss');
      if (lit === 0) toast('Stone cold — not a single ring', 1600);
    }, animDone);
  }

  function finish(won) {
    state.finished = true; state.won = won;
    saveJSON(STATE_KEY, state);
    updateStats(won);
    track('trivenn_game_finished', {
      puzzle: state.n, won, guesses: state.guesses.length,
      diff: puzzle.diff, streak: stats.currentStreak,
    });
    inputEl.disabled = true; probeBtn.disabled = true;
    if (won) {
      markWinRings(true);
      confetti();
      setTimeout(openDecoder, REDUCED ? 300 : 1200);
    } else {
      setTimeout(openDecoder, REDUCED ? 300 : 900);
    }
    renderStreakChip();
  }

  function updateStats(won) {
    stats.played++;
    if (won) {
      stats.wins++;
      stats.currentStreak = (stats.lastCompletedN === state.n - 1 || stats.played === 1) ? stats.currentStreak + 1 : 1;
      stats.dist[state.guesses.length]++;
    } else {
      stats.currentStreak = 0;
      stats.dist.L++;
    }
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
    stats.lastCompletedN = state.n;
    const cats = new Set(puzzle.rules.map(r => r.cat));
    for (const cat of cats) {
      if (!stats.cat[cat]) stats.cat[cat] = { appeared: 0, won: 0, guessSum: 0 };
      stats.cat[cat].appeared++;
      if (won) { stats.cat[cat].won++; stats.cat[cat].guessSum += state.guesses.length; }
    }
    saveJSON(STATS_KEY, stats);
  }

  // ---------- confetti ----------
  function confetti() {
    if (REDUCED) return;
    const host = $('confetti');
    const glyphs = ['🟢', '✨', '🎉', '🟡', '🔵'];
    for (let i = 0; i < 70; i++) {
      const s = document.createElement('span');
      s.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
      s.style.left = Math.random() * 100 + 'vw';
      s.style.animationDuration = (1.2 + Math.random() * 1.4) + 's';
      s.style.animationDelay = (Math.random() * 0.4) + 's';
      s.style.fontSize = (12 + Math.random() * 14) + 'px';
      host.appendChild(s);
    }
    setTimeout(() => { host.innerHTML = ''; }, 3400);
  }

  // ---------- decoder ----------
  function openDecoder() {
    const dec = $('decoder');
    const center = byId.get(puzzle.center);
    $('heroFlag').innerHTML = FLAGS_OK ? center.flag
      : `<img class="fimg hero-fimg" src="https://flagcdn.com/160x120/${center.a2}.png" alt="">`;
    $('heroName').textContent = center.name;
    $('heroResult').textContent = `#${puzzle.n} · ${state.won ? state.guesses.length + '/6' : 'X/6'}`;

    const cards = $('ruleCards');
    cards.innerHTML = '';
    puzzle.rules.forEach((r, i) => {
      const litBy = state.guesses.filter(id => lampsFor(puzzle, id)[i])
        .map(id => FLAGS_OK ? byId.get(id).flag : flagHTML(byId.get(id)));
      const card = document.createElement('div');
      card.className = 'rule-card r' + i;
      card.innerHTML =
        `<div class="rule-name"><span>${r.name}</span><span class="rule-count">${r.count} countries</span></div>` +
        `<div class="rule-policy">${r.policy}</div>` +
        (litBy.length ? `<div class="rule-lit">Lit by: ${litBy.join(' ')}</div>` : '');
      cards.appendChild(card);
    });

    renderJourney();
    const factEl = $('factCard');
    if (puzzle.fact) { factEl.textContent = puzzle.fact; factEl.hidden = false; } else factEl.hidden = true;

    $('btnPlayToday').hidden = !(state.n - 1 < todayIndex());
    startCountdown();
    dec.hidden = false;
  }

  function renderJourney() {
    const svg = $('journeySvg');
    const cx = { a: [132, 96], b: [228, 96], c: [180, 152] }, r = 66;
    const ringColors = ['#f59e0b', '#38bdf8', '#c084fc'];
    let html = '<g fill="none" stroke-width="2.5" opacity="0.8">' +
      `<circle cx="${cx.a[0]}" cy="${cx.a[1]}" r="${r}" stroke="${ringColors[0]}"/>` +
      `<circle cx="${cx.b[0]}" cy="${cx.b[1]}" r="${r}" stroke="${ringColors[1]}"/>` +
      `<circle cx="${cx.c[0]}" cy="${cx.c[1]}" r="${r}" stroke="${ringColors[2]}"/></g>`;
    // rule labels
    const labels = puzzle.rules.map(r2 => r2.name.length > 24 ? r2.name.slice(0, 23) + '…' : r2.name);
    html += `<text x="60" y="16" text-anchor="middle" font-size="9" fill="${ringColors[0]}">${esc(labels[0])}</text>`;
    html += `<text x="300" y="16" text-anchor="middle" font-size="9" fill="${ringColors[1]}">${esc(labels[1])}</text>`;
    html += `<text x="180" y="234" text-anchor="middle" font-size="9" fill="${ringColors[2]}">${esc(labels[2])}</text>`;
    // region anchors for lamp patterns (bitmask a=1,b=2,c=4)
    const anchors = {
      0: [40, 210], 1: [100, 70], 2: [260, 70], 4: [180, 196],
      3: [180, 76], 5: [142, 138], 6: [218, 138], 7: [180, 118],
    };
    const used = {};
    state.guesses.forEach(id => {
      const l = lampsFor(puzzle, id);
      const mask = l[0] | (l[1] << 1) | (l[2] << 2);
      const [ax, ay] = anchors[mask];
      const k = used[mask] = (used[mask] || 0) + 1;
      const dx = ((k - 1) % 3 - 1) * 20, dy = Math.floor((k - 1) / 3) * 18;
      html += flagSVG(byId.get(id), ax + dx, ay + dy, 16);
    });
    if (state.won) html += `<circle cx="180" cy="118" r="14" fill="none" stroke="#34d399" stroke-width="2"/>`;
    svg.innerHTML = html;
  }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  // ---------- share ----------
  function shareText() {
    const head = `Trivenn #${puzzle.n} ${state.won ? state.guesses.length + '/6' : 'X/6'}`;
    const rows = state.guesses.map(id => {
      if (id === puzzle.center) return '🟢🟢🟢';
      return lampsFor(puzzle, id).map(l => (l ? '🟡' : '⚫')).join('');
    });
    const streak = stats.currentStreak >= 2 ? `🔥${stats.currentStreak} ` : '';
    return [head, ...rows, streak + SHARE_URL].join('\n');
  }
  $('btnShare').addEventListener('click', async () => {
    const text = shareText();
    track('trivenn_share_clicked', { puzzle: puzzle.n, won: state.won });
    // share sheet only on touch devices; desktop gets the clipboard
    if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ text }); return; } catch { /* fall through to clipboard */ }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied to clipboard');
    } catch {
      toast('Could not copy — select manually');
    }
  });

  // ---------- countdown / next puzzle ----------
  let cdTimer;
  function startCountdown() {
    clearInterval(cdTimer);
    const el = $('countdown');
    function tick() {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const ms = next - now;
      const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
      const m = String(Math.floor(ms / 60000) % 60).padStart(2, '0');
      const s = String(Math.floor(ms / 1000) % 60).padStart(2, '0');
      el.textContent = `Next Trivenn in ${h}:${m}:${s}`;
    }
    tick();
    cdTimer = setInterval(tick, 1000);
  }
  $('btnPlayToday').addEventListener('click', () => {
    const tIdx = todayIndex();
    state = { n: tIdx + 1, guesses: [], finished: false, won: false };
    saveJSON(STATE_KEY, state);
    puzzle = decodePuzzle(tIdx);
    $('decoder').hidden = true;
    clearInterval(cdTimer);
    inputEl.disabled = false;
    ['ringA', 'ringB', 'ringC'].forEach(id => { $(id).classList.remove('won', 'pulse'); });
    const vc = $('vennCenter'); vc.setAttribute('opacity', '0');
    renderAll();
  });

  // ---------- stats modal ----------
  function openStats() {
    const tiles = $('statTiles');
    const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
    tiles.innerHTML = [
      [stats.played, 'Played'], [winPct + '%', 'Win rate'],
      [stats.currentStreak, 'Streak'], [stats.maxStreak, 'Max streak'],
    ].map(([n, l]) => `<div class="stat-tile"><div class="stat-num">${n}</div><div class="stat-lbl">${l}</div></div>`).join('');

    const dist = $('distBars');
    const max = Math.max(1, ...Object.values(stats.dist));
    const todayKey = state && state.finished ? (state.won ? String(state.guesses.length) : 'L') : null;
    dist.innerHTML = ['1', '2', '3', '4', '5', '6', 'L'].map(k => {
      const v = stats.dist[k] || 0;
      const w = Math.max(8, Math.round((v / max) * 100));
      const cls = 'dist-bar' + (k === 'L' ? ' loss' : '') + (k === todayKey ? ' today' : '');
      return `<div class="dist-row"><div class="dist-key">${k}</div><div class="${cls}" style="width:${w}%">${v || ''}</div></div>`;
    }).join('');

    const prof = $('profileBars');
    const rows = CATS.map(c => {
      const s = stats.cat[c] || { appeared: 0, won: 0 };
      const pct = s.appeared ? Math.round((s.won / s.appeared) * 100) : null;
      return { c, pct, appeared: s.appeared };
    });
    prof.innerHTML = rows.map(r =>
      `<div class="prof-row"><div class="prof-key">${CAT_LABELS[r.c]}</div>` +
      `<div class="prof-track"><div class="prof-fill" style="width:${r.pct ?? 0}%"></div></div>` +
      `<div class="prof-pct">${r.pct === null ? '—' : r.pct + '%'}</div></div>`
    ).join('');
    const qualified = rows.filter(r => r.appeared >= 3 && r.pct !== null);
    const line = $('profileLine');
    if (qualified.length >= 2) {
      const best = qualified.reduce((a, b) => (b.pct > a.pct ? b : a));
      const worst = qualified.reduce((a, b) => (b.pct < a.pct ? b : a));
      line.textContent = best.c !== worst.c ? `Sharpest: ${CAT_LABELS[best.c]} · Blind spot: ${CAT_LABELS[worst.c]}` : '';
    } else line.textContent = 'Play more days to reveal your detective profile.';
    $('statsModal').hidden = false;
  }
  $('btnStats').addEventListener('click', openStats);
  $('btnDecoderStats').addEventListener('click', openStats);

  // ---------- help ----------
  function openHelp() { $('helpOverlay').hidden = false; }
  $('btnHelp').addEventListener('click', openHelp);
  $('btnHelpPlay').addEventListener('click', () => { $('helpOverlay').hidden = true; inputEl.focus(); });
  document.querySelectorAll('[data-close]').forEach(b =>
    b.addEventListener('click', () => { b.closest('.modal').hidden = true; }));
  document.querySelectorAll('.modal').forEach(m =>
    m.addEventListener('pointerdown', e => { if (e.target === m) m.hidden = true; }));

  // ---------- boot ----------
  if (initState()) {
    renderAll();
    if (stats.played === 0 && state.guesses.length === 0) openHelp();
    if (state.finished) openDecoder();
  }
})();
