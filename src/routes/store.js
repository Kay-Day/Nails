const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { renderPage } = require('../layout');
const render = require('../render');
const { loadSections } = require('../content');

const DEFAULT_SHOP_NAME = 'PASTELLE NAILS';

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
async function showProducts(req, res, next) {
  try {
    const { collection, shape, length, q, sort } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = 12;

    const where = ['p.is_active = true'];
    const params = [];
    if (collection) {
      params.push(collection);
      where.push(`EXISTS (
        SELECT 1
        FROM product_collections pc_filter
        JOIN collections c_filter ON c_filter.id = pc_filter.collection_id
        WHERE pc_filter.product_id = p.id AND c_filter.slug = $${params.length}
      )`);
    }
    if (shape) {
      params.push(shape);
      where.push(`p.shape ILIKE $${params.length}`);
    }
    if (length) {
      params.push(length);
      where.push(`p.length ILIKE $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(p.title ILIKE $${params.length} OR p.description ILIKE $${params.length})`);
    }

    let orderBy = 'p.sort_order, p.id';
    if (sort === 'price-asc') orderBy = 'p.price ASC NULLS LAST';
    else if (sort === 'price-desc') orderBy = 'p.price DESC NULLS LAST';
    else if (sort === 'newest') orderBy = 'p.created_at DESC';

    const whereSql = where.join(' AND ');

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM products p
       WHERE ${whereSql}`,
      params
    );
    const total = countRes.rows[0].total;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const offset = (page - 1) * perPage;

    const productsRes = await pool.query(
      `SELECT p.*, c.slug AS collection_slug, c.title AS collection_title, ${HOVER_SELECT}
       FROM products p LEFT JOIN collections c ON c.id = p.collection_id
       WHERE ${whereSql} ORDER BY ${orderBy} LIMIT ${perPage} OFFSET ${offset}`,
      params
    );

    const [collectionsRes, facetsRes, bannerRes, sections] = await Promise.all([
      pool.query('SELECT * FROM collections WHERE is_active = true ORDER BY sort_order, id'),
      pool.query(`
        SELECT facet, value
        FROM (
          SELECT 'shape'::text AS facet, BTRIM(shape) AS value, MIN(sort_order) AS first_position
          FROM products
          WHERE is_active = true AND NULLIF(BTRIM(shape), '') IS NOT NULL
          GROUP BY BTRIM(shape)
          UNION ALL
          SELECT 'length'::text AS facet, BTRIM(length) AS value, MIN(sort_order) AS first_position
          FROM products
          WHERE is_active = true AND NULLIF(BTRIM(length), '') IS NOT NULL
          GROUP BY BTRIM(length)
        ) facets
        ORDER BY facet, first_position, value
      `),
      pool.query("SELECT image FROM banners WHERE is_active = true AND image <> '' ORDER BY sort_order, id LIMIT 1"),
      loadSections('shop'),
    ]);
    const shapes = facetsRes.rows.filter((row) => row.facet === 'shape').map((row) => row.value);
    const lengths = facetsRes.rows.filter((row) => row.facet === 'length').map((row) => row.value);
    if (collection && !collectionsRes.rows.some((item) => item.slug === collection)) {
      return sendThemed(res, render.notFound(), pageTitle(res, 'Collection not found'), 404);
    }

    const html = render.productsPage({
      products: productsRes.rows,
      collections: collectionsRes.rows,
      shapes,
      lengths,
      filters: { collection, shape, length, q, sort },
      page,
      totalPages,
      total,
      bannerImage: bannerRes.rows[0] && bannerRes.rows[0].image,
      sections,
    });
    sendThemed(res, html, pageTitle(res, collection ? 'Shop' : 'Shop All'));
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

    const [relatedRes, sections] = await Promise.all([
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
      loadSections('product'),
    ]);

    const html = render.productPage({
      product,
      gallery,
      variants: variantsRes.rows,
      collections: collectionsRes.rows,
      related: relatedRes.rows,
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
