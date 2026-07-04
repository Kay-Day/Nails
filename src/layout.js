const fs = require('fs');
const path = require('path');

// We reuse the EXACT scraped runzie homepage as the shared chrome (head + header
// + footer) so every page matches the original theme 1:1. The scraped file is
// split once into TOP (everything up to & including the <main> open tag) and
// BOTTOM (the </main> close tag onward, i.e. the footer + scripts).

const HOME_FILE = path.join(__dirname, '..', 'public', 'home', 'index.html');
const MAIN_OPEN = '<main role="main" id="MainContent">';
const MAIN_CLOSE = '</main>';
const DEFAULT_SHOP_NAME = 'Majestic Nail Care';
const DEFAULT_LOGO_URL = '/images/Logo/Logo.jpg';

let TOP = '';
let BOTTOM = '';

function stripCommerce(html) {
  return html
    .replace(/<a href="\/cart" class="m-cart-icon-bubble"[\s\S]*?<\/m-cart-count>/g, '')
    .replace(/<m-cart-drawer[\s\S]*?<\/m-cart-drawer>/g, '')
    // Shopify "Follow on shop" widget — irrelevant to this view+contact clone.
    .replace(/<shop-follow-button\b[\s\S]*?<\/shop-follow-button>/gi, '')
    .replace(/<shop-follow-button\b[^>]*\/?>/gi, '')
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
  facebook: '<svg aria-hidden="true" viewBox="0 0 24 24"><path class="db-icon-fill" d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.3-1.5 1.6-1.5h1.6V3.7c-.3 0-1.3-.1-2.5-.1-2.4 0-4.1 1.5-4.1 4.2v2.1H7.4V13h2.7v8z"/></svg>',
  youtube: '<svg aria-hidden="true" viewBox="0 0 24 24"><path class="db-icon-fill" fill-rule="evenodd" d="M23 12s0-3.6-.46-5.33a2.78 2.78 0 0 0-1.94-1.94C18.88 4.27 12 4.27 12 4.27s-6.88 0-8.6.46A2.78 2.78 0 0 0 1.46 6.67C1 8.4 1 12 1 12s0 3.6.46 5.33a2.78 2.78 0 0 0 1.94 1.94c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-1.94C23 15.6 23 12 23 12zM9.75 15.35v-6.7L15.5 12z"/></svg>',
  pinterest: '<svg aria-hidden="true" viewBox="0 0 24 24"><path class="db-icon-fill" d="M12 2a10 10 0 0 0-3.64 19.31c-.09-.8-.17-2.03.03-2.9l1.17-4.98s-.3-.6-.3-1.48c0-1.38.8-2.42 1.8-2.42.85 0 1.26.64 1.26 1.4 0 .86-.54 2.14-.83 3.33-.24 1 .5 1.81 1.48 1.81 1.78 0 3.14-1.87 3.14-4.58 0-2.39-1.72-4.06-4.17-4.06-2.85 0-4.52 2.13-4.52 4.33 0 .86.33 1.78.74 2.28a.3.3 0 0 1 .07.29l-.28 1.13c-.04.18-.14.22-.33.13-1.24-.58-2.02-2.39-2.02-3.85 0-3.13 2.28-6.01 6.57-6.01 3.45 0 6.13 2.46 6.13 5.74 0 3.43-2.16 6.19-5.16 6.19-1.01 0-1.96-.53-2.28-1.15l-.62 2.37c-.23.87-.84 1.96-1.25 2.62A10 10 0 1 0 12 2z"/></svg>',
  twitter: '<svg aria-hidden="true" viewBox="0 0 24 24"><path class="db-icon-fill" d="M18.9 2.5h3.1l-6.77 7.73L23 21.5h-6.2l-4.86-6.35-5.56 6.35H3.28l7.24-8.27L2 2.5h6.36l4.4 5.81zm-1.09 17.14h1.72L7.26 4.28H5.42z"/></svg>',
  threads: '<svg aria-hidden="true" viewBox="0 0 24 24"><path class="db-icon-fill" d="M17.1 11.15c-.09-.04-.18-.08-.28-.12-.16-3.02-1.81-4.75-4.58-4.77h-.04c-1.66 0-3.03.71-3.88 2l1.52 1.04c.63-.96 1.63-1.16 2.36-1.16h.03c.91.01 1.6.28 2.05.79.32.38.54.9.65 1.56-.8-.14-1.65-.18-2.57-.12-2.56.15-4.21 1.64-4.1 3.71.06 1.05.58 1.95 1.48 2.54.76.49 1.73.73 2.75.68 1.34-.08 2.4-.59 3.13-1.53.56-.71.9-1.63 1.06-2.79.64.39 1.11.9 1.37 1.51.45 1.03.47 2.73-.91 4.11-1.21 1.2-2.67 1.72-4.87 1.74-2.44-.02-4.29-.8-5.49-2.32C6.15 16.85 5.58 14.79 5.56 12.16c.02-2.63.59-4.69 1.7-6.11 1.2-1.52 3.05-2.3 5.49-2.32 2.46.02 4.34.81 5.58 2.34.61.75 1.07 1.69 1.38 2.79l1.78-.48c-.37-1.36-.94-2.53-1.74-3.49C18.7 3.03 16.29 2.02 13.3 2h-.02C10.29 2.02 7.92 3.03 6.24 5c-1.5 1.76-2.27 4.2-2.3 7.16v.02c.03 2.96.8 5.4 2.3 7.16 1.68 1.97 4.05 2.98 7.04 3h.02c2.66-.02 4.54-.72 6.09-2.27 2.03-2.03 1.97-4.57 1.3-6.13-.48-1.11-1.39-2.03-2.63-2.66zM12.68 15.9c-1.13.06-2.3-.44-2.36-1.5-.04-.79.56-1.66 2.42-1.77.21-.01.42-.02.62-.02.67 0 1.31.06 1.88.19-.21 2.63-1.45 3.04-2.56 3.1z"/></svg>',
  whatsapp: '<svg aria-hidden="true" viewBox="0 0 24 24"><path class="db-icon-fill" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.14-.14.3-.35.44-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04.83-1.04 2 0 1.18.86 2.32.98 2.48.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.37.5.57.19 1.1.16 1.51.1.46-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28zM12.05 21.8h-.01a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3.07.8.82-2.99-.2-.31a8.1 8.1 0 1 1 6.9 3.82zM12.05 2a10.05 10.05 0 0 0-8.6 15.13L2 22.5l5.5-1.44A10.05 10.05 0 1 0 12.05 2z"/></svg>',
  telegram: '<svg aria-hidden="true" viewBox="0 0 24 24"><path class="db-icon-fill" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.14 6.86-1.4 6.62c-.1.47-.38.58-.77.36l-2.13-1.57-1.03.99c-.11.11-.21.21-.43.21l.15-2.16 3.94-3.56c.17-.15-.04-.24-.27-.09l-4.87 3.07-2.1-.66c-.46-.14-.47-.46.1-.68l8.2-3.16c.38-.14.71.09.6.65z"/></svg>',
  snapchat: '<svg aria-hidden="true" viewBox="0 0 24 24"><path class="db-icon-fill" d="M12.2 2.3c1.71.01 3.34.94 4.1 2.62.5 1.11.39 2.9.3 4.36-.01.17.01.29.06.35.09.1.29.14.5.14.3-.01.66-.12 1.03-.3.11-.06.25-.09.4-.09.28 0 .58.13.66.4.12.4-.31.7-1.02.99-.09.03-.2.07-.32.11-.4.13-1.02.32-1.19.72-.09.21-.05.47.11.77l.01.01c.06.14 1.42 3.24 4.44 3.74.19.03.33.2.32.4 0 .06-.02.13-.04.19-.24.56-1.28.97-3.17 1.25-.06.09-.12.36-.16.55-.04.16-.08.32-.13.49-.05.18-.18.3-.4.3h-.02c-.14 0-.32-.03-.53-.07-.34-.07-.75-.15-1.24-.15-.28 0-.57.02-.86.07-.56.09-1.03.43-1.53.79-.72.52-1.46 1.06-2.6 1.06s-1.87-.54-2.58-1.06c-.5-.36-.98-.7-1.54-.79a5.1 5.1 0 0 0-.86-.07c-.51 0-.92.09-1.24.15-.2.04-.38.07-.52.07-.28 0-.37-.17-.42-.32-.05-.16-.09-.33-.13-.49-.04-.19-.1-.46-.16-.55-1.89-.28-2.93-.69-3.17-1.26a.42.42 0 0 1-.04-.19c-.01-.2.13-.36.32-.4 3.02-.5 4.38-3.6 4.44-3.74l.01-.01c.16-.3.2-.56.11-.77-.17-.4-.79-.59-1.19-.72-.12-.04-.23-.08-.32-.11-.94-.37-1.09-.79-1.02-1.07.09-.36.55-.61.94-.4.37.18.73.29 1.03.3.24 0 .41-.06.5-.14.05-.06.07-.18.06-.35-.09-1.46-.2-3.25.3-4.36.75-1.68 2.38-2.6 4.09-2.61z"/></svg>',
  messenger: '<svg aria-hidden="true" viewBox="0 0 24 24"><path class="db-icon-fill" d="M12 2C6.24 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.19.16.14.26.35.27.57l.05 1.78c.02.57.6.94 1.12.71l1.99-.88c.17-.07.36-.09.54-.04.91.25 1.88.38 2.89.38 5.76 0 10-4.13 10-9.7C22 6.13 17.76 2 12 2zm6 7.55-2.94 4.66c-.47.74-1.47.92-2.17.4l-2.34-1.75a.6.6 0 0 0-.72 0l-3.16 2.4c-.42.32-.97-.18-.68-.62l2.94-4.66c.47-.74 1.47-.92 2.17-.4l2.34 1.75c.21.16.5.16.72 0l3.16-2.39c.42-.32.96.18.68.61z"/></svg>',
  linkedin: '<svg aria-hidden="true" viewBox="0 0 24 24"><path class="db-icon-fill" d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.44-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>',
};

// Footer social icons, in display order. Each shows only when its URL is set in
// admin Settings. Keys must match the settings keys and FOOTER_ICONS keys.
const SOCIAL_PLATFORMS = [
  ['instagram', 'Instagram'],
  ['tiktok', 'TikTok'],
  ['facebook', 'Facebook'],
  ['youtube', 'YouTube'],
  ['pinterest', 'Pinterest'],
  ['twitter', 'X (Twitter)'],
  ['threads', 'Threads'],
  ['whatsapp', 'WhatsApp'],
  ['telegram', 'Telegram'],
  ['snapchat', 'Snapchat'],
  ['messenger', 'Messenger'],
  ['linkedin', 'LinkedIn'],
];

// Footer = a distinct "Contact <shop>" band (kept prominent) + a runzie-style
// dark footer (Explore links + social + copyright) below it.
function siteFooter(settings = {}, navItems = []) {
  const shopName = settings.shop_name || DEFAULT_SHOP_NAME;
  const phoneDigits = settings.contact_phone ? settings.contact_phone.replace(/\D/g, '') : '';
  const phoneHref = phoneDigits ? '+' + (phoneDigits.length === 10 ? '1' + phoneDigits : phoneDigits) : '';

  const contactCard = (icon, label, value, href, external) => {
    if (!value) return '';
    const inner = `<span class="db-contact-band__icon">${FOOTER_ICONS[icon]}</span><span class="db-contact-band__text"><small>${label}</small><strong>${escapeHtml(value)}</strong></span>`;
    return href
      ? `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener"' : ''} class="db-contact-band__item">${inner}</a>`
      : `<div class="db-contact-band__item">${inner}</div>`;
  };

  const contactCards = [
    contactCard('location', 'Address', settings.contact_address),
    contactCard('phone', 'Phone', settings.contact_phone, phoneHref ? `tel:${phoneHref}` : ''),
    contactCard('instagram', 'Instagram', '@majestic_nailbox', settings.instagram, true),
    contactCard('tiktok', 'TikTok', '@majestic_press_on_nails', settings.tiktok, true),
  ].filter(Boolean).join('');

  // 1) Distinct, prominent contact band (its own section)
  const contactBand = contactCards
    ? `<section class="db-contact-band" aria-label="Store contact information"><div class="container">
        <h2 class="db-contact-band__title">Contact ${escapeHtml(shopName)}</h2>
        <div class="db-contact-band__grid">${contactCards}</div>
      </div></section>`
    : '';

  // 2) Runzie-style dark footer: 4 columns (Shop / Customer Support / Policies / Follow)
  const linkCol = (heading, links) => `<div class="db-site-footer__col">
        <h2 class="db-site-footer__heading">${escapeHtml(heading)}</h2>
        <nav class="db-site-footer__links">${links.map((l) => `<a href="${escapeHtml(l.url)}">${escapeHtml(l.label)}</a>`).join('')}</nav>
      </div>`;

  const shopCol = linkCol('Shop', [
    { label: 'Shop All', url: '/products' },
    { label: 'Best Sellers', url: '/collections/best-sellers-1' },
    { label: 'New Arrivals', url: '/collections/new-arrival' },
    { label: 'On Sale', url: '/collections/now-on-sale' },
  ]);

  const supportCol = linkCol('Customer Support', [
    { label: 'Contact Us', url: '/contact' },
    { label: 'About Us', url: '/about-us' },
    { label: 'FAQ', url: '/faq' },
    { label: 'Nail Tutorial', url: '/nail-tutorial' },
    { label: 'Blog', url: '/blog' },
  ]);

  const policiesCol = linkCol('Policies', [
    { label: 'Shipping Policy', url: '/pages/shipping-policy' },
    { label: 'Refund Policy', url: '/pages/refund-policy' },
    { label: 'Privacy Policy', url: '/pages/privacy-policy' },
    { label: 'Terms of Service', url: '/pages/terms-of-service' },
  ]);

  const socials = SOCIAL_PLATFORMS
    .map(([key, label]) =>
      settings[key] ? `<a href="${escapeHtml(settings[key])}" target="_blank" rel="noopener" aria-label="${label}">${FOOTER_ICONS[key]}</a>` : '')
    .filter(Boolean)
    .join('');

  const signupPercent = parseInt(settings.signup_discount_percent, 10) || 10;
  const followCol = `<div class="db-site-footer__col db-site-footer__col--follow">
        <h2 class="db-site-footer__heading">Join Our Email List</h2>
        <p class="db-site-footer__note">Sign up for our newsletter and receive ${signupPercent}% off your first order.</p>
        <form class="db-footer-signup" data-footer-signup novalidate>
          <input type="email" name="email" class="db-footer-signup__input" placeholder="Enter your email" autocomplete="email" aria-label="Email address" required>
          <button type="submit" class="db-footer-signup__btn" aria-label="Subscribe">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </button>
        </form>
        <div class="db-footer-signup__msg" data-footer-signup-msg hidden></div>
        ${socials ? `<div class="db-site-footer__social">${socials}</div>` : ''}
      </div>`;

  const darkFooter = `<footer class="db-site-footer" aria-label="Site footer"><div class="container">
        <div class="db-site-footer__grid">${shopCol}${supportCol}${policiesCol}${followCol}</div>
        <div class="db-site-footer__bottom">© ${new Date().getFullYear()} ${escapeHtml(shopName)}, All rights reserved.</div>
      </div></footer>`;

  return contactBand + darkFooter;
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

  const footer = siteFooter(settings, navigation?.footer || []);
  if (footer && !output.includes('db-site-footer')) {
    output = addBodyClass(output, 'db-dynamic-footer-enabled');
    output = output.replace('<m-footer', `${footer}\n<m-footer`);
  }
  // Config for the homepage email-signup popup (read by db-site.js).
  const signupConfig = {
    enabled: (settings?.signup_popup_enabled ?? 'true') !== 'false',
    percent: parseInt(settings?.signup_discount_percent, 10) || 10,
    title: settings?.signup_popup_title || 'Get a discount on your first set',
    subtitle: settings?.signup_popup_subtitle || 'Enter your email and we’ll send your personal discount code.',
  };
  const signupJson = JSON.stringify(signupConfig).replace(/</g, '\\u003c');
  output = output.replace(/<\/body>/i, `<script>window.__mncSignup=${signupJson};</script>\n</body>`);
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
