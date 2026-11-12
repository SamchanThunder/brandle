// checks all the puzzles. run: node tools/validate.js
const fs = require('fs');
const path = require('path');
global.window = globalThis;
const dataDir = path.join(__dirname, '..', 'data');
let warnings = [];
const origWarn = console.warn;
console.warn = (...a) => warnings.push(a.join(' '));
fs.readdirSync(dataDir).filter(f => /^puzzles-\d+\.js$/.test(f)).sort().forEach(f => require(path.join(dataDir, f)));
const B = require('../js/data.js');
const days = B.loadPuzzles();
console.warn = origWarn;

const errors = [];
const err = (d, r, msg) => errors.push(`#${d.num}${r ? ' ' + r.name : ''}: ${msg}`);
warnings.forEach(w => errors.push(w));

days.forEach((d, i) => {
  if (d.num !== i + 1) errors.push(`day numbering: expected ${i + 1}, got ${d.num}`);
  if (d.rounds.length !== 7) err(d, null, `has ${d.rounds.length} rounds`);
  d.rounds.forEach(r => {
    const vaults = r.answers.filter(a => a.pts === 100);
    if (vaults.length !== 1) err(d, r, `${vaults.length} vault answers`);
    vaults.forEach(v => { if (!v.fact) err(d, r, `vault "${v.name}" has no fact`); });
    if (r.answers.length < 10) err(d, r, `only ${r.answers.length} answers`);
    r.answers.forEach(a => {
      if (a.pts % 5 || a.pts < 5 || a.pts > 100) err(d, r, `odd points ${a.pts} for ${a.name}`);
      if (a.kind && !B.KINDS[a.kind]) err(d, r, `unknown kind "${a.kind}" on ${a.name}`);
    });
    const owner = new Map();
    r.answers.forEach(a => [a.name].concat(a.aliases).forEach(s => {
      const k = B.keysOf(s).values().next().value;
      if (!k) return;
      if (owner.has(k) && owner.get(k) !== a.name) err(d, r, `"${s}" collides: ${owner.get(k)} / ${a.name}`);
      owner.set(k, a.name);
    }));
    r.vague.concat(r.excluded).forEach(s => {
      const k = B.keysOf(s).values().next().value;
      if (owner.has(k)) err(d, r, `vague/excluded "${s}" is also answer ${owner.get(k)}`);
    });
    if (r.type === 'item' && !r.icon) err(d, r, 'item round without icon');
  });
});

const rounds = days.reduce((n, d) => n + d.rounds.length, 0);
const answers = days.reduce((n, d) => n + d.rounds.reduce((m, r) => m + r.answers.length, 0), 0);
console.log(`${days.length} days · ${rounds} rounds · ${answers} answers`);
if (errors.length) { console.log(errors.length + ' problem(s):\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('All puzzles valid ✔');
