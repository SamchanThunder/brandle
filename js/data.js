// puzzles, daily reset, answer checking, saving
(function (root) {
  'use strict';
  const B = root.Brandle = root.Brandle || {};

  const LAUNCH_UTC = Date.UTC(2026, 10, 12); // day 1
  const TZ = 'America/New_York';
  B.ROUNDS = 7;
  B.ROUND_TIME = 25;

  B.KINDS = {
    sub: 'SUB-BRAND', disc: 'DISCONTINUED', lic: 'LICENSED', store: 'STORE BRAND',
    parent: 'PARENT CO.', clever: 'TOO CLEVER'
  };

  B.TIERS = [
    { min: 100, key: 'vault',   name: 'THE VAULT',      emoji: '🔐' },
    { min: 80,  key: 'archive', name: 'ARCHIVE PULL',   emoji: '🗄️' },
    { min: 60,  key: 'stock',   name: 'STOCKROOM FIND', emoji: '📦' },
    { min: 40,  key: 'clear',   name: 'CLEARANCE RACK', emoji: '🏷️' },
    { min: 20,  key: 'aisle',   name: 'MAIN AISLE',     emoji: '🛒' },
    { min: 10,  key: 'window',  name: 'FRONT WINDOW',   emoji: '🪟' },
    { min: 5,   key: 'impulse', name: 'IMPULSE BUY',    emoji: '💸' },
    { min: 0,   key: 'oos',     name: 'OUT OF STOCK',   emoji: '❌' }
  ];
  B.tierFor = function (pts, timeout) {
    if (timeout) return { min: 0, key: 'oos', name: 'STORE CLOSED', emoji: '❌' };
    return B.TIERS.find(t => pts >= t.min);
  };

  B.ZONES = [
    { from: 0, name: 'STREET LEVEL' }, { from: 1, name: 'SALES FLOOR' },
    { from: 10, name: 'CLEARANCE BASEMENT' }, { from: 25, name: 'STOCKROOM' },
    { from: 40, name: 'LOADING DOCK' }, { from: 55, name: 'THE ARCHIVES' }, { from: 70, name: 'THE VAULT' }
  ];
  B.zoneName = function (floors) {
    let z = B.ZONES[0];
    for (const x of B.ZONES) if (floors >= x.from) z = x;
    return z.name;
  };
  B.floorLabel = function (pts) {
    const f = Math.floor(pts / 10);
    return f <= 0 ? 'G' : 'B' + f;
  };

  const MEGA = ['Amazon', 'Amazon Basics', 'Walmart', 'Target', 'Costco', "Sam's Club", 'eBay', 'Temu', 'Shein',
    'Alibaba', 'AliExpress', 'Wish', 'Kroger', 'Etsy', 'Dollar General', 'Dollar Tree', 'Kmart', 'Macys'];

  // puzzle format is in the README
  function splitList(s) { return s.split(',').map(x => x.trim()).filter(Boolean); }

  function parseAnswer(pts, rest) {
    let note = '';
    const bar = rest.indexOf('|');
    if (bar >= 0) { note = rest.slice(bar + 1).trim(); rest = rest.slice(0, bar); }
    let aliases = [];
    const eq = rest.indexOf('=');
    if (eq >= 0) { aliases = splitList(rest.slice(eq + 1)); rest = rest.slice(0, eq); }
    let name = rest.trim(), kind = '', parent = '';
    const km = name.match(/\(([a-z]+)(?::([^)]*))?\)\s*$/);
    if (km) { kind = km[1]; parent = (km[2] || '').trim(); name = name.slice(0, km.index).trim(); }
    const a = { name, pts, kind, parent, aliases, note: '' };
    if (pts === 100) a.fact = note; else a.note = note;
    return a;
  }

  function parse(text) {
    const days = [];
    let day = null, round = null;
    text.split(/\r?\n/).forEach((raw, ln) => {
      const line = raw.trim();
      if (!line || line.startsWith('//')) return;
      if (line.startsWith('## ')) {
        const p = line.slice(3).split('|').map(s => s.trim());
        day = { num: parseInt(p[0], 10), title: p[1] || '', rounds: [] };
        days.push(day); round = null; return;
      }
      const c = line[0], sp = line[1] === ' ';
      if ((c === 'B' || c === 'I') && sp && day) {
        const p = line.slice(2).split('|').map(s => s.trim());
        round = { type: c === 'B' ? 'brand' : 'item', name: p[0], twist: p[2] || '', vague: [], excluded: [], answers: [] };
        if (round.type === 'brand') round.hint = p[1] || ''; else round.icon = p[1] || '📦';
        day.rounds.push(round); return;
      }
      if (c === 'V' && sp && round) { round.vague.push(...splitList(line.slice(2))); return; }
      if (c === 'X' && sp && round) { round.excluded.push(...splitList(line.slice(2))); return; }
      const m = line.match(/^(\d+)\s+(.+)$/);
      if (m && round) { round.answers.push(parseAnswer(parseInt(m[1], 10), m[2])); return; }
      if (root.console) console.warn('[brandle] unparsed line ' + (ln + 1) + ': ' + line);
    });
    return days;
  }
  B.parse = parse;

  B.loadPuzzles = function (src) {
    const text = src != null ? src : (root.BRANDLE_SRC || []).join('\n');
    B.puzzles = parse(text).sort((a, b) => a.num - b.num);
    return B.puzzles;
  };

  // new puzzle at midnight eastern
  function nyParts(d) {
    const f = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric'
    });
    const o = {};
    for (const x of f.formatToParts(d || new Date())) o[x.type] = x.value;
    return { y: +o.year, m: +o.month, d: +o.day, h: (+o.hour) % 24, mi: +o.minute, s: +o.second };
  }
  B.todayNum = function () {
    const p = nyParts();
    const idx = Math.round((Date.UTC(p.y, p.m - 1, p.d) - LAUNCH_UTC) / 86400000);
    return Math.max(1, idx + 1);
  };
  B.puzzleFor = function (num) {
    const list = B.puzzles, n = list.length;
    return list[(((num - 1) % n) + n) % n];
  };
  B.msToReset = function () {
    const p = nyParts();
    return Math.max(1000, 86400000 - (p.h * 3600 + p.mi * 60 + p.s) * 1000);
  };
  B.dateLabel = function (num) {
    const d = new Date(LAUNCH_UTC + (num - 1) * 86400000);
    return d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
  };

  // matching
  const SUFFIX = new Set(['inc', 'co', 'corp', 'corporation', 'company', 'ltd', 'llc', 'brand', 'brands', 'plc', 'gmbh']);
  const FILLER = new Set(['a', 'an', 'some', 'the', 'my']);

  function words(s) {
    return String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[&+]/g, ' and ').replace(/['’`´]/g, '').replace(/[^a-z0-9]+/g, ' ')
      .trim().split(' ').filter(Boolean);
  }
  // batteries -> battery, knives -> knife, boxes -> box, mowers -> mower
  function singular(w) {
    if (w.length <= 3 || w.endsWith('ss') || w.endsWith('us') || w.endsWith('is')) return w;
    if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
    if (w.endsWith('ves') && w.length > 4) return w.slice(0, -3) + 'f';
    if (/(ses|xes|zes|ches|shes)$/.test(w)) return w.slice(0, -2);
    if (w.endsWith('s')) return w.slice(0, -1);
    return w;
  }
  // first key is the main one
  function variants(ws) {
    const out = new Set();
    ws = ws.slice();
    if (ws.length > 1 && ws[0] === 'the') ws = ws.slice(1);
    while (ws.length > 1 && SUFFIX.has(ws[ws.length - 1])) ws = ws.slice(0, -1);
    const sing = ws.map(singular);
    const forms = [ws.join(''), ws.filter(x => x !== 'and').join(''), sing.join(''), sing.filter(x => x !== 'and').join('')];
    for (const k of forms) {
      if (!k) continue;
      out.add(k);
      if (k.length > 4 && k.endsWith('es')) out.add(k.slice(0, -2));
      if (k.length > 3 && k.endsWith('s')) out.add(k.slice(0, -1));
    }
    return out;
  }
  const GLUE = new Set(['and', 'the', 'of', 'a', 'an', 'by', 'for', 'co', 'inc', 'brand', 'company']);
  // words that don't tell us anything
  const STOP = new Set(['and', 'the', 'of', 'for', 'with', 'by', 'a', 'an', 'in', 'on', 'at', 'to', 'from', 'it', 'its',
    'made', 'make', 'makes', 'brand', 'brands', 'company', 'product', 'products', 'stuff', 'thing', 'things', 'line',
    'kind', 'type', 'my', 'their', 'they', 'sell', 'sells', 'some', 'like', 'also', 'that', 'this', 'is', 'are', 'co', 'inc']);
  function keysOf(s) { return variants(words(s)); }
  B.keysOf = keysOf;

  // autocorrect: typos, sounds-alike, half-typed words, nicknames
  const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  const KEYPOS = {};
  ROWS.forEach((r, y) => r.split('').forEach((ch, x) => { KEYPOS[ch] = [x + y * 0.5, y]; }));
  function subCost(a, b) {
    if (a === b) return 0;
    const p = KEYPOS[a], q = KEYPOS[b];
    if (p && q && Math.abs(p[0] - q[0]) <= 1 && Math.abs(p[1] - q[1]) <= 1) return 0.5; // fat-finger
    if ('aeiouy'.includes(a) && 'aeiouy'.includes(b)) return 0.7;                         // vowel swap
    return 1;
  }
  const VOWEL = 'aeiou';
  function dl(a, b, max) {
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > max + 1) return max + 1;
    let prev2 = null, prev = [];
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      let rowMin = i;
      for (let j = 1; j <= n; j++) {
        // doubled letters are an easy mistake
        const del = prev[j] + (i > 1 && a[i - 1] === a[i - 2] ? 0.5 : VOWEL.includes(a[i - 1]) ? 0.7 : 1);
        const ins = cur[j - 1] + (j > 1 && b[j - 1] === b[j - 2] ? 0.5 : VOWEL.includes(b[j - 1]) ? 0.7 : 1);
        let v = Math.min(del, ins, prev[j - 1] + subCost(a[i - 1], b[j - 1]));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 0.6);
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      prev2 = prev; prev = cur;
    }
    return prev[n];
  }
  function phonetic(k) {
    let s = k.replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k')
      .replace(/q/g, 'k').replace(/x/g, 'ks').replace(/z/g, 's').replace(/dg/g, 'j').replace(/tch/g, 'ch')
      .replace(/gh/g, 'g').replace(/wr/g, 'r').replace(/kn/g, 'n').replace(/[0-9]/g, d => d);
    const first = s[0];
    s = first + s.slice(1).replace(/[aeiouyhw]/g, '');
    return s.replace(/(.)\1+/g, '$1');
  }
  const NICK = {
    chevy: 'chevrolet', vw: 'volkswagen', vdub: 'volkswagen', beemer: 'bmw', bimmer: 'bmw', benz: 'mercedes benz',
    merc: 'mercedes benz', mercedes: 'mercedes benz', lambo: 'lamborghini', caddy: 'cadillac', harley: 'harley davidson',
    hd: 'harley davidson', mcds: 'mcdonalds', mickeyds: 'mcdonalds', maccas: 'mcdonalds', bk: 'burger king',
    dd: 'dunkin', dunkindonuts: 'dunkin', sbux: 'starbucks', lv: 'louis vuitton', ysl: 'yves saint laurent',
    tj: 'trader joes', tjs: 'trader joes', ms: 'microsoft', msft: 'microsoft', fb: 'meta', facebook: 'meta',
    ge: 'general electric', pg: 'procter and gamble', jnj: 'johnson and johnson', hp: 'hewlett packard',
    nb: 'new balance', ua: 'under armour', tnf: 'the north face', ae: 'american eagle', af: 'abercrombie and fitch',
    abercrombie: 'abercrombie and fitch', vicky: 'victorias secret', vs: 'victorias secret',
    tv: 'tvs', tele: 'tv', telly: 'tv', television: 'tv', fridge: 'refrigerator', fridges: 'refrigerator',
    phone: 'phones', cellphone: 'phones', cellphones: 'phones', mobilephone: 'phones', smartphone: 'phones',
    laptop: 'laptops', notebookcomputer: 'laptops', pc: 'computers', computer: 'computers',
    bike: 'bicycles', bikes: 'bicycles', motorbike: 'motorcycles', moto: 'motorcycles', ebike: 'electric bikes',
    shoes: 'sneakers', kicks: 'sneakers', trainers: 'sneakers', tees: 't shirts', tshirt: 't shirts', tee: 't shirts',
    sunnies: 'sunglasses', shades: 'sunglasses', specs: 'glasses', headphone: 'headphones', earphones: 'headphones',
    cans: 'headphones', earbuds: 'headphones', buds: 'headphones', soda: 'soda', pop: 'soda', fizzydrink: 'soda',
    choc: 'chocolate', choccy: 'chocolate', sweets: 'candy', lollies: 'candy', chips: 'chips', crisps: 'chips',
    fries: 'french fries', burger: 'burgers', hamburger: 'burgers', pjs: 'pajamas', jammies: 'pajamas',
    undies: 'underwear', boxers: 'underwear', sneaks: 'sneakers', ac: 'air conditioners', aircon: 'air conditioners',
    meds: 'medicine', vitamins: 'vitamins', mags: 'magazines', vid: 'videos', vids: 'videos', vidya: 'video games',
    games: 'video games', videogame: 'video games', console: 'game consoles', consoles: 'game consoles'
  };
  B.NICK = NICK;

  B.buildRound = function (round) {
    if (round._idx) return round;
    const idx = new Map();
    round.answers.forEach((a, i) => {
      for (const s of [a.name].concat(a.aliases)) for (const k of keysOf(s)) if (!idx.has(k)) idx.set(k, i);
    });
    const setOf = list => { const s = new Set(); list.forEach(x => keysOf(x).forEach(k => s.add(k))); return s; };
    round._idx = idx;
    round._vague = setOf(round.vague.concat(['stuff', 'things', 'thing', 'products', 'product', 'idk', 'nothing', 'everything']));
    round._excl = setOf(round.excluded);
    round._self = keysOf(round.name);
    round._nameWords = words(round.name);
    // everything fuzzy search can land on
    const cand = [];
    for (const [k, i] of idx) cand.push([k, i]);
    round._excl.forEach(k => { if (!idx.has(k)) cand.push([k, 'x']); });
    round._vague.forEach(k => { if (!idx.has(k)) cand.push([k, 'v']); });
    round._cand = cand.map(([k, t]) => ({ k, t, ph: phonetic(k) }));
    // word-level stuff: whole phrases + single standout words
    const nameSet = new Set(round.type === 'brand' ? round._nameWords.map(singular) : []);
    const clean = s => words(s).map(singular).filter(w => !STOP.has(w) && !nameSet.has(w));
    round._nameSet = nameSet;
    round._phrases = [];
    round._wordIdx = new Map();
    round.answers.forEach((a, i) => {
      for (const s of [a.name].concat(a.aliases)) {
        const ws = clean(s);
        if (!ws.length) continue;
        // "on running" minus "on" isn't a phrase anymore, so only keep it if we just dropped glue words
        const dropped = words(s).filter(w => STOP.has(w) && !nameSet.has(w));
        if (dropped.every(w => GLUE.has(w))) round._phrases.push({ i, ws, len: ws.join('').length });
        ws.forEach(w => {
          if (w.length < 3) return;
          if (!round._wordIdx.has(w)) round._wordIdx.set(w, new Set());
          round._wordIdx.get(w).add(i);
        });
      }
    });
    return round;
  };

  function resolveTag(round, t, how) {
    if (t === 'x') return { status: 'retry', reason: 'excluded' };
    if (t === 'v') return { status: 'retry', reason: 'vague' };
    return { status: 'match', answer: round.answers[t], fuzzy: how };
  }
  // if two answers are just as close, don't guess
  function uniqueBest(list) {
    if (!list.length) return null;
    list.sort((a, b) => a.score - b.score);
    const best = list[0];
    const rival = list.find(x => x.t !== best.t);
    if (rival && rival.score - best.score < 0.5) return null;
    return best;
  }
  function exactLookup(round, keys) {
    for (const k of keys) if (round._idx.has(k)) return { status: 'match', answer: round.answers[round._idx.get(k)] };
    for (const k of keys) if (round._excl.has(k)) return { status: 'retry', reason: 'excluded' };
    for (const k of keys) if (round._vague.has(k)) return { status: 'retry', reason: 'vague' };
    for (const k of keys) if (round._self.has(k)) return { status: 'retry', reason: 'self' };
    return null;
  }
  function fuzzyLookup(round, main) {
    const L = main.length;
    // typos
    const tol = tolFor(L);
    if (tol) {
      const hits = [];
      for (const c of round._cand) {
        if (c.k.length < 3 || Math.abs(c.k.length - L) > tol + 1) continue;
        const d = dl(main, c.k, tol);
        // people rarely get the first letter wrong
        if (d <= tol) hits.push({ t: c.t, score: d + (c.k[0] !== main[0] ? 1 : 0) });
      }
      const b = uniqueBest(hits.filter(h => h.score <= tol));
      if (b) return resolveTag(round, b.t, 'typo');
    }
    // sounds right, spelled wrong
    if (L >= 4) {
      const ph = phonetic(main);
      let hits = round._cand.filter(c => c.k.length >= 3 && L >= 5 && ph.length >= 3 && c.ph === ph && Math.abs(c.k.length - L) <= 1).map(c => ({ t: c.t, score: Math.abs(c.k.length - L) * 0.1 }));
      // close-ish sound for longer words ("hedfones" ~ "headphones")
      if (!hits.length && ph.length >= 5 && L >= 6) {
        hits = round._cand.filter(c => c.ph.length === ph.length && c.ph[0] === ph[0])
          .map(c => ({ t: c.t, score: dl(ph, c.ph, 1) })).filter(h => h.score <= 1);
      }
      const b = uniqueBest(hits);
      if (b) return resolveTag(round, b.t, 'sound');
    }
    // half-typed
    if (L >= 5) {
      const hits = round._cand.filter(c => c.k.length > L && c.k.startsWith(main) && L >= c.k.length * 0.6)
        .map(c => ({ t: c.t, score: (c.k.length - L) * 0.05 }));
      const b = uniqueBest(hits);
      if (b) return resolveTag(round, b.t, 'prefix');
    }
    return null;
  }

  function tolFor(L) { return L < 4 ? 0 : L === 4 ? 0.7 : L <= 6 ? 1.5 : L <= 9 ? 2 : L <= 12 ? 2.5 : 3; }

  // "frozen pizza by dr oetker" -> Dr. Oetker, "panels" -> Solar Panels, "outbord motor" -> Outboard Motors
  function wordLookup(round, ws) {
    const iw = ws.map(singular).filter(w => w.length >= 3 && !STOP.has(w) && !round._nameSet.has(w));
    if (!iw.length) return null;
    // fix typos word by word against words we know
    const known = iw.map(w => {
      if (round._wordIdx.has(w) || w.length < 5) return w;
      const tol = Math.min(2, tolFor(w.length) - 0.5);
      let best = null, bestD = 99, tie = false;
      for (const k of round._wordIdx.keys()) {
        if (Math.abs(k.length - w.length) > 2 || k[0] !== w[0]) continue;
        const d = dl(w, k, tol);
        if (d < bestD) { bestD = d; best = k; tie = false; } else if (d === bestD) tie = true;
      }
      return best && bestD <= tol && !tie ? best : w;
    });
    for (const w of known) if (round._excl.has(w)) return { status: 'retry', reason: 'excluded' };
    const set = new Set(known);
    // a whole answer phrase sitting inside what they typed
    let best = null, tie = false;
    for (const p of round._phrases) {
      if (!p.ws.every(w => set.has(w))) continue;
      if (!best || p.len > best.len) { best = p; tie = false; }
      else if (p.len === best.len && p.i !== best.i) tie = true;
    }
    if (best && !tie && best.len >= 4) return { status: 'match', answer: round.answers[best.i], fuzzy: 'phrase' };
    // a single word that only one answer has
    const hits = new Map();
    known.forEach(w => (round._wordIdx.get(w) || []).forEach(i => hits.set(i, (hits.get(i) || 0) + 1)));
    if (!hits.size) return null;
    const ranked = [...hits].map(([i, c]) => ({ i, c, extra: words(round.answers[i].name).length - c }))
      .sort((a, b) => b.c - a.c || a.extra - b.extra);
    const top = ranked[0], next = ranked[1];
    if (next && next.c === top.c && next.extra === top.extra) return null;
    const cover = Math.max(...round._phrases.filter(p => p.i === top.i)
      .map(p => p.ws.filter(w => set.has(w)).join('').length / p.len), 0);
    // brand aisles: also ok if it's the last word, the main thing ("panels" -> solar panels)
    const head = round._phrases.some(p => p.i === top.i && p.ws.length > 1 && set.has(p.ws[p.ws.length - 1]) && p.ws[p.ws.length - 1].length >= 4);
    if (round.type === 'brand' ? !(cover > 0.5 || (head && cover >= 0.4)) : cover <= 0.6) return null;
    return { status: 'match', answer: round.answers[top.i], fuzzy: 'word' };
  }

  B.judge = function (round, input) {
    B.buildRound(round);
    let ws = words(input);
    while (ws.length > 1 && FILLER.has(ws[0])) ws = ws.slice(1);
    if (!ws.length) return { status: 'empty' };
    const j = ws.join(' '), n = round._nameWords.join(' ');
    if (round.type === 'brand') {
      // "honda lawn mowers" -> "lawn mowers"
      for (const p of [n + ' ', n + 's ']) if (j.startsWith(p) && j.length > p.length) { ws = j.slice(p.length).split(' '); break; }
    } else {
      // "nike sneakers" -> "nike"
      for (const s of [' ' + n, ' ' + n.replace(/s$/, '')]) if (j.endsWith(s) && j.length > s.length) { ws = j.slice(0, -s.length).split(' '); break; }
    }
    const keys = variants(ws);
    const main = keys.values().next().value;
    let r = exactLookup(round, keys);
    if (r) return r;
    // chevy -> chevrolet etc
    for (const k of keys) {
      if (NICK[k]) { r = exactLookup(round, keysOf(NICK[k])); if (r) return Object.assign(r, { fuzzy: r.status === 'match' ? 'nickname' : undefined }); }
    }
    r = fuzzyLookup(round, main);
    if (r) return r;
    r = wordLookup(round, ws);
    if (r) return r;
    if (round.type === 'item') {
      for (const m of MEGA) if (keysOf(m).has(main)) {
        return { status: 'mega', answer: { name: m, pts: 5, kind: 'clever', aliases: [], note: 'Sells everything. Nice try.' } };
      }
    }
    return { status: 'none' };
  };

  B.vaultOf = round => round.answers.find(a => a.pts === 100);
  B.deepCuts = function (round, n, skipName) {
    return round.answers.filter(a => a.pts < 100 && a.pts >= 60 && a.name !== skipName)
      .sort((a, b) => b.pts - a.pts).slice(0, n);
  };

  // saving
  const KEY = 'brandle.v1';
  function fresh() { return { settings: { muted: false, muzak: true }, plays: {}, seenHelp: false }; }
  function load() {
    try {
      const d = JSON.parse(root.localStorage.getItem(KEY));
      if (d && d.plays) { d.settings = Object.assign(fresh().settings, d.settings || {}); return d; }
    } catch (e) { /* private mode etc */ }
    return fresh();
  }
  B.store = {
    data: root.localStorage ? load() : fresh(),
    save() { try { root.localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ } }
  };
  B.stats = function () {
    const plays = B.store.data.plays, today = B.todayNum();
    const done = Object.keys(plays).map(Number).filter(k => plays[k].done);
    let n = plays[today] && plays[today].done && plays[today].daily ? today : today - 1, streak = 0;
    while (n >= 1 && plays[n] && plays[n].done && plays[n].daily) { streak++; n--; }
    let best = 0, vaults = 0;
    done.forEach(k => {
      best = Math.max(best, plays[k].total || 0);
      plays[k].rounds.forEach(r => { if (r && r.pts === 100) vaults++; });
    });
    return { streak, best, vaults, played: done.length };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = B;
})(typeof window !== 'undefined' ? window : globalThis);
