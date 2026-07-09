// Migrate the whole Postgres database from the current Neon project (SOURCE =
// DATABASE_URL in .env) to a new Neon project (TARGET = TARGET_DATABASE_URL).
// Applies the schema, copies every table's rows, resets id sequences, verifies
// row counts. Read-only on the source. Idempotent-ish on the target (uses the
// schema's CREATE TABLE IF NOT EXISTS + per-table clear before copy).
//
//   TARGET_DATABASE_URL="postgres://...new-neon..." node scripts/migrate-neon.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const SOURCE_URL = process.env.DATABASE_URL;
const TARGET_URL = process.env.TARGET_DATABASE_URL;
if (!SOURCE_URL) throw new Error('DATABASE_URL (source) is not set');
if (!TARGET_URL) throw new Error('TARGET_DATABASE_URL (new Neon) is not set');

const ssl = { rejectUnauthorized: false };
const src = new Pool({ connectionString: SOURCE_URL, ssl, max: 4 });
const tgt = new Pool({ connectionString: TARGET_URL, ssl, max: 4 });

// Copy order = FK-safe (referenced tables first). "session" is transient login
// state — skip it.
const ORDER = [
  'admins', 'settings', 'collections', 'products', 'product_collections',
  'product_variants', 'product_images', 'banners', 'posts', 'site_sections',
  'section_items', 'section_products', 'navigation_items', 'contact_messages',
  'email_subscribers', 'filter_groups', 'filter_values', 'product_filter_values',
];

const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

async function columnsOf(pool, table) {
  const { rows } = await pool.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [table]);
  return rows;
}

async function run() {
  console.log('Applying schema to the new database…');
  const schema = fs.readFileSync(path.join(__dirname, '..', 'src', 'db', 'schema.sql'), 'utf8');
  await tgt.query(schema);

  let grandTotal = 0;
  for (const table of ORDER) {
    const cols = await columnsOf(src, table);
    if (!cols.length) { console.log(`  - ${table}: not found in source, skip`); continue; }
    const colNames = cols.map((c) => c.column_name);
    const jsonCols = new Set(cols.filter((c) => /json/.test(c.data_type)).map((c) => c.column_name));

    const { rows } = await src.query(`SELECT ${colNames.map((c) => `"${c}"`).join(', ')} FROM "${table}"`);
    // Clear the target table first so re-runs don't duplicate.
    await tgt.query(`DELETE FROM "${table}"`);
    if (!rows.length) { console.log(`  ${table.padEnd(24)} 0`); continue; }

    const colList = colNames.map((c) => `"${c}"`).join(', ');
    for (const batch of chunk(rows, 200)) {
      const values = [];
      const placeholders = batch.map((row, r) => {
        const ph = colNames.map((c, i) => {
          let v = row[c];
          if (v !== null && jsonCols.has(c) && typeof v === 'object') v = JSON.stringify(v);
          values.push(v);
          return `$${r * colNames.length + i + 1}`;
        });
        return `(${ph.join(', ')})`;
      });
      await tgt.query(`INSERT INTO "${table}" (${colList}) VALUES ${placeholders.join(', ')}`, values);
    }
    console.log(`  ${table.padEnd(24)} ${rows.length}`);
    grandTotal += rows.length;
  }

  // Reset sequences for serial id columns so new inserts don't collide.
  console.log('Resetting id sequences…');
  for (const table of ORDER) {
    const has = await tgt.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='id'`, [table]);
    if (!has.rows.length) continue;
    await tgt.query(
      `SELECT setval(pg_get_serial_sequence('"${table}"','id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1), true)
       WHERE pg_get_serial_sequence('"${table}"','id') IS NOT NULL`);
  }

  // Verify.
  console.log('\nVerify (source vs target):');
  let mismatch = 0;
  for (const table of ORDER) {
    const s = (await src.query(`SELECT COUNT(*)::int n FROM "${table}"`)).rows[0].n;
    const t = (await tgt.query(`SELECT COUNT(*)::int n FROM "${table}"`)).rows[0].n;
    const ok = s === t;
    if (!ok) mismatch++;
    console.log(`  ${ok ? 'OK ' : '!! '} ${table.padEnd(24)} src=${s} tgt=${t}`);
  }
  console.log(`\nCopied ${grandTotal} rows across ${ORDER.length} tables. ${mismatch ? mismatch + ' MISMATCH(es)!' : 'All match ✓'}`);
}

run().catch((e) => { console.error('MIGRATION FAILED:', e.message); process.exitCode = 1; })
  .finally(async () => { await src.end().catch(() => {}); await tgt.end().catch(() => {}); });
