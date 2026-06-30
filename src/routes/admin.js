const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const slugify = require('slugify');
const pool = require('../db/pool');
const {
  upload,
  fileUrl,
  normalizeMediaUrl,
  uploadedFilePath,
  removeUploadedFile,
} = require('../middleware/upload');

// ---- Auth helpers ----
function requireAuth(req, res, next) {
  if (req.session.admin) return next();
  return res.redirect('/admin/login');
}

// Uploaded file > pasted URL > remove request > existing value.
function resolveMedia(file, textValue, existing, removeRequested) {
  if (file) return fileUrl(file);
  const normalized = normalizeMediaUrl(textValue);
  if (normalized) return normalized;
  if (removeRequested) return null;
  return existing || null;
}

async function mediaReferenceCount(url) {
  if (!url) return 0;
  const { rows } = await pool.query(
    `SELECT (
      (SELECT COUNT(*) FROM products
        WHERE image = $1 OR video = $1 OR video_poster = $1 OR COALESCE(description, '') LIKE '%' || $1 || '%') +
      (SELECT COUNT(*) FROM product_images WHERE url = $1) +
      (SELECT COUNT(*) FROM collections WHERE image = $1) +
      (SELECT COUNT(*) FROM banners WHERE image = $1 OR video = $1) +
      (SELECT COUNT(*) FROM posts
        WHERE cover_image = $1 OR COALESCE(content, '') LIKE '%' || $1 || '%') +
      (SELECT COUNT(*) FROM site_sections
        WHERE image = $1 OR COALESCE(body_html, '') LIKE '%' || $1 || '%') +
      (SELECT COUNT(*) FROM section_items
        WHERE image = $1 OR COALESCE(body_html, '') LIKE '%' || $1 || '%') +
      (SELECT COUNT(*) FROM settings WHERE value = $1)
    )::int AS count`,
    [url]
  );
  return rows[0]?.count || 0;
}

async function cleanupMediaUrls(values) {
  const urls = Array.from(new Set((values || []).filter(Boolean)));
  for (const url of urls) {
    if (!uploadedFilePath(url)) continue;
    if ((await mediaReferenceCount(url)) === 0) await removeUploadedFile(url);
  }
}

async function uniqueSlug(table, base, ignoreId) {
  let slug = slugify(base, { lower: true, strict: true }) || 'item';
  let candidate = slug;
  let n = 1;
  while (true) {
    const { rows } = await pool.query(
      `SELECT id FROM ${table} WHERE slug = $1 ${ignoreId ? 'AND id <> $2' : ''}`,
      ignoreId ? [candidate, ignoreId] : [candidate]
    );
    if (!rows.length) return candidate;
    candidate = `${slug}-${n++}`;
  }
}

function selectedCollectionIds(body) {
  const value = body.collection_ids || body.collection_id || [];
  return (Array.isArray(value) ? value : [value])
    .map((id) => Number(id))
    .filter(Number.isInteger);
}

function selectedIds(value) {
  return (Array.isArray(value) ? value : [value])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
}

async function syncSectionProducts(sectionId, value) {
  const ids = selectedIds(value);
  await pool.query('DELETE FROM section_products WHERE section_id = $1', [sectionId]);
  for (let index = 0; index < ids.length; index++) {
    await pool.query(
      'INSERT INTO section_products (section_id, product_id, sort_order) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [sectionId, ids[index], index]
    );
  }
}

async function syncProductCollections(productId, body) {
  const ids = selectedCollectionIds(body);
  await pool.query('DELETE FROM product_collections WHERE product_id = $1', [productId]);
  for (let index = 0; index < ids.length; index++) {
    await pool.query(
      `INSERT INTO product_collections (product_id, collection_id, sort_order)
       VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [productId, ids[index], index]
    );
  }
  await pool.query('UPDATE products SET collection_id = $1 WHERE id = $2', [ids[0] || null, productId]);
}

async function syncProductVariants(productId, body) {
  const sizes = String(body.size_options || '')
    .split(',')
    .map((size) => size.trim())
    .filter(Boolean);
  const existing = await pool.query(
    'SELECT title, sku FROM product_variants WHERE product_id = $1',
    [productId]
  );
  const existingSku = new Map(existing.rows.map((variant) => [variant.title, variant.sku]));
  const baseSku = String(body.sku || '').replace(/(?:XS|S|M|L)$/i, '');

  await pool.query('DELETE FROM product_variants WHERE product_id = $1', [productId]);
  const variants = sizes.length ? sizes : ['Default Title'];
  for (let index = 0; index < variants.length; index++) {
    const title = variants[index];
    const sku = existingSku.get(title) || (title === 'Default Title' ? body.sku : `${baseSku}${title}`);
    await pool.query(
      `INSERT INTO product_variants (product_id, title, sku, price, compare_at_price, is_available, sort_order)
       VALUES ($1,$2,$3,$4,$5,true,$6)`,
      [productId, title, sku || null, body.price || null, body.compare_at_price || null, index]
    );
  }
}

// ---- Filter system helpers ----
const slugifyFilter = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

async function loadFilterGroupsWithValues() {
  const rows = (await pool.query(
    `SELECT fg.id AS g_id, fg.slug AS g_slug, fg.title AS g_title, fg.sort_order AS g_sort, fg.is_active AS g_active,
            fv.id AS v_id, fv.label AS v_label, fv.slug AS v_slug, fv.sort_order AS v_sort
     FROM filter_groups fg
     LEFT JOIN filter_values fv ON fv.group_id = fg.id
     ORDER BY fg.sort_order, fg.id, fv.sort_order, fv.id`
  )).rows;
  const map = new Map();
  rows.forEach((r) => {
    if (!map.has(r.g_id)) map.set(r.g_id, { id: r.g_id, slug: r.g_slug, title: r.g_title, sort_order: r.g_sort, is_active: r.g_active, values: [] });
    if (r.v_id) map.get(r.g_id).values.push({ id: r.v_id, label: r.v_label, slug: r.v_slug, sort_order: r.v_sort });
  });
  return [...map.values()];
}

async function syncProductFilterValues(productId, body) {
  const ids = selectedIds(body.filter_value_ids);
  await pool.query('DELETE FROM product_filter_values WHERE product_id = $1', [productId]);
  for (const vid of ids) {
    await pool.query(
      'INSERT INTO product_filter_values (product_id, value_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [productId, vid]
    );
  }
}

// ---- Login / Logout ----
router.get('/login', (req, res) => {
  if (req.session.admin) return res.redirect('/admin');
  res.render('admin/login', { title: 'Admin Login', layout: false, error: null });
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const { rows } = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
    if (rows.length && bcrypt.compareSync(password, rows[0].password_hash)) {
      req.session.admin = { id: rows[0].id, username: rows[0].username };
      return res.redirect('/admin');
    }
    res.render('admin/login', { title: 'Admin Login', layout: false, error: 'Invalid username or password.' });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// Everything below requires auth
router.use(requireAuth);

// ---- Dashboard ----
router.get('/', async (req, res, next) => {
  try {
    const counts = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM products) AS products,
        (SELECT COUNT(*) FROM collections) AS collections,
        (SELECT COUNT(*) FROM banners) AS banners,
        (SELECT COUNT(*) FROM posts) AS posts`);
    const recent = await pool.query('SELECT id, title, image, price, is_active FROM products ORDER BY created_at DESC LIMIT 6');
    res.render('admin/dashboard', { title: 'Dashboard', counts: counts.rows[0], recent: recent.rows, active: 'dashboard' });
  } catch (err) {
    next(err);
  }
});

// =================== PRODUCTS ===================
router.get('/products', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, COALESCE(string_agg(DISTINCT c.title, ', '), '') AS collection_title
       FROM products p
       LEFT JOIN product_collections pc ON pc.product_id = p.id
       LEFT JOIN collections c ON c.id = pc.collection_id
       GROUP BY p.id ORDER BY p.created_at DESC`
    );
    res.render('admin/products', { title: 'Products', products: rows, active: 'products' });
  } catch (err) {
    next(err);
  }
});

router.get('/products/new', async (req, res, next) => {
  try {
    const [collections, shapes, lengths, filterGroups] = await Promise.all([
      pool.query('SELECT * FROM collections ORDER BY title'),
      pool.query("SELECT DISTINCT shape FROM products WHERE shape IS NOT NULL AND shape <> '' ORDER BY shape"),
      pool.query("SELECT DISTINCT length FROM products WHERE length IS NOT NULL AND length <> '' ORDER BY length"),
      loadFilterGroupsWithValues(),
    ]);
    res.render('admin/product-form', { title: 'New Product', product: {}, images: [], variants: [], collectionIds: [], collections: collections.rows, shapes: shapes.rows.map((row) => row.shape), lengths: lengths.rows.map((row) => row.length), filterGroups, assignedValueIds: [], active: 'products', formAction: '/admin/products' });
  } catch (err) {
    next(err);
  }
});

router.post('/products', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'gallery', maxCount: 8 }, { name: 'video', maxCount: 1 }, { name: 'video_poster', maxCount: 1 }]), async (req, res, next) => {
  try {
    const b = req.body;
    const image = resolveMedia(req.files?.image?.[0], b.image_url, null, b.remove_image === 'on');
    const video = resolveMedia(req.files?.video?.[0], b.video_url, null, b.remove_video === 'on');
    const videoPoster = resolveMedia(req.files?.video_poster?.[0], b.video_poster_url, null, b.remove_video_poster === 'on');
    const slug = await uniqueSlug('products', b.slug || b.title);
    const { rows } = await pool.query(
      `INSERT INTO products (slug, sku, title, description, price, compare_at_price, shape, length, size_options, image, video, video_poster, collection_id, is_active, is_featured, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
      [
        slug, b.sku || null, b.title, b.description || null,
        b.price || null, b.compare_at_price || null,
        b.shape || null, b.length || null, b.size_options || 'XS,S,M,L', image,
        video, videoPoster,
        selectedCollectionIds(b)[0] || null,
        b.is_active === 'on', b.is_featured === 'on', parseInt(b.sort_order) || 0,
      ]
    );
    const pid = rows[0].id;
    await syncProductCollections(pid, b);
    await syncProductVariants(pid, b);
    await syncProductFilterValues(pid, b);
    const galleryFiles = req.files?.gallery || [];
    for (let i = 0; i < galleryFiles.length; i++) {
      await pool.query('INSERT INTO product_images (product_id, url, sort_order) VALUES ($1,$2,$3)', [pid, fileUrl(galleryFiles[i]), i]);
    }
    res.redirect('/admin/products');
  } catch (err) {
    next(err);
  }
});

router.get('/products/:id/edit', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.redirect('/admin/products');
    const [collections, images, variants, membership, shapes, lengths, filterGroups, assigned] = await Promise.all([
      pool.query('SELECT * FROM collections ORDER BY title'),
      pool.query('SELECT * FROM product_images WHERE product_id = $1 ORDER BY sort_order, id', [req.params.id]),
      pool.query('SELECT * FROM product_variants WHERE product_id = $1 ORDER BY sort_order, id', [req.params.id]),
      pool.query('SELECT collection_id FROM product_collections WHERE product_id = $1 ORDER BY sort_order', [req.params.id]),
      pool.query("SELECT DISTINCT shape FROM products WHERE shape IS NOT NULL AND shape <> '' ORDER BY shape"),
      pool.query("SELECT DISTINCT length FROM products WHERE length IS NOT NULL AND length <> '' ORDER BY length"),
      loadFilterGroupsWithValues(),
      pool.query('SELECT value_id FROM product_filter_values WHERE product_id = $1', [req.params.id]),
    ]);
    res.render('admin/product-form', {
      title: 'Edit Product',
      product: rows[0],
      images: images.rows,
      variants: variants.rows,
      collectionIds: membership.rows.map((row) => row.collection_id),
      collections: collections.rows,
      shapes: shapes.rows.map((row) => row.shape),
      lengths: lengths.rows.map((row) => row.length),
      filterGroups,
      assignedValueIds: assigned.rows.map((row) => row.value_id),
      active: 'products',
      formAction: `/admin/products/${req.params.id}?_method=PUT`,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/products/:id', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'gallery', maxCount: 8 }, { name: 'video', maxCount: 1 }, { name: 'video_poster', maxCount: 1 }]), async (req, res, next) => {
  try {
    const b = req.body;
    const existing = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.redirect('/admin/products');
    const oldProduct = existing.rows[0];
    const image = resolveMedia(req.files?.image?.[0], b.image_url, oldProduct.image, b.remove_image === 'on');
    const video = resolveMedia(req.files?.video?.[0], b.video_url, oldProduct.video, b.remove_video === 'on');
    const videoPoster = resolveMedia(req.files?.video_poster?.[0], b.video_poster_url, oldProduct.video_poster, b.remove_video_poster === 'on');
    const slug = await uniqueSlug('products', b.slug || b.title, req.params.id);
    await pool.query(
      `UPDATE products SET slug=$1, sku=$2, title=$3, description=$4, price=$5, compare_at_price=$6,
        shape=$7, length=$8, size_options=$9, image=$10, video=$11, video_poster=$12, collection_id=$13,
        is_active=$14, is_featured=$15, sort_order=$16
       WHERE id=$17`,
      [
        slug, b.sku || null, b.title, b.description || null, b.price || null, b.compare_at_price || null,
        b.shape || null, b.length || null, b.size_options || 'XS,S,M,L', image, video,
        videoPoster, selectedCollectionIds(b)[0] || null,
        b.is_active === 'on', b.is_featured === 'on', parseInt(b.sort_order) || 0, req.params.id,
      ]
    );
    await syncProductCollections(req.params.id, b);
    await syncProductVariants(req.params.id, b);
    await syncProductFilterValues(req.params.id, b);
    const galleryFiles = req.files?.gallery || [];
    const startOrder = (await pool.query('SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM product_images WHERE product_id=$1', [req.params.id])).rows[0].n;
    for (let i = 0; i < galleryFiles.length; i++) {
      await pool.query('INSERT INTO product_images (product_id, url, sort_order) VALUES ($1,$2,$3)', [req.params.id, fileUrl(galleryFiles[i]), startOrder + i]);
    }
    await cleanupMediaUrls([oldProduct.image, oldProduct.video, oldProduct.video_poster]);
    res.redirect('/admin/products');
  } catch (err) {
    next(err);
  }
});

router.post('/products/:id/delete', async (req, res, next) => {
  try {
    const media = await pool.query(
      `SELECT image AS url FROM products WHERE id = $1
       UNION ALL SELECT video FROM products WHERE id = $1
       UNION ALL SELECT video_poster FROM products WHERE id = $1
       UNION ALL SELECT url FROM product_images WHERE product_id = $1`,
      [req.params.id]
    );
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    await cleanupMediaUrls(media.rows.map((row) => row.url));
    res.redirect('/admin/products');
  } catch (err) {
    next(err);
  }
});

router.post('/product-images/:id/delete', async (req, res, next) => {
  try {
    const img = await pool.query('SELECT product_id, url FROM product_images WHERE id = $1', [req.params.id]);
    await pool.query('DELETE FROM product_images WHERE id = $1', [req.params.id]);
    await cleanupMediaUrls([img.rows[0]?.url]);
    const pid = img.rows[0]?.product_id;
    res.redirect(pid ? `/admin/products/${pid}/edit` : '/admin/products');
  } catch (err) {
    next(err);
  }
});

// =================== FILTERS (Shop sidebar facets) ===================
router.get('/filters', async (req, res, next) => {
  try {
    const groups = await loadFilterGroupsWithValues();
    res.render('admin/filters', { title: 'Categories', groups, active: 'filters' });
  } catch (err) {
    next(err);
  }
});

router.post('/filters/groups', async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim();
    if (!title) return res.redirect('/admin/filters');
    const slug = await uniqueSlug('filter_groups', req.body.slug || title);
    const maxSort = (await pool.query('SELECT COALESCE(MAX(sort_order),0)+10 AS n FROM filter_groups')).rows[0].n;
    await pool.query('INSERT INTO filter_groups (slug, title, sort_order) VALUES ($1,$2,$3)', [slug, title, maxSort]);
    res.redirect('/admin/filters');
  } catch (err) {
    next(err);
  }
});

// Rename a category (keeps its order/visibility — no technical fields in the UI).
router.post('/filters/groups/:id', async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim();
    if (title) await pool.query('UPDATE filter_groups SET title=$1 WHERE id=$2', [title, req.params.id]);
    res.redirect('/admin/filters');
  } catch (err) {
    next(err);
  }
});

router.post('/filters/groups/:id/delete', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM filter_groups WHERE id=$1', [req.params.id]);
    res.redirect('/admin/filters');
  } catch (err) {
    next(err);
  }
});

router.post('/filters/values', async (req, res, next) => {
  try {
    const groupId = parseInt(req.body.group_id);
    const label = String(req.body.label || '').trim();
    if (!groupId || !label) return res.redirect('/admin/filters');
    const baseSlug = slugifyFilter(req.body.slug || label) || 'value';
    // Ensure slug is unique within the group.
    let slug = baseSlug; let n = 2;
    while ((await pool.query('SELECT 1 FROM filter_values WHERE group_id=$1 AND slug=$2', [groupId, slug])).rowCount) {
      slug = `${baseSlug}-${n++}`;
    }
    const maxSort = (await pool.query('SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM filter_values WHERE group_id=$1', [groupId])).rows[0].n;
    await pool.query('INSERT INTO filter_values (group_id, label, slug, sort_order) VALUES ($1,$2,$3,$4)', [groupId, label, slug, parseInt(req.body.sort_order) || maxSort]);
    res.redirect('/admin/filters');
  } catch (err) {
    next(err);
  }
});

// Rename a sub-category (label only).
router.post('/filters/values/:id', async (req, res, next) => {
  try {
    const label = String(req.body.label || '').trim();
    if (label) await pool.query('UPDATE filter_values SET label=$1 WHERE id=$2', [label, req.params.id]);
    res.redirect('/admin/filters');
  } catch (err) {
    next(err);
  }
});

router.post('/filters/values/:id/delete', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM filter_values WHERE id=$1', [req.params.id]);
    res.redirect('/admin/filters');
  } catch (err) {
    next(err);
  }
});

// =================== COLLECTIONS ===================
router.get('/collections', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*, (SELECT COUNT(*) FROM product_collections pc WHERE pc.collection_id = c.id)::int AS product_count
       FROM collections c ORDER BY sort_order, id`
    );
    res.render('admin/collections', { title: 'Collections', collections: rows, active: 'collections' });
  } catch (err) {
    next(err);
  }
});

router.get('/collections/new', (req, res) => {
  res.render('admin/collection-form', { title: 'New Collection', collection: {}, active: 'collections', formAction: '/admin/collections' });
});

router.post('/collections', upload.single('image'), async (req, res, next) => {
  try {
    const b = req.body;
    const image = resolveMedia(req.file, b.image_url, null, b.remove_image === 'on');
    const slug = await uniqueSlug('collections', b.slug || b.title);
    await pool.query(
      `INSERT INTO collections (slug, title, description, image, sort_order, is_active)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [slug, b.title, b.description || null, image, parseInt(b.sort_order) || 0, b.is_active === 'on']
    );
    res.redirect('/admin/collections');
  } catch (err) {
    next(err);
  }
});

router.get('/collections/:id/edit', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM collections WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.redirect('/admin/collections');
    res.render('admin/collection-form', { title: 'Edit Collection', collection: rows[0], active: 'collections', formAction: `/admin/collections/${req.params.id}` });
  } catch (err) {
    next(err);
  }
});

router.post('/collections/:id', upload.single('image'), async (req, res, next) => {
  try {
    const b = req.body;
    const existing = await pool.query('SELECT * FROM collections WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.redirect('/admin/collections');
    const oldImage = existing.rows[0].image;
    const image = resolveMedia(req.file, b.image_url, oldImage, b.remove_image === 'on');
    const slug = await uniqueSlug('collections', b.slug || b.title, req.params.id);
    await pool.query(
      `UPDATE collections SET slug=$1, title=$2, description=$3, image=$4, sort_order=$5, is_active=$6 WHERE id=$7`,
      [slug, b.title, b.description || null, image, parseInt(b.sort_order) || 0, b.is_active === 'on', req.params.id]
    );
    await cleanupMediaUrls([oldImage]);
    res.redirect('/admin/collections');
  } catch (err) {
    next(err);
  }
});

router.post('/collections/:id/delete', async (req, res, next) => {
  try {
    const existing = await pool.query('SELECT image FROM collections WHERE id = $1', [req.params.id]);
    await pool.query('DELETE FROM collections WHERE id = $1', [req.params.id]);
    await cleanupMediaUrls([existing.rows[0]?.image]);
    res.redirect('/admin/collections');
  } catch (err) {
    next(err);
  }
});

// =================== BANNERS ===================
router.get('/banners', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM banners ORDER BY sort_order, id');
    res.render('admin/banners', { title: 'Banners', banners: rows, active: 'banners' });
  } catch (err) {
    next(err);
  }
});

router.get('/banners/new', (req, res) => {
  res.render('admin/banner-form', { title: 'New Banner', banner: {}, active: 'banners', formAction: '/admin/banners' });
});

router.post('/banners', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), async (req, res, next) => {
  try {
    const b = req.body;
    const image = resolveMedia(req.files?.image?.[0], b.image_url, null, b.remove_image === 'on');
    const video = resolveMedia(req.files?.video?.[0], b.video_url, null, b.remove_video === 'on');
    await pool.query(
      `INSERT INTO banners (title, subtitle, image, video, link, button_text, sort_order, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [b.title || null, b.subtitle || null, image, video, b.link || null, b.button_text || null, parseInt(b.sort_order) || 0, b.is_active === 'on']
    );
    res.redirect('/admin/banners');
  } catch (err) {
    next(err);
  }
});

router.get('/banners/:id/edit', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM banners WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.redirect('/admin/banners');
    res.render('admin/banner-form', { title: 'Edit Banner', banner: rows[0], active: 'banners', formAction: `/admin/banners/${req.params.id}` });
  } catch (err) {
    next(err);
  }
});

router.post('/banners/:id', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), async (req, res, next) => {
  try {
    const b = req.body;
    const existing = await pool.query('SELECT * FROM banners WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.redirect('/admin/banners');
    const oldBanner = existing.rows[0];
    const image = resolveMedia(req.files?.image?.[0], b.image_url, oldBanner.image, b.remove_image === 'on');
    const video = resolveMedia(req.files?.video?.[0], b.video_url, oldBanner.video, b.remove_video === 'on');
    await pool.query(
      `UPDATE banners SET title=$1, subtitle=$2, image=$3, video=$4, link=$5, button_text=$6, sort_order=$7, is_active=$8 WHERE id=$9`,
      [b.title || null, b.subtitle || null, image, video, b.link || null, b.button_text || null, parseInt(b.sort_order) || 0, b.is_active === 'on', req.params.id]
    );
    await cleanupMediaUrls([oldBanner.image, oldBanner.video]);
    res.redirect('/admin/banners');
  } catch (err) {
    next(err);
  }
});

router.post('/banners/:id/delete', async (req, res, next) => {
  try {
    const existing = await pool.query('SELECT image, video FROM banners WHERE id = $1', [req.params.id]);
    await pool.query('DELETE FROM banners WHERE id = $1', [req.params.id]);
    await cleanupMediaUrls([existing.rows[0]?.image, existing.rows[0]?.video]);
    res.redirect('/admin/banners');
  } catch (err) {
    next(err);
  }
});

// =================== BLOG ===================
router.get('/posts', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM posts ORDER BY published_at DESC');
    res.render('admin/posts', { title: 'Blog', posts: rows, active: 'posts' });
  } catch (err) {
    next(err);
  }
});

router.get('/posts/new', (req, res) => {
  res.render('admin/post-form', { title: 'New Post', post: {}, active: 'posts', formAction: '/admin/posts' });
});

router.post('/posts', upload.single('cover_image'), async (req, res, next) => {
  try {
    const b = req.body;
    const cover = resolveMedia(req.file, b.cover_image_url, null, b.remove_cover_image === 'on');
    const slug = await uniqueSlug('posts', b.slug || b.title);
    await pool.query(
      `INSERT INTO posts (slug, title, excerpt, content, cover_image, author, is_published, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE($8::timestamptz, now()))`,
      [slug, b.title, b.excerpt || null, b.content || null, cover, b.author || 'Majestic Nail Care', b.is_published === 'on', b.published_at || null]
    );
    res.redirect('/admin/posts');
  } catch (err) {
    next(err);
  }
});

router.get('/posts/:id/edit', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.redirect('/admin/posts');
    res.render('admin/post-form', { title: 'Edit Post', post: rows[0], active: 'posts', formAction: `/admin/posts/${req.params.id}` });
  } catch (err) {
    next(err);
  }
});

router.post('/posts/:id', upload.single('cover_image'), async (req, res, next) => {
  try {
    const b = req.body;
    const existing = await pool.query('SELECT * FROM posts WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.redirect('/admin/posts');
    const oldCover = existing.rows[0].cover_image;
    const cover = resolveMedia(req.file, b.cover_image_url, oldCover, b.remove_cover_image === 'on');
    const slug = await uniqueSlug('posts', b.slug || b.title, req.params.id);
    await pool.query(
      `UPDATE posts SET slug=$1, title=$2, excerpt=$3, content=$4, cover_image=$5, author=$6, is_published=$7, published_at=COALESCE($8::timestamptz, published_at) WHERE id=$9`,
      [slug, b.title, b.excerpt || null, b.content || null, cover, b.author || 'Majestic Nail Care', b.is_published === 'on', b.published_at || null, req.params.id]
    );
    await cleanupMediaUrls([oldCover]);
    res.redirect('/admin/posts');
  } catch (err) {
    next(err);
  }
});

router.post('/posts/:id/delete', async (req, res, next) => {
  try {
    const existing = await pool.query('SELECT cover_image FROM posts WHERE id = $1', [req.params.id]);
    await pool.query('DELETE FROM posts WHERE id = $1', [req.params.id]);
    await cleanupMediaUrls([existing.rows[0]?.cover_image]);
    res.redirect('/admin/posts');
  } catch (err) {
    next(err);
  }
});

// Navigation structure is defined in code; keep old admin URLs from exposing stale CRUD screens.
router.all(/^\/navigation(?:\/.*)?$/, (req, res) => {
  res.redirect('/admin');
});

// Page Content editor removed from the admin (too technical for shop owners); section
// content is seeded and edited in code. Redirect any old links to the dashboard.
router.all(/^\/content(?:\/.*)?$/, (req, res) => {
  res.redirect('/admin');
});

// =================== SETTINGS ===================
router.get('/settings', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM settings');
    const settings = {};
    rows.forEach((r) => (settings[r.key] = r.value));
    res.render('admin/settings', { title: 'Settings', settings, active: 'settings', saved: req.query.saved });
  } catch (err) {
    next(err);
  }
});

router.post('/settings', upload.fields([{ name: 'og_image_file', maxCount: 1 }, { name: 'contact_banner_file', maxCount: 1 }]), async (req, res, next) => {
  try {
    const currentRows = await pool.query(
      "SELECT key, value FROM settings WHERE key IN ('og_image', 'contact_banner')"
    );
    const current = Object.fromEntries(currentRows.rows.map((row) => [row.key, row.value]));
    const ogImage = resolveMedia(
      req.files?.og_image_file?.[0],
      req.body.og_image_url,
      current.og_image,
      req.body.remove_og_image === 'on'
    );
    const contactBanner = resolveMedia(
      req.files?.contact_banner_file?.[0],
      req.body.contact_banner_url,
      current.contact_banner,
      req.body.remove_contact_banner === 'on'
    );
    const mediaFields = new Set([
      'og_image_url',
      'contact_banner_url',
      'remove_og_image',
      'remove_contact_banner',
    ]);
    const entries = Object.entries(req.body).filter(([key]) => !mediaFields.has(key));
    entries.push(['og_image', ogImage], ['contact_banner', contactBanner]);
    for (const [key, value] of entries) {
      await pool.query(
        `INSERT INTO settings (key, value) VALUES ($1,$2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, value]
      );
    }
    await cleanupMediaUrls([current.og_image, current.contact_banner]);
    res.redirect('/admin/settings?saved=1');
  } catch (err) {
    next(err);
  }
});

// =================== ACCOUNT (change password) ===================
router.post('/account/password', async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    const { rows } = await pool.query('SELECT * FROM admins WHERE id = $1', [req.session.admin.id]);
    if (!rows.length || !bcrypt.compareSync(current_password, rows[0].password_hash)) {
      return res.redirect('/admin/settings?saved=err');
    }
    const hash = bcrypt.hashSync(new_password, 10);
    await pool.query('UPDATE admins SET password_hash = $1 WHERE id = $2', [hash, req.session.admin.id]);
    res.redirect('/admin/settings?saved=pw');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
