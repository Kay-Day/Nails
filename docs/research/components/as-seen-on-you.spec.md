# As Seen On You (UGC strip) — spec

Source of truth: https://www.runzie.ca/ — section "As Seen On You", measured at 1440px via getComputedStyle.

## Heading (`.db-as-seen-section .m-section__heading`)
| prop | original (runzie) | clone (before) |
|---|---|---|
| font-family | "Gilda Display", serif | ✓ same |
| font-size | **29px** @1440 | 42px ✗ |
| line-height | 37.062px (≈1.28) | 1.15 ✗ |
| font-weight | 400 | ✓ |
| letter-spacing | normal | 0 ✓ |
| text-align | center | center ✓ |
| color | rgb(17,17,17) | ✓ |

Note: original standard section headings are 40px; this section is deliberately smaller (29px).

## Section padding
- original section padding-top/bottom resolve to 0 on the `.shopify-section` wrapper (inner block handles spacing). Clone uses `padding: 72px 0` on `.db-as-seen-section` — visually comparable; left as-is.

## Fix applied
`.db-as-seen-section .m-section__heading`: font-size 42px → 29px, line-height 1.15 → 1.28.
