// all sounds are made in code, no audio files
(function () {
  'use strict';
  const B = window.Brandle;
  let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  const A = B.audio = { muted: false, muzak: true };

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = A.muted ? 0 : 0.9; master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  A.unlock = function () { ensure(); if (A.muzak) startMuzak(); };
  A.setMuted = function (m) {
    A.muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.03);
  };

  function tone(f, dur, o) {
    o = o || {};
    const c = ensure(); if (!c || A.muted) return;
    const t = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
    const v = o.vol == null ? 0.3 : o.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(o.bus || sfxBus);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function noise(dur, o) {
    o = o || {};
    const c = ensure(); if (!c || A.muted) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = c.currentTime + (o.delay || 0);
    const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1000, t);
    if (o.slide) f.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
    f.Q.value = o.q || 1;
    const g = c.createGain(), v = o.vol == null ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  A.sfx = {
    beep() { tone(1880, 0.09, { type: 'square', vol: 0.1 }); tone(1880, 0.05, { type: 'square', vol: 0.06, delay: 0.11 }); },
    key() { noise(0.025, { freq: 5000, vol: 0.035, filter: 'highpass' }); },
    ding() {
      tone(1318.5, 1.5, { vol: 0.22 }); tone(2637, 0.5, { vol: 0.04 });
      tone(1046.5, 1.8, { vol: 0.22, delay: 0.24 }); tone(2093, 0.5, { vol: 0.035, delay: 0.24 });
    },
    whoosh(dur) {
      noise(dur, { filter: 'lowpass', freq: 180, slide: 900, vol: 0.16, attack: dur * 0.45 });
      tone(55, dur, { type: 'sawtooth', vol: 0.04, attack: 0.25 });
      tone(110, dur, { type: 'triangle', vol: 0.03, slide: 70 });
    },
    chaching() {
      noise(0.14, { freq: 2800, q: 0.7, vol: 0.25 });
      [2093, 2637, 3136, 4186].forEach((f, i) => tone(f, 0.5, { vol: 0.1, delay: 0.1 + i * 0.06, type: 'triangle' }));
      tone(1568, 1.0, { vol: 0.14, delay: 0.4 }); tone(2093, 1.0, { vol: 0.1, delay: 0.4 });
    },
    fuse() {
      for (let i = 0; i < 8; i++) noise(0.03 + Math.random() * 0.05, { freq: 1500 + Math.random() * 5000, vol: 0.22, delay: i * 0.07 + Math.random() * 0.05, q: 2 });
      tone(90, 0.5, { type: 'sawtooth', vol: 0.06, slide: 40 });
    },
    tick() { tone(1050, 0.04, { type: 'square', vol: 0.05 }); },
    buzz() { tone(196, 0.12, { type: 'square', vol: 0.08 }); tone(147, 0.18, { type: 'square', vol: 0.08, delay: 0.12 }); },
    stamp() { tone(120, 0.2, { vol: 0.45, slide: 45 }); noise(0.09, { freq: 500, vol: 0.3, filter: 'lowpass' }); },
    print(n) { n = n || 12; for (let i = 0; i < n; i++) noise(0.022, { freq: 3800, vol: 0.05, delay: i * 0.05, q: 3 }); },
    start() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.18, { type: 'square', vol: 0.06, delay: i * 0.08 })); },
    coin() { tone(988, 0.07, { type: 'square', vol: 0.06 }); tone(1319, 0.25, { type: 'square', vol: 0.06, delay: 0.07 }); },
    open() { tone(330, 0.12, { type: 'triangle', vol: 0.08 }); tone(440, 0.16, { type: 'triangle', vol: 0.08, delay: 0.08 }); }
  };

  // elevator music
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  // bass note, then chord
  const PROG = [
    [38, 53, 57, 60, 64],  // Dm9
    [43, 53, 59, 64],      // G13
    [36, 52, 55, 59, 62],  // Cmaj9
    [45, 55, 58, 61, 64]   // A7b9
  ];
  const SCALE = [72, 74, 76, 79, 81, 84, 86];
  let timerId = null, step = 0, nextT = 0, melodyNote = null;
  const BPM = 100, EIGHTH = 60 / BPM / 2;

  function ep(f, t, dur, vol) {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o1.type = 'sine'; o2.type = 'triangle';
    o1.frequency.value = f; o2.frequency.value = f * 2.001;
    lp.type = 'lowpass'; lp.frequency.value = 1600;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(lp); lp.connect(musicBus);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  function schedule() {
    while (nextT < ctx.currentTime + 0.25) {
      const bar = Math.floor(step / 8) % PROG.length, e = step % 8, ch = PROG[bar];
      // bass
      if (e === 0) ep(mtof(ch[0]), nextT, 0.5, 0.22);
      if (e === 3) ep(mtof(ch[0] + 7), nextT, 0.3, 0.16);
      if (e === 4) ep(mtof(ch[0] + 7), nextT, 0.5, 0.2);
      if (e === 7) ep(mtof(ch[0]), nextT, 0.3, 0.16);
      // chords
      if (e === 1 || e === 3 || e === 6) ch.slice(1).forEach(m => ep(mtof(m), nextT, 0.28, 0.035));
      // melody
      if ((e === 0 || e === 4) && Math.random() < 0.6) {
        let i = melodyNote == null ? 2 : Math.max(0, Math.min(SCALE.length - 1, melodyNote + Math.round((Math.random() - 0.5) * 3)));
        melodyNote = i;
        ep(mtof(SCALE[i]), nextT, 0.9, 0.05);
      }
      step++; nextT += EIGHTH;
    }
  }
  function startMuzak() {
    if (!ensure()) return;
    musicBus.gain.setTargetAtTime(0.32, ctx.currentTime, 0.6);
    if (timerId) return;
    nextT = ctx.currentTime + 0.1;
    timerId = setInterval(schedule, 60);
  }
  function stopMuzak() {
    if (!ctx) return;
    musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    setTimeout(() => { if (!A.muzak && timerId) { clearInterval(timerId); timerId = null; } }, 1200);
  }
  A.setMuzak = function (on) { A.muzak = on; if (on) startMuzak(); else stopMuzak(); };
  A.duck = function (on) { if (ctx && A.muzak) musicBus.gain.setTargetAtTime(on ? 0.1 : 0.32, ctx.currentTime, 0.2); };
})();
