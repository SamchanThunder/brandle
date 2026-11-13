// one-off: re-rates puzzles-*.js from the original 5-step points (git commit ad7d0a4)
// old 5 -> 15 (gotchas), 10-25 -> 10, 30-45 -> 30, 50-70 -> 60, 75-90 -> 85, 100 stays
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.join(__dirname, '..');
const map = p => p >= 100 ? 100 : p >= 75 ? 85 : p >= 50 ? 60 : p >= 30 ? 30 : p >= 10 ? 10 : 15;
const strip = l => l.replace(/^\d+\s+/, '');
const isAns = l => /^\d+\s+\S/.test(l);
const tally = {};
for (const n of ['01', '02', '03', '04']) {
  const rel = `data/puzzles-${n}.js`;
  const old = cp.execSync(`git show ad7d0a4:${rel}`, { cwd: root, encoding: 'utf8', maxBuffer: 1e8 }).split(/\r?\n/);
  const cur = fs.readFileSync(path.join(root, rel), 'utf8').split(/\r?\n/);
  // match by text (in order), since a couple of lines have moved around since then
  const q = new Map();
  old.filter(isAns).forEach(l => { const k = strip(l); (q.get(k) || q.set(k, []).get(k)).push(parseInt(l, 10)); });
  let miss = 0;
  cur.forEach((l, i) => {
    if (!isAns(l)) return;
    const list = q.get(strip(l));
    if (!list || !list.length) { miss++; return; }
    const np = map(list.shift());
    tally[np] = (tally[np] || 0) + 1;
    cur[i] = l.replace(/^\d+/, np);
  });
  if (miss) console.log(rel, miss, 'lines had no original, left as is');
  fs.writeFileSync(path.join(root, rel), cur.join('\n'));
}
console.log(tally);
