require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./pool');
const { seedCms } = require('./cms-seed');

const IMG_DIR = path.join(__dirname, '..', '..', 'public', 'images');
const allImages = fs.readdirSync(IMG_DIR);
const SNAPSHOT_FILE = path.join(__dirname, 'runzie-products.json');

// Return /images/... url plus any _1.._N gallery variants for a base file name.
function gallery(baseFile) {
  const ext = path.extname(baseFile);
  const stem = path.basename(baseFile, ext);
  const variants = allImages
    .filter((f) => f.startsWith(stem + '_') && /_(\d+)\./.test(f))
    .sort();
  return {
    main: '/images/' + baseFile,
    extra: variants.map((f) => '/images/' + f),
  };
}

const img = (f) => '/images/' + f;
const media = (f) => '/media/' + f;
// Shop's own product photos in public/anhshop — referenced directly as /anhshop/<file>.
const SHOP_PHOTOS = fs
  .readdirSync(path.join(__dirname, '..', '..', 'public', 'anhshop'))
  .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
  .sort();
const shopPhoto = (i) => '/anhshop/' + SHOP_PHOTOS[i % SHOP_PHOTOS.length];

const collections = [
  { slug: 'best-sellers-1', title: 'Best Sellers', image: 'Collection_Banner_-_Desktop_1.jpg', description: 'Most-loved press-on sets selected by customers.' },
  { slug: 'new-arrival', title: 'New Arrival', image: 'Fresh.jpg', description: 'Fresh designs and seasonal sets just added.' },
  { slug: 'spring-2026-collection', title: 'Spring 2026 Collection', image: 'Collection_Banner_-_Desktop_1.jpg', description: 'Soft colors, playful details, and handcrafted salon-quality finish.' },
  { slug: 'almond', title: 'Almond Shape', image: '0326009.jpg', description: 'Soft, tapered tips for an elegant everyday look.' },
  { slug: 'coffin-shape', title: 'Coffin Shape', image: '0326015.jpg', description: 'Bold, flat-tipped glam that turns heads.' },
  { slug: 'round-shape', title: 'Round Shape', image: 'Collection_Banner_-_Desktop_1.jpg', description: 'Gentle curves that flatter every hand.' },
  { slug: 'square-shape', title: 'Square Shape', image: '050026.jpg', description: 'Clean, classic edges with a modern feel.' },
  { slug: 'stiletto-shape', title: 'Stiletto Shape', image: 'Collection_Banner_-_Desktop_1.jpg', description: 'Sharp, dramatic points for a fierce statement.' },
  { slug: 'short-length', title: 'Short Length', image: '050026.jpg', description: 'Easy everyday length with a natural feel.' },
  { slug: 'medium-length', title: 'Medium Length', image: '0326009.jpg', description: 'Balanced length for everyday styling.' },
  { slug: 'long-length', title: 'Long Length', image: '0326015.jpg', description: 'Statement length for detailed nail art.' },
  { slug: 'now-on-sale', title: 'On Sale', image: 'Discount.jpg', description: 'Salon-perfect nails for less.' },
  { slug: 'neonnyx-nails', title: 'NeonNyx Nails', image: '0326015.jpg', description: 'Bold, statement designs for nights out.' },
  { slug: 'bare-edit', title: 'Bare Edit', image: '050026.jpg', description: 'Nude and natural — your everyday go-to.' },
  { slug: 'the-bloom-edit', title: 'The Bloom Edit', image: '0326009.jpg', description: 'Soft, floral-inspired press-on sets.' },
  { slug: 'play-colletion', title: 'Play Collection', image: 'Collection_Banner_-_Desktop_1.jpg', description: 'Fun, colorful sets to mix and match.' },
  { slug: 'dark-edit', title: 'Dark Edit', image: 'Collection_Banner_-_Desktop_1.jpg', description: 'Moody and dramatic for a fierce statement.' },
  { slug: 'the-blush-collection', title: 'The Blush Collection', image: 'Collection_Banner_-_Desktop_1.jpg', description: 'Soft pink hues and romantic tones.' },
  { slug: 'glow-colletion', title: 'Glow Collection', image: 'Collection_Banner_-_Desktop_1.jpg', description: 'Shimmer, chrome, and a little extra shine.' },
  { slug: 'bundle-sales', title: 'Bundle Sales', image: 'Discount.jpg', description: 'Curated bundles — best value, salon-ready.' },
  { slug: 'nail-essentials', title: 'Nail Essentials', image: '0326009_1.jpg', description: 'Prep kits, glue, files, and tools.' },
];

const shapes = ['Almond', 'Coffin', 'Square', 'Stiletto', 'Round'];
const lengths = ['Short', 'Medium', 'Long', 'Extra Long'];

// Product image bases that exist in /public/images
const productBases = [
  '0326009.jpg', '0326015.jpg', '050026.jpg', '030138.jpg', '030150.jpg', '0326002.jpg',
  '11_47100b3c-e7cf-4a63-a668-290a59a22cab.jpg',
  '13_f911b7db-5979-4171-869f-71816f3d353f.jpg',
  '16_8803e228-7e4c-47b8-ac83-72db7cfbb159.jpg',
  '1_3d7672ae-c30a-4e82-8e1c-36ac8904d9aa.jpg',
  '1_5baca975-a38d-410e-b940-86d48c867eef.jpg',
  '1_61028f74-9d53-4c8a-8d6b-230c9feb0803.jpg',
  '1_668f698b-1c86-47ea-9daf-b98732388e5b.jpg',
  '1_75a289b0-908e-48cc-a0c2-d4295b99c177.jpg',
  '1_ab057ec5-259b-4299-81f6-b17263bc4503.jpg',
  '1_bca6d487-40ef-421d-8cd6-92369c4d9d2c.jpg',
  '25_8b41faa1-17be-4e31-8bbc-c533665cf708.jpg',
  '29_209e72de-f153-49e2-9b99-977963b64fd4.jpg',
  '2_30dbb022-30b1-492a-98a8-528d3b60f6d7.jpg',
  '2_51bc920c-0d54-4ea9-8489-a17d6b761740.jpg',
  '2_97f366e5-0af1-4881-b7e0-9d1400cd1980.jpg',
  '2_ea871a6d-db4d-43cd-b397-a273414def81.jpg',
  '3_009377ca-50bc-4324-9673-38d8ff390185.jpg',
  '3_9bdd40e0-d994-4dae-aabb-847050552d75.jpg',
  '3_e86ae790-5d78-4952-9287-d521996ece06.jpg',
  '4_3160e08a-9b4a-4e54-8e6f-4e1b21db786b.jpg',
  '4_84229c04-15be-404b-a515-09e0d5a8a4f4.jpg',
  '4_bc11dfcb-7d1d-49cf-887c-2de351ceabda.jpg',
  '6_95b252ba-f7af-42a1-bf69-fb7c05fecf24.jpg',
  '7_a7ff4e2f-4928-434c-9117-cca058a99040.jpg',
  '8_8167b1ea-746c-438f-bc7d-b70dd28aaf1c.jpg',
  '9_cab940dc-07bb-409c-b69f-8e2531f1eea4.jpg',
];

const names = [
  'Rose Quartz', 'Midnight Velvet', 'Cafe au Lait', 'Cloud Nine', 'Sugar Glaze',
  'French Whisper', 'Cherry Cola', 'Lavender Haze', 'Champagne Toast', 'Matte Mocha',
  'Pearl Drop', 'Coral Crush', 'Smoke & Mirrors', 'Honey Glow', 'Berry Bliss',
  'Ivory Lace', 'Cocoa Dust', 'Pink Sands', 'Onyx Edge', 'Golden Hour',
  'Bare Minimum', 'Frosted Petal', 'Espresso Martini', 'Ballet Slipper', 'Stormy Sky',
  'Peach Fizz', 'Marble Muse', 'Crimson Kiss', 'Soft Serve', 'Velvet Noir',
  'Ocean Mist', 'Caramel Drizzle',
];

const siteSettings = {
  shop_name: 'Majestic Nail Care',
  logo_url: '/images/Logo/Logo.jpeg',
  tagline: 'Handcrafted press-on nails in Ontario.',
  contact_phone: '4379983533',
  contact_email: '',
  contact_address: 'Ontario Canada',
  contact_hours: 'Mon - Fri, 9:00 - 18:00',
  instagram: 'https://www.instagram.com/majestic_nailbox?igsh=em9ia3JyMTVjMjVh&utm_source=qr',
  tiktok: 'https://www.tiktok.com/@majestic_press_on_nails?_r=1&_t=ZS-97Rx00o1YWq',
  facebook: '',
  announcement: 'Handcrafted press-on nails in Ontario, Canada',
};

const flagshipProducts = [
  {
    slug: '0326031',
    sku: '0326031XS',
    title: 'Salazar’s Curse',
    description: 'Handmade press-on nails designed to look effortless and feel like your own. Each set is crafted by real nail techs for a natural fit, lasting wear, and easy reusability so you can switch up your look without the salon commitment.',
    price: 48,
    compare_at_price: null,
    shape: 'Almond',
    length: 'Medium',
    size_options: 'XS,S,M,L',
    image: img('4_e4749313-2ef6-43fd-918f-fe7d2f6b97c3.jpg'),
    gallery: [img('Shopify_Product_Photo_2_2_22348cdd-0a7b-4a82-bf70-6e123b77dd97.jpg')],
    video: media('b357956caf0f492ab2b5c60c7a2847e3.HD-1080p-7.2Mbps-84508836.mp4'),
    video_poster: img('b357956caf0f492ab2b5c60c7a2847e3.thumbnail.0000000000.jpg'),
    collection: 'spring-2026-collection',
    is_featured: true,
  },
];

const collectionSources = [
  { slug: 'spring-2026-collection', file: path.join(__dirname, '..', '..', 'public', 'collections', 'spring-2026-collection', 'index.html') },
  { slug: 'new-arrival', file: path.join(__dirname, '..', '..', 'public', 'collections', 'new-arrival', 'index.html') },
  { slug: 'best-sellers-1', file: path.join(__dirname, '..', '..', 'public', 'collections', 'best-sellers-1', 'index.html') },
];

function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, '’')
    .replace(/&eacute;/g, 'é')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/&nbsp;/g, ' ');
}

function stripTags(value) {
  return decodeEntities(String(value || '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function imageVariants(url) {
  if (!url || !url.startsWith('/images/')) return [];
  const file = path.basename(url);
  if (!allImages.includes(file)) return [];
  return gallery(file).extra;
}

function parseCollectionProducts() {
  const products = new Map();

  for (const source of collectionSources) {
    if (!fs.existsSync(source.file)) continue;
    const html = fs.readFileSync(source.file, 'utf8');
    const blocks = html.split('<div\n  class="m-product-card');

    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i];
      const slugMatch = block.match(/href="\/products\/([^"]+)"/);
      if (!slugMatch) continue;

      const slug = slugMatch[1];
      if (products.has(slug)) {
        const existing = products.get(slug);
        if (!existing.collections.includes(source.slug)) existing.collections.push(source.slug);
        continue;
      }

      const ariaMatch = block.match(/aria-label="([^"]+)"/);
      const nameMatch = block.match(/class="m-product-card__name"[\s\S]*?>([\s\S]*?)<\/a>/);
      const title = stripTags(ariaMatch ? ariaMatch[1] : nameMatch && nameMatch[1]);
      if (!title) continue;

      const moneyMatches = [...block.matchAll(/\$(?!-)([\d,.]+)\s*CAD/g)];
      const price = moneyMatches.length ? Number(moneyMatches[0][1].replace(/,/g, '')) : null;
      const imageMatches = [...block.matchAll(/\/images\/[^"' )]+\.(?:jpg|jpeg|png|webp|gif|avif)/gi)].map((m) => m[0]);
      const uniqueImages = [...new Set(imageMatches)];
      const nonPlaceholder = uniqueImages.filter((src) => !src.includes('Website_Photos_Square'));
      const main = nonPlaceholder[0] || uniqueImages[0] || img('Website_Photos_Square.jpg');
      const extra = [...new Set([...nonPlaceholder.slice(1), ...imageVariants(main)])];

      products.set(slug, {
        slug,
        sku: `${slug.toUpperCase().replace(/[^A-Z0-9]+/g, '-')}-XS`,
        title,
        description: `Handmade press-on nail set inspired by Runzie's ${title} product page. Choose your size, then contact the shop to confirm availability, pickup/shipping, and custom sizing help.`,
        price,
        compare_at_price: null,
        shape: null,
        length: null,
        size_options: 'XS,S,M,L',
        image: main,
        gallery: extra,
        collection: source.slug,
        collections: [source.slug],
        is_featured: source.slug === 'best-sellers-1',
      });
    }
  }

  return [...products.values()];
}

const blogPosts = [
  {
    slug: 'how-to-order-press-on-nails-in-ontario',
    title: 'How to Order Press-On Nails in Ontario',
    excerpt: 'Found a set you love? Here is how to choose your size and contact Majestic Nail Care before ordering.',
    cover_image: '4_e4749313-2ef6-43fd-918f-fe7d2f6b97c3.jpg',
    content: `<p>Our storefront is designed for browsing first. When you find a set you love, open the product page, choose your size, then contact us directly so we can confirm availability, pickup or shipping options, and any sizing questions.</p>
<h3>What to send us</h3>
<p>Send the product name, size, and a screenshot if possible. For example: Salazar's Curse, size XS.</p>
<h3>Where we are</h3>
<p>Majestic Nail Care is based in Ontario, Canada. You can reach us by phone, Instagram, or TikTok from the product page.</p>`,
  },
  {
    slug: 'how-to-apply-press-on-nails',
    title: 'How to Apply Press-On Nails for a Flawless, Long-Lasting Finish',
    excerpt: 'A salon-perfect manicure in under 15 minutes — here is our step-by-step routine for press-ons that actually last.',
    cover_image: '0326009_1.jpg',
    content: `<p>Press-on nails have come a long way. With the right prep, a set can last up to two weeks without lifting. Here is the routine our team swears by.</p>
<h3>1. Prep your natural nails</h3>
<p>Push back cuticles, lightly buff the surface, and wipe each nail with an alcohol pad. A clean, oil-free nail is the secret to a strong bond.</p>
<h3>2. Size every nail first</h3>
<p>Lay out each tip before applying glue. The right fit should sit just inside your sidewalls without pinching.</p>
<h3>3. Apply glue (or adhesive tabs)</h3>
<p>Add a thin layer of glue to both your nail and the press-on. Press firmly for 15-20 seconds, starting at the cuticle and rolling forward to avoid air bubbles.</p>
<h3>4. Shape and seal</h3>
<p>File the free edge to your liking and you are done. Avoid hot water for the first hour to let the bond fully cure.</p>
<p>Want a set that matches your vibe? Browse our shapes and find your match.</p>`,
  },
  {
    slug: 'choosing-the-right-nail-shape',
    title: 'Almond, Coffin or Square? Choosing the Right Nail Shape for You',
    excerpt: 'Your nail shape changes everything. Here is how to pick the one that flatters your hands and fits your lifestyle.',
    cover_image: '0326015_1.jpg',
    content: `<p>The shape you choose does more than follow a trend — it frames your hands. Here is a quick guide.</p>
<h3>Almond</h3>
<p>Soft and tapered, almond elongates shorter fingers and reads elegant and timeless.</p>
<h3>Coffin</h3>
<p>Flat-tipped and bold, coffin is the go-to for statement art and longer lengths.</p>
<h3>Square</h3>
<p>Clean edges and low-maintenance — perfect if you work with your hands.</p>
<h3>Stiletto &amp; Round</h3>
<p>Stiletto is fierce and dramatic; round is the most natural, fuss-free everyday shape.</p>`,
  },
  {
    slug: 'make-your-press-ons-last-longer',
    title: '7 Tips to Make Your Press-On Nails Last Longer',
    excerpt: 'Lifting at the edges? These small habits keep your set looking fresh from day one to day fourteen.',
    cover_image: '050026_1.jpg',
    content: `<p>Getting two full weeks out of a set is all about aftercare. Try these.</p>
<ul>
<li>Wear gloves for dishes and cleaning.</li>
<li>Keep a cuticle oil in your bag and use it daily.</li>
<li>Re-glue any edge the moment it lifts.</li>
<li>Avoid using your nails as tools.</li>
<li>Pat dry instead of soaking after showers.</li>
<li>Store your sets in their case to reuse them.</li>
<li>Give your natural nails a break between wears.</li>
</ul>`,
  },
  {
    slug: 'nail-shape-guide',
    title: 'Which Nail Shape Is Right for You?',
    excerpt: 'Almond, coffin, square, or stiletto — a quick guide to the shape that flatters your hands and fits your life.',
    cover_image: '0326015.jpg',
    content: `<p>Choosing a nail shape is less about trends and more about your hands and your day-to-day. Here is a quick breakdown.</p>
<h3>Almond</h3>
<p>Soft and tapered. The most flattering shape for shorter fingers. Looks elegant and works at any length.</p>
<h3>Coffin</h3>
<p>Flat-tipped and bold. Best for longer lengths and statement art. Needs a little extra care at the tips.</p>
<h3>Square</h3>
<p>Clean, classic, low-maintenance. Great if you type a lot or work with your hands — the corners are the strongest part.</p>
<h3>Stiletto</h3>
<p>Sharp and dramatic. The most high-maintenance of the four but unbeatable for an event or a photoshoot.</p>
<h3>Round</h3>
<p>The most natural shape. Forgiving, comfortable, and pairs well with every outfit.</p>`,
  },
  {
    slug: 'press-on-vs-acrylic',
    title: 'Press-Ons vs Acrylics: What Is Better in 2026?',
    excerpt: 'Spoiler: with today’s glue formulas and handcrafted sets, press-ons are catching up fast. Here is how they compare.',
    cover_image: '0326002.jpg',
    content: `<p>The age-old question — and the honest answer is that it depends on what you want from your nails. Here is how we see it.</p>
<h3>Application Time</h3>
<p>Press-ons: 10-20 minutes at home. Acrylics: 1-2 hours in a salon (plus a fill every 2-3 weeks).</p>
<h3>Damage to Natural Nails</h3>
<p>Press-ons are far gentler. Acrylics can weaken the nail bed over time, especially if removed roughly.</p>
<h3>Wear Time</h3>
<p>With solid glue, modern press-ons last up to two weeks — comparable to acrylics for everyday wear. Acrylics win for very long-term wear.</p>
<h3>Reusability</h3>
<p>Press-ons can be worn 3-5 times. Acrylics need to be filled or removed by a pro.</p>
<h3>Cost</h3>
<p>A press-on set is a fraction of a salon visit, with no appointment required.</p>`,
  },
  {
    slug: 'runzie-story',
    title: 'The Story Behind Majestic Nail Care',
    excerpt: 'A small Ontario studio obsessed with hand-finished press-on nails. Here is how it all started.',
    cover_image: 'Fresh.jpg',
    content: `<p>Majestic Nail Care started with a simple idea: beautiful, salon-quality nails should be easy, affordable, and kind to the planet.</p>
<h3>Handcrafted, not mass-produced</h3>
<p>Every set is finished by a real nail tech in our Ontario studio. We inspect each one before it goes out, because a small batch is the only way we know every set is right.</p>
<h3>Reusable by design</h3>
<p>We design our nails to be worn, loved, and worn again. Lose one? We sell single-tip replacements instead of pushing a whole new set.</p>
<h3>Here for the long run</h3>
<p>From everyday nudes to seasonal edits, we are always working on the next set. Thank you for supporting a small studio — it means the world to us.</p>`,
  },
];

async function ensureOptionalColumns() {
  await pool.query(`
    ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(120);
    ALTER TABLE products ADD COLUMN IF NOT EXISTS size_options TEXT DEFAULT 'XS,S,M,L';
    ALTER TABLE products ADD COLUMN IF NOT EXISTS video TEXT;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS video_poster TEXT;

    CREATE TABLE IF NOT EXISTS product_collections (
      product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      collection_id INT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      sort_order INT NOT NULL DEFAULT 0,
      PRIMARY KEY (product_id, collection_id)
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      id SERIAL PRIMARY KEY,
      product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      title VARCHAR(120) NOT NULL,
      sku VARCHAR(160),
      price NUMERIC(10,2),
      compare_at_price NUMERIC(10,2),
      is_available BOOLEAN NOT NULL DEFAULT true,
      sort_order INT NOT NULL DEFAULT 0,
      UNIQUE(product_id, title)
    );
  `);
}

async function seed() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  await ensureOptionalColumns();

  // Clear existing data (idempotent reseed)
  await pool.query('TRUNCATE product_variants, product_collections, product_images, products, collections, banners, posts RESTART IDENTITY CASCADE');

  for (const [key, value] of Object.entries(siteSettings)) {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1,$2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, value]
    );
  }
  console.log(`✓ ${Object.keys(siteSettings).length} settings`);

  // Collections
  const colIds = {};
  for (let i = 0; i < collections.length; i++) {
    const c = collections[i];
    const { rows } = await pool.query(
      `INSERT INTO collections (slug, title, description, image, sort_order, is_active)
       VALUES ($1,$2,$3,$4,$5,true) RETURNING id`,
      // Collection banners use the shop's own photos (public/anhshop), never a
      // competitor's image — one distinct photo per collection, by index.
      [c.slug, c.title, c.description, shopPhoto(i), i]
    );
    colIds[c.slug] = rows[0].id;
  }
  console.log(`✓ ${collections.length} collections`);

  // Banners (slideshow)
  const banners = [
    { title: 'Spring 2026 Collection', subtitle: 'Soft hues, salon-perfect finish — your new everyday set.', image: shopPhoto(40), link: '/collections/spring-2026-collection', button_text: 'Shop Spring 2026' },
    { title: 'New Arrival', subtitle: 'Fresh handcrafted designs ready to view and reserve.', image: shopPhoto(41), link: '/collections/new-arrival', button_text: 'View New Arrival' },
    { title: 'Reusable. Cruelty-free. Effortless.', subtitle: 'Press-on nails that last up to two weeks.', image: shopPhoto(42), link: '/products', button_text: 'Shop All' },
    { title: 'NeonNyx Nails', subtitle: 'Bold, statement designs for nights out.', image: shopPhoto(43), link: '/collections/neonnyx-nails', button_text: 'Shop NeonNyx' },
    { title: 'Now on Sale', subtitle: 'Your favourite sets, for less.', image: shopPhoto(44), link: '/collections/now-on-sale', button_text: 'Shop the Sale' },
  ];
  for (let i = 0; i < banners.length; i++) {
    const b = banners[i];
    await pool.query(
      `INSERT INTO banners (title, subtitle, image, link, button_text, sort_order, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,true)`,
      [b.title, b.subtitle, b.image, b.link, b.button_text, i]
    );
  }
  console.log(`✓ ${banners.length} banners`);

  // Products. Prefer the normalized Shopify snapshot generated by
  // `npm run db:sync-runzie`; retain the local parser as an offline fallback.
  let productData;
  if (fs.existsSync(SNAPSHOT_FILE)) {
    const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
    productData = snapshot.products || [];
    console.log(`✓ Loaded Runzie snapshot from ${snapshot.generated_at || 'local file'}`);
  } else {
    const parsed = parseCollectionProducts();
    const flagshipSlugs = new Set(flagshipProducts.map((product) => product.slug));
    productData = [...flagshipProducts, ...parsed.filter((product) => !flagshipSlugs.has(product.slug))];
  }

  for (let i = 0; i < productData.length; i++) {
    const p = productData[i];
    const memberships = Array.from(new Set(
      (p.collections && p.collections.length ? p.collections : [p.primary_collection || p.collection]).filter(Boolean)
    ));
    const primaryCollection = p.primary_collection || p.collection || memberships[0] || null;
    const { rows } = await pool.query(
      `INSERT INTO products (slug, sku, title, description, price, compare_at_price, shape, length, size_options, image, video, video_poster, collection_id, is_active, is_featured, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true,$14,$15) RETURNING id`,
      [
        p.slug, p.sku || null, p.title, p.description || null, p.price, p.compare_at_price,
        p.shape || null, p.length || null, p.size_options || '', p.image || null,
        p.video || null, p.video_poster || null, colIds[primaryCollection] || null,
        Boolean(p.is_featured), i,
      ]
    );
    const pid = rows[0].id;

    for (let j = 0; j < (p.gallery || []).length; j++) {
      await pool.query(
        `INSERT INTO product_images (product_id, url, sort_order) VALUES ($1,$2,$3)`,
        [pid, p.gallery[j], j]
      );
    }

    const variants = p.variants && p.variants.length
      ? p.variants
      : String(p.size_options || 'XS,S,M,L').split(',').map((title, index) => ({
        title: title.trim(),
        sku: index === 0 ? p.sku : null,
        price: p.price,
        compare_at_price: p.compare_at_price,
        is_available: true,
        sort_order: index,
      })).filter((variant) => variant.title);
    for (let j = 0; j < variants.length; j++) {
      const variant = variants[j];
      await pool.query(
        `INSERT INTO product_variants (product_id, title, sku, price, compare_at_price, is_available, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          pid, variant.title, variant.sku || null,
          variant.price == null ? p.price : variant.price,
          variant.compare_at_price == null ? null : variant.compare_at_price,
          variant.is_available !== false,
          variant.sort_order == null ? j : variant.sort_order,
        ]
      );
    }

    for (let j = 0; j < memberships.length; j++) {
      const collectionSlug = memberships[j];
      const collectionId = colIds[collectionSlug];
      if (!collectionId) continue;
      const collectionOrder = p.collection_order && p.collection_order[collectionSlug];
      await pool.query(
        `INSERT INTO product_collections (product_id, collection_id, sort_order)
         VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [pid, collectionId, collectionOrder == null ? j : collectionOrder]
      );
    }
  }
  console.log(`✓ ${productData.length} products`);

  // Blog posts
  for (let i = 0; i < blogPosts.length; i++) {
    const p = blogPosts[i];
    await pool.query(
      `INSERT INTO posts (slug, title, excerpt, content, cover_image, author, is_published, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,true, now() - ($7 || ' days')::interval)`,
      [p.slug, p.title, p.excerpt, p.content, img(p.cover_image), 'Majestic Nail Care', i * 5]
    );
  }
  console.log(`✓ ${blogPosts.length} blog posts`);

  const cms = await seedCms(pool);
  console.log(`✓ ${cms.sections} CMS sections`);

  await pool.end();
  console.log('Seed done.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
