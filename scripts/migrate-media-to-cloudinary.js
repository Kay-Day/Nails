// Migrate local media references (/anhshop, /images, /uploads, ...) in the DB to
// Cloudinary. Uploads each existing local file, then rewrites every DB reference
// (exact columns + embedded in HTML) to the Cloudinary URL.
//
//   node scripts/migrate-media-to-cloudinary.js           # DRY RUN (no uploads, no writes)
//   node scripts/migrate-media-to-cloudinary.js --apply    # perform uploads + DB updates
//
// Safe to re-run: only local ("/...") references are touched, so already-migrated
// (https) values are skipped. --apply writes scripts/media-migration-map.json
// (old -> new) so the change can be reversed.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const pool = require('../src/db/pool');
const { hasCloudinary } = require('../src/middleware/upload'); // configures cloudinary

const APPLY = process.argv.includes('--apply');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MAP_FILE = path.join(__dirname, 'media-migration-map.json');
const FOLDER = process.env.CLOUDINARY_FOLDER || 'nail';

const URL_COLUMNS = [
  ['products', 'image'],
  ['products', 'video'],
  ['products', 'video_poster'],
  ['product_images', 'url'],
  ['collections', 'image'],
  ['banners', 'image'],
  ['banners', 'video'],
  ['posts', 'cover_image'],
  ['site_sections', 'image'],
  ['section_items', 'image'],
  ['settings', 'value'],
];

const HTML_COLUMNS = [
  ['products', 'description'],
  ['posts', 'content'],
  ['site_sections', 'body_html'],
  ['section_items', 'body_html'],
];

// A local media ref: starts with a single "/", not "//" (protocol-relative) or http.
const EMBED_RE = /(?:^|["'(\s])(\/[a-z0-9][^"')\s]*\.(?:jpe?g|png|webp|gif|avif|mp4|webm))/gi;

function isLocal(v) {
  return typeof v === 'string' && /^\/[^/]/.test(v) && !/^https?:/i.test(v);
}

function localFilePath(url) {
  const clean = decodeURIComponent(String(url).split(/[?#]/)[0]);
  const resolved = path.resolve(PUBLIC_DIR, '.' + clean);
  return resolved.startsWith(path.resolve(PUBLIC_DIR) + path.sep) ? resolved : null;
}

// Deterministic public_id so re-uploads overwrite instead of duplicating.
function publicIdFor(url) {
  const clean = decodeURIComponent(String(url).split(/[?#]/)[0]).replace(/^\/+/, '');
  const noExt = clean.replace(/\.[a-z0-9]+$/i, '');
  return `migrated/${noExt}`.replace(/[^a-z0-9/_-]+/gi, '-');
}

async function tableExists(table) {
  const { rows } = await pool.query('SELECT to_regclass($1) AS t', ['public.' + table]);
  return !!rows[0].t;
}

async function collectCandidates() {
  const refs = new Map(); // url -> Set("table.col")
  for (const [table, col] of URL_COLUMNS) {
    if (!(await tableExists(table))) continue;
    const { rows } = await pool.query(
      `SELECT DISTINCT ${col} AS v FROM ${table} WHERE ${col} LIKE '/%' AND ${col} NOT LIKE '//%'`
    );
    for (const { v } of rows) {
      if (isLocal(v)) (refs.get(v) || refs.set(v, new Set()).get(v)).add(`${table}.${col}`);
    }
  }
  for (const [table, col] of HTML_COLUMNS) {
    if (!(await tableExists(table))) continue;
    const { rows } = await pool.query(
      `SELECT ${col} AS v FROM ${table} WHERE ${col} LIKE '%/%.%'`
    );
    for (const { v } of rows) {
      let m;
      EMBED_RE.lastIndex = 0;
      while ((m = EMBED_RE.exec(v || ''))) {
        const url = m[1];
        if (isLocal(url)) (refs.get(url) || refs.set(url, new Set()).get(url)).add(`${table}.${col}(html)`);
      }
    }
  }
  return refs;
}

async function run() {
  if (!hasCloudinary) {
    console.error('Cloudinary is not configured (.env CLOUDINARY_*). Aborting.');
    process.exitCode = 1;
    return;
  }

  const refs = await collectCandidates();
  const urls = [...refs.keys()].sort((a, b) => b.length - a.length); // longest first for safe HTML replace

  const uploadable = [];
  const missing = [];
  for (const url of urls) {
    const fp = localFilePath(url);
    if (fp && fs.existsSync(fp)) uploadable.push(url);
    else missing.push(url);
  }

  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
  console.log(`Local media references: ${urls.length}  (uploadable: ${uploadable.length}, missing file: ${missing.length})`);
  if (missing.length) {
    console.log('Missing local files (left unchanged):');
    for (const u of missing) console.log('   -', u);
  }

  if (!APPLY) {
    console.log('\nWould upload & rewrite:');
    for (const u of uploadable) console.log(`   ${u}  ->  cloudinary:${FOLDER}/${publicIdFor(u)}  [${[...refs.get(u)].join(', ')}]`);
    console.log('\nDry run only — re-run with --apply to perform the migration.');
    return;
  }

  const mapping = {};
  let uploaded = 0;
  for (const url of uploadable) {
    const fp = localFilePath(url);
    const publicId = publicIdFor(url);
    try {
      const res = await cloudinary.uploader.upload(fp, {
        folder: FOLDER,
        public_id: publicId,
        resource_type: 'auto',
        overwrite: true,
        invalidate: true,
      });
      mapping[url] = res.secure_url;
      uploaded++;
      console.log(`  [${uploaded}/${uploadable.length}] ${url} -> ${res.secure_url}`);
    } catch (e) {
      console.error(`  FAILED ${url}: ${e.message} — leaving DB reference unchanged`);
    }
  }

  // Persist mapping first (rollback aid) before touching the DB.
  fs.writeFileSync(MAP_FILE, JSON.stringify(mapping, null, 2));
  console.log(`\nSaved URL map -> ${path.relative(process.cwd(), MAP_FILE)}`);

  const entries = Object.entries(mapping).sort((a, b) => b[0].length - a[0].length);
  const client = await pool.connect();
  let updates = 0;
  try {
    await client.query('BEGIN');
    for (const [table, col] of URL_COLUMNS) {
      if (!(await tableExists(table))) continue;
      for (const [oldUrl, newUrl] of entries) {
        const r = await client.query(`UPDATE ${table} SET ${col} = $1 WHERE ${col} = $2`, [newUrl, oldUrl]);
        updates += r.rowCount;
      }
    }
    for (const [table, col] of HTML_COLUMNS) {
      if (!(await tableExists(table))) continue;
      for (const [oldUrl, newUrl] of entries) {
        const r = await client.query(
          `UPDATE ${table} SET ${col} = REPLACE(${col}, $1, $2) WHERE ${col} LIKE '%' || $1 || '%'`,
          [oldUrl, newUrl]
        );
        updates += r.rowCount;
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('DB update failed, rolled back:', e.message);
    throw e;
  } finally {
    client.release();
  }

  console.log(`Uploaded ${uploaded} file(s); rewrote ${updates} DB reference(s). Local files left in place as fallback.`);
}

run()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
