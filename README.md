# Nails-Shop

A runzie.ca-inspired nail storefront built for **viewing products + contacting the shop** (no cart / checkout). Includes a full admin panel for managing banners, products, collections, page content, and a blog.

## Tech stack
- **Node.js + Express** (server-rendered with **EJS**)
- **PostgreSQL** (database name: `nail`)
- **multer** for image/video uploads, **express-session** + **connect-pg-simple** for admin auth

## Project structure
```
public/          static assets (scraped css/js/fonts/images/media) + /uploads
  css/site.css   storefront styles
  css/admin.css  admin styles
views/           EJS templates (storefront + /admin)
src/
  server.js      app entry
  db/            pool, schema.sql, setup.js, seed.js
  routes/        store.js (storefront), admin.js (admin CRUD)
  middleware/    upload.js (multer)
reference/       original scraped index.html (kept for reference)
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env`, then enter your PostgreSQL and admin credentials.

3. Create the schema + default admin/settings:
   ```bash
   npm run db:setup
   ```

4. (Optional) Load demo data — collections, products, banners, blog posts:
   ```bash
   npm run db:seed
   ```

5. Start the app:
   ```bash
   npm start        # or: npm run dev  (auto-reload)
   ```

- Storefront → http://localhost:3000
- Admin panel → http://localhost:3000/admin

## Features

### Storefront
- Homepage: hero slideshow (image/video banners), promo marquee, Best Sellers, Shop By Shape, reviews, blog teaser, Instagram grid
- Shop page with collection / shape / length filters, search, sorting & pagination
- Product detail with image gallery and a **Contact CTA** (WhatsApp / Call / Email) instead of a cart
- Blog list + post pages
- Contact page (info pulled from admin settings)

### Admin (`/admin`)
- Dashboard with counts
- **Products** — full CRUD, main image + gallery upload, price/sale, shape, length, collection, featured/active flags
- **Collections** — CRUD with image
- **Banners** — CRUD for homepage slideshow (image or video background, link, button)
- **Blog** — CRUD with cover image, visual content editor, publish/draft, publish date
- **Page content** — manage reusable page sections and items with a visual editor
- **Settings** — shop name, tagline, announcement bar, contact info, social links
- Change admin password

## Notes
- Images can be **uploaded** (saved to `public/uploads`) or referenced by a direct URL/path.
- Videos support uploaded MP4/WebM files and YouTube/Vimeo links.
- Replaced and deleted uploads are removed when no database record still references them.
- The contact form and newsletter are front-end only (no email backend wired up) — they show a success message. Hook them to an email/CRM service when needed.
- Set a strong admin password and `SESSION_SECRET` before deploying.

## Checks

```bash
npm run check:media
```

## Production deployment

Cấu hình Docker Compose cho VPS (PostgreSQL + app + HTTPS tự động) nằm trong
[DEPLOY.md](DEPLOY.md).
