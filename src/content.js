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

// Default (code-defined) menu, used when the navigation_items table is empty.
// `collections` is the live list so the COLLECTIONS dropdown stays in sync.
function defaultNavigation(collections = []) {
  const collectionChildren = collections.map((collection) => ({
    label: collection.title,
    url: `/products?collection=${encodeURIComponent(collection.slug)}`,
  }));
  return {
    header: [
      { label: 'Shop All', url: '/products' },
      { label: 'New Arrivals', url: '/products?collection=new-arrival' },
      { label: 'Best Sellers', url: '/products?collection=best-sellers-1' },
      { label: 'Collections', url: '/products', children: collectionChildren },
      {
        label: 'Bundles & Accessories',
        url: '/products',
        children: [
          { label: 'Bundle Sales', url: '/products?collection=bundle-sales' },
          { label: 'Nail Essentials', url: '/products?collection=nail-essentials' },
        ],
      },
      { label: 'Sale', url: '/products?sale=1', badge: 'HOT' },
      { label: 'About Us', url: '/pages/about-us' },
      { label: 'Contact', url: '/contact' },
    ],
    footer: [
      { label: 'Shop All', url: '/products' },
      { label: 'Best Sellers', url: '/products?collection=best-sellers-1' },
      { label: 'New Arrivals', url: '/products?collection=new-arrival' },
      { label: 'Sale', url: '/products?sale=1' },
      { label: 'Blog', url: '/blog' },
      { label: 'About Us', url: '/pages/about-us' },
      { label: 'Contact', url: '/contact' },
      { label: 'FAQ', url: '/pages/faq' },
    ],
  };
}

// Build the header/footer trees from the navigation_items table (parent -> children).
function buildTreeFromRows(rows) {
  const byId = new Map();
  rows.forEach((row) => byId.set(row.id, {
    label: row.label,
    url: row.url || '#',
    badge: row.badge || undefined,
    _location: row.location,
    _parent: row.parent_id,
    children: [],
  }));
  const header = [];
  const footer = [];
  byId.forEach((node) => {
    if (node._parent && byId.has(node._parent)) {
      byId.get(node._parent).children.push(node);
    } else if (node._location === 'footer') {
      footer.push(node);
    } else {
      header.push(node);
    }
  });
  const clean = (nodes) => nodes.map(({ _location, _parent, children, ...rest }) =>
    (children && children.length ? { ...rest, children: clean(children) } : rest));
  return { header: clean(header), footer: clean(footer) };
}

async function loadNavigation() {
  const [collectionsRes, navRes] = await Promise.all([
    pool.query('SELECT slug, title FROM collections WHERE is_active = true ORDER BY sort_order, id'),
    pool.query('SELECT id, location, parent_id, label, url, badge, sort_order FROM navigation_items WHERE is_active = true ORDER BY location, parent_id NULLS FIRST, sort_order, id'),
  ]);

  // Admin-managed menu takes priority; fall back to the code-defined default.
  if (navRes.rows.length) return buildTreeFromRows(navRes.rows);
  return defaultNavigation(collectionsRes.rows);
}

module.exports = { loadSections, loadNavigation, defaultNavigation };
