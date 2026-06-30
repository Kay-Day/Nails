# Homepage media — runzie assets mapping

All runzie homepage images/videos were downloaded to `public/images/runzie/` and wired into the
DB content (and persisted in the seed files). Source: https://www.runzie.ca/ home.

## Downloaded assets (`public/images/runzie/`)
| file | runzie source | used in |
|---|---|---|
| hero-1.jpg / hero-2.jpg / hero-3.jpg | hero slideshow slides | banners #1 (Spring), #3 (Reusable), #5 (Now on Sale) |
| curated-dark-edit.jpg | Website_Banner_-_1_1.jpg | Curated card "New Arrivals" |
| curated-on-sale.jpg | 2_ea871a6d…jpg | Curated card "Best Sellers" |
| shape-almond/coffin/round/stiletto/square.png | Shop By Shape single-nail PNGs | home.shop-by-shape items |
| seen-1..4.mp4 + seen-1..4-poster.jpg | As Seen On You UGC videos (HD-1080p) | products coquette-noir-bites, 030102, island-glow-edit, golden-tide |

## Wiring (persisted)
- `src/db/seed.js` — banners #1/#3/#5 image → `/images/runzie/hero-*.jpg`.
- `src/db/cms-seed.js` — `home.curated` + `home.shop-by-shape` item images; shape order set to
  Almond, Coffin, Round, **Stiletto, Square** (matches runzie).
- `src/db/runzie-products.json` — the 4 As-Seen products got `video` + `video_poster` → local files.

## Component changes (`src/render.js`, `public/css/db-pages.css`)
- `asSeenCard`: renders `<video muted loop playsinline poster>` when product has a video; plays on
  hover, pauses+resets on mouseleave (small inline script in the section).
- Shop By Shape: scoped CSS removes the circular crop (`m:rounded-full`) and uses `object-fit:contain`
  so the single nail shows whole — matches runzie's presentation. Heading color `#174733`.
- As Seen On You heading: 29px desktop AND mobile (was 42/32). Mobile section headings 30px → 40px
  (runzie keeps 40px on mobile).

## Note for owner
The 4th As-Seen clip + some assets carry runzie's own branding/watermark (e.g. "runzie" on a nail card,
TikTok handle). Swap those clips/images if you don't want a competitor's branding shown.
