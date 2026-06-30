# Shop By Shape — spec

Source: https://www.runzie.ca/ "Shop By Shape", measured @1440 via getComputedStyle.

## Heading
| prop | original | clone (before) |
|---|---|---|
| font-family | "Gilda Display", serif | ✓ |
| font-size | 40px | 40px ✓ |
| **color** | **rgb(23,71,51) = #174733 (dark green)** | rgb(17,17,17) ✗ |
| text-align | center | center ✓ |

This is a per-section accent: only "Shop By Shape" is green; all other section headings are #111.

## Shape labels
- original: plain name ("Almond"), color #111, Nunito 16px.
- clone: "Almond Shape" + "View collection →", color #111, Nunito 16px. Color/font already match; the "Shape" suffix + link are clone UX choices (kept).

## Presentation difference (content, not fixed)
- original: single elegant nail PNG per shape on the soft-gray section, no circular crop.
- clone: nail-cluster image cropped to a circle (`m-collection-card--round` / `m:rounded-full`). Tied to the uploaded images (admin content), left as-is.

## Section background
- both render on the soft-gray block (`.db-home-soft`). ✓

## Fix applied
Added `db-shape-section` class to the section in render.js; CSS `.db-shape-section .m-section__heading { color:#174733 }`.
