// READ-ONLY survey of local media references in the DB before migrating to Cloudinary.
// Lists every distinct /uploads/* and /images/* URL, whether the local file exists,
// and which columns reference it. Makes NO changes.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Columns that hold a single media URL.
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

// Columns that may embed media URLs inside HTML/markup.
const HTML_COLUMNS = [
  ['products', 'description'],
  ['posts', 'content'],
  ['site_sections', 'body_html'],
  ['section_items', 'body_html'],
];

const LOCAL_RE = /(?:^|["'(\s])((?:\/uploads\/|\/images\/)[^"')\s]+)/gi;

function localFilePath(url) {
  const clean = decodeURIComponent(String(url).split(/[?#]/)[0]);
  const resolved = path.resolve(PUBLIC_DIR, '.' + clean);
  return resolved.startsWith(path.resolve(PUBLIC_DIR)) ? resolved : null;
}

async function tableExists(table) {
  const { rows } = await pool.query('SELECT to_regclass($1) AS t', ['public.' + table]);
  return !!rows[0].t;
}

async function run() {
  const refs = new Map(); // url -> Set of "table.column"

  for (const [table, col] of URL_COLUMNS) {
    if (!(await tableExists(table))) continue;
    const { rows } = await pool.query(
      `SELECT ${col} AS v FROM ${table} WHERE ${col} LIKE '/uploads/%' OR ${col} LIKE '/images/%'`
    );
    for (const { v } of rows) {
      if (!refs.has(v)) refs.set(v, new Set());
      refs.get(v).add(`${table}.${col}`);
    }
  }

  let embeddedHits = 0;
  for (const [table, col] of HTML_COLUMNS) {
    if (!(await tableExists(table))) continue;
    const { rows } = await pool.query(
      `SELECT ${col} AS v FROM ${table} WHERE ${col} LIKE '%/uploads/%' OR ${col} LIKE '%/images/%'`
    );
    for (const { v } of rows) {
      let m;
      LOCAL_RE.lastIndex = 0;
      while ((m = LOCAL_RE.exec(v || ''))) {
        embeddedHits++;
        const url = m[1];
        if (!refs.has(url)) refs.set(url, new Set());
        refs.get(url).add(`${table}.${col}(embedded)`);
      }
    }
  }

  const all = [...refs.keys()].sort();
  const uploads = all.filter((u) => u.startsWith('/uploads/'));
  const images = all.filter((u) => u.startsWith('/images/'));

  let missing = 0;
  let present = 0;
  const missingList = [];
  for (const url of all) {
    const fp = localFilePath(url);
    const exists = fp && fs.existsSync(fp);
    if (exists) present++;
    else {
      missing++;
      missingList.push(url);
    }
  }

  console.log('=== Local media reference survey ===');
  console.log(`Distinct local URLs: ${all.length}  (uploads: ${uploads.length}, images: ${images.length})`);
  console.log(`Embedded-in-HTML occurrences: ${embeddedHits}`);
  console.log(`Local file present: ${present}   Missing on disk: ${missing}`);
  console.log('');
  console.log('--- /uploads/* references ---');
  for (const u of uploads) {
    const fp = localFilePath(u);
    const ok = fp && fs.existsSync(fp) ? 'OK ' : 'MISSING';
    console.log(`  [${ok}] ${u}  <- ${[...refs.get(u)].join(', ')}`);
  }
  console.log('');
  console.log(`--- /images/* references (${images.length}) ---`);
  for (const u of images) {
    const fp = localFilePath(u);
    const ok = fp && fs.existsSync(fp) ? 'OK ' : 'MISSING';
    console.log(`  [${ok}] ${u}  <- ${[...refs.get(u)].join(', ')}`);
  }
  if (missingList.length) {
    console.log('');
    console.log(`!! ${missingList.length} URLs have NO local file and cannot be uploaded (will be left as-is).`);
  }
}

run()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
