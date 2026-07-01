const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { renderPage } = require('../layout');
const render = require('../render');
const { loadSections } = require('../content');

const DEFAULT_SHOP_NAME = 'Majestic Nail Care';

// Store-owned testimonials shown in the product "Customer Reviews" carousel.
// Original copy — paired with real products at request time.
const REVIEW_POOL = [
  { name: 'Riley E.', verified: true, date: '05/23/2026', title: 'Beautiful and easy to wear', text: 'The finish looked salon-polished and the sizing chart made ordering simple. Got so many compliments.' },
  { name: 'Gabby', verified: true, date: '05/21/2026', title: 'Great for repeat wear', text: 'I removed the set gently, cleaned the tips, and wore them again. Still looked brand new.' },
  { name: 'Cecilia S.', verified: true, date: '05/10/2026', title: 'Helpful sizing support', text: 'The studio answered all my questions before I picked a set and a size. Lovely service.' },
  { name: 'Wen', verified: false, date: '05/09/2026', title: 'So different from drugstore nails', text: 'The detail on each nail is unreal and they feel sturdy but comfortable. My new favourite.' },
  { name: 'Bailey', verified: true, date: '05/06/2026', title: 'Very well made', text: 'All the little charms feel secure and the shape is so flattering. Thoughtful packaging too.' },
  { name: 'Aili D.', verified: false, date: '05/09/2026', title: 'Obsessed with these', text: 'Even prettier in person — the colours are rich and they lasted weeks without lifting.' },
  { name: 'Mary', verified: true, date: '05/29/2026', title: 'Love these', text: 'Super realistic look and I have had no problems after a week of wear. Will order more sets.' },
  { name: 'Christina D.', verified: true, date: '06/01/2026', title: 'Highly recommend', text: 'The details are amazing and the nails are durable. Handcrafted quality really shows.' },
  { name: 'Iris', verified: false, date: '05/09/2026', title: 'Lowkey but so pretty', text: 'Subtle, elegant and exactly what I wanted for everyday. Application was quick and clean.' },
];

function shopName(res) {
  return res.locals.settings.shop_name || DEFAULT_SHOP_NAME;
}

function pageTitle(res, title) {
  return `${title} · ${shopName(res)}`;
}

// Send an inner-HTML page wrapped in the shared runzie theme chrome
function sendThemed(res, innerHtml, title, status, description) {
  res.status(status || 200).type('html').send(renderPage(innerHtml, {
    title,
    description,
    url: res.locals.currentPath,
    settings: res.locals.settings,
    navigation: res.locals.navigation,
  }));
}

// SELECT fragment that also grabs the first gallery image as a hover image
const HOVER_SELECT =
  '(SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order, pi.id LIMIT 1) AS hover_image';

// Homepage is fully DB-driven so banner/product/category changes in admin are
// reflected immediately and every product link has a matching DB record.
// Renders inside the scraped runzie theme chrome (renderPage) so it matches
// the rest of the storefront 1:1, instead of the simpler EJS view.
async function showHome(req, res, next) {
  try {
    const [banners, featured, posts, sections] = await Promise.all([
      pool.query('SELECT * FROM banners WHERE is_active = true ORDER BY sort_order, id'),
      pool.query('SELECT * FROM products WHERE is_active = true AND is_featured = true ORDER BY sort_order, id LIMIT 8'),
      pool.query('SELECT * FROM posts WHERE is_published = true ORDER BY published_at DESC LIMIT 3'),
      loadSections('home'),
    ]);
    sendThemed(
      res,
      render.homePage({
        banners: banners.rows,
        featured: featured.rows,
        posts: posts.rows,
        sections,
        settings: res.locals.settings,
      }),
      shopName(res) + ' — Handcrafted Press-On Nails'
    );
  } catch (err) {
    next(err);
  }
}

router.get('/', showHome);
router.get('/home-dynamic', showHome);

// Product listing with filters. Collection membership comes from the join table
// so one product can correctly appear in several collections.
// Pseudo-groups for the column-based attributes, interleaved with the DB tag groups
// by sort_order so the sidebar order is Color(10) Style(20) Shape(30) Length(40) Trending(50).
const COLUMN_GROUPS = [
  { slug: 'shape', title: 'Shop By Shape', column: 'shape', sort: 30 },
  { slug: 'length', title: 'Shop By Length', column: 'length', sort: 40 },
];

async function showProducts(req, res, next) {
  try {
    const { collection, q, sort } = req.query;
    const toArr = (v) => (v == null ? [] : (Array.isArray(v) ? v : [v])).map((x) => String(x).trim()).filter(Boolean);
    const availabilitySel = toArr(req.query.availability); // 'in' / 'out'
    const numOrNull = (v) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
    const priceMin = numOrNull(req.query.price_min);
    const priceMax = numOrNull(req.query.price_max);
    const saleOnly = String(req.query.sale || '') === '1';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = 12;

    // DB-driven tag groups (Color / Style / Trending) and their values.
    const tagGroups = (await pool.query(
      'SELECT id, slug, title, sort_order FROM filter_groups WHERE is_active = true ORDER BY sort_order, id'
    )).rows;
    const tagGroupIds = tagGroups.map((g) => g.id);

    // Selections per group param (group slug). Column groups use shape/length.
    const selections = {};
    tagGroups.forEach((g) => { selections[g.slug] = toArr(req.query[g.slug]); });
    COLUMN_GROUPS.forEach((g) => { selections[g.slug] = toArr(req.query[g.slug]); });

    // Base scope = collection + search only (drives facet counts + price range so
    // each option's count stays stable as boxes in other groups are ticked).
    const baseWhere = ['p.is_active = true'];
    const baseParams = [];
    if (collection) {
      baseParams.push(collection);
      baseWhere.push(`EXISTS (SELECT 1 FROM product_collections pc_filter
        JOIN collections c_filter ON c_filter.id = pc_filter.collection_id
        WHERE pc_filter.product_id = p.id AND c_filter.slug = $${baseParams.length})`);
    }
    if (q) {
      baseParams.push(`%${q}%`);
      baseWhere.push(`(p.title ILIKE $${baseParams.length} OR p.description ILIKE $${baseParams.length})`);
    }
    const baseWhereSql = baseWhere.join(' AND ');

    // Full scope = base + active facet selections (drives product list + total).
    const where = [...baseWhere];
    const params = [...baseParams];
    COLUMN_GROUPS.forEach((g) => {
      const sel = selections[g.slug];
      if (sel.length) {
        params.push(sel);
        where.push(`BTRIM(p.${g.column}) = ANY($${params.length}::text[])`);
      }
    });
    tagGroups.forEach((g) => {
      const sel = selections[g.slug];
      if (sel.length) {
        params.push(g.id); const gi = params.length;
        params.push(sel); const si = params.length;
        where.push(`EXISTS (SELECT 1 FROM product_filter_values pfv
          JOIN filter_values fv ON fv.id = pfv.value_id
          WHERE pfv.product_id = p.id AND fv.group_id = $${gi} AND fv.slug = ANY($${si}::text[]))`);
      }
    });
    if (priceMin != null) { params.push(priceMin); where.push(`p.price >= $${params.length}`); }
    if (priceMax != null) { params.push(priceMax); where.push(`p.price <= $${params.length}`); }
    if (saleOnly) where.push('p.compare_at_price IS NOT NULL AND p.compare_at_price > p.price');
    if (availabilitySel.length === 1 && availabilitySel[0] === 'out') where.push('false');
    const whereSql = where.join(' AND ');

    let orderBy = 'p.sort_order, p.id';
    if (sort === 'price-asc') orderBy = 'p.price ASC NULLS LAST';
    else if (sort === 'price-desc') orderBy = 'p.price DESC NULLS LAST';
    else if (sort === 'newest') orderBy = 'p.created_at DESC';
    else if (sort === 'oldest') orderBy = 'p.created_at ASC';
    else if (sort === 'title-asc') orderBy = 'p.title ASC';
    else if (sort === 'title-desc') orderBy = 'p.title DESC';

    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM products p WHERE ${whereSql}`, params);
    const total = countRes.rows[0].total;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const offset = (page - 1) * perPage;

    const productsRes = await pool.query(
      `SELECT p.*, c.slug AS collection_slug, c.title AS collection_title, ${HOVER_SELECT}
       FROM products p LEFT JOIN collections c ON c.id = p.collection_id
       WHERE ${whereSql} ORDER BY ${orderBy} LIMIT ${perPage} OFFSET ${offset}`,
      params
    );

    const [collectionsRes, colFacetsRes, tagFacetsRes, statsRes, bannerRes, sections] = await Promise.all([
      pool.query('SELECT * FROM collections WHERE is_active = true ORDER BY sort_order, id'),
      // Column facets (shape/length) counted over the base scope.
      pool.query(
        `SELECT facet, value, COUNT(*)::int AS count FROM (
           SELECT 'shape'::text AS facet, BTRIM(shape) AS value, sort_order FROM products p WHERE ${baseWhereSql} AND NULLIF(BTRIM(shape), '') IS NOT NULL
           UNION ALL
           SELECT 'length'::text AS facet, BTRIM(length) AS value, sort_order FROM products p WHERE ${baseWhereSql} AND NULLIF(BTRIM(length), '') IS NOT NULL
         ) f GROUP BY facet, value ORDER BY facet, MIN(sort_order), value`,
        baseParams
      ),
      // Tag-group value counts over the base scope (0-count values still returned).
      tagGroupIds.length ? pool.query(
        `SELECT fv.group_id, fv.label, fv.slug, fv.sort_order, COUNT(p.id)::int AS count
         FROM filter_values fv
         LEFT JOIN product_filter_values pfv ON pfv.value_id = fv.id
         LEFT JOIN products p ON p.id = pfv.product_id AND ${baseWhereSql}
         WHERE fv.group_id = ANY($${baseParams.length + 1}::int[])
         GROUP BY fv.id, fv.group_id, fv.label, fv.slug, fv.sort_order
         ORDER BY fv.sort_order, fv.label`,
        [...baseParams, tagGroupIds]
      ) : { rows: [] },
      pool.query(
        `SELECT COUNT(*)::int AS in_stock, MIN(price)::float AS min_price, MAX(price)::float AS max_price
         FROM products p WHERE ${baseWhereSql}`,
        baseParams
      ),
      pool.query("SELECT image FROM banners WHERE is_active = true AND image <> '' ORDER BY sort_order, id LIMIT 1"),
      loadSections('shop'),
    ]);

    if (collection && !collectionsRes.rows.some((item) => item.slug === collection)) {
      return sendThemed(res, render.notFound(), pageTitle(res, 'Collection not found'), 404);
    }

    // Assemble the ordered list of filter groups for the sidebar.
    const colFacet = (facet) => colFacetsRes.rows
      .filter((r) => r.facet === facet)
      .map((r) => ({ label: r.value, slug: r.value, count: r.count, selected: selections[facet].includes(r.value) }));
    const tagByGroup = {};
    tagFacetsRes.rows.forEach((r) => { (tagByGroup[r.group_id] = tagByGroup[r.group_id] || []).push(r); });

    const filterGroups = [];
    tagGroups.forEach((g) => filterGroups.push({
      slug: g.slug, title: g.title, sort: g.sort_order,
      values: (tagByGroup[g.id] || []).map((r) => ({ label: r.label, slug: r.slug, count: r.count, selected: selections[g.slug].includes(r.slug) })),
    }));
    COLUMN_GROUPS.forEach((g) => filterGroups.push({ slug: g.slug, title: g.title, sort: g.sort, values: colFacet(g.slug) }));
    filterGroups.sort((a, b) => a.sort - b.sort);

    const stats = statsRes.rows[0] || {};
    const priceRange = {
      min: stats.min_price != null ? Math.floor(stats.min_price) : 0,
      max: stats.max_price != null ? Math.ceil(stats.max_price) : 0,
    };

    const html = render.productsPage({
      products: productsRes.rows,
      collections: collectionsRes.rows,
      filterGroups,
      priceRange,
      inStockCount: stats.in_stock || 0,
      filters: { collection, q, sort, selections, availability: availabilitySel, price_min: priceMin, price_max: priceMax, sale: saleOnly },
      page,
      totalPages,
      total,
      bannerImage: bannerRes.rows[0] && bannerRes.rows[0].image,
      sections,
    });
    sendThemed(res, html, pageTitle(res, saleOnly ? 'Sale' : (collection ? 'Shop' : 'Shop All')));
  } catch (err) {
    next(err);
  }
}

router.get('/products', showProducts);

// The header's Shop link opens the unfiltered catalog with the All option active.
router.get('/collections/all', showProducts);

// Keep the original collection URLs while rendering products from Postgres.
router.get('/collections/:slug', (req, res, next) => {
  req.query = Object.assign({}, req.query, { collection: req.params.slug });
  return showProducts(req, res, next);
});

// Product detail
router.get('/products/:slug', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, c.slug AS collection_slug, c.title AS collection_title
       FROM products p
       LEFT JOIN collections c ON c.id = p.collection_id
       WHERE p.slug = $1 AND p.is_active = true`,
      [req.params.slug]
    );
    if (!rows.length) return sendThemed(res, render.notFound(), pageTitle(res, 'Product not found'), 404);
    const product = rows[0];

    const imagesRes = await pool.query(
      'SELECT url FROM product_images WHERE product_id = $1 ORDER BY sort_order, id',
      [product.id]
    );
    const gallery = [product.image, ...imagesRes.rows.map((r) => r.url)].filter(Boolean);

    const variantsRes = await pool.query(
      `SELECT title, sku, price, compare_at_price, is_available
       FROM product_variants WHERE product_id = $1 ORDER BY sort_order, id`,
      [product.id]
    );
    const collectionsRes = await pool.query(
      `SELECT c.slug, c.title
       FROM product_collections pc
       JOIN collections c ON c.id = pc.collection_id
       WHERE pc.product_id = $1
       ORDER BY pc.sort_order, c.sort_order, c.id`,
      [product.id]
    );

    const [relatedRes, reviewProductsRes, sections] = await Promise.all([
      pool.query(
        `SELECT p.*, ${HOVER_SELECT}
         FROM products p
         WHERE p.is_active = true AND p.id <> $1
         AND (
           EXISTS (
             SELECT 1 FROM product_collections rpc
             WHERE rpc.product_id = p.id
             AND rpc.collection_id IN (
               SELECT collection_id FROM product_collections WHERE product_id = $1
             )
           )
           OR ($2::text IS NOT NULL AND p.shape = $2)
         )
         ORDER BY random() LIMIT 4`,
        [product.id, product.shape]
      ),
      pool.query(
        `SELECT slug, title, image FROM products WHERE is_active = true ORDER BY random() LIMIT 9`
      ),
      loadSections('product'),
    ]);

    // Review cards for the "Customer Reviews" carousel — store-owned testimonials
    // paired with real products so the "Review for …" links resolve.
    const reviewCards = reviewProductsRes.rows.map((p, i) => {
      const r = REVIEW_POOL[i % REVIEW_POOL.length];
      return { ...r, product: p };
    });

    const html = render.productPage({
      product,
      gallery,
      variants: variantsRes.rows,
      collections: collectionsRes.rows,
      related: relatedRes.rows,
      reviewCards,
      sections,
      settings: res.locals.settings,
    });
    sendThemed(res, html, pageTitle(res, product.title));
  } catch (err) {
    next(err);
  }
});

// Blog list
router.get(['/blog', '/blogs/news'], async (req, res, next) => {
  try {
    const [postsRes, bannerRes, sections] = await Promise.all([
      pool.query('SELECT * FROM posts WHERE is_published = true ORDER BY published_at DESC'),
      pool.query("SELECT image FROM banners WHERE is_active = true AND image <> '' ORDER BY sort_order, id LIMIT 1"),
      loadSections('blog'),
    ]);
    sendThemed(res, render.blogPage({ posts: postsRes.rows, bannerImage: bannerRes.rows[0] && bannerRes.rows[0].image, sections }), pageTitle(res, 'Journal'));
  } catch (err) {
    next(err);
  }
});

// Blog post
router.get(['/blog/:slug', '/blogs/news/:slug'], async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM posts WHERE slug = $1 AND is_published = true',
      [req.params.slug]
    );
    if (!rows.length) return sendThemed(res, render.notFound(), pageTitle(res, 'Post not found'), 404);
    const [recentRes, sections] = await Promise.all([
      pool.query(
        'SELECT slug, title, excerpt, content, cover_image, published_at FROM posts WHERE is_published = true AND slug <> $1 ORDER BY published_at DESC LIMIT 3',
        [req.params.slug]
      ),
      loadSections('article'),
    ]);
    sendThemed(res, render.postPage({ post: rows[0], recent: recentRes.rows, sections }), pageTitle(res, rows[0].title), 200, rows[0].excerpt);
  } catch (err) {
    next(err);
  }
});

// Contact
router.get(['/contact', '/pages/contact'], async (req, res, next) => {
  try {
    const sections = await loadSections('contact');
    sendThemed(res, render.contactPage({ settings: res.locals.settings, sections, sent: req.query.sent === '1' }), pageTitle(res, 'Contact'));
  } catch (err) {
    next(err);
  }
});

router.post('/contact', async (req, res, next) => {
  try {
    const { name, email, phone, message } = req.body;
    if (!name || !email || !message) return res.redirect('/contact?error=1');
    await pool.query(
      'INSERT INTO contact_messages (name, email, phone, message) VALUES ($1,$2,$3,$4)',
      [String(name).trim(), String(email).trim(), String(phone || '').trim() || null, String(message).trim()]
    );
    res.redirect('/contact?sent=1');
  } catch (err) {
    next(err);
  }
});

// Email signup popup — stores the email and returns a unique per-email discount code.
router.post('/subscribe', async (req, res, next) => {
  try {
    const settings = res.locals.settings || {};
    // Note: signup_popup_enabled only controls the auto homepage popup; the footer
    // newsletter form always collects emails and issues a code.
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'invalid_email' });
    const percent = Math.max(1, Math.min(90, parseInt(settings.signup_discount_percent) || 10));

    const existing = await pool.query('SELECT discount_code, discount_percent FROM email_subscribers WHERE email = $1', [email]);
    if (existing.rows.length) {
      return res.json({ code: existing.rows[0].discount_code, percent: existing.rows[0].discount_percent, existing: true });
    }
    // Generate a unique code (retry on the rare collision).
    let code = '';
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = 'MNC' + Math.random().toString(36).slice(2, 8).toUpperCase();
      const dup = await pool.query('SELECT 1 FROM email_subscribers WHERE discount_code = $1', [candidate]);
      if (!dup.rows.length) { code = candidate; break; }
    }
    if (!code) return res.status(500).json({ error: 'code_generation_failed' });
    await pool.query(
      'INSERT INTO email_subscribers (email, discount_code, discount_percent, source) VALUES ($1,$2,$3,$4)',
      [email, code, percent, 'popup']
    );
    res.json({ code, percent });
  } catch (err) {
    next(err);
  }
});

// About Us
router.get(['/pages/about-us', '/about-us'], async (req, res, next) => {
  try {
    sendThemed(res, render.aboutPage({ sections: await loadSections('about') }), pageTitle(res, 'About Us'));
  } catch (err) {
    next(err);
  }
});

// FAQ + tutorial — both as /pages/<slug> and short aliases /faq, /nail-tutorial
router.get(['/pages/faq', '/faq'], async (req, res, next) => {
  try {
    sendThemed(res, render.faqPage({ sections: await loadSections('faq') }), pageTitle(res, 'FAQ'));
  } catch (err) {
    next(err);
  }
});
router.get(['/pages/nail-tutorial', '/nail-tutorial'], async (req, res, next) => {
  try {
    sendThemed(res, render.tutorialPage({ sections: await loadSections('tutorial') }), pageTitle(res, 'Nail Tutorial'));
  } catch (err) {
    next(err);
  }
});

// Generic /pages/:slug for the four policy pages
const POLICY_TITLES = {
  'shipping-policy': 'Shipping Policy',
  'refund-policy': 'Refund & Exchange Policy',
  'privacy-policy': 'Privacy Policy',
  'terms-of-service': 'Terms of Service',
};
router.get('/pages/:slug', async (req, res, next) => {
  try {
    const slug = req.params.slug;
    if (!POLICY_TITLES[slug]) return sendThemed(res, render.notFound(), pageTitle(res, 'Page not found'), 404);
    const sections = await loadSections('policy');
    const section = sections[slug];
    if (!section) return sendThemed(res, render.notFound(), pageTitle(res, 'Page not found'), 404);
    sendThemed(res, render.policyPage({ section, settings: res.locals.settings }), pageTitle(res, POLICY_TITLES[slug]));
  } catch (err) {
    next(err);
  }
});

// /policies/:slug → 301 redirect to the new /pages/:slug URL
router.get('/policies/:slug', (req, res) => {
  res.redirect(301, '/pages/' + req.params.slug);
});

// Account area (front-end only — shop is contact-based; no real backend)
router.get(['/account', '/account/login', '/account/register'], (req, res) => res.redirect('/contact'));

module.exports = router;
