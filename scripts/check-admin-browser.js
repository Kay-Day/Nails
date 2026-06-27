require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');

const debugUrl = process.env.EDGE_DEBUG_URL || 'http://127.0.0.1:9333';
const screenshotPath = path.join(__dirname, '..', '.admin-media-mobile.png');
let sequence = 0;
const pending = new Map();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findPage() {
  const response = await fetch(`${debugUrl}/json/list`);
  const targets = await response.json();
  return targets.find((target) => target.type === 'page');
}

async function run() {
  const page = await findPage();
  assert(page?.webSocketDebuggerUrl, 'No Edge page target found');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });

  function send(method, params = {}) {
    const id = ++sequence;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Browser evaluation failed');
    return result.result.value;
  }

  async function navigate(url) {
    await send('Page.navigate', { url });
    for (let attempt = 0; attempt < 30; attempt++) {
      await delay(100);
      const ready = await evaluate('document.readyState');
      if (ready === 'complete') return;
    }
    throw new Error(`Timed out while loading ${url}`);
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('DOM.enable');
  await send('Network.clearBrowserCookies');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });

  await navigate('http://localhost:3000/admin/login');
  await evaluate(`(() => {
    document.querySelector('[name="username"]').value = ${JSON.stringify(process.env.ADMIN_USERNAME || '')};
    document.querySelector('[name="password"]').value = ${JSON.stringify(process.env.ADMIN_PASSWORD || '')};
    document.querySelector('form').requestSubmit();
  })()`);
  await delay(600);
  assert((await evaluate('location.pathname')) === '/admin', 'Browser admin login failed');

  await navigate('http://localhost:3000/admin/banners/new');
  await evaluate(`(() => {
    const image = document.querySelector('[data-media-kind="image"] [data-media-url]');
    image.value = 'http://localhost:3000/images/0326004.jpg';
    image.dispatchEvent(new Event('input', { bubbles: true }));
    const video = document.querySelector('[data-media-kind="video"] [data-media-url]');
    video.value = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    video.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await delay(800);
  const bannerState = await evaluate(`(() => ({
    imageReady: (document.querySelector('[data-media-kind="image"] [data-media-preview] img')?.naturalWidth || 0) > 0,
    videoEmbed: document.querySelector('[data-media-kind="video"] [data-media-preview] iframe')?.src || '',
    overflow: document.documentElement.scrollWidth > window.innerWidth
  }))()`);
  assert(bannerState.imageReady, 'External image preview did not load');
  assert(/youtube(?:-nocookie)?\.com\/embed\//.test(bannerState.videoEmbed), 'YouTube preview was not embedded');
  assert(!bannerState.overflow, 'Banner form overflows the mobile viewport');

  const sectionResult = await pool.query('SELECT id FROM site_sections ORDER BY id LIMIT 1');
  assert(sectionResult.rows[0], 'No content section is available for editor testing');
  await navigate(`http://localhost:3000/admin/content/${sectionResult.rows[0].id}/edit`);
  const editorState = await evaluate(`(() => {
    const editor = document.querySelector('[data-rich-editor]');
    const source = document.querySelector('[data-rich-source]');
    return {
      visible: Boolean(editor && editor.getBoundingClientRect().height > 100),
      sourceHidden: Boolean(source && source.hidden),
      rawLabelVisible: document.body.innerText.includes('Body HTML'),
      overflow: document.documentElement.scrollWidth > window.innerWidth
    };
  })()`);
  assert(editorState.visible, 'Visual content editor is not visible');
  assert(editorState.sourceHidden, 'The raw content source is visible');
  assert(!editorState.rawLabelVisible, 'Raw HTML wording is still shown');
  assert(!editorState.overflow, 'Content form overflows the mobile viewport');

  await navigate('http://localhost:3000/admin/settings');
  await evaluate(`(() => {
    const input = document.querySelector('[name="og_image_url"]');
    input.value = 'http://localhost:3000/images/0326004.jpg';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await delay(500);
  const settingsState = await evaluate(`(() => ({
    mediaFields: document.querySelectorAll('[data-media-field]').length,
    imageReady: (document.querySelector('[name="og_image_url"]')?.closest('[data-media-field]')?.querySelector('img')?.naturalWidth || 0) > 0,
    overflow: document.documentElement.scrollWidth > window.innerWidth
  }))()`);
  assert(settingsState.mediaFields === 2, 'Settings media fields are missing');
  assert(settingsState.imageReady, 'Settings image preview did not load');
  assert(!settingsState.overflow, 'Settings form overflows the mobile viewport');

  await navigate('http://localhost:3000/admin/products/new');
  const documentNode = await send('DOM.getDocument');
  const galleryNode = await send('DOM.querySelector', {
    nodeId: documentNode.root.nodeId,
    selector: '[data-gallery-input]',
  });
  await send('DOM.setFileInputFiles', {
    nodeId: galleryNode.nodeId,
    files: [path.join(__dirname, '..', 'public', 'images', '0326004.jpg')],
  });
  await delay(400);
  const galleryState = await evaluate(`(() => ({
    previews: document.querySelectorAll('[data-gallery-preview] img').length,
    imageReady: (document.querySelector('[data-gallery-preview] img')?.naturalWidth || 0) > 0,
    overflow: document.documentElement.scrollWidth > window.innerWidth
  }))()`);
  assert(galleryState.previews === 1 && galleryState.imageReady, 'Gallery file preview did not load');
  assert(!galleryState.overflow, 'Product form overflows the mobile viewport');

  await navigate('http://localhost:3000/admin/banners/new');
  await evaluate(`(() => {
    const image = document.querySelector('[data-media-kind="image"] [data-media-url]');
    image.value = 'http://localhost:3000/images/0326004.jpg';
    image.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await delay(500);
  const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
  console.log(`Browser previews, visual editor, and mobile layout passed. Screenshot: ${screenshotPath}`);
  socket.close();
}

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
