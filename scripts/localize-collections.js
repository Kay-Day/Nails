const fs = require('fs');
const path = require('path');

const RAW_DIR = path.join(__dirname, '..', 'reference', 'collections');
const OUT_DIR = path.join(__dirname, '..', 'public', 'collections');
const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images');

const COLLECTIONS = [
  'best-sellers-1',
  'new-arrival',
  'spring-2026-collection',
];

function assetPath(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.css') return `/css/${file}`;
  if (ext === '.js') return `/js/${file}`;
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext)) return `/images/${file}`;
  return `/assets/${file}`;
}

function decodeFile(file) {
  return decodeURIComponent(file.replace(/&amp;/g, '&'));
}

function localizeHtml(html) {
  let output = html;

  output = output.replace(
    /(?:https?:)?\/\/www\.runzie\.ca\/cdn\/shop\/t\/14\/assets\/([^?"'<>\s,)]+)(?:\?[^"'<>\s,)]*)?/g,
    (_, file) => assetPath(decodeFile(file))
  );

  output = output.replace(
    /(?:https?:)?\/\/www\.runzie\.ca\/cdn\/shop\/files\/([^?"'<>\s,)]+)(?:\?[^"'<>\s,)]*)?/g,
    (_, file) => `/images/${decodeFile(file)}`
  );

  output = output.replace(
    /(?:https?:)?\/\/www\.runzie\.ca\/cdn\/fonts\/[^"'<>\s,)]+\/([^\/?"'<>\s,)]+)(?:\?[^"'<>\s,)]*)?/g,
    (_, file) => `/fonts/${decodeFile(file)}`
  );

  output = output.replace(
    /https:\/\/cdn\.shopify\.com\/extensions\/[^"'<>\s,)]+\/assets\/([^?"'<>\s,)]+)(?:\?[^"'<>\s,)]*)?/g,
    (_, file) => assetPath(decodeFile(file))
  );

  output = output.replace(
    /(?:https?:)?\/\/cdn\.shopify\.com\/shopifycloud\/storefront\/assets\/storefront\/([^?"'<>\s,)]+)(?:\?[^"'<>\s,)]*)?/g,
    (_, file) => `/js/${decodeFile(file)}`
  );

  if (!/<base\b/i.test(output)) {
    output = output.replace(/<head>/i, '<head>\n<base href="/">');
  }

  return output;
}

function collectShopFileUrls(html, map) {
  for (const match of html.matchAll(
    /((?:https?:)?\/\/www\.runzie\.ca\/cdn\/shop\/files\/([^?"'<>\s,)]+)(?:\?[^"'<>\s,)]*)?)/g
  )) {
    const file = decodeFile(match[2]);
    const url = match[1].startsWith('//') ? `https:${match[1]}` : match[1];
    if (!map.has(file)) map.set(file, url.replace(/&amp;/g, '&'));
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const imageUrls = new Map();
const writtenFiles = [];

for (const slug of COLLECTIONS) {
  const rawFile = path.join(RAW_DIR, `${slug}.raw.html`);
  const outDir = path.join(OUT_DIR, slug);
  const outFile = path.join(outDir, 'index.html');
  const raw = fs.readFileSync(rawFile, 'utf8');

  collectShopFileUrls(raw, imageUrls);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, localizeHtml(raw));
  writtenFiles.push(outFile);
  console.log(`wrote ${path.relative(process.cwd(), outFile)}`);
}

const missing = [...imageUrls]
  .filter(([file]) => !fs.existsSync(path.join(IMAGES_DIR, file)))
  .sort(([a], [b]) => a.localeCompare(b));

const missingFile = path.join(RAW_DIR, 'missing-image-urls.txt');
fs.writeFileSync(missingFile, missing.map(([file, url]) => `${file}\t${url}`).join('\n'));

console.log(`shop file refs: ${imageUrls.size}`);
console.log(`missing local images: ${missing.length}`);
if (missing.length) {
  console.log(`missing list: ${path.relative(process.cwd(), missingFile)}`);
}

const missingLocalRefs = [];
const localRefPattern = /(?:src|href)="(\/(?:css|js|images|fonts)\/[^"#?]+)(?:[?#][^"]*)?"/g;

for (const file of writtenFiles) {
  const html = fs.readFileSync(file, 'utf8');
  for (const match of html.matchAll(localRefPattern)) {
    const ref = match[1];
    const localFile = path.join(__dirname, '..', 'public', ref.slice(1));
    if (!fs.existsSync(localFile)) {
      missingLocalRefs.push(`${path.relative(process.cwd(), file)}\t${ref}`);
    }
  }
}

console.log(`missing local asset refs: ${missingLocalRefs.length}`);
if (missingLocalRefs.length) {
  console.log(missingLocalRefs.slice(0, 80).join('\n'));
}
