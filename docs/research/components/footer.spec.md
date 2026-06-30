# Footer — spec (runzie-style, Majestic content)

Goal: match runzie's footer design 100% but keep Majestic's contact content.
Source: https://www.runzie.ca/ footer, measured @1440 via getComputedStyle.

## Runzie reference values
- Background: black (#000), text white.
- Layout: multi-column grid; serif column headings + vertical link lists; newsletter + circular social icons; copyright bottom bar with top divider + payment icons.
- Column heading: "Gilda Display", **19.2px / weight 500 / line-height 24.5px**, white, margin-bottom 12px.
- Links: Nunito, **16px / line-height 34px**, white.
- Social icons: **40×40px, border-radius 50%** (circular).
- Copyright: Nunito 14px / line-height 21px, white.

## Clone implementation (kept content) — FINAL (user chose: distinct contact band + dark footer)
`siteFooter()` in `src/layout.js` outputs TWO bands, replacing the old 3-piece footer
(Explore bar + cream cards + leftover runzie `<m-footer>`). Leftover theme `<m-footer>` hidden
(`.db-dynamic-footer-enabled m-footer { display:none }`).

1. **Contact band** (`.db-contact-band`, cream #f7f3f1) — distinct, prominent section:
   centered Gilda 30px title "Contact Majestic Nail Care" + 4 white cards (icon in green #174733 +
   uppercase label + value): Address → Ontario Canada; Phone → 4379983533;
   Instagram → @majestic_nailbox; TikTok → @majestic_press_on_nails.
   Grid: 4 cols → 2 cols ≤900px → 1 col ≤540px.
2. **Dark footer** (`.db-site-footer`, black) — runzie's 4-column layout, headings Gilda 19px/500,
   links Nunito 16px/lh34, 40px circular social icons:
   - **Shop**: Shop All, Best Sellers, New Arrivals, On Sale
   - **Customer Support**: Contact Us, About Us, FAQ, Nail Tutorial, Blog
   - **Policies**: Shipping Policy, Refund Policy, Privacy Policy, Terms of Service (→ /pages/<slug>)
   - **Stay in Touch**: note + IG/TikTok icons + "Contact the studio" link (no fake newsletter,
     no payment icons — store is contact-only, no checkout).
   - Copyright bar with top divider.
   Grid: `repeat(4,1fr)` → 2 cols ≤960px → 1 col ≤540px.

History: (1) first merged contact into footer columns — rejected as "deleting" contact.
(2) then 2-band but dark footer was only Explore+Follow (unbalanced, empty middle on wide screens)
— rejected as "chưa chuẩn". Correct = runzie's 4 labeled columns (above), links hardcoded in
`siteFooter()` since they map to fixed pages.

Verified: 1440 (4 col) / 768 (2×2) / 390 (1 col), no horizontal overflow, inner pages OK.
CSS in `public/css/db-pages.css` (`.db-contact-band*` + `.db-site-footer*`).
