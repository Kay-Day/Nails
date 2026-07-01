const fs = require('fs');
const path = require('path');

// Shop's own product photos in public/anhshop — referenced directly as /anhshop/<file>.
const SHOP_PHOTOS = fs
  .readdirSync(path.join(__dirname, '..', '..', 'public', 'anhshop'))
  .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
  .sort();
const shopPhoto = (i) => '/anhshop/' + SHOP_PHOTOS[i % SHOP_PHOTOS.length];

const sections = [
  { page: 'home', key: 'best-sellers', type: 'products', title: 'Best Sellers', subtitle: 'Our most-loved sets - hand-finished, ready to wear.', order: 10 },
  { page: 'home', key: 'shop-by-collection', type: 'items', title: 'Shop By Collection', subtitle: 'Curated edits — find the collection that fits your mood.', order: 15 },
  { page: 'home', key: 'shop-by-shape', type: 'items', title: 'Shop By Shape', subtitle: 'From soft almond to bold coffin - choose the look that is you.', order: 20 },
  { page: 'home', key: 'shop-by-length', type: 'items', title: 'Shop By Length', subtitle: 'Short, medium, or long — pick the length that suits your day.', order: 25 },
  { page: 'home', key: 'bundle-deals', type: 'products', eyebrow: 'Limited Time Offer', title: 'Curated Bundle Deals', buttonText: 'Shop More', buttonLink: '/products?sale=1', image: '/images/Homepage_Banner_1_-_Desk_Top.jpg', order: 27 },
  { page: 'home', key: 'curated', type: 'items', title: 'Curated for Your Style', subtitle: 'Fresh edits and customer favourites, selected for every mood.', order: 30 },
  { page: 'home', key: 'as-seen', type: 'products', title: 'As Seen On You', order: 40 },
  {
    page: 'home', key: 'brand-story', type: 'story', eyebrow: 'Why Majestic Nail Care',
    title: 'A salon manicure, minus the salon.',
    subtitle: 'Each set is hand-finished and built to last up to two weeks. No appointments, no drying time, no damage - just press, wear, and reuse.',
    body: '<p>Our nails are designed in-house for a natural fit and an effortless everyday finish. Browse your favourite look, choose a size, then contact our studio for availability and ordering.</p>',
    image: '/images/0326009_2.jpg', buttonText: 'Explore the Collection', buttonLink: '/collections/all', order: 50,
  },
  { page: 'home', key: 'features', type: 'items', order: 60 },
  { page: 'home', key: 'reviews', type: 'items', title: 'Let Customers Speak For Us', subtitle: 'Real notes from customers who wear and reuse their sets.', order: 70 },
  { page: 'home', key: 'journal', type: 'posts', title: 'The Journal', subtitle: 'Tips, tricks and inspiration from our studio.', buttonText: 'View All Articles', buttonLink: '/blog', order: 80 },
  { page: 'home', key: 'instagram', type: 'products', title: 'Get Inspired by Every Look', subtitle: 'Follow our studio for new sets and customer looks.', order: 90 },

  { page: 'about', key: 'intro', type: 'story', title: 'A little About Us', body: '<p>Majestic Nail Care is an independent Ontario studio creating hand-finished press-on nails for people who want salon detail without the appointment.</p><p>Every set is designed to feel easy, wearable, and reusable. Choose a look that feels like you, then contact us for sizing, availability, pickup, or shipping.</p>', image: '/images/about-runzie-nails.jpg', buttonText: 'Shop All', buttonLink: '/collections/all', order: 10 },
  { page: 'about', key: 'name', type: 'story-reverse', title: 'Made with intention', body: '<p>We work in small batches so every set gets real attention. Our designs move between everyday neutrals, playful seasonal details, and statement art.</p><p>The goal is simple: give you a polished set you can apply in minutes, remove gently, and wear again.</p>', image: '/images/about-runzie-name.jpg', buttonText: 'View the Collection', buttonLink: '/collections/all', order: 20 },
  { page: 'about', key: 'features', type: 'items', order: 30 },
  { page: 'about', key: 'team', type: 'story', title: 'How it all comes together', body: '<p>Our small team handles design, finishing, quality checks, and customer support from Ontario. Each order starts with a conversation so we can confirm the right size and the best pickup or shipping option.</p><p>That personal process is why the storefront is contact-based instead of using an automatic checkout.</p>', image: '/images/about-runzie-team.jpg', buttonText: 'Contact the Studio', buttonLink: '/contact', order: 40 },

  { page: 'contact', key: 'hero', type: 'hero', title: 'Get in Touch', subtitle: "Questions about a set, sizing, or your order? We'd love to help.", image: '/images/Homepage_Banner_1_-_Desk_Top.jpg', order: 10 },
  { page: 'blog', key: 'hero', type: 'hero', eyebrow: 'Majestic Nail Care journal', title: 'Ideas for better nail days.', subtitle: 'Application guides, sizing advice, care tips, and fresh inspiration from our Ontario studio.', order: 10 },
  { page: 'article', key: 'cta', type: 'cta', eyebrow: 'Need help choosing your set?', title: 'Find the look, then talk to our studio.', subtitle: 'Browse the collection and contact us for sizing, availability, pickup, or shipping.', buttonText: 'Browse nail sets', buttonLink: '/collections/all', order: 10 },
  { page: 'shop', key: 'hero', type: 'hero', title: 'Shop All Nails', subtitle: 'Find your perfect press-on set.', order: 10 },

  { page: 'product', key: 'contact', type: 'content', title: 'Contact shop to order', subtitle: 'Online cart and checkout are disabled. Choose your size, then contact our studio to confirm availability, sizing, pickup, or shipping.', order: 10 },
  { page: 'product', key: 'promises', type: 'items', subtitle: 'No salon needed — just peel, press, and shine!', order: 20 },
  { page: 'product', key: 'reasons', type: 'items', title: '4 reasons our customers choose press-on nails', order: 30 },
  { page: 'product', key: 'accordions', type: 'items', order: 40 },

  { page: 'faq', key: 'main', type: 'items', title: 'Frequently Asked Questions', subtitle: 'Answers to the questions we get most about sizing, application, shipping, and our handmade process.', image: '/images/Homepage_Banner_1_-_Desk_Top.jpg', order: 10 },
  { page: 'tutorial', key: 'main', type: 'items', title: 'Nail Tutorial', subtitle: 'A salon-perfect press-on manicure in under 15 minutes - our step-by-step routine.', image: '/images/0326009_2.jpg', buttonText: 'Shop All Nails', buttonLink: '/collections/all', order: 10 },

  { page: 'policy', key: 'shipping-policy', type: 'policy', title: 'Shipping Policy', subtitle: 'Contact us for current pickup and shipping options.', body: '<p>We currently ship within Canada and to selected international destinations. Because every set is hand-finished, please allow 2-4 business days for production before dispatch.</p><h3>Processing Time</h3><p>Standard processing is 2-4 business days. During collection launches it may take up to 7 business days; we will confirm timing before starting your order.</p><h3>Shipping Options</h3><ul><li><strong>Ontario local pickup</strong> - pickup details are confirmed directly.</li><li><strong>Canada Post standard</strong> - estimated 3-7 business days.</li><li><strong>Canada Post express</strong> - estimated 1-3 business days.</li></ul><h3>International Shipping</h3><p>Contact us with your destination and selected products. We will confirm availability, shipping cost, and any customs information before you order.</p><h3>Lost or Damaged Parcels</h3><p>If your parcel is delayed or arrives damaged, contact us and we will work with the carrier to help.</p>', order: 10 },
  { page: 'policy', key: 'refund-policy', type: 'policy', title: 'Refund & Exchange Policy', subtitle: 'Please review these terms before confirming your order.', body: '<p>Because each set is hand-finished, all confirmed orders are final. We still want you to love your set and will help when something is not right.</p><h3>Sizing Issues</h3><p>Contact us within 7 days of delivery. We will review the sizing details and available replacement options.</p><h3>Manufacturing Defects</h3><p>If a tip arrives damaged, send us a clear photo within 14 days. We will arrange a replacement tip or set when appropriate.</p><h3>Order Changes</h3><p>Changes can be requested before production begins. Once the set is in production, changes may not be possible.</p><h3>Single Nail Replacements</h3><p>Lost a single nail? Message us with the style and size so we can confirm a replacement.</p>', order: 20 },
  { page: 'policy', key: 'privacy-policy', type: 'policy', title: 'Privacy Policy', subtitle: 'How we collect and use your information.', body: '<p>We collect only the information needed to respond to enquiries and prepare an order.</p><h3>Information We Collect</h3><ul><li>Name, email, phone number, or social handle when you contact us.</li><li>Product, sizing, pickup, and shipping details you choose to provide.</li><li>Basic technical data required to operate and secure the website.</li></ul><h3>How We Use It</h3><p>We use your information to answer questions, confirm orders, provide support, and improve the storefront. We do not sell your personal data.</p><h3>Admin Sessions</h3><p>Essential session cookies are used only for the protected admin area.</p><h3>Your Rights</h3><p>You can request access, correction, or deletion of your contact information by contacting the studio.</p>', order: 30 },
  { page: 'policy', key: 'terms-of-service', type: 'policy', title: 'Terms of Service', subtitle: 'Terms for browsing and ordering from Majestic Nail Care.', body: '<p>By using this website and confirming an order with Majestic Nail Care, you agree to these terms.</p><h3>Products</h3><p>Our press-on nails are hand-finished in small batches. Slight variations are part of the handcrafted process.</p><h3>Ordering</h3><p>An order begins when you contact us and is confirmed only after the product, size, price, pickup or shipping details, and timing are agreed in writing.</p><h3>Pricing</h3><p>Prices are shown in CAD. We confirm the final total before production begins.</p><h3>Intellectual Property</h3><p>Product designs, photos, and written content belong to Majestic Nail Care and may not be copied or resold without permission.</p>', order: 40 },
];

const items = {
  'home.shop-by-collection': [
    { title: 'Spring 2026', image: shopPhoto(25), link: '/products?collection=spring-2026-collection' },
    { title: 'Best Sellers', image: shopPhoto(26), link: '/products?collection=best-sellers-1' },
    { title: 'New Arrival', image: shopPhoto(27), link: '/products?collection=new-arrival' },
    { title: 'Bundle Sales', image: shopPhoto(28), link: '/products?collection=bundle-sales' },
    { title: 'Nail Essentials', image: shopPhoto(29), link: '/products?collection=nail-essentials' },
  ],
  'home.shop-by-shape': [
    { title: 'Almond', image: '/images/shapes/almond.png', link: '/collections/almond' },
    { title: 'Coffin', image: '/images/shapes/coffin.png', link: '/collections/coffin-shape' },
    { title: 'Round', image: '/images/shapes/round.png', link: '/collections/round-shape' },
    { title: 'Stiletto', image: '/images/shapes/stiletto.png', link: '/collections/stiletto-shape' },
    { title: 'Square', image: '/images/shapes/square.png', link: '/collections/square-shape' },
  ],
  'home.shop-by-length': [
    { title: 'Short', image: '/images/shapes/round.png', link: '/products?length=Short' },
    { title: 'Medium', image: '/images/shapes/almond.png', link: '/products?length=Medium' },
    { title: 'Long', image: '/images/shapes/stiletto.png', link: '/products?length=Long' },
  ],
  'home.curated': [
    { label: 'Freshly added', title: 'New Arrivals', body: '<p>Discover the latest hand-finished sets from our studio.</p>', image: shopPhoto(30), link: '/collections/new-arrival' },
    { label: 'Limited time', title: 'Now on Sale', body: '<p>Selected handmade sets at special prices — while they last.</p>', image: shopPhoto(31), link: '/collections/now-on-sale' },
  ],
  'home.features': [
    { label: 'leaf', title: 'Salon Quality', body: '<p>Hand-finished, glossy, durable.</p>' },
    { label: 'clock', title: 'Ready in Minutes', body: '<p>Apply at home, anytime.</p>' },
    { label: 'reuse', title: 'Reusable', body: '<p>Wear your favourites again.</p>' },
    { label: 'heart', title: 'Cruelty-Free', body: '<p>Always kind, never tested.</p>' },
  ],
  'home.reviews': [
    { label: '5', title: 'Beautiful and easy to wear', body: '<p>The finish looked polished and the sizing help made ordering simple.</p>', subtitle: 'Riley E.', image: shopPhoto(20) },
    { label: '5', title: 'Great quality for repeat wear', body: '<p>I removed the set gently, cleaned the tips, and wore them again.</p>', subtitle: 'Gabby', image: shopPhoto(21) },
    { label: '5', title: 'Helpful sizing support', body: '<p>The studio answered my questions before I chose a set and size.</p>', subtitle: 'Cecilia S.', image: shopPhoto(22) },
    { label: '5', title: 'Incredible detail', body: '<p>I am debating which set is my favourite — the attention to detail on each nail is unreal.</p>', subtitle: 'Wen', image: shopPhoto(23) },
  ],
  'about.features': [
    { label: 'heart', title: 'Premium', body: '<p>Handcrafted with salon-quality gel.</p>' },
    { label: 'leaf', title: 'Reusable', body: '<p>Made for multiple wears with careful removal.</p>' },
    { label: 'clock', title: 'Fast Application', body: '<p>A polished manicure in minutes.</p>' },
    { label: 'truck', title: 'Pickup & Shipping', body: '<p>Options are confirmed directly with the studio.</p>' },
  ],
  'product.promises': [
    { title: '5 minute application' },
    { title: 'Handcrafted by a real nail tech with gel' },
    { title: 'Lasts up to 4 weeks' },
    { title: '100% reusable' },
  ],
  'product.reasons': [
    { title: 'Handcrafted by real nail techs', body: '<p>Each set is made with care and inspected before it reaches you.</p>', image: '/images/16_1024x1024.jpg' },
    { title: 'Made in small batches', body: '<p>Better quality control and more attention to every detail.</p>', image: '/images/24_1024x1024.jpg' },
    { title: 'Made to wear again', body: '<p>Reusable, replaceable, and easy to return to whenever you want a fresh look.</p>', image: '/images/26_1024x1024.jpg' },
    { title: 'Single nail replacement', body: '<p>Lose a nail? Contact us about a replacement instead of buying a full new set.</p>', image: '/images/32_1024x1024.jpg' },
  ],
  'product.accordions': [
    { title: 'Complimentary Prep Kit Included', body: '<ul><li>2 sheets of sticky tabs</li><li>2 alcohol wipes</li><li>1 cuticle stick</li><li>1 buffer</li><li>1 nail file</li></ul>' },
    { title: 'How to Apply', body: '<p>Clean and buff your natural nails. Apply nail glue or adhesive tabs, align the press-on with your cuticle, then press firmly for 10-20 seconds.</p>' },
    { title: 'Safe Ingredients', body: '<p>Crafted with nail-safe materials for comfortable, reusable wear.</p>' },
    { title: 'Size Guide', body: '<p>Measure each natural nail at its widest point and compare it with the size guide.</p>', image: '/images/SIZE_GUIDE_2.jpg' },
    { title: 'Shipping Policy', body: '<p>Contact the studio for current Ontario pickup and shipping options.</p>', link: '/pages/shipping-policy' },
  ],
  'faq.main': [
    { title: 'How long do press-on nails last?', body: '<p>With careful preparation and solid nail glue, a set can last up to two weeks. Adhesive tabs are best for shorter wear.</p>' },
    { title: 'How do I choose the right size?', body: '<p>Measure each nail at its widest point in millimetres. Contact us if you are between sizes.</p>' },
    { title: 'How do I apply the nails?', body: '<p>Push back cuticles, lightly buff, clean with alcohol, apply adhesive, and press each tip firmly for 15-20 seconds.</p>' },
    { title: 'Are the nails reusable?', body: '<p>Yes. Remove them gently, clean away remaining adhesive, and store the tips in their case.</p>' },
    { title: 'Do you ship internationally?', body: '<p>Contact us with your destination and selected set so we can confirm current options.</p>' },
    { title: 'How long does production take?', body: '<p>Most sets require 2-4 business days. Timing is confirmed before your order begins.</p>' },
    { title: 'Can I change my order?', body: '<p>Contact us as soon as possible. Changes are usually possible before production starts.</p>' },
    { title: 'What if a nail breaks or I lose one?', body: '<p>Message us with the style and size so we can check replacement availability.</p>' },
    { title: 'Do you do custom designs?', body: '<p>Custom work is accepted selectively. Send us your idea and preferred timeline.</p>' },
    { title: 'Are the nails safe for natural nails?', body: '<p>Apply and remove them gently, and follow the included preparation instructions.</p>' },
  ],
  'tutorial.main': [
    { label: '1', title: 'Prep your natural nails', body: '<p>Push back cuticles, lightly buff each nail, then clean with an alcohol pad.</p>' },
    { label: '2', title: 'Size every nail first', body: '<p>Lay out each tip before applying adhesive. The right fit sits inside the sidewalls without pinching.</p>' },
    { label: '3', title: 'Apply glue or adhesive tabs', body: '<p>Apply a thin, even layer, align at the cuticle, and press firmly for 15-20 seconds.</p>' },
    { label: '4', title: 'Shape and seal', body: '<p>File the free edge if needed and avoid hot water for the first hour.</p>' },
    { label: '5', title: 'Removal and storage', body: '<p>Soak in warm soapy water, lift gently from the cuticle edge, clean the tips, and store them for reuse.</p>' },
  ],
};

const sectionProducts = {
  'home.best-sellers': ['dual-dots', 'midnight-marble', 'mocha-dots', 'starfish-shore', 'blue-enchante', 'sacred-armor', 'island-glow-edit', '030102'],
  'home.bundle-deals': ['sacred-armor', 'totoros-garden', 'silk-road-petals', 'astral-crown-tips', 'mocha-dots', 'starfish-shore', 'island-glow-edit', 'mocha-muse'],
  'home.as-seen': ['coquette-noir-bites', '030102', 'island-glow-edit', 'golden-tide'],
  'home.instagram': ['dual-dots', 'midnight-marble', 'island-glow-edit', 'golden-tide', 'blue-enchante', 'starfish-shore'],
};

const settings = {
  logo_url: '/images/Logo/Logo.jpeg',
  announcement: 'Buy 3, get 1 free - contact us to reserve your sets',
  announcement_2: 'Free shipping over $100 CAD / $70 USD',
  announcement_3: 'Message us for sizing and availability',
  announcement_4: 'Handcrafted press-on nails in Ontario, Canada',
  seo_description: 'Majestic Nail Care creates handcrafted press-on nails in Ontario for reusable, salon-quality wear.',
  og_image: '/images/Homepage_Banner_1_-_Desk_Top.jpg',
  site_url: 'http://localhost:3000',
  contact_banner: '/images/Homepage_Banner_1_-_Desk_Top.jpg',
};

async function seedCms(pool) {
  // Content sections are now editable in the admin panel. Skip reseeding when data
  // already exists so admin edits are never clobbered (set SEED_FORCE=1 to override).
  // Navigation is managed separately (navigation_items) and is intentionally left untouched.
  const existing = await pool.query('SELECT COUNT(*)::int AS n FROM site_sections');
  if (existing.rows[0].n > 0 && process.env.SEED_FORCE !== '1') {
    console.log(`Skipped: ${existing.rows[0].n} sections already exist. Use SEED_FORCE=1 to reseed.`);
    return { sections: 0, skipped: true };
  }
  await pool.query('TRUNCATE section_products, section_items, site_sections RESTART IDENTITY CASCADE');
  for (const [key, value] of Object.entries(settings)) {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1,$2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, value]
    );
  }

  const sectionIds = {};
  for (const section of sections) {
    const { rows } = await pool.query(
      `INSERT INTO site_sections
       (page_slug, section_key, section_type, eyebrow, title, subtitle, body_html, image, button_text, button_link, sort_order, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true) RETURNING id`,
      [section.page, section.key, section.type, section.eyebrow || null, section.title || null,
        section.subtitle || null, section.body || null, section.image || null,
        section.buttonText || null, section.buttonLink || null, section.order || 0]
    );
    sectionIds[`${section.page}.${section.key}`] = rows[0].id;
  }

  for (const [sectionKey, sectionItems] of Object.entries(items)) {
    const sectionId = sectionIds[sectionKey];
    for (let index = 0; index < sectionItems.length; index++) {
      const item = sectionItems[index];
      await pool.query(
        `INSERT INTO section_items
         (section_id, label, title, subtitle, body_html, image, link, sort_order, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)`,
        [sectionId, item.label || null, item.title || null, item.subtitle || null,
          item.body || null, item.image || null, item.link || null, index]
      );
    }
  }

  for (const [sectionKey, slugs] of Object.entries(sectionProducts)) {
    const sectionId = sectionIds[sectionKey];
    for (let index = 0; index < slugs.length; index++) {
      const product = await pool.query('SELECT id FROM products WHERE slug = $1', [slugs[index]]);
      if (!product.rows.length) continue;
      await pool.query(
        'INSERT INTO section_products (section_id, product_id, sort_order) VALUES ($1,$2,$3)',
        [sectionId, product.rows[0].id, index]
      );
    }
  }

  return { sections: sections.length };
}

async function run() {
  const pool = require('./pool');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  const result = await seedCms(pool);
  console.log(`Seeded ${result.sections} CMS sections.`);
  await pool.end();
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { seedCms };
