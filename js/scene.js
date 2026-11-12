// the pixel world: street, store, elevator, basements
(function () {
  'use strict';
  const B = window.Brandle;
  const FH = 36;               // 10 pts = 1 floor
  const PX_PT = FH / 10;
  const VAULT = 70;

  const cvs = document.getElementById('world');
  const ctx = cvs.getContext('2d', { alpha: false });
  let W = 320, H = 200, S = 3;
  const st = {
    t: 0, last: 0, camY: -140, mode: 'title', depth: 0, anim: null, bounce: 0, bounceOff: 0, shake: 0,
    flash: 0, flashCol: '255,210,63', flicker: 0, parts: [], hop: 0, headShake: 0, vel: 0, onFrame: null
  };

  // helpers
  function hash(n) {
    n |= 0; n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  }
  const h2 = (a, b) => hash(Math.imul(a | 0, 73856093) ^ Math.imul((b | 0) + 1, 19349663));
  function rect(x, y, w, h, c) { if (w <= 0 || h <= 0) return; ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  const lerp = (a, b, t) => a + (b - a) * t;
  function mix(c1, c2, t) {
    const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
    const r = Math.round(lerp(a >> 16, b >> 16, t)), g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t)), bl = Math.round(lerp(a & 255, b & 255, t));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }

  // tiny pixel font
  const FONT = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
    F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
    K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
    P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
    Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
    9: '111101111001110', '.': '000000000000010', '-': '000000111000000', '&': '010101010101011', '!': '010010010000010',
    '%': '101001010100101', ' ': '000000000000000', '/': '001001010100100', '$': '011110010011110', "'": '010010000000000'
  };
  function text(str, x, y, col) {
    ctx.fillStyle = col;
    let cx = Math.round(x); y = Math.round(y);
    for (const ch of String(str).toUpperCase()) {
      const g = FONT[ch] || FONT[' '];
      for (let i = 0; i < 15; i++) if (g.charCodeAt(i) === 49) ctx.fillRect(cx + (i % 3), y + ((i / 3) | 0), 1, 1);
      cx += 4;
    }
  }
  const textW = s => String(s).length * 4 - 1;

  // sprites
  const spriteCache = {};
  function sprite(key, rows, pal) {
    if (spriteCache[key]) return spriteCache[key];
    const c = document.createElement('canvas');
    c.width = rows[0].length; c.height = rows.length;
    const g = c.getContext('2d');
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const p = pal[row[x]]; if (p) { g.fillStyle = p; g.fillRect(x, y, 1, 1); } } });
    return (spriteCache[key] = c);
  }
  function drawSprite(img, x, y, flip) {
    x = Math.round(x); y = Math.round(y);
    if (!flip) { ctx.drawImage(img, x, y); return; }
    ctx.save(); ctx.translate(x + img.width, y); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); ctx.restore();
  }

  const SKU_PAL = { s: '#ffd23f', k: '#1a1024', P: '#ff4f8b', p: '#c22f6b', c: '#fff3dc', b: '#1a1024', e: '#1a1024', m: '#7a1640', w: '#ffffff' };
  const SKU_BODY = [
    '....s.s....',
    '...s...s...',
    '....s.s....',
    '.....s.....',
    '....kkk....',
    '...kPPPk...',
    '..kPPkPPk..',
    '.kPPPPPPPk.',
    '.kPwePwePk.',
    '.kPPPmPPPk.',
    '.kcbcbcbck.',
    '.kcbcbcbck.',
    '.kpppppppk.',
    '..kkkkkkk..'
  ];
  const SKU_BLINK = SKU_BODY.slice(); SKU_BLINK[8] = '.kPkkPkkPk.';
  const LEGS_A = ['...k...k...', '..kk...kk..'];
  const LEGS_B = ['...k...k...', '...kk.kk...'];
  const LEGS_JUMP = ['..k.....k..', '.k.......k.'];
  function skuImg(blink, legs) {
    const key = 'sku' + (blink ? 'b' : '') + legs;
    const L = legs === 'a' ? LEGS_A : legs === 'b' ? LEGS_B : LEGS_JUMP;
    return sprite(key, (blink ? SKU_BLINK : SKU_BODY).concat(L), SKU_PAL);
  }
  const CART = sprite('cart', [
    'k...........',
    '.k..........',
    '.kkkkkkkkkkk',
    '.k.k.k.k.k.k',
    '..kkkkkkkkk.',
    '..k.k.k.k.k.',
    '...kkkkkkk..',
    '...k.....k..',
    '..o.......o.'
  ], { k: '#c9c2dc', o: '#1a1024' });
  const CART_RED = sprite('cartr', [
    'k......rr...',
    '.k.....rr...',
    '.kkkkkkkkkkk',
    '.k.k.k.k.k.k',
    '..kkkkkkkkk.',
    '..k.k.k.k.k.',
    '...kkkkkkk..',
    '...k.....k..',
    '..o.......o.'
  ], { k: '#b9a9b8', o: '#1a1024', r: '#ff3b5c' });
  const FORK = sprite('fork', [
    '.....kkkkk......',
    '.....k...k.....m',
    '.....k...k.....m',
    '..yyyyyyyyyy...m',
    '.yyyyyyyyyyyy..m',
    '.yyyyyyyyyyyy..m',
    '.yyddyyyyyyyy..m',
    '.yyyyyyyyyyyy..m',
    '..oo.....oo..mmm',
    '..oo.....oo.....'
  ], { k: '#1a1024', y: '#ffb347', d: '#c97a1d', m: '#8a8299', o: '#140e1c' });
  const JACK = sprite('jack', [
    'k.........',
    '.k........',
    '..k.......',
    '...kbbbbbb',
    '...kbbbbbb',
    '...kkkkkkk',
    '...o....o.'
  ], { k: '#e04a4a', b: '#b98b55', o: '#140e1c' });
  const RAT = sprite('rat', [
    '...kk...',
    'kkkkkk.e',
    '.k..k...'
  ], { k: '#7d7280', e: '#ff4f8b' });
  const SHOPPER = [
    sprite('shop1', ['.kk.', '.kk.', 'kkkk', 'kkkk', 'kkkk', '.kk.', '.k.k', 'k..k'], { k: '#2a1f40' }),
    sprite('shop2', ['.kk.', '.kk.', 'kkkk', 'kkkk', 'kkkk', '.kk.', '.kk.', '.kk.'], { k: '#2a1f40' })
  ];

  // basement zones, top to bottom
  const ZONES = [
    { from: 1,  wall: '#57467a', wall2: '#4f3f70', trim: '#7b67a6', floor: '#d9cbe8', floor2: '#9d8cbc', light: '#fffaf0', glow: 'rgba(255,248,230,0.10)', lamp: 'tube', plate: '#271c40', label: '#fff3dc', decor: ['rack', 'mannequin', 'table', 'plant', 'display', 'sign', 'rack', 'mannequin'] },
    { from: 10, wall: '#62283f', wall2: '#5a2339', trim: '#8d3a5a', floor: '#c49aa0', floor2: '#86565f', light: '#ffe6ea', glow: 'rgba(255,120,150,0.10)', lamp: 'tube', flicker: true, plate: '#2b0e1b', label: '#ffd0da', decor: ['bin', 'rack', 'sign', 'tags', 'mannequin', 'bin', 'table'] },
    { from: 25, wall: '#1d4643', wall2: '#193d3a', trim: '#2c625d', floor: '#7ea39b', floor2: '#4b6c66', light: '#ddfff5', glow: 'rgba(61,255,197,0.08)', lamp: 'tube', plate: '#0a2220', label: '#c8fff0', decor: ['shelf', 'boxes', 'shelf', 'ladder', 'boxes', 'shelf'] },
    { from: 40, wall: '#38281d', wall2: '#302219', trim: '#5a4130', floor: '#86705a', floor2: '#5a4836', light: '#ffcf7a', glow: 'rgba(255,170,60,0.12)', lamp: 'sodium', plate: '#1c120b', label: '#ffd9a0', decor: ['crates', 'pallet', 'barrels', 'boxes', 'hazard', 'crates'] },
    { from: 55, wall: '#221a25', wall2: '#1c151f', trim: '#3a2d36', floor: '#4f423e', floor2: '#352b29', light: '#ffe2a8', glow: 'rgba(255,214,140,0.08)', lamp: 'bulb', plate: '#110b0f', label: '#cbb89a', decor: ['cabinet', 'dusty', 'cabinet', 'cobweb', 'dusty', 'oldsign'] },
    { from: 70, wall: '#0f0b12', wall2: '#0b080d', trim: '#6b5414', floor: '#3a2e10', floor2: '#1d170a', light: '#ffe9a0', glow: 'rgba(255,210,63,0.12)', lamp: 'bulb', plate: '#000000', label: '#ffd23f', decor: ['gold'] }
  ];
  function zone(k) { let z = ZONES[0]; for (const x of ZONES) if (k >= x.from) z = x; return z; }
  const GARMENT = ['#ff4f8b', '#3dffc5', '#ffd23f', '#5ad1ff', '#fff3dc', '#b28dff', '#ff8a5b'];
  const BOXC = ['#b98b55', '#a07445', '#c9a06a', '#8f6a3d'];

  // layout
  let L = {};
  function layout() {
    const bw = Math.max(92, Math.min(150, Math.round(W * 0.3)));
    const bx0 = W < 200 ? 6 : Math.round(W * 0.1);
    L = { bx0, bw, bx1: bx0 + bw, sx: bx0 + 20, storeH: 66 };
  }
  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    S = Math.max(2, Math.round(vh / 250));
    if (vw / S < 128) S = Math.max(2, Math.floor(vw / 128));
    W = Math.ceil(vw / S); H = Math.ceil(vh / S);
    cvs.width = W; cvs.height = H;
    cvs.style.width = W * S + 'px'; cvs.style.height = H * S + 'px';
    ctx.imageSmoothingEnabled = false;
    layout();
  }

  // camera
  const cabBottom = () => st.depth * PX_PT - 3;
  function camTarget() {
    if (st.mode === 'title') return -Math.round(H * 0.64);
    if (st.mode === 'results') return cabBottom() - Math.round(H * 0.42);
    return cabBottom() - Math.round(H * 0.52);
  }

  // sky + street
  const SKY = [[-280, '#120a26'], [-190, '#24124a'], [-130, '#4a1f6a'], [-85, '#8a2f78'], [-50, '#d4577a'], [-22, '#ff8a70'], [0, '#ffc38a']];
  function skyColor(wy) {
    if (wy <= SKY[0][0]) return SKY[0][1];
    for (let i = 1; i < SKY.length; i++) {
      if (wy <= SKY[i][0]) { const a = SKY[i - 1], b = SKY[i]; return mix(a[1], b[1], (wy - a[0]) / (b[0] - a[0])); }
    }
    return SKY[SKY.length - 1][1];
  }
  function drawSky(sy) {
    const top = Math.max(0, 0), bottom = Math.min(H, sy);
    for (let y = top; y < bottom; y += 3) {
      const wy = Math.floor((y + st.camY) / 6) * 6;
      rect(0, y, W, 3, skyColor(wy));
    }
    // stars
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(hash(i * 3 + 1) * W), wy = -300 + hash(i * 7 + 5) * 190, y = wy - st.camY;
      if (y < 0 || y > sy - 60) continue;
      const tw = hash(i + Math.floor(st.t * 1.5 + i)) > 0.85;
      rect(x, y, 1, 1, tw ? '#fff6d8' : 'rgba(255,240,220,0.55)');
    }
    // sun
    const cx = Math.round(W * 0.8), cy = sy - 26, r = Math.max(14, Math.min(26, Math.round(W * 0.05)));
    for (let y = -r; y <= r; y++) {
      const wy = cy + y;
      if (wy >= sy) break;
      if (y > 0 && ((y + Math.floor(st.t * 4)) % 5 === 0 || (y > r * 0.5 && (y % 3 === 0)))) continue;
      const w = Math.floor(Math.sqrt(r * r - y * y));
      rect(cx - w, wy, w * 2 + 1, 1, mix('#fff0a6', '#ff6f6f', (y + r) / (2 * r)));
    }
    // clouds
    for (let i = 0; i < 5; i++) {
      const speed = 1.5 + hash(i + 40) * 2.5, span = W + 90;
      const x = ((hash(i + 20) * span + st.t * speed) % span) - 60;
      const y = -150 + hash(i + 30) * 90 - st.camY;
      if (y > sy - 20 || y < -20) continue;
      cloud(x, y, 18 + Math.floor(hash(i + 50) * 26), i);
    }
  }
  function cloud(x, y, w, seed) {
    const c1 = 'rgba(255,170,190,0.55)', c2 = 'rgba(255,215,220,0.65)';
    rect(x, y + 4, w, 4, c1);
    rect(x + 3, y + 1, w * 0.5, 4, c2);
    rect(x + w * 0.4, y - 1, w * 0.35, 5, c2);
    rect(x + w * 0.15, y + 3, w * 0.75, 2, c2);
    if (hash(seed) > 0.5) rect(x - 4, y + 6, w * 0.4, 2, c1);
  }
  function drawSkyline(sy) {
    let x = -4, i = 0;
    while (x < W) {
      const w = 10 + Math.floor(h2(i, 3) * 18), h = 18 + Math.floor(h2(i, 4) * 46);
      rect(x, sy - h, w, h, '#2a1846');
      for (let wy = sy - h + 3; wy < sy - 4; wy += 4) for (let wx = x + 2; wx < x + w - 2; wx += 3) {
        const lit = h2(wx * 31 + wy, 9) < 0.18;
        if (lit) rect(wx, wy, 1, 2, h2(wx + wy, Math.floor(st.t / 3)) < 0.97 ? '#ffcf6b' : '#2a1846');
      }
      x += w + (h2(i, 5) < 0.3 ? 2 : 0); i++;
    }
    x = -8; i = 100;
    while (x < W) {
      const w = 14 + Math.floor(h2(i, 3) * 20), h = 8 + Math.floor(h2(i, 4) * 22);
      rect(x, sy - h, w, h, '#1d1033');
      x += w; i++;
    }
  }
  function drawStore(sy) {
    const { bx0, bw, bx1, sx, storeH } = L;
    const top = sy - storeH;
    // walls
    rect(bx0, top, bw, storeH, '#43306b');
    for (let y = top + 2; y < sy - 30; y += 3) {
      const off = ((y - top) / 3) % 2 ? 3 : 0;
      rect(bx0, y, bw, 1, '#3b2a60');
      for (let x = bx0 + off; x < bx1; x += 6) rect(x, y - 2, 1, 2, '#3b2a60');
    }
    // roof sign
    rect(bx0 - 2, top - 3, bw + 4, 3, '#6b55a0'); rect(bx0 - 2, top - 3, bw + 4, 1, '#8f79c6');
    const signW = textW('BRANDLE & CO') + 8, signX = Math.round(bx0 + bw / 2 - signW / 2 + 8), signY = top - 16;
    rect(signX + 4, signY + 9, 1, 4, '#1d1530'); rect(signX + signW - 5, signY + 9, 1, 4, '#1d1530');
    rect(signX, signY, signW, 10, '#1d1530'); rect(signX, signY, signW, 1, '#3a2d5c');
    const on = !(hash(Math.floor(st.t * 6)) < 0.04);
    if (on) { ctx.fillStyle = 'rgba(255,79,139,0.22)'; ctx.fillRect(signX - 2, signY - 2, signW + 4, 14); }
    text('BRANDLE & CO', signX + 4, signY + 3, on ? '#ff8fbc' : '#5c2a45');
    // windows
    for (let x = bx0 + 6; x < bx1 - 8; x += 11) {
      if (x > sx - 16 && x < sx + 14) continue;
      const lit = h2(x, 77) < 0.6;
      rect(x, top + 6, 7, 11, '#2a1d45');
      rect(x + 1, top + 7, 5, 9, lit ? '#ffcf6b' : '#1f1636');
      if (lit) rect(x + 1, top + 7, 5, 2, '#ffe6a6');
      rect(x + 3, top + 7, 1, 9, '#2a1d45');
    }
    // store name
    rect(bx0, top + 21, bw, 8, '#2a1d45');
    const label = bw > 120 ? 'DEPARTMENT STORE' : 'DEPT. STORE';
    text(label, bx0 + bw / 2 - textW(label) / 2 + 8, top + 23, '#ffd23f');
    // awning
    const ay = top + 30;
    for (let x = bx0 - 2; x < bx1 + 2; x++) {
      const pink = Math.floor((x - bx0) / 3) % 2 === 0;
      rect(x, ay, 1, 5, pink ? '#ff4f8b' : '#fff3dc');
      if ((x - bx0) % 6 < 3) rect(x, ay + 5, 1, 1, pink ? '#ff4f8b' : '#fff3dc');
    }
    // display windows
    const gy = ay + 7, gh = sy - 3 - gy;
    rect(bx0, gy, bw, gh, '#2a1d45');
    const doorX = bx1 - 22;
    for (let x = bx0 + 4; x < doorX - 6; x += 24) {
      if (x + 20 > sx - 14 && x < sx + 14) continue;
      const w = Math.min(20, doorX - 4 - x);
      for (let y = 0; y < gh - 2; y++) rect(x, gy + 1 + y, w, 1, mix('#ffe9b8', '#ffb86b', y / gh));
      // mannequins
      for (let m = 0; m < 2; m++) {
        const mx = x + 4 + m * 9, my = sy - 4;
        rect(mx + 1, my - 17, 2, 2, '#3d2b5c');
        rect(mx, my - 15, 4, 6, GARMENT[Math.floor(h2(x, m) * GARMENT.length)]);
        rect(mx + 1, my - 9, 2, 6, '#3d2b5c'); rect(mx, my - 3, 4, 1, '#3d2b5c');
      }
      rect(x, gy + 1, w, 1, '#fff6dc');
    }
    // door
    rect(doorX, gy + 2, 14, gh - 2, '#b8862f');
    rect(doorX + 1, gy + 3, 12, gh - 3, '#1a1228');
    rect(doorX + 6, gy + 3, 1, gh - 3, '#b8862f');
    const openOn = hash(Math.floor(st.t * 3) + 5) > 0.05;
    text('OPEN', doorX - 1, gy - 6 + 2, openOn ? '#3dffc5' : '#1d5c4c');
    // elevator shaft
    rect(sx - 13, top - 8, 26, storeH + 8, '#100b18');
    rect(sx - 15, top - 12, 30, 5, '#2b1f45'); rect(sx - 15, top - 12, 30, 1, '#4a3a70');
    // pulley
    const a = st.t * (st.anim ? 8 : 0.4);
    rect(sx - 2, top - 7, 5, 5, '#8a8299'); rect(sx - 1 + Math.round(Math.cos(a)), top - 6 + Math.round(Math.sin(a)), 1, 1, '#1a1024');
    rect(sx - 14, top - 8, 1, storeH + 8, '#b8862f'); rect(sx + 13, top - 8, 1, storeH + 8, '#b8862f');
  }
  function drawStreetLife(sy) {
    // sidewalk
    rect(0, sy - 3, W, 3, '#5e5478'); rect(0, sy - 3, W, 1, '#8a80a8');
    // street lamps
    for (let x = L.bx1 + 26; x < W - 6; x += 64) {
      rect(x, sy - 30, 1, 27, '#241a38'); rect(x - 2, sy - 31, 5, 2, '#241a38'); rect(x - 1, sy - 29, 3, 1, '#fff3dc');
      for (let j = 0; j < 4; j++) rect(x - 2 - j * 2, sy - 28 + j * 6, 5 + j * 4, 6, 'rgba(255,230,160,0.07)');
    }
    // pedestrians
    for (let i = 0; i < 4; i++) {
      const dir = hash(i + 60) < 0.5 ? 1 : -1, sp = 6 + hash(i + 61) * 8, span = W + 20;
      const x = (((hash(i + 62) * span + dir * st.t * sp) % span) + span) % span - 10;
      if (x > L.sx - 16 && x < L.sx + 14) continue;
      drawSprite(SHOPPER[Math.floor(st.t * 4 + i) % 2], x, sy - 11, dir < 0);
    }
  }

  // basement floors
  function drawDecor(kind, x, fy, k, i, z) {
    const r = h2(k, i + 300);
    switch (kind) {
      case 'rack': {
        rect(x, fy - 16, 1, 16, '#2a2238'); rect(x + 15, fy - 16, 1, 16, '#2a2238'); rect(x, fy - 16, 16, 1, '#c9c2dc');
        for (let g = 0; g < 5; g++) {
          const c = GARMENT[Math.floor(h2(k * 9 + i, g) * GARMENT.length)];
          rect(x + 2 + g * 3, fy - 15, 2, 7 + Math.floor(h2(k, g + i) * 3), c);
        }
        return 16;
      }
      case 'mannequin': {
        const c = GARMENT[Math.floor(r * GARMENT.length)];
        rect(x + 2, fy - 18, 2, 2, '#e8dcc8'); rect(x + 1, fy - 16, 4, 6, c); rect(x, fy - 15, 1, 4, '#e8dcc8'); rect(x + 5, fy - 15, 1, 4, '#e8dcc8');
        rect(x + 2, fy - 10, 1, 7, '#e8dcc8'); rect(x + 3, fy - 10, 1, 7, '#e8dcc8'); rect(x + 1, fy - 3, 4, 1, '#2a2238');
        return 6;
      }
      case 'table': {
        rect(x, fy - 7, 14, 2, '#8a6a46'); rect(x + 1, fy - 5, 1, 5, '#5c452c'); rect(x + 12, fy - 5, 1, 5, '#5c452c');
        rect(x + 2, fy - 9, 4, 2, GARMENT[Math.floor(r * 7)]); rect(x + 2, fy - 11, 4, 2, GARMENT[Math.floor(r * 5 + 1) % 7]);
        rect(x + 8, fy - 9, 4, 2, GARMENT[Math.floor(r * 3 + 2) % 7]);
        return 14;
      }
      case 'plant': {
        rect(x + 1, fy - 4, 4, 4, '#b0603a'); rect(x + 2, fy - 9, 2, 5, '#2f9e6a'); rect(x, fy - 8, 2, 2, '#3dbb7a'); rect(x + 4, fy - 10, 2, 3, '#3dbb7a'); rect(x + 1, fy - 11, 2, 2, '#57d68f');
        return 6;
      }
      case 'display': {
        rect(x + 1, fy - 7, 7, 7, '#efe6d6'); rect(x + 1, fy - 7, 7, 1, '#ffffff');
        rect(x + 2, fy - 12, 5, 5, GARMENT[Math.floor(r * 7)]); rect(x + 3, fy - 11, 1, 1, '#fff');
        return 9;
      }
      case 'sign': {
        const words = z === ZONES[0] ? ['NEW', 'SALE', 'HOT'] : ['50%', 'SALE', '70%', 'LAST'];
        const w = words[Math.floor(r * words.length)];
        const sw = textW(w) + 4, sy = fy - 26;
        rect(x, sy, sw, 9, '#fff3dc'); rect(x, sy + 8, sw, 1, '#c9b89a');
        text(w, x + 2, sy + 2, '#e8344e');
        return sw;
      }
      case 'bin': {
        rect(x, fy - 8, 14, 8, '#c43d5c'); rect(x, fy - 8, 14, 1, '#ff6b8b'); rect(x + 1, fy - 5, 12, 1, '#a02e4a');
        for (let j = 0; j < 4; j++) rect(x + 1 + j * 3, fy - 10 - Math.floor(h2(k, j) * 2), 2, 2, GARMENT[(j + Math.floor(r * 7)) % 7]);
        text('$1', x + 4, fy - 4, '#fff3dc');
        return 14;
      }
      case 'tags': {
        const top = fy - FH + 6;
        for (let j = 0; j < 3; j++) { const tx = x + j * 4, len = 4 + Math.floor(h2(k, j + 9) * 8); rect(tx + 1, top, 1, len, '#c9b89a'); rect(tx, top + len, 3, 4, '#ff3b5c'); }
        return 12;
      }
      case 'shelf': {
        rect(x, fy - 25, 1, 25, '#7d8b96'); rect(x + 17, fy - 25, 1, 25, '#7d8b96');
        for (let s = 0; s < 3; s++) {
          const yy = fy - 1 - s * 8; rect(x, yy, 18, 1, '#9fb0bc');
          let bx = x + 1;
          while (bx < x + 15) { const bw = 3 + Math.floor(h2(k * 7 + s, bx) * 4); const bh = 3 + Math.floor(h2(bx, s + k) * 4); if (bx + bw > x + 17) break; rect(bx, yy - bh, bw, bh, BOXC[Math.floor(h2(bx, k) * 4)]); rect(bx, yy - bh, bw, 1, '#d8b47e'); bx += bw + 1; }
        }
        return 18;
      }
      case 'boxes': {
        let y = fy, n = 2 + Math.floor(r * 3);
        for (let j = 0; j < n; j++) { const w = 7 + Math.floor(h2(k, j + i) * 5), h = 5 + Math.floor(h2(j, k + i) * 3); const ox = Math.floor(h2(j, i) * 3); rect(x + ox, y - h, w, h, BOXC[j % 4]); rect(x + ox, y - h, w, 1, '#d8b47e'); rect(x + ox + Math.floor(w / 2), y - h, 1, h, '#8f6a3d'); y -= h; }
        return 13;
      }
      case 'ladder': {
        rect(x, fy - 22, 1, 22, '#d9a441'); rect(x + 5, fy - 22, 1, 22, '#d9a441');
        for (let y = fy - 20; y < fy; y += 4) rect(x, y, 6, 1, '#d9a441');
        return 6;
      }
      case 'crates': {
        for (let j = 0; j < 2; j++) { const cx = x + j * 7, h = j ? 7 : 10; rect(cx, fy - h, 7, h, '#8a5a32'); rect(cx, fy - h, 7, 1, '#b07a48'); rect(cx, fy - h + 3, 7, 1, '#6b4426'); rect(cx + 3, fy - h, 1, h, '#6b4426'); }
        return 14;
      }
      case 'pallet': {
        rect(x, fy - 2, 16, 2, '#9a7a4a'); rect(x + 1, fy - 11, 14, 9, 'rgba(210,225,235,0.55)');
        for (let j = 0; j < 3; j++) rect(x + 2 + j * 5, fy - 10, 4, 7, BOXC[(j + i) % 4]);
        return 16;
      }
      case 'barrels': {
        for (let j = 0; j < 2; j++) { const bx = x + j * 7, c = r < 0.5 ? '#3a6ea5' : '#a33a3a'; rect(bx, fy - 10, 6, 10, c); rect(bx, fy - 8, 6, 1, '#1a1024'); rect(bx, fy - 3, 6, 1, '#1a1024'); rect(bx + 1, fy - 10, 1, 10, 'rgba(255,255,255,0.18)'); }
        return 13;
      }
      case 'hazard': {
        const yy = fy - 20;
        for (let j = 0; j < 16; j++) rect(x + j, yy, 1, 3, Math.floor((j + Math.floor(st.t * 0)) / 2) % 2 ? '#1a1024' : '#ffd23f');
        text('DOCK ' + (1 + (k % 9)), x, yy + 5, '#ffd23f');
        return 24;
      }
      case 'cabinet': {
        rect(x, fy - 17, 9, 17, '#55505e'); rect(x, fy - 17, 9, 1, '#77707f');
        for (let d = 0; d < 4; d++) { rect(x + 1, fy - 16 + d * 4, 7, 3, '#4a4553'); rect(x + 3, fy - 15 + d * 4, 3, 1, '#a39ca8'); }
        return 9;
      }
      case 'dusty': {
        rect(x, fy - 9, 15, 9, '#6b5a48'); rect(x, fy - 9, 15, 1, '#8a7660'); text('OLD', x + 2, fy - 7, '#3b3027');
        rect(x + 3, fy - 15, 9, 6, '#5d4e3f'); rect(x + 3, fy - 15, 9, 1, '#7a6853');
        return 15;
      }
      case 'cobweb': {
        const top = fy - FH + 5;
        for (let j = 0; j < 7; j++) { rect(x + j, top + j, 1, 1, 'rgba(200,190,200,0.4)'); rect(x, top + j, 1, 1, 'rgba(200,190,200,0.3)'); rect(x + j, top, 1, 1, 'rgba(200,190,200,0.3)'); }
        rect(x + 2, top + 4, 3, 1, 'rgba(200,190,200,0.3)');
        return 8;
      }
      case 'oldsign': {
        const w = r < 0.5 ? 'SALE' : 'CLOSED';
        const sw = textW(w) + 4; rect(x, fy - 25, sw, 9, '#8a7a62'); text(w, x + 2, fy - 23, '#5a3a2a');
        return sw;
      }
      case 'gold': {
        for (let j = 0; j < 4; j++) { rect(x + j * 4, fy - 3, 4, 3, '#ffd23f'); rect(x + j * 4, fy - 3, 4, 1, '#fff2a8'); }
        for (let j = 0; j < 3; j++) { rect(x + 2 + j * 4, fy - 6, 4, 3, '#e8b923'); rect(x + 2 + j * 4, fy - 6, 4, 1, '#fff2a8'); }
        return 17;
      }
    }
    return 8;
  }
  function drawLight(x, y0, z, k, i) {
    const flickOff = (z.flicker && h2(k * 13 + i, Math.floor(st.t * 7)) < 0.06) || (st.flicker > 0 && hash(Math.floor(st.t * 30) + i + k) < 0.5);
    if (z.lamp === 'tube') {
      rect(x - 1, y0 + 2, 14, 2, '#3a3348');
      rect(x, y0 + 3, 12, 1, flickOff ? '#5a5468' : z.light);
      if (!flickOff) for (let j = 0; j < 5; j++) rect(x - 2 - j * 3, y0 + 4 + j * 6, 16 + j * 6, 6, z.glow);
    } else if (z.lamp === 'sodium') {
      rect(x, y0 + 2, 1, 3, '#1a1024'); rect(x - 3, y0 + 5, 7, 2, '#2b2030'); rect(x - 2, y0 + 7, 5, 1, flickOff ? '#5a4a30' : z.light);
      if (!flickOff) for (let j = 0; j < 5; j++) rect(x - 3 - j * 3, y0 + 8 + j * 5, 7 + j * 6, 5, z.glow);
    } else {
      const sway = Math.round(Math.sin(st.t * 1.3 + k + i) * 1.5);
      rect(x, y0 + 2, 1, 6, '#2a2230'); rect(x - 1 + sway, y0 + 8, 3, 3, flickOff ? '#5a4a30' : z.light);
      if (!flickOff) for (let j = 0; j < 4; j++) rect(x - 2 - j * 3 + sway, y0 + 11 + j * 5, 7 + j * 6, 5, z.glow);
    }
  }
  function inShaft(x, w) { return x + w > L.sx - 15 && x < L.sx + 32; }

  function drawFloor(k) {
    const y0 = Math.round((k - 1) * FH - st.camY);
    if (y0 > H || y0 + FH < 0) return;
    if (k > VAULT) { drawBedrock(k, y0); return; }
    const z = zone(k);
    rect(0, y0, W, FH, z.wall);
    // wallpaper
    if (z === ZONES[0]) { for (let x = (k * 3) % 8; x < W; x += 8) rect(x, y0 + 4, 1, FH - 16, z.wall2); }
    else if (z === ZONES[1]) { for (let x = (k * 5) % 12; x < W; x += 12) rect(x, y0 + 4, 4, FH - 16, z.wall2); }
    else if (z === ZONES[2]) { for (let y = y0 + 5; y < y0 + FH - 4; y += 5) { rect(0, y, W, 1, z.wall2); for (let x = ((y - y0) / 5 % 2) * 6; x < W; x += 12) rect(x, y - 4, 1, 4, z.wall2); } }
    else if (z === ZONES[3]) { for (let x = 0; x < W; x += 3) rect(x, y0 + 3, 1, FH - 6, z.wall2); }
    else if (z === ZONES[4]) { for (let x = (k * 7) % 14; x < W; x += 14) rect(x, y0 + 3, 1, FH - 6, z.wall2); rect(0, y0 + FH - 14, W, 1, z.trim); }
    else { for (let x = 0; x < W; x += 9) { rect(x, y0 + 4, 1, 1, '#6b5414'); rect(x + 4, y0 + FH - 8, 1, 1, '#6b5414'); } rect(0, y0 + 2, W, 1, '#6b5414'); }
    rect(0, y0 + FH - 12, W, 1, z.trim);
    // ceiling + floor
    rect(0, y0, W, 2, '#120d1a');
    rect(0, y0 + FH - 3, W, 3, z.floor2); rect(0, y0 + FH - 3, W, 1, z.floor);
    // lights
    let li = 0;
    for (let x = 14 + (k * 11) % 26; x < W - 8; x += 44) { if (!inShaft(x, 14)) drawLight(x, y0, z, k, li); li++; }
    // decor
    const fy = y0 + FH - 3;
    if (k === VAULT) { drawVaultRoom(y0, fy); return; }
    let x = 3 + Math.floor(h2(k, 1) * 14), i = 0;
    while (x < W - 4 && i < 40) {
      const kind = z.decor[Math.floor(h2(k, i + 2) * z.decor.length)];
      let w = 16;
      if (!inShaft(x, 18)) w = drawDecor(kind, x, fy, k, i, z);
      x += w + 5 + Math.floor(h2(k, i + 50) * 20); i++;
    }
  }
  function drawVaultRoom(y0, fy) {
    const cx = Math.round(Math.max(L.sx + 60, W * 0.62)), cy = y0 + 17, r = 14;
    for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y)); rect(cx - w, cy + y, w * 2 + 1, 1, Math.abs(y) > r - 3 || w > r - 3 ? '#8a6a14' : '#c9a227'); }
    const a = st.t * 0.6;
    for (let s = 0; s < 6; s++) { const ang = a + s * Math.PI / 3; for (let d = 2; d < 9; d++) rect(cx + Math.round(Math.cos(ang) * d), cy + Math.round(Math.sin(ang) * d), 1, 1, '#6b5414'); }
    rect(cx - 2, cy - 2, 5, 5, '#fff2a8');
    text('VAULT', cx - 9, y0 + 3, '#ffd23f');
    drawDecor('gold', cx - 44, fy, 70, 1, ZONES[5]); drawDecor('gold', cx + 22, fy, 70, 2, ZONES[5]);
  }
  function drawBedrock(k, y0) {
    rect(0, y0, W, FH, '#0b080e');
    for (let i = 0; i < 18; i++) rect(Math.floor(h2(k, i) * W), y0 + Math.floor(h2(i, k) * FH), 3, 2, '#17121c');
  }

  function drawMovers(k) {
    const y0 = (k - 1) * FH - st.camY, fy = y0 + FH - 3;
    if (y0 > H || y0 + FH < 0 || k >= VAULT) return;
    if (h2(k, 900) > 0.75) return;
    const z = zone(k), dir = h2(k, 901) < 0.5 ? 1 : -1, sp = 5 + h2(k, 902) * 9, span = W + 40;
    const x = (((h2(k, 903) * span + dir * st.t * sp) % span) + span) % span - 20;
    if (z === ZONES[0]) drawSprite(CART, x, fy - 9, dir < 0);
    else if (z === ZONES[1]) {
      if (h2(k, 904) < 0.5) drawSprite(CART_RED, x, fy - 9, dir < 0);
      else { const fall = (st.t * 9 + h2(k, 905) * 30) % (FH - 8); const tx = Math.floor(h2(k, 906) * W); rect(tx, y0 + 4 + fall, 3, 4, '#ff3b5c'); rect(tx + 1, y0 + 3 + fall, 1, 1, '#c9b89a'); }
    }
    else if (z === ZONES[2]) drawSprite(JACK, x, fy - 7, dir < 0);
    else if (z === ZONES[3]) drawSprite(FORK, x, fy - 10, dir > 0);
    else if (z === ZONES[4]) {
      const rx = (((h2(k, 903) * span + dir * st.t * sp * 3) % span) + span) % span - 20;
      if (Math.floor(st.t / 4 + k) % 3 === 0) drawSprite(RAT, rx, fy - 3, dir > 0);
      const mx = 30 + h2(k, 907) * (W - 60), my = y0 + 10;
      rect(mx + Math.round(Math.sin(st.t * 9 + k) * 3), my + Math.round(Math.cos(st.t * 7 + k) * 2), 1, 1, '#cbb89a');
    }
  }

  function drawShaft() {
    const top = Math.max(0, Math.round(-L.storeH - 8 - st.camY)), x0 = L.sx - 13;
    if (top >= H) return;
    rect(x0, top, 26, H - top, '#100b18');
    rect(x0 + 1, top, 1, H - top, '#3b3350'); rect(x0 + 24, top, 1, H - top, '#3b3350');
    const off = ((-st.camY % 9) + 9) % 9;
    for (let y = top + off; y < H; y += 9) { rect(x0 + 2, y, 3, 1, '#2a2240'); rect(x0 + 21, y, 3, 1, '#2a2240'); }
    rect(x0, top, 1, H - top, '#b8862f'); rect(x0 + 25, top, 1, H - top, '#b8862f');
    // floor numbers
    const k0 = Math.max(1, Math.floor(st.camY / FH)), k1 = Math.ceil((st.camY + H) / FH) + 1;
    for (let k = k0; k <= Math.min(k1, VAULT); k++) {
      const y0 = Math.round((k - 1) * FH - st.camY), z = zone(k);
      rect(x0 - 2, y0 + FH - 3, 30, 3, '#b8862f'); rect(x0 - 2, y0 + FH - 3, 30, 1, '#ffd88a');
      const lbl = 'B' + k, pw = textW(lbl) + 4, px = x0 + 29;
      rect(px, y0 + 9, pw, 9, '#b8862f'); rect(px + 1, y0 + 10, pw - 2, 7, z.plate);
      text(lbl, px + 2, y0 + 11, z.label);
    }
  }

  function drawCab() {
    const by = cabBottom() - st.camY + st.bounceOff;
    const x0 = L.sx - 10, top = Math.round(by - 24);
    const vib = st.anim ? (Math.floor(st.t * 30) % 2) : 0;
    const cableTop = Math.max(0, Math.round(-L.storeH - 6 - st.camY));
    if (top > cableTop) rect(L.sx + vib * 0, cableTop, 1, top - 3 - cableTop, '#9a92ad');
    // hanger
    rect(L.sx - 3, top - 3, 7, 1, '#6e5320'); rect(L.sx - 1, top - 4, 3, 2, '#8a6a2a');
    // car
    rect(x0, top, 21, 25, '#2a1f33');
    rect(x0 + 1, top + 1, 19, 2, '#ffe9b0');
    for (let j = 0; j < 3; j++) rect(x0 + 1, top + 3 + j * 4, 19, 4, 'rgba(255,233,176,' + (0.18 - j * 0.05) + ')');
    // SKU
    const blink = (st.t % 3.2) < 0.12;
    const hopY = st.hop > 0 ? -Math.round(Math.sin(st.hop * Math.PI) * 6) : 0;
    const legs = st.hop > 0 ? 'j' : (st.anim ? 'j' : (Math.floor(st.t * 2) % 2 ? 'a' : 'b'));
    const bob = st.anim ? 0 : (Math.floor(st.t * 2) % 2);
    const shx = st.headShake > 0 ? Math.round(Math.sin(st.headShake * 40) * 1.5) : 0;
    drawSprite(skuImg(blink, legs), L.sx - 5 + shx, Math.round(by) - 2 - 16 + hopY + bob);
    // cage bars
    rect(x0, top, 21, 1, '#d9a441'); rect(x0, top + 23, 21, 2, '#d9a441'); rect(x0, top + 23, 21, 1, '#ffd88a');
    rect(x0, top, 1, 25, '#d9a441'); rect(x0 + 20, top, 1, 25, '#d9a441');
    rect(x0 + 4, top + 3, 1, 20, 'rgba(217,164,65,0.6)'); rect(x0 + 16, top + 3, 1, 20, 'rgba(217,164,65,0.6)');
    // little light
    rect(L.sx, top - 1, 1, 1, st.anim ? (Math.floor(st.t * 8) % 2 ? '#ff4f8b' : '#ffd23f') : '#3dffc5');
  }

  function drawRuler() {
    const x = W - 2;
    const k0 = Math.max(0, Math.floor(st.camY / FH)), k1 = Math.ceil((st.camY + H) / FH);
    for (let k = k0; k <= k1; k++) {
      const y = Math.round(k * FH - st.camY);
      if (y < 0 || y > H) continue;
      const major = k % 10 === 0;
      rect(x - (major ? 5 : 2), y, major ? 5 : 2, 1, 'rgba(255,243,220,0.35)');
      if (major && k > 0) text('B' + k, x - 6 - textW('B' + k), y - 2, 'rgba(255,243,220,0.45)');
    }
    rect(x, 0, 1, H, 'rgba(255,243,220,0.15)');
  }

  function drawDust() {
    const streetY = -st.camY;
    for (let i = 0; i < 46; i++) {
      const x = Math.floor(hash(i + 400) * W);
      const y = (((hash(i + 500) * H - st.t * (2 + hash(i) * 5)) % H) + H) % H;
      if (y < streetY + 2) continue;
      rect(x, y, 1, 1, i % 3 ? 'rgba(255,240,220,0.18)' : 'rgba(255,240,220,0.32)');
    }
    if (Math.abs(st.vel) > 30) {
      const len = Math.min(26, Math.abs(st.vel) * 0.06);
      for (let i = 0; i < 16; i++) {
        const x = Math.floor(hash(i + 700) * W);
        const y = (((hash(i + 800) * H - st.t * st.vel * 1.3) % H) + H) % H;
        if (y < streetY) continue;
        rect(x, y, 1, len, 'rgba(255,255,255,0.10)');
      }
    }
  }

  // coins, sparks, confetti
  function burst(type, n) {
    const by = cabBottom() - 14;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 70;
      st.parts.push({ type, x: L.sx + (Math.random() - 0.5) * 10, y: by, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 50, life: 1.4 + Math.random() * 0.8, age: 0 });
    }
  }
  function updateParts(dt) {
    st.parts = st.parts.filter(p => (p.age += dt) < p.life);
    for (const p of st.parts) {
      p.vy += (p.type === 'spark' ? 160 : 110) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.99;
      const sx = Math.round(p.x), sy = Math.round(p.y - st.camY);
      if (p.type === 'coin') { const f = Math.floor(p.age * 10) % 3; rect(sx, sy, f === 1 ? 1 : 2, 2, '#ffd23f'); rect(sx, sy, 1, 1, '#fff2a8'); }
      else if (p.type === 'spark') rect(sx, sy, 1, 1, Math.random() < 0.5 ? '#fff6c8' : '#ffb347');
      else rect(sx, sy, 2, 1, Math.random() < 0.5 ? '#fff3dc' : '#ff4f8b');
    }
  }

  // loop
  const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function frame(now) {
    const dt = Math.min(0.05, (now - (st.last || now)) / 1000);
    st.last = now; st.t += dt;
    const prevDepth = st.depth;
    if (st.anim) {
      const a = st.anim, p = Math.min(1, (now - a.t0) / a.dur);
      st.depth = a.from + (a.to - a.from) * easeInOut(p);
      if (p >= 1) { st.anim = null; st.depth = a.to; st.bounce = 1; if (a.cb) a.cb(); }
    }
    st.vel = (st.depth - prevDepth) * PX_PT / Math.max(dt, 0.001);
    st.bounce = Math.max(0, st.bounce - dt * 2.2);
    st.bounceOff = Math.round(Math.sin(st.bounce * 18) * st.bounce * 2.5);
    st.hop = st.hop > 0 ? Math.max(0, st.hop - dt * 2.2) : 0;
    st.headShake = Math.max(0, st.headShake - dt);
    st.flicker = Math.max(0, st.flicker - dt);
    st.flash = Math.max(0, st.flash - dt * 1.4);
    st.shake = Math.max(0, st.shake - dt);

    const target = camTarget();
    const follow = st.anim ? 1 : Math.min(1, dt * 3.5);
    st.camY += (target - st.camY) * follow;
    const camSave = st.camY;
    if (st.shake > 0) st.camY += Math.round((Math.random() - 0.5) * 3);

    render(dt);
    st.camY = camSave;
    if (st.onFrame) st.onFrame(st.depth);
    requestAnimationFrame(frame);
  }
  function render(dt) {
    const sy = Math.round(-st.camY);
    // background
    rect(0, 0, W, H, '#0b0810');
    if (sy > 0) { drawSky(sy); drawSkyline(sy); }
    const k0 = Math.max(1, Math.floor(st.camY / FH)), k1 = Math.ceil((st.camY + H) / FH) + 1;
    for (let k = k0; k <= k1; k++) drawFloor(k);
    for (let k = k0; k <= k1; k++) drawMovers(k);
    if (sy > -10 && sy < H + 120) { rect(0, sy, W, 3, '#1a1424'); drawStore(sy); drawStreetLife(sy); }
    drawShaft();
    drawDust();
    drawCab();
    updateParts(dt);
    drawRuler();
    if (st.flash > 0) { ctx.fillStyle = 'rgba(' + st.flashCol + ',' + (st.flash * 0.45).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
    if (st.flicker > 0 && hash(Math.floor(st.t * 25)) < 0.35) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H); }
  }

  // used by game.js
  B.scene = {
    FH,
    setMode(m) { st.mode = m; },
    setDepth(pts) { st.depth = pts; st.anim = null; },
    snap() { st.camY = camTarget(); },
    depth: () => st.depth,
    onFrame(fn) { st.onFrame = fn; },
    descend(pts, cb) {
      if (pts <= 0) {
        st.shake = 0.6; st.flicker = 1.1; st.headShake = 0.6; burst('spark', 26);
        B.audio.sfx.fuse();
        setTimeout(cb, 1100);
        return;
      }
      const floors = pts / 10;
      const dur = Math.min(2600, 700 + floors * 260);
      B.audio.sfx.whoosh(dur / 1000);
      st.anim = { from: st.depth, to: st.depth + pts, t0: performance.now(), dur, cb: () => {
        if (pts >= 100) { st.flash = 1; st.flashCol = '255,210,63'; st.hop = 1; burst('coin', 46); burst('confetti', 30); }
        else if (pts >= 60) { st.hop = 1; burst('confetti', 14); }
        cb && cb();
      } };
    },
    nope() { st.headShake = 0.5; },
    // wrong guess: jolt + sparks, but the round keeps going
    miss() {
      st.shake = 0.45; st.flicker = 0.5; st.headShake = 0.5; st.bounce = 0.8;
      burst('spark', 16);
      B.audio.sfx.fuse();
    },
    hop() { st.hop = 1; }
  };

  resize();
  window.addEventListener('resize', () => { resize(); });
  st.camY = camTarget();
  requestAnimationFrame(frame);
})();
