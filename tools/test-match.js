// quick autocorrect test. run: node tools/test-match.js
const fs = require('fs');
const path = require('path');
global.window = globalThis;
const dir = path.join(__dirname, '..', 'data');
fs.readdirSync(dir).filter(f => /^puzzles-\d+\.js$/.test(f)).sort().forEach(f => require(path.join(dir, f)));
const B = require('../js/data.js');
B.loadPuzzles();
const find = name => { for (const d of B.puzzles) for (const r of d.rounds) if (r.name === name) return r; throw new Error('no round ' + name); };

// [round, what they typed, answer we expect (null = no match, 'retry' = try again)]
const cases = [
  ['Yamaha', 'poano', 'Pianos'], ['Yamaha', 'pianoes', 'Pianos'], ['Yamaha', 'motercycles', 'Motorcycles'],
  ['Yamaha', 'jetski', 'Jet Skis'], ['Yamaha', 'archery', 'Archery Bows'], ['Yamaha', 'yamaha drums', 'Drums'],
  ['Yamaha', 'instruments', 'retry'], ['Yamaha', 'yamaha', 'retry'], ['Yamaha', 'saxaphone', 'Band Instruments'],
  ['Yamaha', 'grand pianos', 'Pianos'], ['Yamaha', 'bow and arrows', 'Archery Bows'], ['Yamaha', 'golf carts for golf', 'Golf Carts'],
  ['Yamaha', 'outbord motor', 'Outboard Motors'], ['Yamaha', 'electric guitars', 'Guitars'], ['Yamaha', 'snow mobiles', 'Snowmobiles'],
  ['Sneakers', 'rebok', 'Reebok'], ['Sneakers', 'sketchers', 'Skechers'], ['Sneakers', 'nkie', 'Nike'], ['Sneakers', 'adiddas', 'Adidas'],
  ['Sneakers', 'dunkin donuts', "Dunkin'"], ['Sneakers', 'new balence', 'New Balance'], ['Sneakers', 'nike sneakers', 'Nike'],
  ['Sneakers', 'converce', 'Converse'], ['Sneakers', 'shoes', 'retry'], ['Sneakers', 'just do it nike', 'Nike'],
  ['Sneakers', 'under armor shoes', 'Under Armour'], ['Sneakers', 'hokka', 'Hoka'], ['Sneakers', 'asics running shoes', 'Asics'],
  ['Honda', 'lawnmower', 'Lawn Mowers'], ['Honda', 'honda lawn mowers', 'Lawn Mowers'], ['Honda', 'genarator', 'Generators'],
  ['Honda', 'solar pannels', 'Solar Panels'], ['Honda', 'vehicles', 'retry'], ['Honda', 'panels', 'Solar Panels'],
  ['Honda', 'private jets', 'Jets'], ['Honda', 'hondajet airplane', 'Jets'], ['Honda', 'boat engins', 'Outboard Motors'],
  ['Honda', 'asimo robot', 'Robots'], ['Honda', 'snow blowers', 'Snowblowers'], ['Honda', 'dirtbikes', 'Motorcycles'],
  ['Cereal', 'kelogs', "Kellogg's"], ['Cereal', 'captain crunch', "Cap'n Crunch"], ['Cereal', 'nintendo', 'Nintendo'],
  ['Cereal', 'cherios', 'Cheerios'], ['Cereal', 'luckycharms', 'Lucky Charms'], ['Cereal', 'froot loop', 'Froot Loops'],
  ['Cereal', 'honey nut cheerios', 'Cheerios'], ['Cereal', 'general mils', 'General Mills'],
  ['Headphones', 'senheiser', 'Sennheiser'], ['Headphones', 'audio technica', 'Audio-Technica'], ['Headphones', 'beats by dre', 'Beats'],
  ['Headphones', 'dysn', 'Dyson'], ['Headphones', 'airpod', 'Apple'], ['Headphones', 'bose quietcomfort', 'Bose'],
  ['IKEA', 'sofa', 'retry'], ['IKEA', 'meatbals', 'Meatballs'], ['IKEA', 'blahaj', 'Blåhaj'], ['IKEA', 'houses', 'Houses'],
  ['IKEA', 'bookshelfs', 'retry'], ['IKEA', 'sneekers', 'Sneakers'], ['IKEA', 'swedish meat balls', 'Meatballs'],
  ['IKEA', 'shark plushie', 'Blåhaj'], ['IKEA', 'storage cabinet', 'retry'], ['IKEA', 'prefab houses', 'Houses'],
  ['Coca-Cola', 'movies', 'Movies'], ['Coca-Cola', 'drinks', 'retry'], ['Coca-Cola', 'columbia', 'Movies'],
  ['Coca-Cola', 'fridge', 'Vending Machines'], ['Coca-Cola', 'christmas ornament', 'Christmas Ornaments'],
  ['Coca-Cola', 'bottled waters', 'Water'], ['Coca-Cola', 'columbia pictures movies', 'Movies'],
  ['Batteries', 'duracel', 'Duracell'], ['Batteries', 'energiser', 'Energizer'], ['Pizza', 'frozen pizza from dr oetker', 'Dr. Oetker'],
  ['Pizza', 'dominoes', "Domino's"], ['Pizza', 'papa jons', "Papa John's"], ['Pizza', 'little ceasars', 'Little Caesars'],
  ['Cars', 'lamborgini', 'Lamborghini'], ['Cars', 'chevy', 'Chevrolet'], ['Cars', 'mercedes', 'Mercedes-Benz'],
  ['Cars', 'volkswagon', 'Volkswagen'], ['Cars', 'porshe', 'Porsche'], ['Cars', 'ferari', 'Ferrari'],
  ['Hershey', 'hersheys kisses', 'Kisses'], ['Hershey', 'reeses cups', "Reese's"], ['Hershey', 'twizzler', 'Twizzlers'],
  ['Toothpaste', 'colgat', 'Colgate'], ['Toothpaste', 'sensodine', 'Sensodyne'], ['Toothpaste', 'arm and hammer', 'Arm & Hammer'],
  ['Microsoft', 'zune player', 'Zune'], ['Microsoft', 'xbox consoles', 'Xbox'], ['Microsoft', 'barny', 'Talking Barney'],
  ['Jeans', 'levis', "Levi's"], ['Jeans', 'wrangler jeans', 'Wrangler'], ['Jeans', 'calvin klien', 'Calvin Klein'],
  ['Sunglasses', 'raybans', 'Ray-Ban'], ['Sunglasses', 'oakleys', 'Oakley'], ['Sunglasses', 'maui jims', 'Maui Jim'],
  ['Pianos', 'stienway', 'Steinway'], ['Pianos', 'bosendorfer', 'Bösendorfer'], ['Watches', 'rollex', 'Rolex'],
  ['Watches', 'tag hauer', 'Tag Heuer'], ['Watches', 'patek phillipe', 'Patek Philippe'],
  ['Pens', 'zzqqx', null], ['Batteries', 'banana', null], ['Honda', 'computers', null],
];
let pass = 0;
const fails = [];
for (const [r, g, want] of cases) {
  const res = B.judge(find(r), g);
  const got = res.status === 'match' || res.status === 'mega' ? res.answer.name : res.status === 'retry' ? 'retry' : null;
  if (got === want) pass++;
  else fails.push(`${r.padEnd(11)} "${g}" -> ${got} (wanted ${want})`);
}
console.log(`${pass}/${cases.length} passed`);
fails.forEach(f => console.log('  FAIL ' + f));
