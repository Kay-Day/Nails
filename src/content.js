const pool = require('./db/pool');

async function loadSections(pageSlug) {
  const sectionsRes = await pool.query(
    `SELECT * FROM site_sections
     WHERE page_slug = $1 AND is_active = true
     ORDER BY sort_order, id`,
    [pageSlug]
  );
  if (!sectionsRes.rows.length) return {};

  const ids = sectionsRes.rows.map((section) => section.id);
  const [itemsRes, productsRes] = await Promise.all([
    pool.query(
      `SELECT * FROM section_items
       WHERE section_id = ANY($1::int[]) AND is_active = true
       ORDER BY section_id, sort_order, id`,
      [ids]
    ),
    pool.query(
      `SELECT sp.section_id, p.*,
         (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order, pi.id LIMIT 1) AS hover_image
       FROM section_products sp
       JOIN products p ON p.id = sp.product_id
       WHERE sp.section_id = ANY($1::int[]) AND p.is_active = true
       ORDER BY sp.section_id, sp.sort_order, p.id`,
      [ids]
    ),
  ]);

  const sections = {};
  sectionsRes.rows.forEach((section) => {
    sections[section.section_key] = { ...section, items: [], products: [] };
  });
  const byId = new Map(Object.values(sections).map((section) => [section.id, section]));
  itemsRes.rows.forEach((item) => byId.get(item.section_id)?.items.push(item));
  productsRes.rows.forEach((product) => byId.get(product.section_id)?.products.push(product));
  return sections;
}

async function loadNavigation() {
  const [collectionsRes, shapesRes, lengthsRes] = await Promise.all([
    pool.query('SELECT slug, title FROM collections WHERE is_active = true ORDER BY sort_order, id'),
    pool.query("SELECT DISTINCT shape FROM products WHERE is_active = true AND shape IS NOT NULL AND shape <> '' ORDER BY shape"),
    pool.query("SELECT DISTINCT length FROM products WHERE is_active = true AND length IS NOT NULL AND length <> '' ORDER BY length"),
  ]);

  const collections = collectionsRes.rows.map((collection) => ({
    label: collection.title,
    url: `/products?collection=${encodeURIComponent(collection.slug)}`,
  }));
  const shapes = shapesRes.rows.map((row) => ({
    label: row.shape,
    url: `/products?shape=${encodeURIComponent(row.shape)}`,
  }));
  const lengths = lengthsRes.rows.map((row) => ({
    label: row.length,
    url: `/products?length=${encodeURIComponent(row.length)}`,
  }));

  return {
    header: [
      {
        label: 'Shop',
        url: '/products',
        badge: 'HOT',
        children: [
          { label: 'All', url: '/products' },
          { label: 'Shop by Collection', url: '/products', children: collections },
          { label: 'Shape', url: '/products', children: shapes },
          { label: 'Length', url: '/products', children: lengths },
        ],
      },
      { label: 'Best Sellers', url: '/products?collection=best-sellers-1' },
      { label: 'New Arrivals', url: '/products?collection=new-arrival' },
      { label: 'Blog', url: '/blog' },
      { label: 'About Us', url: '/pages/about-us' },
      { label: 'Contact', url: '/contact' },
    ],
    footer: [
      { label: 'Shop All', url: '/products' },
      { label: 'Best Sellers', url: '/products?collection=best-sellers-1' },
      { label: 'New Arrivals', url: '/products?collection=new-arrival' },
      { label: 'Blog', url: '/blog' },
      { label: 'About Us', url: '/pages/about-us' },
      { label: 'Contact', url: '/contact' },
      { label: 'FAQ', url: '/pages/faq' },
      { label: 'Nail Tutorial', url: '/pages/nail-tutorial' },
    ],
  };
}

module.exports = { loadSections, loadNavigation };
