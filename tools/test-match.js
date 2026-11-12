// quick autocorrect test
global.window = globalThis;
require('../data/puzzles-01.js');
const B = require('../js/data.js');
B.loadPuzzles();
const d = B.puzzleFor(1);
const R = n => d.rounds.find(r => r.name === n);
const cases = [
  ['Yamaha', 'poano'], ['Yamaha', 'pianoes'], ['Yamaha', 'motercycles'], ['Yamaha', 'jetski'], ['Yamaha', 'archery'],
  ['Yamaha', 'yamaha drums'], ['Yamaha', 'instruments'], ['Yamaha', 'yamaha'], ['Yamaha', 'saxaphone'],
  ['Sneakers', 'rebok'], ['Sneakers', 'sketchers'], ['Sneakers', 'nkie'], ['Sneakers', 'adiddas'], ['Sneakers', 'dunkin donuts'],
  ['Sneakers', 'walmart'], ['Sneakers', 'new balence'], ['Sneakers', 'nike sneakers'], ['Sneakers', 'converce'], ['Sneakers', 'shoes'],
  ['Honda', 'lawnmower'], ['Honda', 'honda lawn mowers'], ['Honda', 'genarator'], ['Honda', 'solar pannels'], ['Honda', 'vehicles'],
  ['Cereal', 'kelogs'], ['Cereal', 'captain crunch'], ['Cereal', 'nintendo'], ['Cereal', 'cherios'], ['Cereal', 'luckycharms'],
  ['Headphones', 'senheiser'], ['Headphones', 'audio technica'], ['Headphones', 'skullcandy'], ['Headphones', 'beats by dre'], ['Headphones', 'dysn'],
  ['IKEA', 'sofa'], ['IKEA', 'meatbals'], ['IKEA', 'blahaj'], ['IKEA', 'houses'], ['IKEA', 'bookshelfs'], ['IKEA', 'sneekers'],
  ['Coca-Cola', 'movies'], ['Coca-Cola', 'drinks'], ['Coca-Cola', 'columbia'], ['Coca-Cola', 'telly'], ['Coca-Cola', 'fridge'],
];
for (const [r, g] of cases) {
  const res = B.judge(R(r), g);
  console.log(r.padEnd(11), g.padEnd(20), '->', res.status, res.answer ? `${res.answer.name} (${res.answer.pts})` : res.reason || '', res.fuzzy || '');
}
