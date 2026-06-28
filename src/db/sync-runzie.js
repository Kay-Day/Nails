require('dotenv').config();
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SNAPSHOT_FILE = path.join(__dirname, 'runzie-products.json');
const PRODUCT_IMAGE_ROOT = path.join(ROOT, 'public', 'images', 'products');
const STORE_URL = 'https://www.runzie.ca';

const collectionDefinitions = [
  { slug: 'best-sellers-1', title: 'Best Sellers', kind: 'core', image: '/images/0326002.jpg', description: 'Most-loved press-on sets selected by customers.' },
  { slug: 'new-arrival', title: 'New Arrival', kind: 'core', image: '/images/Fresh.jpg', description: 'Fresh designs and seasonal sets just added.' },
  { slug: 'spring-2026-collection', title: 'Spring 2026 Collection', kind: 'core', image: '/images/Collection_Banner_-_Desktop_1.jpg', description: 'Soft colors, playful details, and handcrafted salon-quality finish.' },
  { slug: 'almond', title: 'Almond Shape', kind: 'shape', value: 'Almond', image: '/images/0326009.jpg' },
  { slug: 'coffin-shape', title: 'Coffin Shape', kind: 'shape', value: 'Coffin', image: '/images/0326015.jpg' },
  { slug: 'round-shape', title: 'Round Shape', kind: 'shape', value: 'Round', image: '/images/030150.jpg' },
  { slug: 'square-shape', title: 'Square Shape', kind: 'shape', value: 'Square', image: '/images/050026.jpg' },
  { slug: 'stiletto-shape', title: 'Stiletto Shape', kind: 'shape', value: 'Stiletto', image: '/images/030138.jpg' },
  { slug: 'short-length', title: 'Short Length', kind: 'length', value: 'Short', image: '/images/050026.jpg' },
  { slug: 'medium-length', title: 'Medium Length', kind: 'length', value: 'Medium', image: '/images/0326009.jpg' },
  { slug: 'long-length', title: 'Long Length', kind: 'length', value: 'Long', image: '/images/0326015.jpg' },
  { slug: 'now-on-sale', title: 'On Sale', kind: 'supplemental', image: '/images/Discount.jpg', description: 'Salon-perfect nails for less.' },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url, options = {}, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 Pastelle-Nails-Sync',
          Accept: options.accept || 'application/json,text/plain,*/*',
        },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(attempt * 500);
    }
  }
  throw new Error(`Could not fetch ${url}: ${lastError && lastError.message}`);
}

async function fetchJson(url) {
  return (await fetchWithRetry(url)).json();
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&rsquo;/gi, '’')
    .replace(/&ndash;/gi, '-')
    .replace(/&mdash;/gi, '-');
}

function htmlToText(value) {
  return decodeEntities(
    String(value || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|li|h[1-6])>/gi, '\n')
      .replace(/<li[^>]*>/gi, '- ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function numberPrice(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return typeof value === 'number' ? number / 100 : number;
}

function normalizeProduct(raw) {
  const variants = (raw.variants || []).map((variant, index) => ({
    title: variant.public_title || variant.title || variant.option1 || 'Default Title',
    sku: variant.sku || '',
    price: numberPrice(variant.price),
    compare_at_price: numberPrice(variant.compare_at_price),
    is_available: variant.available !== false,
    sort_order: variant.position ? Number(variant.position) - 1 : index,
  }));
  const imageSources = (raw.media || [])
    .filter((item) => item.media_type === 'image' && item.src)
    .map((item) => item.src);
  const fallbackImages = (raw.images || []).map((item) => typeof item === 'string' ? item : item.src);
  const images = [];
  const imageKeys = new Set();
  for (const source of [...imageSources, ...fallbackImages].filter(Boolean)) {
    const absolute = source.startsWith('//') ? `https:${source}` : source;
    let key = absolute;
    try {
      key = new URL(absolute).pathname;
    } catch {}
    if (imageKeys.has(key)) continue;
    imageKeys.add(key);
    images.push(absolute);
  }
  const videos = (raw.media || []).filter((item) => item.media_type === 'video');
  const video = videos[0];
  const videoSource = video && (video.sources || [])
    .filter((source) => source.mime_type === 'video/mp4')
    .sort((a, b) => Number(b.height || 0) - Number(a.height || 0))[0];

  return {
    slug: raw.handle,
    title: raw.title,
    description: htmlToText(raw.description || raw.body_html),
    price: variants[0] ? variants[0].price : numberPrice(raw.price),
    compare_at_price: variants[0] ? variants[0].compare_at_price : numberPrice(raw.compare_at_price),
    variants,
    remoteImages: images,
    video: videoSource ? videoSource.url : null,
    videoPosterRemote: video && video.preview_image ? video.preview_image.src : null,
  };
}

function imageUrl(source) {
  const url = new URL(source.startsWith('//') ? `https:${source}` : source);
  url.searchParams.set('width', '1800');
  url.searchParams.set('format', 'jpg');
  return url.toString();
}

async function downloadImage(source, slug, fileName) {
  if (!source) return null;
  const folder = path.join(PRODUCT_IMAGE_ROOT, slug);
  fs.mkdirSync(folder, { recursive: true });
  const target = path.join(folder, fileName);
  if (!fs.existsSync(target) || fs.statSync(target).size < 1000) {
    const response = await fetchWithRetry(imageUrl(source), { accept: 'image/jpeg,image/*,*/*' });
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 1000) throw new Error(`Image response too small for ${slug}/${fileName}`);
    fs.writeFileSync(target, buffer);
  }
  return `/images/products/${slug}/${fileName}`;
}

async function main() {
  fs.mkdirSync(PRODUCT_IMAGE_ROOT, { recursive: true });

  const collectionPayloads = new Map();
  await mapLimit(collectionDefinitions, 4, async (collection) => {
    try {
      const payload = await fetchJson(`${STORE_URL}/collections/${collection.slug}/products.json?limit=250`);
      collectionPayloads.set(collection.slug, payload.products || []);
      console.log(`✓ ${collection.slug}: ${(payload.products || []).length} products`);
    } catch (error) {
      if (collection.kind === 'core') throw error;
      collectionPayloads.set(collection.slug, []);
      console.warn(`- ${collection.slug}: ${error.message}`);
    }
  });

  const records = new Map();
  for (const collection of collectionDefinitions.filter((item) => item.kind === 'core')) {
    const products = collectionPayloads.get(collection.slug) || [];
    products.forEach((raw, index) => {
      const current = records.get(raw.handle) || {
        raw,
        collections: [],
        collectionOrder: {},
      };
      current.raw = raw;
      if (!current.collections.includes(collection.slug)) current.collections.push(collection.slug);
      current.collectionOrder[collection.slug] = index;
      records.set(raw.handle, current);
    });
  }

  if (!records.has('0326031')) {
    const flagship = await fetchJson(`${STORE_URL}/products/0326031.js`);
    records.set('0326031', {
      raw: flagship,
      collections: ['spring-2026-collection'],
      collectionOrder: { 'spring-2026-collection': -1 },
    });
  }

  for (const collection of collectionDefinitions.filter((item) => item.kind !== 'core')) {
    const handles = new Set((collectionPayloads.get(collection.slug) || []).map((product) => product.handle));
    for (const [handle, record] of records) {
      if (!handles.has(handle)) continue;
      if (!record.collections.includes(collection.slug)) record.collections.push(collection.slug);
      record.collectionOrder[collection.slug] = [...handles].indexOf(handle);
      if (collection.kind === 'shape') record.shape = collection.value;
      if (collection.kind === 'length') record.length = collection.value;
    }
  }

  const entries = [...records.entries()];
  const products = await mapLimit(entries, 5, async ([slug, record], productIndex) => {
    let raw = record.raw;
    try {
      raw = await fetchJson(`${STORE_URL}/products/${encodeURIComponent(slug)}.js`);
    } catch (error) {
      console.warn(`- ${slug}: product media fallback (${error.message})`);
    }

    const product = normalizeProduct(raw);
    const localImages = [];
    for (let index = 0; index < product.remoteImages.length; index++) {
      try {
        localImages.push(await downloadImage(product.remoteImages[index], slug, `${String(index + 1).padStart(2, '0')}.jpg`));
      } catch (error) {
        console.warn(`- ${slug} image ${index + 1}: ${error.message}`);
        localImages.push(imageUrl(product.remoteImages[index]));
      }
    }

    let videoPoster = null;
    if (product.videoPosterRemote) {
      try {
        videoPoster = await downloadImage(product.videoPosterRemote, slug, 'video-poster.jpg');
      } catch (error) {
        videoPoster = imageUrl(product.videoPosterRemote);
      }
    }

    const primaryCollection = record.collections.find((collection) =>
      ['best-sellers-1', 'new-arrival', 'spring-2026-collection'].includes(collection)
    ) || record.collections[0] || null;

    console.log(`✓ ${productIndex + 1}/${entries.length} ${slug}: ${localImages.length} images, ${product.variants.length} variants`);
    return {
      slug,
      title: product.title,
      description: product.description,
      price: product.price,
      compare_at_price: product.compare_at_price,
      sku: product.variants[0] && product.variants[0].sku || '',
      size_options: product.variants
        .map((variant) => variant.title)
        .filter((title) => !/^default title$/i.test(title))
        .join(','),
      shape: record.shape || null,
      length: record.length || null,
      image: localImages[0] || null,
      gallery: localImages.slice(1),
      video: product.video,
      video_poster: videoPoster,
      variants: product.variants,
      collections: record.collections,
      collection_order: record.collectionOrder,
      primary_collection: primaryCollection,
      is_featured: record.collections.includes('best-sellers-1'),
    };
  });

  const snapshot = {
    generated_at: new Date().toISOString(),
    collections: collectionDefinitions.map((collection, index) => ({
      slug: collection.slug,
      title: collection.title,
      description: collection.description || '',
      image: collection.image || '',
      sort_order: index,
    })),
    products,
  };
  fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`\nSaved ${products.length} products to ${SNAPSHOT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
