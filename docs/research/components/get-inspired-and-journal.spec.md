# Get Inspired + The Journal — spec

## The Journal (blog teaser) — REMOVED from homepage
runzie's homepage has NO blog/journal section (confirmed: scanned all homepage headings — none match
journal/blog/article). The clone had added "The Journal" (3 post teasers). User chose to remove it
from the homepage to match 100%. `journalHtml` is still computed in `render.js` `homePage()` but
omitted from the return string (re-add `${journalHtml}` to restore). The `/blog` page + nav link stay.

## Get Inspired by Every Look — rebuilt to runzie's UGC grid
Runzie: 4-column grid of **portrait UGC photos** (aspect ~4:5, object-fit cover, no rounding,
edge-to-edge), each with **@handle above** + **"SHOP THE LOOK" underlined link below**.

Clone before: 6 product-on-white images, square, rounded, floating with gaps (didn't match).

Clone after (`socialHtml` in render.js + `.db-insta-*` in db-pages.css):
- 4-col grid (gap 18px) of portrait tiles: `.db-insta-tile__handle` (@majestic_nailbox) +
  `.db-insta-tile__media` (aspect 4/5 cover) + `.db-insta-tile__shop` ("Shop the Look" → /products).
- Photos: `public/images/runzie/inspired/inspired-1..4.jpg` (downloaded from runzie's Get Inspired).
- Grid: 4 → 2 cols ≤989px → 2 cols ≤640px. Verified 1440 / 390, no overflow.

UPDATE: the runzie UGC photos had runzie's watermark baked in, so inspired-1..4.jpg were REPLACED
with royalty-free Pexels manicure stock (portrait 4:5 crop, free for commercial use, no watermark).
Owner can drop in Majestic's own customer photos over inspired-1..4.jpg anytime.
Still TODO (owner's call): the 4th As-Seen video clip (seen-4) still shows runzie branding — video,
harder to swap with stock; replace with Majestic's own clip when available.
