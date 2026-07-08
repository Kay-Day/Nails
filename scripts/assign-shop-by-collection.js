// Roughly assign existing products into the "SHOP BY COLLECTION" category values
// by theme (name + colour + style heuristics), so /collections isn't empty when
// it switches to reading from that group. Idempotent.
//
//   node scripts/assign-shop-by-collection.js           # DRY RUN
//   node scripts/assign-shop-by-collection.js --apply
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');

const APPLY = process.argv.includes('--apply');
const BACKUP = path.join(__dirname, 'shop-by-collection-backup.json');

// slug -> match(name, colors, styles) => boolean
const has = (s, ...words) => words.some((w) => s.includes(w));
const THEMES = {
  'winter': (n, c, s) => has(n, 'snow', 'ice', 'aurora', 'moonlit', 'frost', 'silver', 'crystal', 'halo') || (c.includes('white') && (c.includes('silver') || s.includes('chrome'))),
  'spring-summer-2026': (n, c, s) => has(n, 'bloom', 'petal', 'rosy', 'rose', 'buttercream', 'flora', 'sand', 'soft', 'whisper') || (c.includes('pink') && !c.includes('black')),
  'autumn': (n, c, s) => has(n, 'mocha', 'ember', 'golden', 'amber', 'pomelo', 'yuzu', 'citrus', 'lemon') || c.includes('brown'),
  'holidays': (n, c, s) => has(n, 'sacred', 'royal', 'crown', 'celestial', 'star', 'cherry', 'flame', 'bloodline') || (c.includes('red') && c.includes('gold')),
  'the-gemstone': (n, c, s) => has(n, 'opal', 'gem', 'crystal', 'halo', 'shimmer', 'zodiac', 'astral', 'ethereal') || s.includes('glitter'),
  'tropical': (n, c, s) => has(n, 'island', 'coast', 'shore', 'tide', 'lure', 'seashell', 'pomelo', 'yuzu', 'citrus', 'lemon', 'rainbow', 'jelly') || (c.includes('blue') && !has(n, 'marble')),
  'jungle': (n, c, s) => has(n, 'garden', 'vine', 'flora', 'matcha', 'lotus', 'totoro', 'petal') || c.includes('green'),
  'y2k': (n, c, s) => has(n, 'chrome', 'silver', 'cyber', 'metal', 'liquid', 'color me', 'shimmer', 'strike') || s.includes('chrome'),
  'the-signature': (n, c, s) => has(n, 'dots', 'marble', 'cat', 'noir', 'throne', 'velvet', 'silk', 'couture', 'signature', 'dual'),
};
const SKIP_NAME = /bundle test|^test\b/i;

async function run() {
  const fg = (await pool.query("SELECT id FROM filter_groups WHERE slug='shop-by-collection'")).rows[0];
  if (!fg) throw new Error('shop-by-collection group not found');
  const values = (await pool.query('SELECT id, slug, label FROM filter_values WHERE group_id=$1', [fg.id])).rows;
  const valBySlug = new Map(values.map((v) => [v.slug, v]));

  const products = (await pool.query(`
    SELECT p.id, p.title,
      COALESCE((SELECT string_agg(lower(fv.label),',') FROM product_filter_values pfv JOIN filter_values fv ON fv.id=pfv.value_id JOIN filter_groups g ON g.id=fv.group_id WHERE pfv.product_id=p.id AND g.slug='color'),'') colors,
      COALESCE((SELECT string_agg(lower(fv.label),',') FROM product_filter_values pfv JOIN filter_values fv ON fv.id=pfv.value_id JOIN filter_groups g ON g.id=fv.group_id WHERE pfv.product_id=p.id AND g.slug='style'),'') styles
    FROM products p WHERE p.is_active=true ORDER BY p.title`)).rows;

  const assignments = []; // {productId, valueId, slug, title}
  const dist = {}; values.forEach((v) => (dist[v.slug] = []));
  for (const p of products) {
    if (SKIP_NAME.test(p.title)) continue;
    const n = p.title.toLowerCase();
    let matched = [];
    for (const [slug, fn] of Object.entries(THEMES)) {
      if (valBySlug.has(slug) && fn(n, p.colors, p.styles)) matched.push(slug);
    }
    if (!matched.length) matched = ['the-signature']; // fallback
    matched = matched.slice(0, 3); // cap per product
    for (const slug of matched) {
      assignments.push({ productId: p.id, valueId: valBySlug.get(slug).id, slug });
      dist[slug].push(p.title);
    }
  }

  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'} — ${assignments.length} assignments across ${products.length} products\n`);
  for (const v of values) {
    console.log(`[${v.label}] (${dist[v.slug].length}): ${dist[v.slug].slice(0, 8).join(', ')}${dist[v.slug].length > 8 ? '…' : ''}`);
  }

  if (!APPLY) { console.log('\nDry run — re-run with --apply.'); return; }

  const before = (await pool.query(
    'SELECT pfv.product_id, pfv.value_id FROM product_filter_values pfv JOIN filter_values fv ON fv.id=pfv.value_id WHERE fv.group_id=$1',
    [fg.id]
  )).rows;
  fs.writeFileSync(BACKUP, JSON.stringify({ groupId: fg.id, before }, null, 2));
  console.log(`\nBackup -> ${path.relative(process.cwd(), BACKUP)}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const a of assignments) {
      await client.query('INSERT INTO product_filter_values (product_id, value_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [a.productId, a.valueId]);
    }
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  console.log('Done.');
}
run().catch((e) => { console.error(e.message || e); process.exitCode = 1; }).finally(() => pool.end());
