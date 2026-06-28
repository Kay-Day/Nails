const fs = require('fs');
const path = require('path');

// We reuse the EXACT scraped runzie homepage as the shared chrome (head + header
// + footer) so every page matches the original theme 1:1. The scraped file is
// split once into TOP (everything up to & including the <main> open tag) and
// BOTTOM (the </main> close tag onward, i.e. the footer + scripts).

const HOME_FILE = path.join(__dirname, '..', 'public', 'home', 'index.html');
const MAIN_OPEN = '<main role="main" id="MainContent">';
const MAIN_CLOSE = '</main>';
const DEFAULT_SHOP_NAME = 'PASTELLE NAILS';
const DEFAULT_LOGO_URL = '/images/Logo/Logo.jpeg';

let TOP = '';
let BOTTOM = '';

function stripCommerce(html) {
  return html
    .replace(/<a href="\/cart" class="m-cart-icon-bubble"[\s\S]*?<\/m-cart-count>/g, '')
    .replace(/<m-cart-drawer[\s\S]*?<\/m-cart-drawer>/g, '')
    .replace(/href="\/account(?:\/login|\/register)?"/g, 'href="/contact"');
}

function normalizeShopNavigation(html) {
  return html.replace(/\/collections\/neonnyx-nails/g, '/collections/all');
}

function load() {
  const html = fs.readFileSync(HOME_FILE, 'utf8');
  const openIdx = html.indexOf(MAIN_OPEN);
  const closeIdx = html.indexOf(MAIN_CLOSE, openIdx);
  if (openIdx === -1 || closeIdx === -1) {
    throw new Error('layout: could not locate <main> markers in scraped homepage');
  }
  TOP = html.slice(0, openIdx + MAIN_OPEN.length);
  BOTTOM = html.slice(closeIdx); // includes </main> + footer-group + scripts
  TOP = stripCommerce(TOP);
  BOTTOM = stripCommerce(BOTTOM);

  // The scraped file sometimes stores a huge runtime header height. If we keep
  // that stale value, homepage banners calculate the wrong size before JS runs.
  TOP = TOP.replace(
    /style="[^"]*--m-header-height:[^"]*"/i,
    'style="--m-header-height: 72px; --m-announcement-height: 22px;"'
  );

  // The scraped theme references assets with RELATIVE paths (css/…, images/…).
  // Those break on nested URLs like /products/:slug. Inject <base href="/"> so
  // every relative asset/url() resolves against the site root on any page depth.
  if (!/<base\b/i.test(TOP)) {
    TOP = TOP.replace(/<head>/i, '<head>\n<base href="/">');
  }
}
load();

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const FOOTER_ICONS = {
  phone: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.33 1.84.56 2.8.69A2 2 0 0 1 22 16.92z"/></svg>',
  location: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  instagram: '<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" class="db-icon-fill"/></svg>',
  tiktok: '<svg aria-hidden="true" viewBox="0 0 24 24"><path class="db-icon-fill" d="M15.6 3c.4 2.2 1.7 3.6 4.1 3.8v3.1c-1.5.1-2.8-.3-4.1-1.1v6.3a6.1 6.1 0 1 1-5.3-6V12a3.2 3.2 0 1 0 2.2 3.1V3h3.1z"/></svg>',
};

function footerContact(settings = {}) {
  const shopName = settings.shop_name || DEFAULT_SHOP_NAME;
  const phoneDigits = settings.contact_phone ? settings.contact_phone.replace(/\D/g, '') : '';
  const phoneHref = phoneDigits ? '+' + (phoneDigits.length === 10 ? '1' + phoneDigits : phoneDigits) : '';
  const item = (icon, label, value, href, external) => {
    if (!value) return '';
    const content = `<span class="db-site-contact-strip__icon">${FOOTER_ICONS[icon]}</span><span><small>${label}</small><strong>${escapeHtml(value)}</strong></span>`;
    return href
      ? `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener"' : ''}>${content}</a>`
      : `<div>${content}</div>`;
  };

  const content = [
    item('location', 'Address', settings.contact_address),
    item('phone', 'Phone', settings.contact_phone, phoneHref ? `tel:${phoneHref}` : ''),
    item('instagram', 'Instagram', '@majestic_nailbox', settings.instagram, true),
    item('tiktok', 'TikTok', '@majestic_press_on_nails', settings.tiktok, true),
  ].filter(Boolean).join('');

  if (!content) return '';
  return `<section class="db-site-contact-strip" aria-label="Store contact information"><div class="container"><h2>Contact ${escapeHtml(shopName)}</h2><div class="db-site-contact-strip__grid">${content}</div></div></section>`;
}

function addBlogNavigation(html) {
  if (html.includes('data-db-blog-nav')) return html;

  const mobileItem = `
<li class="m-menu-mobile__item m-menu-mobile__item--no-submenu" data-url="/blog" data-db-blog-nav>
  <a href="/blog" class="m-menu-mobile__link">
    <span style="color: ">Blog</span>
  </a>
</li>
`;
  const desktopItem = `
<li class="m-menu__item" data-index="4" data-db-blog-nav>
  <a href="/blog" class="m-menu__link m-menu__link--main m:uppercase">
    <span class="m-menu__text">Blog</span>
  </a>
</li>
`;

  let output = html.replace(
    /(<li class="m-menu-mobile__item m-menu-mobile__item--no-submenu" data-url="\/pages\/about-us">)/,
    mobileItem + '$1'
  );
  output = output.replace(
    /(<li class="m-menu__item" data-index="4">\s*<a href="\/pages\/about-us")/,
    desktopItem + '$1'
  );
  return output;
}

function replaceBalancedList(html, marker, replacement) {
  const start = html.indexOf(marker);
  if (start === -1) return html;
  const tagPattern = /<\/?ul\b[^>]*>/gi;
  tagPattern.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = tagPattern.exec(html))) {
    depth += /^<ul\b/i.test(match[0]) ? 1 : -1;
    if (depth === 0) {
      return html.slice(0, start) + replacement + html.slice(tagPattern.lastIndex);
    }
  }
  return html;
}

function menuBadge(item) {
  return item.badge ? `<span class="m-menu__badge">${escapeHtml(item.badge)}</span>` : '';
}

function desktopMenu(items = []) {
  const child = (item) => `
    <li class="m-sub-menu__item m-sub-menu__item--level-1">
      <a href="${escapeHtml(item.url || '#')}" class="m-menu__link"><span class="m-menu__text">${escapeHtml(item.label)}</span>${menuBadge(item)}</a>
      ${item.children?.length ? `<div class="m-mega-menu__column"><ul class="m-sub-menu m-sub-menu--level-2">${item.children.map((entry) => `
        <li class="m-sub-menu__item m-sub-menu__item--level-2"><a href="${escapeHtml(entry.url || '#')}" class="m-menu__link"><span class="m-menu__text">${escapeHtml(entry.label)}</span>${menuBadge(entry)}</a></li>`).join('')}
      </ul></div>` : ''}
    </li>`;
  return `<ul class="m-menu" data-db-navigation>${items.map((item, index) => `
    <li class="m-menu__item${item.children?.length ? ' m-menu__item--parent m-menu__item--has-submenu m-menu__item--mega' : ''}" data-index="${index}">
      <a href="${escapeHtml(item.url || '#')}" class="m-menu__link m-menu__link--main m:uppercase"><span class="m-menu__text">${escapeHtml(item.label)}</span>${menuBadge(item)}</a>
      ${item.children?.length ? `<div class="m-mega-menu m-gradient m-color-default" style="--total-columns:${Math.max(1, item.children.length)}"><div class="m-mega-menu__container container-full"><div class="m-mega-menu__inner"><ul class="m-sub-menu m-sub-menu--level-1 m:w-full m:flex-1">${item.children.map(child).join('')}</ul></div></div></div>` : ''}
    </li>`).join('')}
  </ul>`;
}

const MENU_ARROW = '<svg fill="currentColor" stroke="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512"><path d="M17.525 36.465l-7.071 7.07c-4.686 4.686-4.686 12.284 0 16.971L205.947 256 10.454 451.494c-4.686 4.686-4.686 12.284 0 16.971l7.071 7.07c4.686 4.686 12.284 4.686 16.97 0l211.051-211.05c4.686-4.686 4.686-12.284 0-16.971L34.495 36.465c-4.686-4.687-12.284-4.687-16.97 0z"></path></svg>';

function mobileMenu(items = []) {
  const level = (entries, depth) => entries.map((item, index) => `
    <li class="m-menu-mobile__item${item.children?.length ? '' : ' m-menu-mobile__item--no-submenu'}" data-url="${escapeHtml(item.url || '#')}" data-index="${index}">
      <a href="${escapeHtml(item.url || '#')}" class="m-menu-mobile__link"><span class="m-menu__text">${escapeHtml(item.label)}</span>${menuBadge(item)}</a>
      ${item.children?.length ? `<span class="m-menu-mobile__toggle-button" data-toggle-submenu="${depth}">${MENU_ARROW}</span><div class="m-megamenu-mobile m-megamenu-mobile--level-${depth}"><div class="m-megamenu-mobile__wrapper"><button class="m-menu-mobile__back-button" data-level="${depth}">${MENU_ARROW}<span>${escapeHtml(item.label)}</span></button><ul class="m-submenu-mobile">${level(item.children, depth + 1)}</ul></div></div>` : ''}
    </li>`).join('');
  return `<ul class="m-menu-drawer__navigation m-menu-mobile" data-db-navigation>${level(items, 1)}</ul>`;
}

function applyNavigation(html, navigation = {}) {
  const header = navigation.header || [];
  if (!header.length) return addBlogNavigation(html);
  let output = replaceBalancedList(html, '<ul class="m-menu">', desktopMenu(header));
  output = replaceBalancedList(output, '<ul class="m-menu-drawer__navigation m-menu-mobile">', mobileMenu(header));
  return output;
}

function applyAnnouncements(html, settings = {}) {
  const messages = [settings.announcement, settings.announcement_2, settings.announcement_3, settings.announcement_4].filter(Boolean);
  let index = 0;
  return html.replace(/(<div class="m-announcement-bar__content">)[\s\S]*?(<\/div>)/g, (match, open, close) => {
    const message = messages[index++];
    return message ? `${open}${escapeHtml(message)}${close}` : match;
  });
}

function applyBranding(html, settings = {}) {
  const shopName = settings.shop_name || DEFAULT_SHOP_NAME;
  const logoUrl = settings.logo_url || DEFAULT_LOGO_URL;
  const logo = `
    <a href="/" class="m-logo__image m:block db-brand-lockup" title="${escapeHtml(shopName)}">
      <span class="db-brand-logo-frame" aria-hidden="true">
        <img src="${escapeHtml(logoUrl)}" alt="">
      </span>
      <span class="db-brand-name">${escapeHtml(shopName)}</span>
    </a>`;

  let output = html.replace(
    /<a href="\/" class="m-logo__image m:block" title="[^"]*">[\s\S]*?<\/a>/g,
    logo
  );
  output = output.replace(
    /<link rel="shortcut icon"[^>]*>/i,
    `<link rel="icon" type="image/jpeg" href="${escapeHtml(logoUrl)}">`
  );
  output = output.replace(
    /<meta property="og:site_name" content="[^"]*">/i,
    `<meta property="og:site_name" content="${escapeHtml(shopName)}">`
  );
  return output;
}

function footerNavigation(items = []) {
  if (!items.length) return '';
  return `<nav class="db-dynamic-footer-nav" aria-label="Footer navigation"><div class="container"><strong>Explore</strong><div>${items.map((item) => `<a href="${escapeHtml(item.url || '#')}">${escapeHtml(item.label)}</a>`).join('')}</div></div></nav>`;
}

const THEME_CSS_BUNDLE = [
  '/css/main.css',
  '/css/vendor.css',
  '/css/custom-style.css',
  '/css/custom.css',
  '/css/styles.css',
  '/css/header.css',
  '/css/footer.css',
  '/css/slideshow.css',
  '/css/scrolling-promotion.css',
  '/css/component-product-inventory.css',
  '/css/featured-collection.css',
  '/css/collection.css',
  '/css/collection-header.css',
  '/css/collection-list.css',
  '/css/component-collection-card.css',
  '/css/component-image-card.css',
  '/css/custom-content.css',
  '/css/icon-box.css',
  '/css/rich-text.css',
  '/css/image-with-text.css',
  '/css/featured-collection-banner.css',
  '/css/product.css',
  '/css/component-newsletter.css',
  '/css/db-pages.css',
];

const SIDE_EFFECT_ASSETS = [
  'cart.css',
  'cart.js',
  'accelerated-checkout-backwards-compat.css',
  'swiper-bundle.min.css',
  'swiper-bundle.min.js',
  'swiper-scoped.css',
  'fancybox.css',
  'fancybox.umd.js',
  'video-ugc.css',
  'video-ugc.js',
  'component-quantity-popover.css',
  'quantity-popover.js',
  'widget_v3_base.css',
  'shopify_v2.css',
  'loader.init-shop-cart-sync',
];

const SIDE_EFFECT_BLOCKS = [
  /<!-- BEGIN app block: shopify:\/\/apps\/super-video-ugc\/[\s\S]*?<!-- END app block -->/gi,
  /<!-- BEGIN app block: shopify:\/\/apps\/hoppy-free-shipping\/[\s\S]*?<!-- END app block -->/gi,
  /<script[^>]*class=["'][^"']*jdgm-settings-script[^"']*["'][^>]*>[\s\S]*?<\/script>/gi,
  /<script[^>]*>[\s\S]*?window\.jdgm[\s\S]*?<\/script>/gi,
  /<style[^>]*>[\s\S]*?\.jdgm[\s\S]*?<\/style>/gi,
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ensureThemeCss(output) {
  // These lazy/remote stylesheet tags belonged to Shopify's live runtime. In
  // this local clone they can load late, duplicate local files, or pull cart /
  // checkout styles we intentionally do not use.
  SIDE_EFFECT_BLOCKS.forEach((pattern) => {
    output = output.replace(pattern, '');
  });

  output = output.replace(
    /<link[^>]*rel=["']stylesheet["'][^>]*media=["']print["'][^>]*\/?>/gi,
    ''
  );
  output = output.replace(
    /<link[^>]*rel=["']stylesheet["'][^>]*\/\/www\.runzie\.ca[^>]*\/?>/gi,
    ''
  );
  output = output.replace(
    /<link[^>]*rel=["']stylesheet["'][^>]*https?:\/\/cdn\.shopify\.com[^>]*\/?>/gi,
    ''
  );
  output = output.replace(
    /<link[^>]*(?:href|src)=["'][^"']*(?:\/\/www\.runzie\.ca|https?:\/\/cdn\.shopify\.com)[^"']*["'][^>]*\/?>/gi,
    ''
  );
  output = output.replace(
    /<style[^>]*id=["']shopify-accelerated-checkout-cart["'][^>]*>[\s\S]*?<\/style>/gi,
    ''
  );
  output = output.replace(
    /<script[^>]*data-source-attribution=["']shopify\.dynamic_checkout[^"']*["'][^>]*>[\s\S]*?<\/script>/gi,
    ''
  );

  SIDE_EFFECT_ASSETS.forEach((asset) => {
    const pattern = escapeRegExp(asset);
    output = output.replace(
      new RegExp(`<link[^>]*(?:href|src)=["'][^"']*${pattern}[^"']*["'][^>]*\\/?>`, 'gi'),
      ''
    );
    output = output.replace(
      new RegExp(`<script[^>]*src=["'][^"']*${pattern}[^"']*["'][^>]*>\\s*<\\/script>`, 'gi'),
      ''
    );
  });

  const hasStylesheet = (href) => {
    const normalized = href.replace(/^\//, '');
    const pattern = escapeRegExp(normalized);
    return new RegExp(`<link[^>]+href=["']/?${pattern}(?:["'?]|\\?)`, 'i').test(output);
  };
  const missing = THEME_CSS_BUNDLE.filter((href) => !hasStylesheet(href));
  if (!missing.length) return output;
  const links = missing.map((href) => `<link rel="stylesheet" href="${href}">`).join('\n');
  return output.replace(/<\/head>/i, `${links}\n</head>`);
}

function addBodyClass(html, className) {
  if (!className || html.includes(className)) return html;
  if (/<body\b[^>]*class="/i.test(html)) {
    return html.replace(/<body\b([^>]*)class="([^"]*)"/i, `<body$1class="$2 ${className}"`);
  }
  return html.replace(/<body\b([^>]*)>/i, `<body$1 class="${className}">`);
}

function personalizeHtml(html, { title, description, url, settings, navigation, isInnerPage } = {}) {
  let output = applyNavigation(normalizeShopNavigation(stripCommerce(html)), navigation);
  output = applyAnnouncements(output, settings);
  output = applyBranding(output, settings);
  if (isInnerPage) {
    output = addBodyClass(output, 'db-inner-page');
    output = output
      .replace(/\s*transparent-on-top\b/g, '')
      .replace(/data-transparent="true"/g, 'data-transparent="false"');
  }
  if (title) {
    output = output.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`);
  }
  const metaDescription = description || settings?.seo_description || settings?.tagline || '';
  if (metaDescription) {
    output = output
      .replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${escapeHtml(metaDescription)}">`)
      .replace(/<meta property="og:description" content="[^"]*">/i, `<meta property="og:description" content="${escapeHtml(metaDescription)}">`)
      .replace(/<meta name="twitter:description" content="[^"]*">/i, `<meta name="twitter:description" content="${escapeHtml(metaDescription)}">`);
  }
  if (title) {
    output = output
      .replace(/<meta property="og:title" content="[^"]*">/i, `<meta property="og:title" content="${escapeHtml(title)}">`)
      .replace(/<meta name="twitter:title" content="[^"]*">/i, `<meta name="twitter:title" content="${escapeHtml(title)}">`);
  }
  const siteUrl = String(settings?.site_url || '').replace(/\/$/, '');
  const pageUrl = siteUrl && url ? siteUrl + (url.startsWith('/') ? url : '/' + url) : '';
  if (pageUrl) {
    output = output.replace(/<meta property="og:url" content="[^"]*">/i, `<meta property="og:url" content="${escapeHtml(pageUrl)}">`);
    if (/<link rel="canonical"/i.test(output)) {
      output = output.replace(/<link rel="canonical" href="[^"]*">/i, `<link rel="canonical" href="${escapeHtml(pageUrl)}">`);
    } else {
      output = output.replace(/<\/head>/i, `<link rel="canonical" href="${escapeHtml(pageUrl)}">\n</head>`);
    }
  }
  const socialImage = settings?.og_image
    ? (/^https?:\/\//i.test(settings.og_image) ? settings.og_image : siteUrl + (settings.og_image.startsWith('/') ? '' : '/') + settings.og_image)
    : '';
  if (socialImage) {
    const tags = `<meta property="og:image" content="${escapeHtml(socialImage)}">\n<meta name="twitter:image" content="${escapeHtml(socialImage)}">`;
    if (/<meta property="og:image"/i.test(output)) {
      output = output.replace(/<meta property="og:image" content="[^"]*">/i, `<meta property="og:image" content="${escapeHtml(socialImage)}">`);
      output = output.replace(/<meta name="twitter:image" content="[^"]*">/i, `<meta name="twitter:image" content="${escapeHtml(socialImage)}">`);
    } else {
      output = output.replace(/<\/head>/i, `${tags}\n</head>`);
    }
  }
  output = ensureThemeCss(output);

  output = output
    .replace(/https:\/\/instagram\.com\/runzienails/g, escapeHtml(settings && settings.instagram || '#'))
    .replace(/https:\/\/www\.tiktok\.com\/@runzienails/g, escapeHtml(settings && settings.tiktok || '#'))
    .replace(
      /© 2026 Runzie, All rights reserved\./g,
      `© 2026 ${escapeHtml(settings?.shop_name || DEFAULT_SHOP_NAME)}, All rights reserved.`
    );

  const contact = footerContact(settings);
  const footer = footerNavigation(navigation?.footer || []);
  if (footer && !output.includes('db-dynamic-footer-nav')) {
    output = addBodyClass(output, 'db-dynamic-footer-enabled');
    output = output.replace('<m-footer', `${footer}\n<m-footer`);
  }
  if (contact && !output.includes('db-site-contact-strip')) {
    output = output.replace('<m-footer', `${contact}\n<m-footer`);
  }
  if (!output.includes('/js/db-site.js')) {
    output = output.replace(/<\/body>/i, '<script src="/js/db-site.js" defer></script>\n</body>');
  }
  return output;
}

// Wrap inner content with the theme chrome. Optionally swap the <title>.
function renderPage(innerHtml, { title, description, url, settings, navigation } = {}) {
  const isHome = /\bm-slideshow\b|\bdata-slideshow\b/i.test(innerHtml);
  return personalizeHtml(TOP + '\n' + innerHtml + '\n' + BOTTOM, { title, description, url, settings, navigation, isInnerPage: !isHome });
}

module.exports = { renderPage, personalizeHtml, escapeHtml, reload: load };
