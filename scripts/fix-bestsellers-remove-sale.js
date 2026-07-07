// Remove on-sale products from the "Best Sellers" collection + homepage section so
// Best Sellers only shows full-price popular sets. Keeps is_featured in sync (it
// drives the "Best Seller" badge and the homepage fallback) and backfills the
// homepage grid with non-sale best sellers.
//
//   node scripts/fix-bestsellers-remove-sale.js            # DRY RUN
//   node scripts/fix-bestsellers-remove-sale.js --apply     # apply in a transaction
//
// Writes scripts/bestsellers-fix-backup.json (old state) so the change can be reversed.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');

const APPLY = process.argv.includes('--apply');
const SLUG = 'best-sellers-1';
const BACKUP = path.join(__dirname, 'bestsellers-fix-backup.json');

async function run() {
  const col = (await pool.query('SELECT id FROM collections WHERE slug=$1', [SLUG])).rows[0];
  if (!col) throw new Error(`collection ${SLUG} not found`);
  const sec = (await pool.query(
    "SELECT id FROM site_sections WHERE page_slug='home' AND section_key='best-sellers'"
  )).rows[0];

  // Current best-sellers members, flagged on-sale or not.
  const members = (await pool.query(
    `SELECT p.id, p.title, p.is_featured,
            (p.compare_at_price IS NOT NULL AND p.compare_at_price > p.price) AS on_sale
     FROM products p
     JOIN product_collections pc ON pc.product_id = p.id
     WHERE pc.collection_id = $1 AND p.is_active = true
     ORDER BY p.sort_order, p.id`,
    [col.id]
  )).rows;

  const sale = members.filter((m) => m.on_sale);
  const keep = members.filter((m) => !m.on_sale);
  const saleIds = sale.map((m) => m.id);

  // Homepage section products (before).
  const sectionBefore = sec ? (await pool.query(
    `SELECT sp.product_id, sp.sort_order, p.title,
            (p.compare_at_price IS NOT NULL AND p.compare_at_price > p.price) AS on_sale
     FROM section_products sp JOIN products p ON p.id = sp.product_id
     WHERE sp.section_id = $1 ORDER BY sp.sort_order, sp.product_id`,
    [sec.id]
  )).rows : [];

  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
  console.log(`Best Sellers members: ${members.length}  (on sale: ${sale.length}, keep: ${keep.length})`);
  console.log('Remove from Best Sellers:', sale.map((m) => m.title).join(', ') || '(none)');
  console.log('Keep (full price):', keep.map((m) => m.title).join(', '));

  // Homepage grid: drop sale rows, then append non-sale best sellers not present, target >=8.
  const sectionKeepIds = new Set(sectionBefore.filter((r) => !r.on_sale).map((r) => r.product_id));
  const toAppend = keep.filter((m) => !sectionKeepIds.has(m.id)).map((m) => m.id);
  const finalSection = [...sectionBefore.filter((r) => !r.on_sale).map((r) => r.product_id), ...toAppend].slice(0, 8);
  if (sec) {
    console.log(`Homepage section: was ${sectionBefore.length} (${sectionBefore.filter(r=>r.on_sale).length} sale) -> ${finalSection.length} full-price`);
  } else {
    console.log('Homepage best-sellers section not found (skipping section rebuild).');
  }

  if (!APPLY) {
    console.log('\nDry run only — re-run with --apply to make changes.');
    return;
  }

  const backup = {
    collectionId: col.id,
    sectionId: sec ? sec.id : null,
    removedFromCollection: sale.map((m) => ({ id: m.id, title: m.title })),
    isFeaturedResetToFalse: sale.filter((m) => m.is_featured).map((m) => ({ id: m.id, title: m.title })),
    sectionProductsBefore: sectionBefore.map((r) => ({ product_id: r.product_id, sort_order: r.sort_order })),
  };
  fs.writeFileSync(BACKUP, JSON.stringify(backup, null, 2));
  console.log(`\nSaved backup -> ${path.relative(process.cwd(), BACKUP)}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (saleIds.length) {
      await client.query('DELETE FROM product_collections WHERE collection_id = $1 AND product_id = ANY($2::int[])', [col.id, saleIds]);
      await client.query('UPDATE products SET is_featured = false WHERE id = ANY($1::int[])', [saleIds]);
    }
    if (sec) {
      await client.query('DELETE FROM section_products WHERE section_id = $1', [sec.id]);
      for (let i = 0; i < finalSection.length; i++) {
        await client.query(
          'INSERT INTO section_products (section_id, product_id, sort_order) VALUES ($1,$2,$3)',
          [sec.id, finalSection[i], i]
        );
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  console.log('Done. Best Sellers now excludes on-sale products.');
}

run()
  .catch((e) => { console.error(e.message || e); process.exitCode = 1; })
  .finally(() => pool.end());
