require('dotenv').config();
const pool = require('./pool');

// Faceted filter seed. Shape/Length come from product columns and are NOT seeded
// here; this seeds the tag-based groups (Color, Style, Trending), their values, and
// assigns values to products using keyword matching on the product title.
const slugify = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const GROUPS = [
  {
    slug: 'color', title: 'Shop By Color', sort: 10, values: [
      { label: 'Nude', kw: ['nude', 'bare', 'ivory', 'buttercream', 'cream', 'vow', 'whisper', 'silk', 'seashell'] },
      { label: 'Pink', kw: ['pink', 'rose', 'rosy', 'rose', 'blush', 'coquette', 'flutter', 'syrup'] },
      { label: 'Red', kw: ['red', 'ember', 'flame', 'cherry', 'blood', 'ruby'] },
      { label: 'Blue', kw: ['blue', 'ocean', 'sea', 'lure', 'enchant', 'island', 'tide'] },
      { label: 'Green', kw: ['green', 'matcha', 'jade', 'mint', 'sage', 'totoro', 'haze'] },
      { label: 'Black', kw: ['black', 'noir', 'midnight', 'dark', 'throne', 'ruin', 'zodiac', 'velvet', 'curse'] },
      { label: 'White', kw: ['white', 'snow', 'pearl', 'opal', 'ice', 'moonlit', 'star', 'celestial', 'astral', 'wings', 'halo', 'aurora'] },
      { label: 'Brown', kw: ['mocha', 'coffee', 'caramel', 'bronze', 'cocoa'] },
      { label: 'Gold', kw: ['gold', 'golden', 'citrus', 'lemon', 'yuzu', 'jelly', 'glam', 'royal', 'pomelo'] },
      { label: 'Purple', kw: ['purple', 'violet', 'lavender', 'amethyst'] },
      { label: 'Silver', kw: ['silver', 'chrome', 'liquid', 'metallic', 'crusade', 'current'] },
      { label: 'Floral', kw: ['flora', 'floral', 'flower', 'bloom', 'blossom', 'petal', 'garden', 'lotus', 'vine', 'rose', 'poetic'] },
    ],
  },
  {
    slug: 'style', title: 'Shop By Style', sort: 20, values: [
      { label: 'French Tip', kw: ['tip', 'tips', 'french'] },
      { label: '3D Floral', kw: ['flora', 'floral', 'flower', 'bloom', 'blossom', 'petal', 'garden', 'lotus', 'vine', 'rose', 'buttercream', 'poetic'] },
      { label: 'Ombre', kw: ['ombre', 'sands', 'gradient', 'fade', 'sand'] },
      { label: 'Chrome', kw: ['chrome', 'silver', 'liquid', 'metallic', 'mirror'] },
      { label: 'Cat Eye', kw: ['cat eye', 'cat-eye', 'cateye'] },
      { label: 'Glitter', kw: ['glitter', 'shimmer', 'sparkle', 'glow', 'aurora', 'celestial', 'astral', 'wings', 'halo', 'star'] },
      { label: 'Dots', kw: ['dot', 'dots', 'polka'] },
    ],
  },
  {
    slug: 'trending', title: 'Trending', sort: 50, values: [
      { label: 'New', special: 'new' },
      { label: 'Best Seller', special: 'featured' },
    ],
  },
];

async function seed() {
  // Ensure tables exist (no-op if already created by setup.js).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS filter_groups (
      id SERIAL PRIMARY KEY, slug VARCHAR(60) UNIQUE NOT NULL, title VARCHAR(120) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS filter_values (
      id SERIAL PRIMARY KEY, group_id INT NOT NULL REFERENCES filter_groups(id) ON DELETE CASCADE,
      label VARCHAR(120) NOT NULL, slug VARCHAR(120) NOT NULL, sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (group_id, slug));
    CREATE TABLE IF NOT EXISTS product_filter_values (
      product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      value_id INT NOT NULL REFERENCES filter_values(id) ON DELETE CASCADE,
      PRIMARY KEY (product_id, value_id));
  `);

  const products = (await pool.query('SELECT id, title, is_featured FROM products ORDER BY created_at DESC, id DESC')).rows;
  const newestIds = new Set(products.slice(0, 12).map((p) => p.id));

  const valueIdByKey = {}; // `${groupSlug}:${valueSlug}` -> id
  const seededValueIds = [];

  for (const g of GROUPS) {
    const gRes = await pool.query(
      `INSERT INTO filter_groups (slug, title, sort_order) VALUES ($1,$2,$3)
       ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, sort_order = EXCLUDED.sort_order
       RETURNING id`,
      [g.slug, g.title, g.sort]
    );
    const gid = gRes.rows[0].id;
    for (let i = 0; i < g.values.length; i++) {
      const v = g.values[i];
      const vslug = slugify(v.label);
      const vRes = await pool.query(
        `INSERT INTO filter_values (group_id, label, slug, sort_order) VALUES ($1,$2,$3,$4)
         ON CONFLICT (group_id, slug) DO UPDATE SET label = EXCLUDED.label, sort_order = EXCLUDED.sort_order
         RETURNING id`,
        [gid, v.label, vslug, i]
      );
      const vid = vRes.rows[0].id;
      valueIdByKey[`${g.slug}:${vslug}`] = { id: vid, def: v };
      seededValueIds.push(vid);
    }
  }

  // Reset only the mappings for the values we manage here, then reassign.
  if (seededValueIds.length) {
    await pool.query('DELETE FROM product_filter_values WHERE value_id = ANY($1::int[])', [seededValueIds]);
  }

  let mapCount = 0;
  for (const p of products) {
    const title = String(p.title || '').toLowerCase();
    const toAssign = new Set();
    for (const g of GROUPS) {
      for (const v of g.values) {
        const key = `${g.slug}:${slugify(v.label)}`;
        const rec = valueIdByKey[key];
        if (!rec) continue;
        let match = false;
        if (v.special === 'featured') match = !!p.is_featured;
        else if (v.special === 'new') match = newestIds.has(p.id);
        else if (v.kw) match = v.kw.some((k) => title.includes(k));
        if (match) toAssign.add(rec.id);
      }
    }
    for (const vid of toAssign) {
      await pool.query(
        'INSERT INTO product_filter_values (product_id, value_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [p.id, vid]
      );
      mapCount++;
    }
  }

  // Report
  const summary = await pool.query(
    `SELECT fg.title AS grp, COUNT(DISTINCT fv.id) AS values, COUNT(pfv.product_id) AS assignments
     FROM filter_groups fg
     LEFT JOIN filter_values fv ON fv.group_id = fg.id
     LEFT JOIN product_filter_values pfv ON pfv.value_id = fv.id
     GROUP BY fg.id, fg.title, fg.sort_order ORDER BY fg.sort_order`
  );
  console.log('✓ Filter groups seeded:');
  summary.rows.forEach((r) => console.log(`  - ${r.grp}: ${r.values} values, ${r.assignments} product assignments`));
  console.log(`✓ Total mappings: ${mapCount}`);
  await pool.end();
}

seed().catch((err) => { console.error(err); process.exit(1); });
