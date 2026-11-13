// prints every answer for a day (or all days), with points and which file/line it's on
// run: node tools/show-day.js 3        (one day)
//      node tools/show-day.js 3 > day3.txt   (save it to read in the editor)
const fs = require('fs'), path = require('path');
global.window = globalThis;
const dir = path.join(__dirname, '..', 'data');
const files = fs.readdirSync(dir).filter(f => /^(puzzles|more)-[a-z0-9]+\.js$/.test(f)).sort();
files.forEach(f => require(path.join(dir, f)));
const B = require('../js/data.js');
const days = B.loadPuzzles();
const want = process.argv[2] ? +process.argv[2] : null;

// where each answer was written: "day|round|name" -> file:line
const where = new Map();
for (const f of files) {
  let day = 0, round = '';
  fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/).forEach((raw, i) => {
    const l = raw.trim();
    let m;
    if ((m = l.match(/^## (\d+)/))) { day = +m[1]; return; }
    if ((m = l.match(/^[BI] ([^|]+)/))) { round = m[1].trim(); return; }
    if ((m = l.match(/^@ (\d+) \| (.+)$/))) { day = +m[1]; round = m[2].trim(); return; }
    if ((m = l.match(/^\d+\s+(.+)$/))) {
      const name = m[1].split('|')[0].split('=')[0].replace(/\s*\([^)]*\)\s*$/, '').trim();
      const k = `${day}|${round}|${name}`;
      if (!where.has(k)) where.set(k, `${f}:${i + 1}`);
    }
  });
}

for (const d of days) {
  if (want && d.num !== want) continue;
  console.log(`\n=========== DAY ${d.num}: ${d.title} ===========`);
  for (const r of d.rounds) {
    console.log(`\n--- ${r.type === 'brand' ? 'BRAND' : 'ITEM'}: ${r.name}${r.twist ? '  [' + r.twist + ']' : ''}  (${r.answers.length} answers)`);
    r.answers.slice().sort((a, b) => a.pts - b.pts || a.name.localeCompare(b.name)).forEach(a => {
      const src = where.get(`${d.num}|${r.name}|${a.name}`) || '?';
      console.log(`${String(a.pts).padStart(3)}  ${a.name}${a.kind ? ' (' + a.kind + ')' : ''}   ${src}`);
    });
  }
}
