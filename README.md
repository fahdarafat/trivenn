# Trivenn

**Three hidden rules. One country in the middle.**

### ▶️ Play it now: **https://fahdarafat.github.io/trivenn/** — new puzzle every day at midnight.

A daily deduction game. Every day there are three secret rules about countries
(e.g. *Landlocked · EU member · Monarchy*) and **exactly one country on Earth
satisfies all three**. Probe with any country; three lamps show which hidden
rules it satisfies. Deduce the rules from the lamp patterns and find the center
in 6 probes. After the game the rules are revealed — with receipts.

## Architecture

Pure static site: no backend, no login, no network calls after load.

```
data/        source of truth (hand-curated + agent-verified rosters)
  countries.js   197-country canon (193 UN + Vatican, Palestine, Kosovo, Taiwan)
  predicates.js  ~37 predicates with policies; name predicates derived at build
  flags1-3.js    flag-feature rosters (authored from web sources)
  facts.js       one fun-fact line per country
build/
  generate.js    enumerates rule triples, asserts EXACTLY-ONE-country
                 intersections, schedules 730 days, emits site data
  serve.js       local dev server (npm run serve → :8642)
site/            the deployable static site (index.html, app.js, styles.css,
                 + generated countries.js, puzzles.js)
```

## Build & run

```
npm run build   # validates all data, regenerates site/puzzles.js + site/countries.js
npm run serve   # http://localhost:8642
```

The build **fails loudly** on any data inconsistency: unknown IDs, duplicate
members, count drift vs `expect`, non-unique triple intersections, obfuscation
round-trip failures. The "exactly one country fits" guarantee is enforced here,
not at runtime.

## Daily puzzle mechanics

- Puzzle #1 = the `EPOCH` date in `build/generate.js`, in the **player's local
  timezone** (Wordle convention).
- Difficulty curve: Mon/Tue gentle (no expert rules, famous centers) → Sat brutal.
  No center repeats within 60 days; no rule repeats within 10 days.
- Day records are XOR-obfuscated (Wordle-grade, not cryptographic — view-source
  cheating is accepted).
- Share grid: 3-emoji lamp rows (⚫/🟡, win row 🟢🟢🟢) — journey only, zero
  answer leakage.

## Before launching publicly

- Register the domain and update `SHARE_URL` in `site/app.js`.
- Extend the schedule before day 730 (`DAYS_TO_SCHEDULE`).
- Re-verify time-sensitive rosters (EU/NATO/OPEC members, euro adopters,
  monarchies, populations) — predicate `policy` strings are the published
  rulings shown to players, keep them in sync.
