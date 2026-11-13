# Brandle — The Daily Markdown
Play it here: https://samchanthunder.github.io/brandle/

<img width="900" height="500" alt="image" src="https://github.com/user-attachments/assets/bb7dcbf3-b0cd-4543-ba44-e28448feff0c" />


A daily brand game. 7 aisles, 25 seconds each. Name a rare-but-real answer and the elevator drops deeper into the department store. Every aisle hides exactly one 100-point **Vault** answer.

- **Brand aisles:** name something a brand makes or sells (Honda → lawn mowers)
- **Item aisles:** name a brand that makes or sells an item (Cereal → Nintendo)
- **Twist aisles:** same, plus a rule (IKEA *that isn't furniture*)

A new puzzle unlocks every day at **midnight US Eastern**. Puzzle #1 is Nov 12, 2026, and there are 30 days of puzzles in `data/`.

## Run it locally
No build step. Just open `index.html` in a browser (double-click works).

## Project layout
```
index.html          page shell
css/style.css       all styling (desktop + mobile)
js/data.js          puzzle parser, daily rotation, autocorrect matcher, tiers, saving
js/scene.js         pixel-art world: street, store, elevator, basement floors
js/audio.js         synthesized sound effects + elevator muzak
js/game.js          game flow, receipts, results, sharing, archive
data/puzzles-*.js   the 30 days of puzzles
data/more-*.js      extra answers bolted onto existing rounds
tools/validate.js   checks every puzzle (run: node tools/validate.js)
tools/test-match.js autocorrect spot-checks (run: node tools/test-match.js)
```

## Writing puzzles
Each day is plain text inside `data/puzzles-*.js`:
```
## 31 | Day title
B Honda | known for: cars | optional twist
V vague, words, that ask for a retry
X words that break the twist (retry)
10 Cars = car, civic, accord
30 Lawn Mowers = mower, lawnmower
100 Solar Panels (disc) = solar | The fun fact shown after the round.
I Sneakers | 👟
10 Nike
15 Foot Locker (clever) | note shown on the receipt
```
- `B` = brand round, `I` = item round (with an emoji icon)
- Points are 10 (obvious), 15 (gotcha: parent cos, mega-retailers), 30 (solid), 60 (rare), 85 (deep cut) or 100. **Exactly one** answer per round must be worth 100 and have a fact.
- Tags: `(sub:Parent)`, `(disc)`, `(lic)`, `(store)`, `(parent)`, `(clever)`
- More answers for an existing round can go in `data/more-*.js` under `@ day | Round Name` (dupes get skipped).
- After editing, run `node tools/validate.js`.
