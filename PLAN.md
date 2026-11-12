# BRANDLE: Design & Implementation Plan (v2)

> **THE DAILY MARKDOWN**: 7 rounds · 25 seconds each · rarer answers go deeper

---

## 1. How the game plays

Every day has **7 rounds** that mix two kinds of questions, ordered **easy → hard**:

| Round type | Screen shows | You type | Example |
|---|---|---|---|
| **Brand → Item** | A famous brand + a hint | Something that brand makes or sells | **HONDA** · *known for: cars* → "lawn mowers" (40) |
| **Item → Brand** | An everyday product | A brand that makes or sells it | **SNEAKERS** → "Dunkin'" (100) |
| **Twist** (a Brand → Item round with a rule, usually round 7) | Brand + a rule | An item that follows the rule | **IKEA** *that isn't furniture* → "houses" (100) |

- **Everyone can score.** Brands are household names, everyday items have obvious answers, and the hint line names the famous product. Obvious answers only score 10–15, so nobody gets 0 unless they try for a deep cut and miss.
- **Rarity is per prompt.** Yamaha's golf clubs score 70 in the Yamaha round, and Nike scores 10 in the Sneakers round. Every round has **exactly one 100-point answer**, revealed afterward with a fun fact.
- **"Wrong aisle" retries:** answers that are too vague ("drinks", "stuff") or break the twist ("sofa" in the IKEA round) **don't end the round**. SKU shakes its head, shows *BE MORE SPECIFIC* or *THAT'S FURNITURE*, and you try again while the clock keeps running.
- Not in the catalog → **OUT OF STOCK (0)**. Timeout → **STORE CLOSED (0)**.
- Valid answers include sub-brands, discontinued lines, licensed merch and store brands. Parent conglomerates, mega-retailers and famous gotcha answers are worth only **5 (IMPULSE BUY)**.

### Scoring tiers
| Pts | Tier | Floor band (per round) |
|---|---|---|
| **100** | **THE VAULT** (one per round) | B10 |
| 80–95 | ARCHIVE PULL | B8–B9 |
| 60–75 | STOCKROOM FIND | B6–B7 |
| 40–55 | CLEARANCE RACK | B4–B5 |
| 20–35 | MAIN AISLE | B2–B3 |
| 10–15 | FRONT WINDOW | B1 |
| 5 | IMPULSE BUY (too clever) | B0.5 |
| 0 | OUT OF STOCK / STORE CLOSED | B0 |

---

## 2. Visual concept (unchanged from v1)

**A cut-away view of a giant retro department store.** The top of the screen is a street at dusk with the store facade, display windows and a flickering neon **BRANDLE** sign on the roof (pink/mint chromatic offset, like Krillion's title). Below the sidewalk, a **freight elevator shaft** drops through the basements:

**Sales Floor (B0–9) → Clearance Basement (B10–24) → Stockroom (B25–39) → Loading Dock (B40–54) → The Archives (B55–69) → THE VAULT (B70)**

Each zone has its own lighting (white fluorescents → red sale tags → mint stockroom → sodium amber → sepia dust → black and gold). Things drift through every floor the way Krillion's fish do: shopping carts, falling price tags, forklifts, moths and dust motes.

- **Mascot: SKU ("skew"),** a pixel price tag with legs, a barcode belly and a bobbing string loop. It rides a brass cage elevator.
- **Depth:** 10 points = 1 floor. A perfect day is **B70 · THE VAULT**. The results screen shows something like **`B32`**.
- **Descent animation:** the elevator drops by that round's points with parallax floors, a swinging brass floor dial, a whoosh, and a *DING* on arrival. Then a tier stamp slams onto the screen. A 100 opens a spinning vault door with gold light and a *cha-ching*. A 0 makes a fuse spark and the lights flicker.
- **UI as store objects:**
  - Depth readout → brass floor dial
  - Score → cash-register LCD
  - Round pips → 7 tear-off tickets
  - Prompt → hanging aisle sign
  - Timer → deli "NOW SERVING" counter
  - Submit button → **SCAN** (with a beep)
  - Start button → elevator call plate reading **▼ GOING DOWN ▼**
- **Reveal:** a receipt prints line by line, with your answer and its tier stamp. Below it, a gold slip shows **THE VAULT ANSWER** and its fun fact.
- **Item art:** everyday items (sneakers, cereal, headphones…) get pixel icons. Brands appear as **text on store signage only**. No real logos are drawn, which avoids trademark trouble.
- **Pixel rendering:** a 480×270 canvas scaled up with `image-rendering: pixelated`, sprites stored as pixel grids in code, CRT scanlines and a vignette.
- **Fonts:** Silkscreen + VT323.
- **Sound:** all generated in the browser: ding, scanner beep, cha-ching, fuse crackle, timer ticks, and optional **elevator muzak**. There's a mute toggle.

### Results screen
1. A big **`B32`** readout, plus `320 PTS · STOCKROOM` and SKU.
2. **Elevator Log:** 7 elevator shafts side by side, each cable dropped to that round's depth, with a gold vault icon for any 100. Tap a shaft to see its details.
3. **Itemized receipt:** each round's prompt → your answer → tier → points, plus the vault answer. TOTAL at the bottom with a fake barcode.
4. **Your stats:** streak, best floor, and how many vault hits you've had in total.
5. **SHARE RECEIPT** (Web Share API, clipboard fallback):
   ```
   BRANDLE #1 · B32 🛗
   🪟📦🛒🔐🏷️🗄️❌
   <link>
   ```
   Tier emoji: 🔐 vault · 🗄️ archive · 📦 stockroom · 🏷️ clearance · 🛒 main aisle · 🪟 front window · 💸 impulse buy · ❌ out of stock

*(The "better than X% of players" curve has been dropped, as you asked.)*

---

## 3. Technical architecture

**Zero-build static site:** vanilla ES modules, HTML, CSS and Canvas 2D. It runs on GitHub Pages as-is, and all paths are relative. A dev-only Node script validates the data.

```
index.html
css/style.css
js/
  main.js        state machine: TITLE → ROUND → REVEAL → … → RESULTS
  daily.js       today's puzzle number (local date) → loads data/puzzles/NNNN.json
  match.js       normalization, alias index, fuzzy match, vague/excluded checks
  score.js       tiers, floors, totals
  audio.js       WebAudio SFX + muzak, mute
  share.js       share text
  store.js       localStorage: streak, today's result, settings
  scene/         renderer, sprites, world zones, elevator, vault sequence
  ui/            hud, round, reveal, results, elevator-log chart
data/
  global.json    mega-retailers (Amazon, Walmart, Target…) = 5 in every Item→Brand round
  puzzles/0001.json
tools/validate.mjs
```

### Data model
```jsonc
// Brand → Item round
{ "type": "brand", "brand": "IKEA", "twist": "that isn't furniture",
  "hint": "known for: flat-pack furniture",
  "vague":    ["stuff", "home decor", …],      // → "be more specific", retry
  "excluded": ["sofa", "bookcase", …],         // → "breaks the twist", retry
  "answers": [
    { "name": "Meatballs", "pts": 10, "aliases": ["swedish meatballs"] },
    { "name": "Houses", "pts": 100, "aliases": ["boklok", "homes"], "fact": "…" } ] }

// Item → Brand round
{ "type": "item", "item": "Cereal", "sprite": "cereal",
  "answers": [
    { "name": "Cheerios", "pts": 10, "kind": "sub", "parent": "General Mills" },
    { "name": "Nintendo", "pts": 100, "kind": "licensed", "fact": "…" },
    { "name": "PepsiCo", "pts": 5, "kind": "parent", "note": "Parent of Quaker" } ] }
```
- **`kind`:** `sub` · `discontinued` · `licensed` · `store` · `parent` · `clever`. It shows as a badge on the reveal, e.g. "LICENSED" or "DISCONTINUED".
- In Brand → Item rounds, typing a specific product counts as its category: "Civic" → Cars, "Blåhaj" → its own 40-point entry, "Fairlife" → Milk.
- **The validator fails a puzzle if** a round has zero or multiple 100s, a 100 has no fact, two answers normalize to the same alias, or a vague/excluded word collides with a real answer.

### Matching
1. **Normalize:** lowercase, strip accents, `&`/`+` → "and", drop punctuation and spaces, plus a "the"-less variant.
2. **Plurals:** strip a trailing `s`/`es` on both sides, so "lawnmower" = "Lawn Mowers".
3. **Exact alias lookup → fuzzy fallback:** Damerau-Levenshtein distance, 1 edit allowed for 5–8 characters and 2 edits for 9+, accepted only if exactly one answer is closest.
4. **Check order:** answer match → excluded (retry) → vague (retry) → global mega-retailers (5) → OUT OF STOCK (0).

### Daily rotation
`puzzleNo = days since launch + 1`, using the player's local date. Results and streaks are saved in localStorage, so a refresh shows today's receipt instead of letting you replay.

---

## 4. Content lifespan
- About 150–250 brands with interesting product ranges, plus a few hundred everyday items, give **~600–800 prompts**.
- **Twists** let a brand or item come back with a new answer list ("Honda that has no wheels", "Disney that isn't a movie"), for **~1,500–2,000 prompts**.
- A brand can **repeat after about 6 months** with a different twist.
- That's **well over a year of dailies**. Archive, Themed Packs and Unlimited add replay value without using up the daily supply.
- **Workflow:** Claude drafts a month of puzzles at a time, you skim them, and `validate.mjs` catches structural mistakes.

---

## 5. Sample day: Puzzle #1 "Opening Day"
Full data: [`data/puzzles/0001.json`](data/puzzles/0001.json) (222 answers, validated).

| # | Type | Prompt | Easy answers (10–15) | Deep cuts | 🔐 THE VAULT (100) |
|---|---|---|---|---|---|
| 1 | Brand → Item | **Coca-Cola** | soda, water, juice | lip balm 60, wine 90 | **Movies**: owned Columbia Pictures 1982–89 |
| 2 | Item → Brand | **Sneakers** | Nike, Adidas, New Balance | British Knights 65, Starbury 70 | **Dunkin'**: Saucony's 2018 donut Kinvara 9 |
| 3 | Brand → Item | **Honda** | cars, motorcycles | jets 80, walking-assist devices 85 | **Solar panels**: Honda Soltec, 2007–2014 |
| 4 | Item → Brand | **Cereal** | Kellogg's, Cheerios, Post | Ghostbusters 75, Mr. T 80 | **Nintendo**: 1988 Nintendo Cereal System |
| 5 | Item → Brand | **Headphones** | Apple, Beats, Sony, Bose | Audeze 65, Stax 75 | **Dyson**: Dyson Zone, with an air-purifying visor |
| 6 | Brand → Item | **Yamaha** | motorcycles, pianos | tennis rackets 80, car engines 85 | **Archery bows**: once Japan's top archery maker |
| 7 | Twist | **IKEA** *that isn't furniture* | meatballs, lamps | e-bikes 85, sneakers 90 | **Houses**: BoKlok prefab homes since 1996 |

**Fact-check status:** all 7 vault facts were checked lightly. The Dunkin' Kinvara and Honda Soltec facts were confirmed by search. Yamaha's archery history was confirmed, but not when it stopped, so the fact leaves out a date. The rest are well documented.

---

## 6. Build order
1. Data, matcher, scorer, validator (test the loop without graphics)
2. Canvas renderer, sprites, storefront and zones, SKU's elevator descent
3. Round UI (aisle sign, deli timer, SCAN input, retry feedback), receipt reveal, vault sequence
4. Results: floor readout, elevator log, receipt, stats, share
5. Audio and muzak, settings, streaks, mobile pass
6. GitHub Pages setup (only when you say go; **no commits or pushes until you ask**)
