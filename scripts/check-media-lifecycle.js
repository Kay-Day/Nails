require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');
const { uploadedFilePath } = require('../src/middleware/upload');

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const testToken = `media-check-${Date.now()}`;
const created = { collections: [], banners: [] };
const uploadedPaths = new Set();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function login() {
  const body = new URLSearchParams({
    username: process.env.ADMIN_USERNAME || '',
    password: process.env.ADMIN_PASSWORD || '',
  });
  const response = await fetch(`${baseUrl}/admin/login`, {
    method: 'POST',
    body,
    redirect: 'manual',
  });
  assert(response.status === 302, `Admin login returned ${response.status}`);
  const setCookie = response.headers.get('set-cookie') || '';
  const cookie = setCookie.split(';')[0];
  assert(cookie, 'Admin login did not return a session cookie');
  return cookie;
}

async function submit(cookie, pathname, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: { cookie },
    body,
    redirect: 'manual',
  });
  assert(response.status === 302, `${pathname} returned ${response.status}`);
  return response;
}

async function run() {
  const cookie = await login();
  const sourcePath = path.join(__dirname, '..', 'public', 'images', '0326004.jpg');
  const uploadForm = new FormData();
  uploadForm.set('title', `${testToken}-owner`);
  uploadForm.set('sort_order', '9999');
  uploadForm.set('image', new Blob([fs.readFileSync(sourcePath)], { type: 'image/jpeg' }), 'media-lifecycle.jpg');
  await submit(cookie, '/admin/collections', uploadForm);

  const ownerResult = await pool.query('SELECT id, image FROM collections WHERE title = $1', [`${testToken}-owner`]);
  assert(ownerResult.rows.length === 1, 'Uploaded collection was not saved');
  const owner = ownerResult.rows[0];
  created.collections.push(owner.id);
  assert(/^\/uploads\/[^/]+$/.test(owner.image), `Upload URL is not portable: ${owner.image}`);
  const sharedUploadPath = uploadedFilePath(owner.image);
  assert(sharedUploadPath && fs.existsSync(sharedUploadPath), 'Uploaded file does not exist');
  uploadedPaths.add(sharedUploadPath);

  const sharedForm = new FormData();
  sharedForm.set('title', `${testToken}-shared`);
  sharedForm.set('sort_order', '9999');
  sharedForm.set('image_url', owner.image);
  await submit(cookie, '/admin/collections', sharedForm);
  const sharedResult = await pool.query('SELECT id FROM collections WHERE title = $1', [`${testToken}-shared`]);
  assert(sharedResult.rows.length === 1, 'Shared-media collection was not saved');
  created.collections.push(sharedResult.rows[0].id);

  await submit(cookie, `/admin/collections/${owner.id}/delete`, new URLSearchParams());
  created.collections = created.collections.filter((id) => id !== owner.id);
  assert(fs.existsSync(sharedUploadPath), 'A shared upload was deleted while still referenced');

  await submit(cookie, `/admin/collections/${sharedResult.rows[0].id}/delete`, new URLSearchParams());
  created.collections = created.collections.filter((id) => id !== sharedResult.rows[0].id);
  assert(!fs.existsSync(sharedUploadPath), 'Upload remained after its final database reference was deleted');
  uploadedPaths.delete(sharedUploadPath);

  const replacementForm = new FormData();
  replacementForm.set('title', `${testToken}-replacement`);
  replacementForm.set('sort_order', '9999');
  replacementForm.set('image', new Blob([fs.readFileSync(sourcePath)], { type: 'image/jpeg' }), 'media-replacement.jpg');
  await submit(cookie, '/admin/collections', replacementForm);
  const replacementResult = await pool.query('SELECT id, image FROM collections WHERE title = $1', [`${testToken}-replacement`]);
  assert(replacementResult.rows.length === 1, 'Replacement collection was not saved');
  created.collections.push(replacementResult.rows[0].id);
  const replacementPath = uploadedFilePath(replacementResult.rows[0].image);
  assert(replacementPath && fs.existsSync(replacementPath), 'Replacement upload does not exist');
  uploadedPaths.add(replacementPath);

  const updateForm = new FormData();
  updateForm.set('title', `${testToken}-replacement`);
  updateForm.set('image_url', 'https://www.example.com/replacement.jpg');
  updateForm.set('sort_order', '9999');
  await submit(cookie, `/admin/collections/${replacementResult.rows[0].id}`, updateForm);
  assert(!fs.existsSync(replacementPath), 'Old upload remained after media was replaced');
  uploadedPaths.delete(replacementPath);
  await submit(cookie, `/admin/collections/${replacementResult.rows[0].id}/delete`, new URLSearchParams());
  created.collections = created.collections.filter((id) => id !== replacementResult.rows[0].id);

  const bannerForm = new FormData();
  bannerForm.set('title', `${testToken}-external`);
  bannerForm.set('image_url', 'www.example.com/banner.jpg');
  bannerForm.set('video_url', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  bannerForm.set('sort_order', '9999');
  await submit(cookie, '/admin/banners', bannerForm);
  const bannerResult = await pool.query('SELECT id, image, video FROM banners WHERE title = $1', [`${testToken}-external`]);
  assert(bannerResult.rows.length === 1, 'External-media banner was not saved');
  created.banners.push(bannerResult.rows[0].id);
  assert(bannerResult.rows[0].image === 'https://www.example.com/banner.jpg', 'External image URL was not normalized');

  const formResponse = await fetch(`${baseUrl}/admin/banners/${bannerResult.rows[0].id}/edit`, {
    headers: { cookie },
  });
  const formHtml = await formResponse.text();
  assert(formHtml.includes('data-media-preview'), 'Media preview component is missing');
  assert(formHtml.includes('data-media-kind=\"video\"'), 'Video preview component is missing');

  const productFormResponse = await fetch(`${baseUrl}/admin/products/new`, { headers: { cookie } });
  const productFormHtml = await productFormResponse.text();
  assert(productFormResponse.status === 200, 'Product form did not render');
  assert(productFormHtml.includes('data-gallery-preview'), 'Gallery preview component is missing');
  assert(productFormHtml.includes('name=\"video_poster\"'), 'Video cover upload is missing');

  const sectionResult = await pool.query('SELECT id FROM site_sections ORDER BY id LIMIT 1');
  if (sectionResult.rows[0]) {
    const contentResponse = await fetch(`${baseUrl}/admin/content/${sectionResult.rows[0].id}/edit`, {
      headers: { cookie },
    });
    const contentHtml = await contentResponse.text();
    assert(contentHtml.includes('data-rich-editor'), 'Visual content editor is missing');
    assert(!contentHtml.includes('Body HTML'), 'Raw HTML field is still visible');
  }

  await submit(cookie, `/admin/banners/${bannerResult.rows[0].id}/delete`, new URLSearchParams());
  created.banners = created.banners.filter((id) => id !== bannerResult.rows[0].id);
  console.log('Media lifecycle, portable paths, external URLs, and admin form checks passed.');
}

async function cleanup() {
  for (const id of created.banners) await pool.query('DELETE FROM banners WHERE id = $1', [id]);
  for (const id of created.collections) await pool.query('DELETE FROM collections WHERE id = $1', [id]);
  for (const uploadedPath of uploadedPaths) {
    if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
  }
  await pool.end();
}

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(cleanup);
