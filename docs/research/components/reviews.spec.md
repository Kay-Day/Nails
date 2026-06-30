# Reviews ("Let Customers Speak For Us") — spec

Goal: match runzie's "Loved by So Many of You" card design (photo + teal stars + name + Verified
badge + title + text), keep Majestic's own review copy.

## Runzie reference (image + live)
- 4 cards in a row (carousel w/ arrows on runzie; clone uses a responsive grid — same look statically).
- Card: white, rounded, soft shadow. **Customer photo on top** (rounded, ~square, object-fit cover).
- Below photo, centered: teal/mint **stars**, then **Name + black "Verified" pill**, then **bold title**,
  then muted review text (truncated).

## Clone implementation
`reviewHtml` in `src/render.js` + `.db-review*` in `public/css/db-pages.css`.
- Card order: `.db-review__media` (photo, aspect 1/1) → `.db-review__stars` (#2ec4a0) →
  `.db-review__head` (name + `.db-review__verified` black pill) → `.db-review__title` (Nunito 700/17px)
  → `.db-review__text` (muted, line-clamp 3). All centered.
- 4 reviews seeded (`home.reviews`): each has `image` (runzie review photo) + `subtitle` used as the
  customer NAME (Riley E. / Gabby / Cecilia S. / Wen); "Verified" badge is always rendered.
- Photos: `public/images/runzie/reviews/review-1..4.jpg` (downloaded from runzie's judge.me images).
- Persisted in `src/db/cms-seed.js` (`home.reviews`).

Grid: `repeat(4,1fr)` → 2 cols ≤989px → 1 col ≤640px. Verified 1440 / 768 / 390, no overflow.

Note: runzie's section heading is "Loved by So Many of You"; clone keeps its own "Let Customers
Speak For Us" (editable in admin). Design matches; copy is Majestic's.
