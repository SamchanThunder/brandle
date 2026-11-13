// game flow + screens
(function () {
  'use strict';
  const B = window.Brandle, A = B.audio, scene = B.scene, store = B.store;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let todayNum = 1;
  let game = null; // current run

  // turns an emoji into a pixel icon
  function pixelEmoji(canvas, emoji) {
    const s = 18; canvas.width = s; canvas.height = s;
    const c = canvas.getContext('2d', { willReadFrequently: true });
    c.clearRect(0, 0, s, s);
    c.font = '14px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(emoji, s / 2, s / 2 + 1);
    const img = c.getImageData(0, 0, s, s), d = img.data, solid = new Uint8Array(s * s);
    for (let i = 0; i < s * s; i++) { solid[i] = d[i * 4 + 3] > 110 ? 1 : 0; d[i * 4 + 3] = solid[i] ? 255 : 0; }
    // dark outline
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const i = y * s + x;
      if (solid[i]) continue;
      if ((x > 0 && solid[i - 1]) || (x < s - 1 && solid[i + 1]) || (y > 0 && solid[i - s]) || (y < s - 1 && solid[i + s])) {
        d[i * 4] = 26; d[i * 4 + 1] = 16; d[i * 4 + 2] = 36; d[i * 4 + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
  }

  // helpers
  function show(el, on) { el.classList.toggle('hidden', !on); }
  function fmtTime(ms) {
    const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    return [h, m, x].map(v => String(v).padStart(2, '0')).join(':');
  }
  function globalToast(msg) {
    const t = $('#global-toast'); t.textContent = msg; show(t, true);
    clearTimeout(t._h); t._h = setTimeout(() => show(t, false), 1800);
  }
  function playOf(num) { return store.data.plays[num]; }
  function sumPts(play) { return play.rounds.reduce((a, r) => a + (r && !r.pending ? r.pts : 0), 0); }

  // title screen
  function buildLogo() {
    const logo = $('#logo');
    logo.innerHTML = 'BRANDLE'.split('').map((ch, i) => `<span class="${i === 2 ? 'flick' : i === 5 ? 'flick2' : ''}">${ch}</span>`).join('');
  }
  function howToHTML() {
    return `
      <p>Every day: <b>7 aisles</b>, <b>25 seconds</b> each, one answer per aisle.</p>
      <ul>
        <li><b>BRAND aisles</b>: name something that brand makes or sells.</li>
        <li><b>ITEM aisles</b>: name a brand that makes or sells that item.</li>
        <li><b>TWIST aisles</b>: same thing, plus a rule. Follow it!</li>
      </ul>
      <p>Obvious answers keep you near the <b>front window</b>. Rare-but-real answers send SKU's elevator <b>deeper</b>. Each aisle hides exactly one <b>100-point VAULT</b> answer.</p>
      <p>Sub-brands, discontinued lines and licensed merch all count. Typos are forgiven. Wrong or too vague? Keep guessing until the clock runs out. No valid answer by then means 0.</p>
      <p>New aisles every day at <b>midnight Eastern</b>.</p>`;
  }
  function tierTableHTML() {
    const rows = [['100', 'THE VAULT', 'the one rarest answer'], ['80-95', 'ARCHIVE PULL', 'deep cut'], ['60-75', 'STOCKROOM FIND', 'impressive'],
      ['40-55', 'CLEARANCE RACK', 'nice'], ['20-35', 'MAIN AISLE', 'solid'], ['10-15', 'FRONT WINDOW', 'the obvious one'],
      ['5', 'IMPULSE BUY', 'parent companies, mega-retailers, famous gotchas'], ['0', 'OUT OF STOCK', 'not in our catalog / time ran out']];
    return '<table class="tier-table">' + rows.map(r => `<tr><td>${r[0]}</td><td><b style="font-family:var(--px);font-size:13px">${r[1]}</b> · ${r[2]}</td></tr>`).join('') + '</table>';
  }
  function renderTitle() {
    todayNum = B.todayNum();
    const p = playOf(todayNum), stats = B.stats();
    $('#howto-body').innerHTML = howToHTML();
    $('#howto').open = false;
    const label = !p ? 'GOING DOWN' : p.done ? 'TODAY’S RECEIPT' : 'RESUME DESCENT';
    $('#start-label').textContent = label;
    $('#meta-line').textContent = `BRANDLE #${todayNum} · STREAK ${stats.streak}`;
    updateCountdown();
  }
  function updateCountdown() {
    const ms = B.msToReset();
    const p = playOf(todayNum);
    $('#title-countdown').textContent = p && p.done ? `NEXT DELIVERY IN ${fmtTime(ms)}` : '';
    const rc = $('#res-countdown');
    if (rc) rc.textContent = `NEXT DELIVERY IN ${fmtTime(ms)} · RESETS AT MIDNIGHT ET`;
    if (B.todayNum() !== todayNum && !game) renderTitle();
  }

  // hud
  function renderTickets() {
    const row = $('#tickets-row'); row.innerHTML = '';
    for (let i = 0; i < B.ROUNDS; i++) {
      const r = game.play.rounds[i], el = document.createElement('div');
      el.className = 'tk';
      if (r && !r.pending) el.classList.add('t-' + B.tierFor(r.pts, r.timeout).key);
      else if (i === game.i) el.classList.add('cur');
      row.appendChild(el);
    }
    $('#ticket-lbl').textContent = `AISLE ${Math.min(game.i + 1, B.ROUNDS)} OF ${B.ROUNDS}`;
  }
  scene.onFrame(depth => {
    if (!game) return;
    const f = depth / 10;
    $('#floor-val').textContent = f < 0.5 ? 'G' : 'B' + Math.floor(f);
    $('#dial-needle').style.transform = `rotate(${-80 + Math.min(1, f / 70) * 160}deg)`;
  });
  function setScore(v) { $('#score-val').textContent = v; }

  // start
  function start(num) {
    A.unlock();
    store.data.seenHelp = true;
    const puzzle = B.puzzleFor(num);
    let play = playOf(num);
    if (play && play.done) { showResults(num); return; }
    if (!play) play = store.data.plays[num] = { rounds: [], done: false, daily: num === B.todayNum(), total: 0 };
    // refreshed mid-round? that round's a 0
    const last = play.rounds.length - 1;
    if (last >= 0 && play.rounds[last] && play.rounds[last].pending) play.rounds[last] = { input: '', pts: 0, name: null, timeout: true };
    play.total = sumPts(play);
    store.save();
    puzzle.rounds.forEach(B.buildRound);
    game = { num, puzzle, play, i: play.rounds.length, locked: true };
    A.sfx.start();
    closeModal();
    show($('#title-screen'), false); show($('#results'), false);
    document.body.classList.remove('on-results');
    show($('#hud'), true); show($('#round-screen'), true);
    show($('#reveal'), false);
    scene.setDepth(play.total);
    scene.setMode('game');
    setScore(play.total);
    renderTickets();
    if (game.i >= B.ROUNDS) { finish(); return; }
    setTimeout(showRound, 650);
  }

  function showRound() {
    const r = game.puzzle.rounds[game.i];
    game.locked = false; game.phase = 'round';
    renderTickets();
    $('#sign-aisle').textContent = `AISLE ${game.i + 1} OF ${B.ROUNDS}`;
    $('#sign-type').textContent = r.twist ? 'TWIST AISLE' : r.type === 'brand' ? 'BRAND AISLE' : 'ITEM AISLE';
    $('#sign-ask').textContent = r.type === 'brand' ? 'NAME SOMETHING THIS BRAND MAKES OR SELLS' : 'NAME A BRAND THAT MAKES OR SELLS';
    $('#sign-name').textContent = r.name.toUpperCase();
    const icon = $('#sign-icon');
    if (r.type === 'item') { show(icon, true); pixelEmoji(icon, r.icon || '📦'); } else show(icon, false);
    const tw = $('#sign-twist');
    if (r.twist) { tw.textContent = 'TWIST: ' + r.twist.toUpperCase(); show(tw, true); } else show(tw, false);
    $('#sign-hint').textContent = r.type === 'brand' ? (r.hint || '') : '';
    const sign = $('#aisle-sign');
    show($('#sign-wrap'), true);
    sign.classList.remove('lift', 'drop'); void sign.offsetWidth; sign.classList.add('drop');
    show($('#reveal'), false);
    show($('#answer-bar'), true);
    $('#toast').classList.remove('on');
    const input = $('#answer');
    input.value = ''; input.disabled = false; input.classList.remove('shake');
    setTimeout(() => input.focus({ preventScroll: true }), 120);
    A.sfx.open();
    // so refreshing can't cheat
    game.play.rounds[game.i] = { pending: true };
    game.misses = [];
    store.save();
    startTimer();
  }

  // timer
  function startTimer() {
    game.deadline = performance.now() + B.ROUND_TIME * 1000;
    game.lastTick = B.ROUND_TIME + 1;
    const loop = () => {
      if (!game || game.locked) return;
      const left = Math.max(0, game.deadline - performance.now());
      const secs = Math.ceil(left / 1000);
      $('#timer').textContent = secs;
      $('#timebar-fill').style.width = (left / (B.ROUND_TIME * 10)) + '%';
      const low = secs <= 5;
      $('#deli').classList.toggle('low', low); $('#timebar').classList.toggle('low', low);
      if (low && secs < game.lastTick && secs > 0) A.sfx.tick();
      game.lastTick = secs;
      if (left <= 0) { finalize(null, ''); return; }
      game.timerRaf = requestAnimationFrame(loop);
    };
    loop();
  }

  // answering
  // pops a message above the input, plus a stamp on the sign so you can't miss it
  function toast(msg, stamp) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.remove('on');
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('on')));
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 1800);
    const s = $('#sign-stamp');
    s.textContent = stamp || '';
    s.classList.remove('on');
    if (stamp) requestAnimationFrame(() => requestAnimationFrame(() => s.classList.add('on')));
    clearTimeout(s._h); s._h = setTimeout(() => s.classList.remove('on'), 1400);
  }
  function submit(e) {
    e && e.preventDefault();
    if (!game || game.locked || game.phase !== 'round') return;
    const input = $('#answer'), val = input.value.trim();
    if (!val) return;
    const r = game.puzzle.rounds[game.i];
    const res = B.judge(r, val);
    if (res.status === 'retry' || res.status === 'empty') {
      const msg = res.reason === 'vague' ? 'TOO VAGUE · BE MORE SPECIFIC'
        : res.reason === 'excluded' ? 'NOPE · ' + (r.twist || 'BREAKS THE RULE').toUpperCase()
        : r.type === 'brand' ? 'THAT’S THE BRAND ITSELF!' : 'NAME A BRAND, NOT THE ITEM';
      toast(msg, res.reason === 'vague' ? 'TOO VAGUE' : 'NOPE'); A.sfx.buzz(); scene.nope();
      input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake');
      input.select();
      return;
    }
    if (res.status === 'none') {
      // wrong answer: elevator jolts, keep guessing till time's up
      game.misses.push(val);
      toast('OUT OF STOCK · TRY AGAIN', 'OUT OF STOCK');
      scene.miss();
      input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake');
      input.select();
      return;
    }
    finalize(res, val);
  }

  function finalize(res, input) {
    game.locked = true; game.phase = 'reveal';
    cancelAnimationFrame(game.timerRaf);
    const timeout = !res;
    const ans = res && (res.status === 'match' || res.status === 'mega') ? res.answer : null;
    const rec = {
      input, pts: ans ? ans.pts : 0, name: ans ? ans.name : null, kind: ans ? ans.kind : '',
      parent: ans ? ans.parent : '', note: ans ? ans.note : '', timeout, fuzzy: res && res.fuzzy ? res.fuzzy : '',
      misses: game.misses.slice()
    };
    game.play.rounds[game.i] = rec;
    game.play.total = sumPts(game.play);
    store.save();
    $('#answer').disabled = true;
    if (!timeout) A.sfx.beep();
    const sign = $('#aisle-sign');
    sign.classList.remove('drop'); void sign.offsetWidth; sign.classList.add('lift');
    show($('#answer-bar'), false);
    A.duck(true);
    setTimeout(() => {
      show($('#sign-wrap'), false);
      scene.descend(rec.pts, () => {
        if (rec.pts > 0) A.sfx.ding();
        if (rec.pts >= 100) setTimeout(() => A.sfx.chaching(), 250);
        setScore(game.play.total);
        A.duck(false);
        renderTickets();
        setTimeout(() => showReceipt(rec), rec.pts >= 100 ? 500 : 250);
      });
    }, 380);
  }

  function showReceipt(rec) {
    const r = game.puzzle.rounds[game.i];
    const tier = B.tierFor(rec.pts, rec.timeout);
    const vault = B.vaultOf(r);
    const won = rec.pts >= 100;
    const kindBadge = rec.kind && B.KINDS[rec.kind] ? `<span class="badge">${B.KINDS[rec.kind]}${rec.parent ? ' · ' + esc(rec.parent).toUpperCase() : ''}</span>` : '';
    const fuzzyNote = rec.fuzzy && rec.name ? `<div class="r-fuzzy">autocorrected from “${esc(rec.input)}”</div>` : '';
    let itemLine;
    const tried = rec.misses && rec.misses.length ? rec.misses.map(m => '“' + esc(m) + '”').join(', ') : '';
    if (rec.timeout) itemLine = `<div class="r-item">— NO SALE —</div><div class="r-note">${tried ? 'None of these were in stock: ' + tried + '.' : 'The store closed before you scanned anything.'}</div>`;
    else if (!rec.name) itemLine = `<div class="r-item">NOT IN OUR CATALOG</div><div class="r-note">We don’t stock “${esc(rec.input)}” for this aisle.</div>`;
    else itemLine = `<div class="r-item">${esc(rec.name).toUpperCase()}</div>${fuzzyNote}<div>${kindBadge}</div>${rec.note ? `<div class="r-note">${esc(rec.note)}</div>` : ''}`;
    const also = B.deepCuts(r, 3, rec.name).map(a => `<b>${esc(a.name)}</b> ${a.pts}`).join(' · ');
    const last = game.i >= B.ROUNDS - 1;
    const el = $('#reveal');
    el.innerHTML = `
      <div class="receipt">
        <div class="r-head">BRANDLE DEPT. STORE<small>AISLE ${game.i + 1} · ${esc(r.name).toUpperCase()}${r.twist ? ' · ' + esc(r.twist).toUpperCase() : ''}</small></div>
        <div class="r-row r-you"><span>YOU SCANNED</span><span>${rec.timeout ? '(nothing)' : '“' + esc(rec.input) + '”'}</span></div>
        ${itemLine}
        <div class="stamp-row">
          <div class="stamp t-${tier.key}">${tier.name}</div>
          <div class="r-pts">+${rec.pts}<small>${rec.pts ? (rec.pts / 10) + ' FLOORS DOWN' : 'NO MOVEMENT'}</small></div>
        </div>
        <div class="r-sep"></div>
        <div class="vault-slip ${won ? 'won' : ''}">
          <div class="v-head">${won ? '🔐 YOU CRACKED THE VAULT!' : '🔐 THE VAULT ANSWER'}</div>
          <div class="v-name">${esc(vault ? vault.name : '?').toUpperCase()}</div>
          <div class="v-fact">${esc(vault && vault.fact)}</div>
        </div>
        ${also ? `<div class="r-also">ALSO IN THE BACK: ${also}</div>` : ''}
        <button class="btn-next" id="btn-next">${last ? 'CHECK OUT 🧾' : 'NEXT AISLE ▶'} <small>(ENTER)</small></button>
      </div>`;
    show(el, true);
    el.scrollTop = 0;
    A.sfx.print(14);
    setTimeout(() => A.sfx.stamp(), 750);
    game.phase = 'receipt';
    $('#btn-next').addEventListener('click', next);
    setTimeout(() => { const b = $('#btn-next'); if (b) b.focus({ preventScroll: true }); }, 900);
  }

  function next() {
    if (!game || game.phase !== 'receipt') return;
    game.phase = 'moving';
    show($('#reveal'), false);
    game.i++;
    if (game.i >= B.ROUNDS) finish(); else showRound();
  }

  function finish() {
    game.play.done = true;
    game.play.total = sumPts(game.play);
    store.save();
    const num = game.num;
    game = null;
    show($('#round-screen'), false);
    show($('#hud'), false);
    scene.setMode('results');
    if (num === todayNum) renderTitle();
    setTimeout(() => showResults(num), 700);
  }

  // results
  // the log isn't linear: rare answers sink way down, only a vault answer hits the bottom strip
  const LOG_LEFT = 24, LOG_CW = 32, LOG_TOP = 14, LOG_H = 100, VAULT_H = 8;
  // each tier gets a band, and every band is a bit thinner than the one above it
  const LOG_TIERS = [[0, 26, '#4a3d6e'], [10, 22, '#3d3262'], [20, 18, '#322855'], [40, 14, '#271f47'], [60, 11, '#1d1739'], [80, 9, '#14102b']];
  function logDepth(pts) {
    if (pts >= 100) return LOG_H + VAULT_H / 2 + 1;
    let y = 0;
    for (let k = 0; k < LOG_TIERS.length; k++) {
      const [lo, h] = LOG_TIERS[k], hi = k + 1 < LOG_TIERS.length ? LOG_TIERS[k + 1][0] : 100;
      if (pts < hi) return y + h * (pts - lo) / (hi - lo);
      y += h;
    }
    return y;
  }
  function drawLog(canvas, puzzle, play, progress) {
    const cols = 7, cw = LOG_CW, left = LOG_LEFT, top = LOG_TOP, Wd = left + cols * cw, Hd = top + LOG_H + VAULT_H + 4;
    canvas.width = Wd; canvas.height = Hd;
    const c = canvas.getContext('2d');
    const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    // sky
    for (let y = 0; y < top; y++) R(0, y, Wd, 1, `rgb(${Math.round(36 + y * 12)},${Math.round(18 + y * 3)},${Math.round(74 - y)})`);
    R(0, top - 1, Wd, 1, '#8a80a8');
    // tier bands, squished so the rare ones take up most of the shaft
    let yy = top;
    LOG_TIERS.forEach(([, h, col]) => { R(0, yy, Wd, h, col); R(0, yy + h - 1, Wd, 1, 'rgba(0,0,0,0.4)'); yy += h; });
    // the vault strip
    R(0, top + LOG_H, Wd, VAULT_H + 4, '#2e2205');
    R(0, top + LOG_H, Wd, 1, '#ffd23f');
    // labels
    const FONT = {
      G: '011100101101011', R: '110101110101101', A: '010101111101101', E: '111100110100111',
      V: '101101101101010', U: '101101101101111', L: '100100100100111', T: '111010010010010'
    };
    const txt = (s, x, y, col) => { c.fillStyle = col; let cx = x; for (const ch of s) { const g = FONT[ch]; if (g) for (let i = 0; i < 15; i++) if (g[i] === '1') c.fillRect(cx + i % 3, y + (i / 3 | 0), 1, 1); cx += 4; } };
    txt('G', 3, top - 7, '#cfc6e6');
    txt('RARE', 3, top + logDepth(60) + 3, '#7fe8c8');
    txt('VAULT', 2, top + LOG_H + 4, '#ffd23f');
    for (let i = 0; i < cols; i++) {
      const r = play.rounds[i];
      const cx = left + i * cw + cw / 2;
      R(left + i * cw, top, 1, LOG_H + VAULT_H, 'rgba(255,255,255,0.05)');
      if (!r || r.pending) continue;
      const p = Math.max(0, Math.min(1, (progress - i * 0.08) / 0.5));
      const depth = logDepth(r.pts) * (p < 1 ? (1 - Math.pow(1 - p, 3)) : 1);
      const y = top + depth + 3;
      R(cx, 0, 1, y - 6, '#9a92ad');
      if (r.pts === 0 && p > 0) { R(cx - 2, top - 6, 5, 1, '#ff3b5c'); R(cx - 2, top - 2, 5, 1, '#ff3b5c'); }
      // cab
      const gold = r.pts >= 100;
      R(cx - 3, y - 7, 7, 7, gold ? '#ffd23f' : '#d9a441'); R(cx - 2, y - 6, 5, 5, gold ? '#fff2a8' : '#2a1f33'); R(cx - 1, y - 5, 3, 3, '#ff4f8b');
      if (gold && p >= 1) { const t = Date.now() / 200; for (let k = 0; k < 4; k++) R(cx + Math.round(Math.cos(t + k * 1.57) * 6), y - 4 + Math.round(Math.sin(t + k * 1.57) * 5), 1, 1, '#fff2a8'); }
    }
  }

  function searchKey(s) {
    return String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }
  // the "see all answers" list
  function allAnswersHTML(r, rec) {
    const list = r.answers.slice().sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));
    const items = list.map(a => {
      const t = B.tierFor(a.pts);
      const mine = rec && rec.name === a.name;
      const k = searchKey([a.name].concat(a.aliases).join('|'));
      const badge = a.kind && B.KINDS[a.kind] ? `<em>${B.KINDS[a.kind]}</em>` : '';
      return `<li data-k="${esc(k)}" class="${mine ? 'mine' : ''} ${a.pts === 100 ? 'vault' : ''}">
        <span class="al-name">${esc(a.name)}${mine ? ' <b>← YOU</b>' : ''}${badge}</span>
        <span class="al-tier t-${t.key}">${t.name}</span>
        <span class="al-pts">${a.pts}</span></li>`;
    }).join('');
    return `<details class="rl-all">
      <summary>SEE ALL ${list.length} ANSWERS</summary>
      <input class="rl-search" type="search" placeholder="search an answer…" autocomplete="off" spellcheck="false" aria-label="Search answers">
      <ul>${items}<li class="rl-none hidden">Not in our catalog. That answer would score 0.</li></ul>
    </details>`;
  }

  function showResults(num) {
    const puzzle = B.puzzleFor(num), play = playOf(num);
    if (!play) return;
    puzzle.rounds.forEach(B.buildRound);
    const total = play.total, floors = Math.floor(total / 10), stats = B.stats();
    document.body.classList.add('on-results');
    scene.setDepth(total); scene.setMode('results');
    show($('#title-screen'), false); show($('#round-screen'), false); show($('#hud'), false);
    const rows = puzzle.rounds.map((r, i) => {
      const rec = play.rounds[i] || { pts: 0, timeout: true };
      const tier = B.tierFor(rec.pts, rec.timeout), vault = B.vaultOf(r);
      const guess = rec.timeout ? '(store closed)' : rec.name ? `${esc(rec.name)}${rec.input && rec.input.toLowerCase() !== rec.name.toLowerCase() ? ` <span style="color:#8a7d93">(“${esc(rec.input)}”)</span>` : ''}` : `“${esc(rec.input)}” · not stocked`;
      return `<div class="rl-row" data-i="${i}">
        <div class="rl-n">${i + 1}</div>
        <div><div class="rl-prompt">${esc(r.name).toUpperCase()} <em>${r.type === 'brand' ? 'BRAND→ITEM' : 'ITEM→BRAND'}${r.twist ? ' · ' + esc(r.twist).toUpperCase() : ''}</em></div><div class="rl-guess">${guess}</div></div>
        <div><div class="rl-pts">${rec.pts}</div><div class="rl-tier stamp-c t-${tier.key}" style="color:var(--t-${tier.key === 'window' ? 'oos' : tier.key})">${tier.name}</div></div>
        <div class="rl-vault">🔐 vault: <b>${esc(vault ? vault.name : '')}</b></div>
        <div class="rl-fact">${esc(vault ? vault.fact : '')}</div>
        ${allAnswersHTML(r, rec)}
      </div>`;
    }).join('');
    const el = $('#results');
    el.innerHTML = `
      <div class="res-panel">
        <div class="res-title"><b>BRANDLE #${num}</b> · ${B.dateLabel(num).toUpperCase()} · ${play.daily ? 'CHECKED OUT' : 'ARCHIVE RUN'}</div>
        <div class="res-score">
          <div class="res-score-num"><span class="n">${total}</span><span class="of">/700</span></div>
          <div class="res-score-lbl">POINTS</div>
          <div class="res-meter"><i style="width:${Math.min(100, total / 7)}%"></i></div>
          <div class="res-floorline"><b>${B.floorLabel(total)}</b> · ${floors} FLOORS DOWN · <span>${B.zoneName(floors)}</span></div>
        </div>
        <div>
          <div class="sec-lbl">ELEVATOR LOG <small>DEEPER = RARER · TAP A SHAFT</small></div>
          <div class="log-wrap"><canvas id="log-canvas"></canvas><div class="log-cols">${puzzle.rounds.map((_, i) => `<button data-i="${i}" aria-label="Aisle ${i + 1}"></button>`).join('')}</div></div>
          <div class="log-names"><span></span>${puzzle.rounds.map(r => `<span>${esc(r.name).toUpperCase()}</span>`).join('')}</div>
        </div>
        <div class="receipt long">
          <div class="r-head">BRANDLE DEPT. STORE · RECEIPT<small>${esc(puzzle.title || '')} · ${B.dateLabel(num)}</small></div>
          ${rows}
          <div class="rl-total"><span>TOTAL</span><span>${total} PTS · ${B.floorLabel(total)}</span></div>
          <div class="barcode"></div>
        </div>
        <div class="res-stats">
          <div class="stat"><b>${stats.streak}</b><span>STREAK</span></div>
          <div class="stat"><b>${B.floorLabel(stats.best)}</b><span>DEEPEST</span></div>
          <div class="stat"><b>${stats.vaults}</b><span>VAULTS CRACKED</span></div>
          <div class="stat"><b>${stats.played}</b><span>DAYS SHOPPED</span></div>
        </div>
        <div class="res-actions">
          <button class="call-plate" id="btn-share"><span class="arrow">🧾</span>SHARE RECEIPT</button>
          <button class="chip" id="btn-res-archive">ARCHIVE ⟲</button>
          <button class="chip" id="btn-res-home">STOREFRONT ▲</button>
        </div>
        <div class="countdown" id="res-countdown"></div>
      </div>`;
    show(el, true);
    el.scrollTop = 0;
    updateCountdown();
    // animate the log
    const cv = $('#log-canvas'), t0 = performance.now();
    const anim = () => {
      if (!document.body.contains(cv)) return;
      drawLog(cv, puzzle, play, (performance.now() - t0) / 1400);
      requestAnimationFrame(anim);
    };
    anim();
    const select = i => {
      el.querySelectorAll('.rl-row, .log-cols button').forEach(n => n.classList.toggle('sel', +n.dataset.i === i));
      const row = el.querySelector(`.rl-row[data-i="${i}"]`);
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    el.querySelectorAll('.log-cols button').forEach(b => b.addEventListener('click', () => select(+b.dataset.i)));
    el.querySelectorAll('.rl-row').forEach(r => r.addEventListener('click', e => {
      if (e.target.closest('.rl-all')) return;
      r.classList.toggle('sel');
    }));
    // search box
    el.querySelectorAll('.rl-search').forEach(inp => inp.addEventListener('input', () => {
      const q = searchKey(inp.value), list = inp.closest('.rl-all');
      let shown = 0;
      list.querySelectorAll('li[data-k]').forEach(li => {
        const hit = !q || li.dataset.k.includes(q);
        li.classList.toggle('hidden', !hit);
        if (hit) shown++;
      });
      list.querySelector('.rl-none').classList.toggle('hidden', shown > 0);
    }));
    $('#btn-share').addEventListener('click', () => share(num));
    $('#btn-res-archive').addEventListener('click', openArchive);
    $('#btn-res-home').addEventListener('click', goHome);
  }

  function goHome() {
    game = null;
    show($('#results'), false); show($('#round-screen'), false); show($('#hud'), false);
    show($('#title-screen'), true);
    document.body.classList.remove('on-results');
    scene.setDepth(0); scene.setMode('title');
    renderTitle();
  }

  function share(num) {
    const play = playOf(num), total = play.total;
    const emojis = play.rounds.map(r => B.tierFor(r.pts, r.timeout).emoji).join('');
    const url = location.href.split(/[?#]/)[0];
    const txt = `BRANDLE #${num} · ${B.floorLabel(total)} 🛗\n${emojis}\n${total}/700 pts\n${url}`;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (navigator.share && coarse) { navigator.share({ text: txt }).catch(() => copy(txt)); return; }
    copy(txt);
  }
  function copy(txt) {
    const done = () => globalToast('RECEIPT COPIED!');
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done, () => fallbackCopy(txt, done));
    else fallbackCopy(txt, done);
  }
  function fallbackCopy(txt, done) {
    const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { prompt('Copy your receipt:', txt); }
    ta.remove();
  }

  // popups
  function openModal(html) { $('#modal-body').innerHTML = html; show($('#modal'), true); }
  function closeModal() { show($('#modal'), false); }
  function openHelp() {
    openModal(`<h2>HOW TO SHOP</h2>${howToHTML()}<h2 style="margin-top:16px">TIERS</h2>${tierTableHTML()}
      <p style="color:var(--muted)">10 points = 1 floor down. A perfect day reaches <b style="color:var(--gold);font-weight:normal">B70 · THE VAULT</b>.</p>`);
  }
  function openArchive() {
    const today = B.todayNum(), rows = [];
    for (let n = today; n >= 1; n--) {
      const p = playOf(n), title = B.puzzleFor(n).title;
      const status = p && p.done ? `${B.floorLabel(p.total)} · ${p.total}` : p ? 'IN PROGRESS' : '';
      rows.push(`<div class="arch-row"><div><div class="n">#${n} ${n === today ? '· TODAY' : ''}</div><div class="d">${B.dateLabel(n)} · ${esc(title)}</div></div>
        <div class="s">${status}</div><button class="chip" data-n="${n}">${p && p.done ? 'RECEIPT' : 'PLAY'}</button></div>`);
    }
    openModal(`<h2>ARCHIVE</h2><p style="color:var(--muted)">Missed a day? Shop it here. Archive runs don’t count toward your streak.</p>${rows.join('')}`);
    document.querySelectorAll('.arch-row .chip').forEach(b => b.addEventListener('click', () => {
      const n = +b.dataset.n, p = playOf(n);
      closeModal();
      if (p && p.done) showResults(n); else start(n);
    }));
  }

  // sound buttons
  function updateSoundButtons() {
    $('#btn-mute').textContent = A.muted ? '🔇' : '🔊';
    $('#btn-mute').classList.toggle('off', A.muted);
    $('#btn-muzak').classList.toggle('off', !A.muzak);
  }

  // go
  function init() {
    B.loadPuzzles();
    if (!B.puzzles.length) { document.body.insertAdjacentHTML('beforeend', '<p style="position:fixed;top:40%;width:100%;text-align:center;z-index:99">No puzzles loaded.</p>'); return; }
    A.muted = !!store.data.settings.muted;
    A.muzak = store.data.settings.muzak !== false;
    updateSoundButtons();
    buildLogo();
    renderTitle();
    scene.setMode('title'); scene.setDepth(0); scene.snap();

    $('#btn-start').addEventListener('click', () => {
      const p = playOf(todayNum);
      if (p && p.done) { A.unlock(); showResults(todayNum); } else start(todayNum);
    });
    $('#answer-form').addEventListener('submit', submit);
    $('#answer').addEventListener('input', () => A.sfx.key());
    $('#btn-archive').addEventListener('click', () => { A.unlock(); openArchive(); });
    $('#btn-help').addEventListener('click', openHelp);
    $('#modal-x').addEventListener('click', closeModal);
    $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
    $('#btn-mute').addEventListener('click', () => {
      A.setMuted(!A.muted); store.data.settings.muted = A.muted; store.save(); updateSoundButtons();
    });
    $('#btn-muzak').addEventListener('click', () => {
      A.unlock(); A.setMuzak(!A.muzak); store.data.settings.muzak = A.muzak; store.save(); updateSoundButtons();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Enter' && game && game.phase === 'receipt') { e.preventDefault(); next(); }
    });
    setInterval(updateCountdown, 1000);

    // phone keyboard: keep the sign + input in the part of the screen you can see
    const fit = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      document.documentElement.style.setProperty('--vvh', vv.height + 'px');
      document.documentElement.style.setProperty('--vvtop', vv.offsetTop + 'px');
    };
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', fit);
      window.visualViewport.addEventListener('scroll', fit);
      fit();
    }
    const touch = window.matchMedia('(pointer: coarse)').matches;
    $('#answer').addEventListener('focus', () => {
      if (touch) document.body.classList.add('typing');
      fit(); setTimeout(fit, 350);
    });
    $('#answer').addEventListener('blur', () => {
      document.body.classList.remove('typing');
      setTimeout(fit, 350);
    });
  }
  init();
})();
