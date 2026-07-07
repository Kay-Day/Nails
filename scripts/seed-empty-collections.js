// Populate the empty themed collections with products (by color/style), assign
// the sale collections, fix two typo slugs, hide the empty Coffin shape, and
// delete the leftover "test" collection.
//
//   node scripts/seed-empty-collections.js           # DRY RUN
//   node scripts/seed-empty-collections.js --apply     # apply in a transaction
//
// Idempotent: uses ON CONFLICT DO NOTHING, so re-running only adds what's missing.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');

const APPLY = process.argv.includes('--apply');
const BACKUP = path.join(__dirname, 'seed-collections-backup.json');

// collection slug -> filter labels (any-of, matched across color/style groups)
const THEMED = {
  'the-blush-collection': ['Pink'],
  'the-bloom-edit': ['Floral', '3D Floral'],
  'dark-edit': ['Black'],
  'glow-collection': ['Chrome', 'Glitter', 'Silver', 'Gold'],
  'play-collection': ['Dots', 'Cat Eye', 'Red', 'Blue', 'Green', 'Purple'],
  'bare-edit': ['Nude', 'White'],
  'neonnyx-nails': ['Black', 'Chrome'],
  'nail-essentials': ['French Tip', 'Nude', 'White'],
};
const SALE_SLUGS = ['now-on-sale', 'bundle-sales'];
const SLUG_FIXES = [
  ['play-colletion', 'play-collection'],
  ['glow-colletion', 'glow-collection'],
];

async function idFor(slug) {
  const r = await pool.query('SELECT id FROM collections WHERE slug = $1', [slug]);
  return r.rows[0] && r.rows[0].id;
}

async function productsByLabels(labels) {
  const r = await pool.query(
    `SELECT DISTINCT p.id, p.sort_order, p.title
     FROM products p
     JOIN product_filter_values pfv ON pfv.product_id = p.id
     JOIN filter_values fv ON fv.id = pfv.value_id
     WHERE p.is_active = true AND fv.label = ANY($1::text[])
     ORDER BY p.sort_order, p.id`,
    [labels]
  );
  return r.rows;
}

async function saleProducts() {
  const r = await pool.query(
    `SELECT id, sort_order, title FROM products
     WHERE is_active = true AND compare_at_price IS NOT NULL AND compare_at_price > price
     ORDER BY sort_order, id`
  );
  return r.rows;
}

async function run() {
  const plan = {}; // slug -> [{id,title}]
  for (const [slug, labels] of Object.entries(THEMED)) plan[slug] = await productsByLabels(labels);
  const sale = await saleProducts();
  for (const slug of SALE_SLUGS) plan[slug] = sale;

  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n=== Seed plan ===`);
  for (const [slug, rows] of Object.entries(plan)) {
    console.log(`  ${slug.padEnd(22)} +${rows.length}: ${rows.slice(0, 6).map((r) => r.title).join(', ')}${rows.length > 6 ? '…' : ''}`);
  }
  console.log('Slug fixes:', SLUG_FIXES.map((s) => s.join('→')).join(', '));
  console.log('Hide (no products): coffin-shape (+ its nav + Shop By Shape card)');
  console.log('Delete: collection "test"');

  if (!APPLY) { console.log('\nDry run only — re-run with --apply.'); return; }

  // Backup current membership of affected collections for reversal.
  const affected = [...Object.keys(plan)];
  const before = {};
  for (const slug of affected) {
    const id = await idFor(slug);
    before[slug] = id ? (await pool.query('SELECT product_id FROM product_collections WHERE collection_id=$1', [id])).rows.map((r) => r.product_id) : [];
  }
  fs.writeFileSync(BACKUP, JSON.stringify({ before, slugFixes: SLUG_FIXES }, null, 2));
  console.log(`\nSaved backup -> ${path.relative(process.cwd(), BACKUP)}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // 1. Seed memberships.
    for (const [slug, rows] of Object.entries(plan)) {
      const cid = (await client.query('SELECT id FROM collections WHERE slug=$1', [slug])).rows[0]?.id;
      if (!cid) { console.warn(`  ! ${slug} missing, skipped`); continue; }
      for (let i = 0; i < rows.length; i++) {
        await client.query(
          'INSERT INTO product_collections (product_id, collection_id, sort_order) VALUES ($1,$2,$3) ON CONFLICT (product_id, collection_id) DO NOTHING',
          [rows[i].id, cid, i]
        );
      }
    }
    // 2. Fix typo slugs + their nav links.
    for (const [oldSlug, newSlug] of SLUG_FIXES) {
      await client.query('UPDATE collections SET slug=$1 WHERE slug=$2', [newSlug, oldSlug]);
      await client.query('UPDATE navigation_items SET url=$1 WHERE url=$2', [`/collections/${newSlug}`, `/collections/${oldSlug}`]);
    }
    // 3. Hide empty Coffin shape (collection + nav + Shop By Shape card).
    await client.query("UPDATE collections SET is_active=false WHERE slug='coffin-shape'");
    await client.query("UPDATE navigation_items SET is_active=false WHERE url='/collections/coffin-shape'");
    await client.query("UPDATE section_items SET is_active=false WHERE link='/collections/coffin-shape'");
    // 4. Delete the test collection (cascades product_collections).
    await client.query("DELETE FROM collections WHERE slug='test'");
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  console.log('Done.');
}

run().catch((e) => { console.error(e.message || e); process.exitCode = 1; }).finally(() => pool.end());
