// Builds the inner HTML for each storefront page using the runzie theme's own
// CSS classes (m-section, m-product-card, m-price, m-button…) so DB-driven pages
// match the scraped homepage. Data comes from Postgres.
const { escapeHtml } = require('./layout');
const sections = require('./sections');

const e = escapeHtml;
const money = (v) => (v == null ? null : '$' + Number(v).toFixed(2));
const moneyCad = (v) => (v == null ? null : '$' + Number(v).toFixed(2) + ' CAD');
const PLACEHOLDER = '/images/Website_Photos_Square.jpg';
const DEFAULT_BANNER = '/images/Homepage_Banner_1_-_Desk_Top.jpg';

function videoEmbedInfo(value, background) {
  try {
    const url = new URL(String(value || ''), 'https://local.invalid');
    const host = url.hostname.replace(/^www\./, '');
    let id = '';
    if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
    if (host.endsWith('youtube.com')) {
      id = url.searchParams.get('v') || '';
      if (!id && /^\/(?:embed|shorts)\//.test(url.pathname)) id = url.pathname.split('/')[2] || '';
    }
    if (id) {
      const query = background
        ? `?autoplay=1&mute=1&controls=0&loop=1&playsinline=1&modestbranding=1&playlist=${encodeURIComponent(id)}`
        : '';
      return {
        embed: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}${query}`,
        thumbnail: `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`,
      };
    }
    if (host.endsWith('vimeo.com')) {
      id = url.pathname.split('/').filter(Boolean).find((part) => /^\d+$/.test(part)) || '';
      if (id) {
        const query = background ? '?autoplay=1&muted=1&loop=1&background=1' : '';
        return { embed: `https://player.vimeo.com/video/${id}${query}`, thumbnail: '' };
      }
    }
  } catch (error) {
    return null;
  }
  return null;
}

function videoFrame(src, title, background) {
  const info = videoEmbedInfo(src, background);
  if (!info) return '';
  const className = background ? ' class="db-video-embed db-video-embed--background"' : ' class="db-video-embed"';
  return `<iframe${className} src="${e(info.embed)}" title="${e(title || 'Video')}" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
}

const CONTACT_ICONS = {
  phone: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.33 1.84.56 2.8.69A2 2 0 0 1 22 16.92z"/></svg>',
  location: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  instagram: '<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" class="db-icon-fill"/></svg>',
  tiktok: '<svg aria-hidden="true" viewBox="0 0 24 24"><path class="db-icon-fill" d="M15.6 3c.4 2.2 1.7 3.6 4.1 3.8v3.1c-1.5.1-2.8-.3-4.1-1.1v6.3a6.1 6.1 0 1 1-5.3-6V12a3.2 3.2 0 1 0 2.2 3.1V3h3.1z"/></svg>',
};

function contactIcon(name) {
  return `<span class="db-contact-icon">${CONTACT_ICONS[name] || ''}</span>`;
}

function listFrom(value, fallback) {
  if (Array.isArray(value)) return value.filter(Boolean);
  const items = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : fallback;
}

function cmsSection(sections, key) {
  return sections && sections[key] ? sections[key] : { items: [], products: [] };
}

// The theme's scrolling promotion ("chạy chữ"), verbatim from the homepage
const marquee = () => sections.scrollingPromotion();

// Full-width hero banner using the collection/page image with overlaid title
function pageBanner({ image, title, subtitle, breadcrumbHtml }) {
  const img = image || DEFAULT_BANNER;
  return `
<section class="m-section" style="padding:0">
  <div class="container-full" style="padding-left:0;padding-right:0">
    <div class="db-banner">
      <img src="${e(img)}" alt="${e(title || '')}" loading="eager">
      <div class="db-banner__overlay">
        ${breadcrumbHtml ? `<div class="db-breadcrumb">${breadcrumbHtml}</div>` : ''}
        <h1 class="m-section__heading">${e(title || '')}</h1>
        ${subtitle ? `<div class="rte">${e(subtitle)}</div>` : ''}
      </div>
    </div>
  </div>
</section>`;
}

function onSale(p) {
  return p.compare_at_price && Number(p.compare_at_price) > Number(p.price);
}

// --- Product card (theme m-product-card) ---
function productCard(p, hoverUrl) {
  const main = p.image || PLACEHOLDER;
  const hover = hoverUrl || main;
  const sale = onSale(p);
  return `
<div class="m-product-card m-product-card--style-5 m-product-card--show-second-img" data-view="card">
  <div class="m-product-card__media">
    <a class="m-product-card__link m:block m:w-full" href="/products/${e(p.slug)}" aria-label="${e(p.title)}">
      <div class="m-product-card__main-image db-card-image">
        <img src="${e(main)}" alt="${e(p.title)}" width="1100" height="1100" loading="lazy" decoding="async" class="m:w-full m:h-full">
      </div>
      <div class="m-product-card__hover-image db-card-image">
        <img src="${e(hover)}" alt="${e(p.title)}" width="1100" height="1100" loading="lazy" decoding="async" class="m:w-full m:h-full">
      </div>
    </a>
    <div class="m-product-card__tags">
      ${sale ? '<span class="m-product-card__tag-name m-product-tag m-product-tag--sale m-gradient m-color-badge-sale">Sale</span>' : ''}
      ${!sale && p.is_featured ? '<span class="m-product-card__tag-name m-product-tag m-product-tag--new m-gradient m-color-dark">Best Seller</span>' : ''}
    </div>
  </div>
  <div class="m-product-card__content m:text-center">
    <div class="m-product-card__info">
      <h3 class="m-product-card__title">
        <a href="/products/${e(p.slug)}" class="m-product-card__name">${e(p.title)}</a>
      </h3>
      ${p.shape ? `<div class="m-product-card__reviews m:text-color-body" style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;opacity:.6">${e(p.shape)}${p.length ? ' · ' + e(p.length) : ''}</div>` : ''}
      <div class="m-product-card__price">
        <div class="m-price m:inline-flex m:items-center m:flex-wrap">
          ${sale
            ? `<div class="m-price__sale"><span class="m-price-item m-price-item--sale m-price-item--last">${money(p.price)}</span> <s class="m-price-item m-price-item--regular">${money(p.compare_at_price)}</s></div>`
            : `<div class="m-price__regular"><span class="m-price-item m-price-item--regular">${p.price != null ? money(p.price) : 'Contact for price'}</span></div>`}
        </div>
      </div>
    </div>
  </div>
</div>`;
}

function asSeenCard(p) {
  const media = p.video_poster || p.image || PLACEHOLDER;
  const thumb = p.image || media;
  return `
    <a href="/products/${e(p.slug)}" class="db-as-seen-card" aria-label="${e(p.title)}">
      <div class="db-as-seen-card__media">
        <img src="${e(media)}" alt="${e(p.title)}" loading="lazy" decoding="async">
        ${p.video_poster || p.video ? `<span class="db-as-seen-card__play" aria-hidden="true">
          <svg viewBox="0 0 32 32"><path d="M23.5 15.134a1 1 0 0 1 0 1.732l-11.25 6.495a1 1 0 0 1-1.5-.866V9.505a1 1 0 0 1 1.5-.866l11.25 6.495z"/></svg>
        </span>` : ''}
      </div>
      <div class="db-as-seen-card__product">
        <img src="${e(thumb)}" alt="${e(p.title)}" loading="lazy" decoding="async">
        <span>
          <strong>${e(p.title)}</strong>
          <small>${p.price != null ? money(p.price) : 'Contact for price'}</small>
        </span>
      </div>
    </a>`;
}

function header(extraCss) {
  const links = ['<link rel="stylesheet" href="/css/db-pages.css">'];
  (extraCss || []).forEach((href) => links.push(`<link rel="stylesheet" href="${e(href)}">`));
  return links.join('\n');
}

function sectionHeading(title, desc) {
  return `
  <div class="m-section__header m:text-center db-head">
    <h2 class="m-section__heading h2">${e(title)}</h2>
    ${desc ? `<div class="m-section__description rte">${e(desc)}</div>` : ''}
  </div>`;
}

// --- Products listing page ---
function productsPage({ products, collections, shapes, lengths, filters, page, totalPages, total, bannerImage, sections }) {
  const col = filters.collection ? collections.find((c) => c.slug === filters.collection) : null;
  const colTitle = col ? col.title : null;
  const hero = cmsSection(sections, 'hero');
  const bannerTitle = colTitle || hero.title || 'Shop All Nails';
  const bannerSub = col && col.description ? col.description : (hero.subtitle || 'Find your perfect press-on set.');
  const bannerImg = (col && col.image) || hero.image || bannerImage || DEFAULT_BANNER;
  const bannerBreadcrumb = `<a href="/">Home</a> / Shop${colTitle ? ' / ' + e(colTitle) : ''}`;

  const filterLink = (key, val) => {
    const o = Object.assign({}, filters, { [key]: val, page: undefined });
    const qs = Object.entries(o).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return '/products' + (qs ? '?' + qs : '');
  };
  const pageLink = (p) => {
    const o = Object.assign({}, filters, { page: p });
    const qs = Object.entries(o).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return '/products?' + qs;
  };

  const filtersHtml = `
  <button class="db-filter-toggle" type="button" aria-expanded="false" aria-controls="db-product-filters">
    <span>Filters &amp; categories</span><span aria-hidden="true">+</span>
  </button>
  <aside class="db-filters" id="db-product-filters">
    <form class="db-search" method="get" action="/products">
      <input type="text" name="q" placeholder="Search…" value="${e(filters.q || '')}">
      <button class="m-button m-button--primary" type="submit" style="padding:8px 14px">Go</button>
    </form>
    <div class="db-filters__group">
      <h4>Collections</h4>
      <a href="/products" class="${!filters.collection ? 'is-active' : ''}">All</a>
      ${collections.map((c) => `<a href="/products?collection=${e(c.slug)}" class="${filters.collection === c.slug ? 'is-active' : ''}">${e(c.title)}</a>`).join('')}
    </div>
    <div class="db-filters__group">
      <h4>Shape</h4>
      ${shapes.map((s) => `<a href="${filterLink('shape', s)}" class="${filters.shape === s ? 'is-active' : ''}">${e(s)}</a>`).join('')}
    </div>
    <div class="db-filters__group">
      <h4>Length</h4>
      ${lengths.map((l) => `<a href="${filterLink('length', l)}" class="${filters.length === l ? 'is-active' : ''}">${e(l)}</a>`).join('')}
    </div>
  </aside>`;

  const cards = products.length
    ? `<div class="db-grid db-grid--4">${products.map((p) => productCard(p, p.hover_image)).join('')}</div>`
    : '<div class="db-empty"><h3>No products found</h3><p>Try clearing your filters.</p><a class="m-button m-button--primary" href="/products">View all</a></div>';

  let pagination = '';
  if (totalPages > 1) {
    let items = '';
    if (page > 1) items += `<a href="${pageLink(page - 1)}">←</a>`;
    for (let p = 1; p <= totalPages; p++) {
      items += p === page ? `<span class="is-current">${p}</span>` : `<a href="${pageLink(p)}">${p}</a>`;
    }
    if (page < totalPages) items += `<a href="${pageLink(page + 1)}">→</a>`;
    pagination = `<div class="db-pagination">${items}</div>`;
  }

  return `${header()}
${pageBanner({ image: bannerImg, title: bannerTitle, subtitle: bannerSub, breadcrumbHtml: bannerBreadcrumb })}
${marquee()}
<section class="m-section db-page">
  <div class="container m-section-my m-section-py">
    <div class="db-shop">
      ${filtersHtml}
      <div>
        <div class="db-toolbar">
          <span class="db-count">${total} product${total === 1 ? '' : 's'}</span>
          <form method="get" action="/products" id="db-sort">
            ${Object.entries(filters).filter(([k, v]) => v && k !== 'sort').map(([k, v]) => `<input type="hidden" name="${e(k)}" value="${e(v)}">`).join('')}
            <select name="sort" onchange="document.getElementById('db-sort').submit()">
              <option value="">Sort: Featured</option>
              <option value="newest" ${filters.sort === 'newest' ? 'selected' : ''}>Newest</option>
              <option value="price-asc" ${filters.sort === 'price-asc' ? 'selected' : ''}>Price: Low to High</option>
              <option value="price-desc" ${filters.sort === 'price-desc' ? 'selected' : ''}>Price: High to Low</option>
            </select>
          </form>
        </div>
        ${cards}
        ${pagination}
      </div>
    </div>
  </div>
</section>
<script>
(() => {
  const button = document.querySelector('.db-filter-toggle');
  const filtersPanel = document.querySelector('#db-product-filters');
  if (!button || !filtersPanel) return;
  button.addEventListener('click', () => {
    const isOpen = filtersPanel.classList.toggle('is-open');
    button.setAttribute('aria-expanded', String(isOpen));
    button.lastElementChild.textContent = isOpen ? '-' : '+';
  });
})();
</script>`;
}

// --- Product detail page ---
function productPage({ product, gallery, variants, collections, related, settings, sections }) {
  const sale = onSale(product);
  const images = Array.from(new Set((gallery || []).filter(Boolean)));
  const media = images.map((src) => ({ type: 'image', src, poster: '' }));
  if (product.video) {
    const embedInfo = videoEmbedInfo(product.video, false);
    media.push({
      type: 'video',
      src: product.video,
      embed: embedInfo?.embed || '',
      poster: product.video_poster || embedInfo?.thumbnail || images[0] || PLACEHOLDER,
    });
  }
  if (!media.length) media.push({ type: 'image', src: PLACEHOLDER, poster: '' });

  const storedVariants = (variants || []).filter((variant) => variant && variant.title);
  const fallbackSizes = listFrom(product.size_options, ['XS', 'S', 'M', 'L']);
  const productVariants = storedVariants.length
    ? storedVariants
    : fallbackSizes.map((title, index) => ({
      title,
      sku: index === 0 ? product.sku : '',
      price: product.price,
      compare_at_price: product.compare_at_price,
      is_available: true,
    }));
  const selectableVariants = productVariants.filter((variant) => !/^default title$/i.test(variant.title));
  const initialVariant = productVariants.find((variant) => variant.is_available !== false) || productVariants[0] || {};
  const sku = initialVariant.sku || product.sku || '';
  const shopName = settings.shop_name || 'Majestic Nailbox';
  const phoneDigits = settings.contact_phone ? settings.contact_phone.replace(/\D/g, '') : '';
  const phoneHref = phoneDigits ? '+' + (phoneDigits.length === 10 ? '1' + phoneDigits : phoneDigits) : '';

  const renderMainMedia = (item) => item.type === 'video'
    ? (item.embed
      ? `<iframe class="db-video-embed" src="${e(item.embed)}" title="${e(product.title)} video" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`
      : `<video controls playsinline muted loop poster="${e(item.poster || '')}" src="${e(item.src)}"></video>`)
    : `<img src="${e(item.src)}" alt="${e(product.title)}" id="db-main-img">`;

  const thumbs = media.map((item, i) => `
      <button type="button" class="db-product-media__thumb${i === 0 ? ' is-active' : ''}" data-type="${e(item.type)}" data-src="${e(item.src)}" data-embed="${e(item.embed || '')}" data-poster="${e(item.poster || '')}" aria-label="View media ${i + 1}">
        <img src="${e(item.type === 'video' ? (item.poster || PLACEHOLDER) : item.src)}" alt="${e(product.title)} thumbnail ${i + 1}">
        ${item.type === 'video' ? '<span class="db-product-media__play">Play</span>' : ''}
      </button>`).join('');

  const sizeButtons = selectableVariants.map((variant) => {
    const selected = variant.title === initialVariant.title;
    return `
    <button type="button" class="db-size-option${selected ? ' is-selected' : ''}" data-size="${e(variant.title)}" data-sku="${e(variant.sku || '')}" data-price="${e(variant.price == null ? '' : variant.price)}" data-compare-price="${e(variant.compare_at_price == null ? '' : variant.compare_at_price)}"${variant.is_available === false ? ' disabled' : ''}>${e(variant.title)}</button>`;
  }).join('');
  const productCollections = (collections || []).length
    ? collections
    : (product.collection_slug ? [{ slug: product.collection_slug, title: product.collection_title }] : []);
  const collectionLinks = productCollections
    .map((collection) => `<a href="/collections/${e(collection.slug)}">${e(collection.title)}</a>`)
    .join(' / ');

  const contactButtons = [
    phoneHref ? `<a class="m-button m-button--primary db-contact-btn" href="tel:${phoneHref}">${contactIcon('phone')}<span>${e(settings.contact_phone)}</span></a>` : '',
    settings.instagram ? `<a class="m-button m-button--secondary db-contact-btn" href="${e(settings.instagram)}" target="_blank" rel="noopener" aria-label="Instagram">${contactIcon('instagram')}<span>Instagram</span></a>` : '',
    settings.tiktok ? `<a class="m-button m-button--secondary db-contact-btn" href="${e(settings.tiktok)}" target="_blank" rel="noopener" aria-label="TikTok">${contactIcon('tiktok')}<span>TikTok</span></a>` : '',
    settings.contact_email ? `<a class="m-button m-button--secondary db-contact-btn" href="mailto:${e(settings.contact_email)}?subject=${encodeURIComponent('Enquiry: ' + product.title)}">Email</a>` : '',
  ].filter(Boolean).join('');

  const infoRow = (label, value) => value ? `<div><span>${e(label)}</span><strong>${e(value)}</strong></div>` : '';
  const accordion = (title, body, open) => `
    <details class="db-product-accordion"${open ? ' open' : ''}>
      <summary>${e(title)}</summary>
      <div class="db-product-accordion__body">${body}</div>
    </details>`;

  const contactSection = cmsSection(sections, 'contact');
  const promiseItems = cmsSection(sections, 'promises').items || [];
  const reasonsSection = cmsSection(sections, 'reasons');
  const accordionItems = cmsSection(sections, 'accordions').items || [];
  const reasonItems = (reasonsSection.items || []).map((item) => `
    <article class="db-product-reason">
      ${item.image ? `<img src="${e(item.image)}" alt="${e(item.title || '')}" loading="lazy">` : ''}
      <div>
        <h3>${e(item.title || '')}</h3>
        <div class="rte">${item.body_html || ''}</div>
      </div>
    </article>`).join('');
  const productAccordions = [
    accordion('Product Description', `<p>${e(product.description || '')}</p>`, true),
    ...accordionItems.map((item) => accordion(
      item.title || '',
      `${item.body_html || ''}${item.image ? `<img class="db-size-guide-img" src="${e(item.image)}" alt="${e(item.title || '')}" loading="lazy">` : ''}${item.link ? `<p><a href="${e(item.link)}">Learn more</a></p>` : ''}`
    )),
  ].join('');

  const relatedHtml = related.length
    ? `<div style="margin-top:72px">${sectionHeading('You May Also Like')}<div class="db-grid db-grid--4">${related.map((p) => productCard(p, p.hover_image)).join('')}</div></div>`
    : '';

  return `${header(['/css/product.css'])}
<section class="m-section db-page db-product-clone-section">
  <div class="container m-section-my m-section-py">
    <div class="db-breadcrumb"><a href="/">Home</a> / <a href="/products">Shop</a>${productCollections[0] ? ` / <a href="/collections/${e(productCollections[0].slug)}">${e(productCollections[0].title)}</a>` : ''} / ${e(product.title)}</div>
    <div class="db-product-clone">
      <div class="db-product-media" data-db-product-gallery>
        <div class="db-product-media__stage" data-main-media>${renderMainMedia(media[0])}</div>
        <div class="db-product-media__thumbs">${thumbs}</div>
      </div>
      <div class="db-product-panel">
        ${collectionLinks ? `<div class="db-product-kicker">${collectionLinks}</div>` : ''}
        <h1 class="m-product-title">${e(product.title)}</h1>
        <div class="db-review-line"><span>★★★★★</span><span>No reviews yet</span></div>
        <div class="db-product-price" data-product-price>
          <span data-current-price>${initialVariant.price != null ? moneyCad(initialVariant.price) : (product.price != null ? moneyCad(product.price) : 'Contact for price')}</span>
          <span class="was" data-current-compare${initialVariant.compare_at_price || sale ? '' : ' hidden'}>${initialVariant.compare_at_price ? moneyCad(initialVariant.compare_at_price) : (sale ? moneyCad(product.compare_at_price) : '')}</span>
        </div>
        <div class="db-product-info-row">
          ${sku ? `<div><span>SKU</span><strong data-selected-sku>${e(sku)}</strong></div>` : ''}
          ${infoRow('Shape', product.shape)}
          ${infoRow('Length', product.length)}
        </div>
        ${selectableVariants.length ? `<div class="db-size-picker">
          <div class="db-size-picker__head">
            <span>Size:</span>
            <strong data-selected-size>${e(initialVariant.title || '')}</strong>
          </div>
          <div class="db-size-picker__options">${sizeButtons}</div>
        </div>` : ''}
        <div class="db-product-contact-card">
          <h2>${e(contactSection.title || 'Contact shop to order')}</h2>
          <p>${e((contactSection.subtitle || '').replace(/our studio/gi, shopName))}</p>
          <div class="db-product-contact-details">
            ${settings.contact_address ? `<div>${contactIcon('location')}<span><small>Address</small>${e(settings.contact_address)}</span></div>` : ''}
            ${phoneHref ? `<a href="tel:${phoneHref}">${contactIcon('phone')}<span><small>Phone</small>${e(settings.contact_phone)}</span></a>` : ''}
          </div>
          <div class="db-contact-btns">${contactButtons}</div>
        </div>
        ${promiseItems.length ? `<ul class="db-product-promises">${promiseItems.map((item) => `<li>${e(item.title || '')}</li>`).join('')}</ul>` : ''}
        <div class="db-product-accordions">${productAccordions}</div>
      </div>
    </div>
    ${reasonItems ? `<section class="db-product-reasons-section">
      <h2>${e(reasonsSection.title || '')}</h2>
      <div class="db-product-reasons">${reasonItems}</div>
    </section>` : ''}
    ${relatedHtml}
  </div>
</section>
${marquee()}
<script>
(function () {
  var gallery = document.querySelector('[data-db-product-gallery]');
  if (!gallery) return;
  var stage = gallery.querySelector('[data-main-media]');
  var altText = ${JSON.stringify(product.title)};
  gallery.querySelectorAll('.db-product-media__thumb').forEach(function (btn) {
    btn.addEventListener('click', function () {
      gallery.querySelectorAll('.db-product-media__thumb').forEach(function (x) { x.classList.remove('is-active'); });
      btn.classList.add('is-active');
      stage.replaceChildren();
      if (btn.dataset.type === 'video') {
        if (btn.dataset.embed) {
          var frame = document.createElement('iframe');
          frame.className = 'db-video-embed';
          frame.src = btn.dataset.embed;
          frame.title = altText + ' video';
          frame.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture';
          frame.allowFullscreen = true;
          stage.appendChild(frame);
        } else {
          var video = document.createElement('video');
          video.controls = true;
          video.playsInline = true;
          video.muted = true;
          video.loop = true;
          video.autoplay = true;
          video.poster = btn.dataset.poster;
          video.src = btn.dataset.src;
          stage.appendChild(video);
        }
      } else {
        var img = document.createElement('img');
        img.src = btn.dataset.src;
        img.alt = altText;
        stage.appendChild(img);
      }
    });
  });
  document.querySelectorAll('.db-size-option').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.db-size-option').forEach(function (x) { x.classList.remove('is-selected'); });
      btn.classList.add('is-selected');
      var selected = document.querySelector('[data-selected-size]');
      if (selected) selected.textContent = btn.dataset.size;
      var sku = document.querySelector('[data-selected-sku]');
      if (sku && btn.dataset.sku) sku.textContent = btn.dataset.sku;
      var price = document.querySelector('[data-current-price]');
      if (price && btn.dataset.price) price.textContent = '$' + Number(btn.dataset.price).toFixed(2) + ' CAD';
      var compare = document.querySelector('[data-current-compare]');
      if (compare) {
        if (btn.dataset.comparePrice) {
          compare.textContent = '$' + Number(btn.dataset.comparePrice).toFixed(2) + ' CAD';
          compare.hidden = false;
        } else {
          compare.textContent = '';
          compare.hidden = true;
        }
      }
    });
  });
})();
</script>`;
}

// --- Blog list ---
function blogPage({ posts, bannerImage, sections }) {
  const heroSection = cmsSection(sections, 'hero');
  const featured = posts[0];
  const latest = posts.slice(1);
  const arrow = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14M14 7l5 5-5 5"/></svg>';
  const meta = (post) => `${fmtDate(post.published_at)}<span></span>${readingMinutes(post.content)} min read`;
  const card = (post) => `
    <article class="db-journal-card">
      <a href="/blog/${e(post.slug)}" class="db-journal-card__media">
        <img src="${e(post.cover_image || PLACEHOLDER)}" alt="${e(post.title)}" loading="lazy">
      </a>
      <div class="db-journal-card__meta">${meta(post)}</div>
      <h2><a href="/blog/${e(post.slug)}">${e(post.title)}</a></h2>
      <p>${e(post.excerpt || '')}</p>
      <a href="/blog/${e(post.slug)}" class="db-journal-read">Read article ${arrow}</a>
    </article>`;

  const content = featured ? `
    <section class="db-journal-featured">
      <a href="/blog/${e(featured.slug)}" class="db-journal-featured__media">
        <img src="${e(featured.cover_image || PLACEHOLDER)}" alt="${e(featured.title)}">
      </a>
      <div class="db-journal-featured__content">
        <div class="db-journal-label">Featured story</div>
        <div class="db-journal-card__meta">${meta(featured)}</div>
        <h2><a href="/blog/${e(featured.slug)}">${e(featured.title)}</a></h2>
        <p>${e(featured.excerpt || '')}</p>
        <a href="/blog/${e(featured.slug)}" class="db-journal-read">Read article ${arrow}</a>
      </div>
    </section>
    ${latest.length ? `
      <section class="db-journal-latest">
        <div class="db-journal-section-head">
          <div>
            <div class="db-journal-label">The latest</div>
            <h2>Stories from the studio</h2>
          </div>
          <span>${latest.length} article${latest.length === 1 ? '' : 's'}</span>
        </div>
        <div class="db-journal-grid">${latest.map(card).join('')}</div>
      </section>` : ''}`
    : '<div class="db-empty"><h3>No posts yet</h3><p>Check back soon!</p></div>';

  return `${header()}
<section class="db-journal-hero">
  <img src="${e(heroSection.image || bannerImage || (featured && featured.cover_image) || DEFAULT_BANNER)}" alt="" aria-hidden="true">
  <div class="db-journal-hero__overlay"></div>
  <div class="container db-journal-hero__content">
    <div class="db-breadcrumb"><a href="/">Home</a> / Blog</div>
    ${heroSection.eyebrow ? `<div class="db-journal-label">${e(heroSection.eyebrow)}</div>` : ''}
    <h1>${e(heroSection.title || 'Journal')}</h1>
    ${heroSection.subtitle ? `<p>${e(heroSection.subtitle)}</p>` : ''}
  </div>
</section>
<section class="db-journal-page">
  <div class="container">
    ${content}
  </div>
</section>
${marquee()}`;
}

// --- Blog post ---
function postPage({ post, recent, sections }) {
  const cta = cmsSection(sections, 'cta');
  const arrow = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14M14 7l5 5-5 5"/></svg>';
  const author = post.author || 'Majestic Nailbox';
  const initials = author
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
  const readTime = readingMinutes(post.content);
  const publishedIso = new Date(post.published_at).toISOString();
  const recentHtml = recent.length
    ? `<section class="db-article-related">
        <div class="db-journal-section-head">
          <div>
            <div class="db-journal-label">Keep reading</div>
            <h2>More from the journal</h2>
          </div>
          <a href="/blog">View all</a>
        </div>
        <div class="db-journal-grid">${recent.map((p) => `
          <article class="db-journal-card">
            <a href="/blog/${e(p.slug)}" class="db-journal-card__media">
              <img src="${e(p.cover_image || PLACEHOLDER)}" alt="${e(p.title)}" loading="lazy">
            </a>
            <div class="db-journal-card__meta">${fmtDate(p.published_at)}<span></span>${readingMinutes(p.content)} min read</div>
            <h2><a href="/blog/${e(p.slug)}">${e(p.title)}</a></h2>
            ${p.excerpt ? `<p>${e(p.excerpt)}</p>` : ''}
            <a href="/blog/${e(p.slug)}" class="db-journal-read">Read article ${arrow}</a>
          </article>`).join('')}</div>
      </section>`
    : '';

  return `${header()}
<div class="db-article-progress" aria-hidden="true"><span data-article-progress></span></div>
<article class="db-article-page" data-article-page>
  <header class="db-article-header">
    <div class="container">
      <nav class="db-breadcrumb db-article-breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a><span aria-hidden="true">/</span><a href="/blog">Journal</a>
      </nav>
      <div class="db-article-header__inner">
        <div class="db-journal-label">Nail notes</div>
        <h1>${e(post.title)}</h1>
        ${post.excerpt ? `<p>${e(post.excerpt)}</p>` : ''}
        <div class="db-article-byline">
          <span class="db-article-avatar" aria-hidden="true">${e(initials || 'MN')}</span>
          <span class="db-article-byline__text">
            <strong>${e(author)}</strong>
            <small><time datetime="${e(publishedIso)}">${fmtDate(post.published_at)}</time><i></i>${readTime} min read</small>
          </span>
        </div>
      </div>
    </div>
  </header>
  <figure class="container db-article-cover">
    <img src="${e(post.cover_image || PLACEHOLDER)}" alt="${e(post.title)}" width="1400" height="700" fetchpriority="high">
  </figure>
  <div class="container db-article-layout">
    <aside class="db-article-aside">
      <div class="db-article-aside__panel">
        <div class="db-article-aside__label">In this article</div>
        <nav class="db-article-toc" aria-label="Table of contents" data-article-toc></nav>
        <div class="db-article-aside__actions">
          <button type="button" data-share-article>Share article</button>
          <span class="db-article-share-status" data-share-status aria-live="polite"></span>
          <a href="/blog">All articles ${arrow}</a>
        </div>
      </div>
    </aside>
    <div class="db-article-content">
      <div class="db-article__body" data-article-body>${post.content || ''}</div>
      <footer class="db-article-author">
        <span class="db-article-avatar" aria-hidden="true">${e(initials || 'MN')}</span>
        <span>
          <small>Written by</small>
          <strong>${e(author)}</strong>
        </span>
      </footer>
    </div>
  </div>
  <section class="db-article-shop">
    <div class="container">
      <div>
        ${cta.eyebrow ? `<div class="db-journal-label">${e(cta.eyebrow)}</div>` : ''}
        <h2>${e(cta.title || '')}</h2>
        ${cta.subtitle ? `<p>${e(cta.subtitle)}</p>` : ''}
      </div>
      <div class="db-article-shop__actions">
        ${cta.button_link ? `<a class="m-button db-article-shop__primary" href="${e(cta.button_link)}">${e(cta.button_text || 'Browse nail sets')}</a>` : ''}
        <a class="m-button db-article-shop__secondary" href="/contact">Contact the studio</a>
      </div>
    </div>
  </section>
  <div class="container">
    ${recentHtml}
  </div>
</article>
${marquee()}
<script>
(() => {
  const article = document.querySelector('[data-article-page]');
  const body = article && article.querySelector('[data-article-body]');
  const toc = article && article.querySelector('[data-article-toc]');
  const progress = document.querySelector('[data-article-progress]');

  if (body && toc) {
    const headings = Array.from(body.querySelectorAll('h2, h3'));
    const used = new Set();
    headings.forEach((heading, index) => {
      let id = heading.id || heading.textContent.toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'section-' + (index + 1);
      const base = id;
      let suffix = 2;
      while (used.has(id) || document.getElementById(id)) id = base + '-' + suffix++;
      used.add(id);
      heading.id = id;
      const link = document.createElement('a');
      link.href = '#' + id;
      link.textContent = heading.textContent;
      if (heading.tagName === 'H3') link.className = 'is-subheading';
      toc.appendChild(link);
    });
    if (!headings.length) toc.closest('.db-article-aside__panel').classList.add('has-no-toc');
  }

  const updateProgress = () => {
    if (!article || !progress) return;
    const start = article.offsetTop;
    const distance = Math.max(1, article.offsetHeight - window.innerHeight);
    const value = Math.min(1, Math.max(0, (window.scrollY - start) / distance));
    progress.style.transform = 'scaleX(' + value + ')';
  };
  updateProgress();
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);

  const shareButton = article && article.querySelector('[data-share-article]');
  const shareStatus = article && article.querySelector('[data-share-status]');
  if (shareButton) {
    shareButton.addEventListener('click', async () => {
      try {
        if (navigator.share) {
          await navigator.share({ title: document.title, url: window.location.href });
        } else {
          await navigator.clipboard.writeText(window.location.href);
          if (shareStatus) shareStatus.textContent = 'Link copied';
        }
      } catch (error) {
        if (error && error.name !== 'AbortError' && shareStatus) shareStatus.textContent = 'Copy the URL above';
      }
    });
  }
})();
</script>`;
}

// --- Contact ---
function contactPage({ settings, sections, sent }) {
  const heroSection = cmsSection(sections, 'hero');
  const phoneDigits = settings.contact_phone ? settings.contact_phone.replace(/\D/g, '') : '';
  const phone = phoneDigits ? '+' + (phoneDigits.length === 10 ? '1' + phoneDigits : phoneDigits) : '';
  const item = (ic, title, body) => `<div class="db-contact__item"><span class="ic">${ic}</span><div><h4>${title}</h4>${body}</div></div>`;
  return `${header()}
${pageBanner({ image: heroSection.image || settings.contact_banner, title: heroSection.title || 'Get in Touch', subtitle: heroSection.subtitle || '', breadcrumbHtml: '<a href="/">Home</a> / Contact' })}
${marquee()}
<section class="m-section db-page">
  <div class="container m-section-my m-section-py">
    <div class="db-contact">
      <div>
        ${phone ? item(contactIcon('phone'), 'Phone', `<a href="tel:${phone}">${e(settings.contact_phone)}</a>`) : ''}
        ${settings.contact_address ? item(contactIcon('location'), 'Address', `<p>${e(settings.contact_address)}</p>`) : ''}
        ${settings.instagram ? item(contactIcon('instagram'), 'Instagram', `<a href="${e(settings.instagram)}" target="_blank" rel="noopener">@majestic_nailbox</a>`) : ''}
        ${settings.tiktok ? item(contactIcon('tiktok'), 'TikTok', `<a href="${e(settings.tiktok)}" target="_blank" rel="noopener">@majestic_press_on_nails</a>`) : ''}
        ${settings.contact_email ? item('', 'Email', `<a href="mailto:${e(settings.contact_email)}">${e(settings.contact_email)}</a>`) : ''}
        ${settings.contact_hours ? item('', 'Hours', `<p>${e(settings.contact_hours)}</p>`) : ''}
      </div>
      <div class="db-form">
        <h3>Send us a message</h3>
        ${sent ? '<p class="db-form-success" role="status">Thanks! Your message has been saved. We will get back to you shortly.</p>' : ''}
        <form method="post" action="/contact">
          <div class="field"><label for="contact-name">Name</label><input id="contact-name" name="name" type="text" maxlength="180" required></div>
          <div class="field"><label for="contact-email">Email</label><input id="contact-email" name="email" type="email" maxlength="240" required></div>
          <div class="field"><label for="contact-phone">Phone (optional)</label><input id="contact-phone" name="phone" type="tel" maxlength="80"></div>
          <div class="field"><label for="contact-message">Message</label><textarea id="contact-message" name="message" rows="5" maxlength="5000" required></textarea></div>
          <button type="submit" class="m-button m-button--primary m:w-full">Send Message</button>
        </form>
      </div>
    </div>
  </div>
</section>`;
}

// --- About page ---
const ABOUT_ICON_PATHS = {
  heart: '<path d="M41.015 14.742C27.191-11.367-3.113 6.153 2.742 35.739c5.73 28.951 38.274 44.26 38.274 44.26s32.547-15.31 38.273-44.26c5.854-29.586-24.446-47.106-38.274-20.997Z"></path>',
  eco: '<path d="M55.751 44.921c8.592-14.035 27.427-4.617 23.788 11.287C75.978 71.77 55.751 80 55.751 80s-20.229-8.23-23.788-23.792c-3.639-15.904 15.194-25.323 23.788-11.287Z"></path><path d="M73.656 40.142c.047-.751.071-1.509.071-2.272C73.726 18.06 57.67 2 37.863 2S2 18.06 2 37.87c0 19.811 16.056 35.87 35.863 35.87a36.13 36.13 0 0 0 6.006-.501"></path><path d="M27.249 3.637s10.498 7.661 5.503 14.39c-4.995 6.729-5.912 8.462-6.218 14.987-.306 6.525-1.771 19.86-21.425 19.207M52.176 5.104s-11.495 5.174-8.539 12.719c2.956 7.544 7.819 3.101 12.13 7.035 5.81 5.302 12.48 3.658 15.937 1.725"></path>',
  clock: '<path d="M41 74.932c18.586 0 33.653-15.077 33.653-33.676C74.653 22.657 59.586 7.58 41 7.58S7.347 22.657 7.347 41.256c0 18.599 15.067 33.676 33.653 33.676Z"></path><path d="M41 80.052c21.54 0 39-17.473 39-39.026C80 19.472 62.54 2 41 2S2 19.473 2 41.026c0 21.553 17.46 39.026 39 39.026Z"></path><path d="M41 22.647v18.379h18.375M41 12.633v2.765M69.093 41.238l-2.763.031M40.822 69.668l-.061-2.764M12.097 41.698l2.762-.093M54.702 16.399l-1.34 2.419M65.414 55.047l-2.432-1.313M26.914 66.198 28.2 63.75M15.341 27.799l2.461 1.259M65.207 27.147l-2.366 1.428M55.246 65.995l-1.454-2.351M16.315 56.463l2.333-1.48M25.405 17.401l1.506 2.318"></path>',
  truck: '<path d="M7.238 68.717H1.867V2.12H58.4v16.736h3.886c9.755 0 17.663 7.908 17.663 17.663v32.199h-5.917M55.781 68.717H25.487"></path><path d="M58.334 42.124h15.068v-4.27c0-6.82-5.53-12.35-12.351-12.35h-2.718v16.62M73.909 70.236a9.125 9.125 0 1 0-18.013-2.931 9.125 9.125 0 0 0 18.013 2.93ZM25.367 70.235a9.125 9.125 0 1 0-18.012-2.931 9.125 9.125 0 0 0 7.54 10.471 9.125 9.125 0 0 0 10.472-7.54Z"></path><path d="M13.723 77.507c-3.966.658-7.937 1.51-11.857 2.593M60.373 76.736c-10.512-1.212-24.298-1.969-38.645-.451M79.768 80.121s-4.96-1.222-12.975-2.395"></path>',
};

function aboutFeature({ icon, title, body_html: bodyHtml }) {
  const iconPath = ABOUT_ICON_PATHS[icon === 'leaf' ? 'eco' : icon] || ABOUT_ICON_PATHS.heart;
  return `
    <div class="db-about-feature">
      <svg aria-hidden="true" focusable="false" viewBox="0 0 82 82">${iconPath}</svg>
      <h3>${e(title)}</h3>
      <div class="rte">${bodyHtml || ''}</div>
    </div>`;
}

function aboutStorySection({ image, title, body_html: bodyHtml, button_text: buttonText, button_link: buttonLink, section_type: sectionType }) {
  const reverse = sectionType === 'story-reverse';
  return `
<section class="m-section db-about-story${reverse ? ' db-about-story--reverse db-about-story--muted' : ''}">
  <div class="container-fluid m-section-my m-section-py">
    <div class="db-about-story__inner">
      <div class="db-about-story__media">
        <img src="${e(image)}" alt="${e(title)}" loading="lazy">
      </div>
      <div class="db-about-story__content">
        <h2 class="m-section__heading h2">${e(title)}</h2>
        <div class="rte">${bodyHtml}</div>
        ${buttonLink ? `<a class="m-button m-button--secondary" href="${e(buttonLink)}">${e(buttonText || 'Learn more')}</a>` : ''}
      </div>
    </div>
  </div>
</section>`;
}

function aboutPage({ sections }) {
  const ordered = Object.values(sections || {}).sort((a, b) => a.sort_order - b.sort_order);
  const content = ordered.map((section) => {
    if (section.section_type === 'items') {
      return `<section class="m-section db-about-features">
        <div class="container-fluid m-section-my m-section-py">
          <div class="db-about-features__grid">${(section.items || []).map((item) => aboutFeature({ ...item, icon: item.label })).join('')}</div>
        </div>
      </section>`;
    }
    return aboutStorySection(section);
  }).join('');
  return `${header()}<div class="db-about">${content}</div>`;
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function readingMinutes(content) {
  const words = String(content || '')
    .replace(/<[^>]+>/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function notFound() {
  return `${header()}
<section class="m-section db-page"><div class="container m-section-my m-section-py db-empty" style="padding:120px 20px">
  <h1 class="m-section__heading h2" style="font-size:64px">404</h1>
  <p>We couldn't find that page.</p>
  <a class="m-button m-button--primary" href="/">Back to Home</a>
</div></section>`;
}

// --- Home page (scraped runzie theme) ---
function homePageLegacy({ banners, featured, collections, posts, asSeenProducts, settings }) {
  const shop = settings.shop_name || 'Majestic Nailbox';
  const instagram = settings.instagram || '#';
  const arrow = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14M14 7l5 5-5 5"/></svg>';

  // Hero slideshow
  const heroSlides = (banners || []).map((b) => `
    <div class="m-slide">
      <div class="m-slide__image m-slide__image--adapt" style="--aspect-ratio: 1.9101">
        <img src="${e(b.image || PLACEHOLDER)}" alt="${e(b.title || '')}" loading="eager">
        <div class="m-slide__overlay"></div>
        <div class="m-slide__content container">
          <div class="m-slide__content-inner">
            <h1 class="m-slide__title m-slide__title--large">${e(b.title || '')}</h1>
            ${b.subtitle ? `<p class="m-slide__description">${e(b.subtitle)}</p>` : ''}
            <div class="m-slide__buttons">
              ${b.link ? `<a href="${e(b.link)}" class="m-button m-button--white m-slide__button-first">${e(b.button_text || 'Shop Now')}</a>` : ''}
              <a href="/products" class="m-button m-button--secondary m-slide__button-second">Shop All</a>
            </div>
          </div>
        </div>
      </div>
    </div>`).join('');

  const hero = banners && banners.length ? `
<section class="m-section" style="padding:0">
  <div class="m-slideshow" data-slideshow>
    <div class="m-slideshow__track">${heroSlides}</div>
    ${banners.length > 1 ? `
    <button class="m-slideshow__arrow m-slideshow__arrow--prev" aria-label="Previous">‹</button>
    <button class="m-slideshow__arrow m-slideshow__arrow--next" aria-label="Next">›</button>
    <div class="m-slideshow__dots">
      ${banners.map((_, i) => `<button class="m-slideshow__dot ${i === 0 ? 'is-active' : ''}" aria-label="Slide ${i + 1}"></button>`).join('')}
    </div>` : ''}
  </div>
</section>` : '';

  const heroScript = banners && banners.length > 1 ? `
<script>
(() => {
  const root = document.querySelector('[data-slideshow]');
  if (!root) return;
  const track = root.querySelector('.m-slideshow__track');
  const slides = Array.from(root.querySelectorAll('.m-slide'));
  const dots = Array.from(root.querySelectorAll('.m-slideshow__dot'));
  const prev = root.querySelector('.m-slideshow__arrow--prev');
  const next = root.querySelector('.m-slideshow__arrow--next');
  if (!track || slides.length < 2) return;

  let index = 0;
  let timer = null;
  const go = (nextIndex) => {
    index = (nextIndex + slides.length) % slides.length;
    track.style.transform = 'translateX(' + (-index * 100) + '%)';
    dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
  };
  const restart = () => {
    window.clearInterval(timer);
    timer = window.setInterval(() => go(index + 1), 5000);
  };

  prev && prev.addEventListener('click', () => { go(index - 1); restart(); });
  next && next.addEventListener('click', () => { go(index + 1); restart(); });
  dots.forEach((dot, i) => dot.addEventListener('click', () => { go(i); restart(); }));
  restart();
})();
</script>` : '';

  // Featured product cards (best sellers)
  const featuredCards = (featured || []).map((p) => productCard(p, p.hover_image)).join('');
  const featuredSection = featured.length ? `
<section class="m-section m-section-my m-section-py">
  <div class="container db-home-container">
    ${sectionHeading('Best Sellers', 'Our most-loved sets — hand-finished, ready to wear.')}
    <div class="db-grid db-grid--4">${featuredCards}</div>
    <div class="db-empty" style="margin-top:32px;text-align:center">
      <a class="m-button m-button--primary" href="/collections/best-sellers-1">View All Best Sellers</a>
    </div>
  </div>
</section>` : '';

  // Shop by shape (round badges)
  const shapeCards = (collections || []).slice(0, 5).map((c) => `
    <a href="/collections/${e(c.slug)}" class="m-collection-card m-collection-card--round" aria-label="${e(c.title)}">
      <div class="m-collection-card__image m-collection-card__image-rounded m:rounded-full m-hover-box m-hover-box--scale-up" style="--aspect-ratio: 1/1">
        <img src="${e(c.image || PLACEHOLDER)}" alt="${e(c.title)}" loading="lazy" width="500" height="500">
      </div>
      <div class="m-collection-card__content">
        <h3 class="m-collection-card__title">${e(c.title)}</h3>
        <span class="m-collection-card__link">Shop now ${arrow}</span>
      </div>
    </a>`).join('');

  const shapesSection = (collections || []).length ? `
<section class="m-section m-section-my m-section-py" style="background:var(--color-bg-soft,#faf6f1)">
  <div class="container db-home-container">
    ${sectionHeading('Shop By Shape', 'From soft almond to bold coffin — choose the look that is you.')}
    <div class="db-grid db-grid--5">${shapeCards}</div>
  </div>
</section>` : '';

  const asSeenItems = ((asSeenProducts || []).length ? asSeenProducts : (featured || [])).slice(0, 4);
  const asSeenSection = asSeenItems.length ? `
<section class="m-section db-as-seen-section">
  <div class="container-full">
    ${sectionHeading('As Seen On You')}
    <div class="db-as-seen-track">${asSeenItems.map(asSeenCard).join('')}</div>
  </div>
</section>` : '';

  // Image with text (about the brand)
  const splitSection = `
<section class="m-section m-section-my m-section-py">
  <div class="container db-home-container db-split">
    <div class="db-split__media">
      <img src="/images/0326009_2.jpg" alt="Press-on application" loading="lazy">
    </div>
    <div class="db-split__content">
      <span class="m-eyebrow">Why ${e(shop)}</span>
      <h2 class="m-section__heading h2">A salon manicure, minus the salon.</h2>
      <div class="rte">
        <p>Each set is hand-finished and built to last up to two weeks. No appointments, no drying time, no damage — just press, wear, and reuse. Our nails are cruelty-free and designed in-house for the perfect everyday fit.</p>
      </div>
      <a class="m-button m-button--primary" href="/products">Explore the Collection</a>
    </div>
  </div>
</section>`;

  // Feature icons strip
  const featuresSection = `
<section class="m-section--tight m-section-py" style="background:var(--color-bg-soft,#faf6f1)">
  <div class="container db-home-container">
    <div class="db-features">
      <div class="db-feature">
        <div class="db-feature__icon"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 20c1-5 1-11 3-16 3 2 5 5 7 9 1 3-1 7-5 7H7z"/><path d="M10 8c2 1 4 3 5 5"/></svg></div>
        <h4>Salon Quality</h4><p>Hand-finished, glossy, durable.</p>
      </div>
      <div class="db-feature">
        <div class="db-feature__icon"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg></div>
        <h4>Ready in Minutes</h4><p>Apply at home, anytime.</p>
      </div>
      <div class="db-feature">
        <div class="db-feature__icon"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 7 3-3 3 3M10 4v7a5 5 0 0 0 5 5h2"/><path d="m17 17-3 3-3-3M14 20v-7a5 5 0 0 0-5-5H7"/></svg></div>
        <h4>Reusable</h4><p>Wear your favourites again.</p>
      </div>
      <div class="db-feature">
        <div class="db-feature__icon"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 21C7 18 4 14 4 9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5-3 9-6 12z"/></svg></div>
        <h4>Cruelty-Free</h4><p>Always kind, never tested.</p>
      </div>
    </div>
  </div>
</section>`;

  // Reviews
  const reviewsSection = `
<section class="m-section m-section-my m-section-py">
  <div class="container db-home-container">
    ${sectionHeading('Let Customers Speak For Us', '★★★★★ &nbsp;Over 10,000 happy hands and counting.')}
    <div class="db-reviews">
      <div class="db-review">
        <div class="db-review__stars">★★★★★</div>
        <p>"Genuinely lasted two full weeks and looked like I'd been to the salon. The almond fit is perfect."</p>
        <div class="db-review__author">— Mia T.</div>
      </div>
      <div class="db-review">
        <div class="db-review__stars">★★★★★</div>
        <p>"So easy to apply and the quality is unreal for the price. I'm completely hooked."</p>
        <div class="db-review__author">— Jasmine R.</div>
      </div>
      <div class="db-review">
        <div class="db-review__stars">★★★★★</div>
        <p>"Reusable, gorgeous, and zero damage to my natural nails. Repurchasing in every shade."</p>
        <div class="db-review__author">— Hannah L.</div>
      </div>
    </div>
  </div>
</section>`;

  // Blog teaser
  const blogCards = (posts || []).slice(0, 3).map((post) => `
    <a href="/blog/${e(post.slug)}" class="db-journal-card">
      <div class="db-journal-card__media">
        <img src="${e(post.cover_image || PLACEHOLDER)}" alt="${e(post.title)}" loading="lazy">
      </div>
      <div class="db-journal-card__meta">${fmtDate(post.published_at)}<span></span>${readingMinutes(post.content)} min read</div>
      <h2>${e(post.title)}</h2>
      <p>${e(post.excerpt || '')}</p>
      <span class="db-journal-read">Read article ${arrow}</span>
    </a>`).join('');

  const blogSection = (posts || []).length ? `
<section class="m-section m-section-my m-section-py">
  <div class="container db-home-container">
    ${sectionHeading('The Journal', 'Tips, tricks and inspiration from our studio.')}
    <div class="db-journal-grid">${blogCards}</div>
    <div class="db-empty" style="text-align:center;margin-top:32px">
      <a class="m-button m-button--primary" href="/blog">View All Articles</a>
    </div>
  </div>
</section>` : '';

  // Instagram grid
  const instaCards = (featured || []).slice(0, 6).map((p) => `
    <a href="${e(instagram)}" target="_blank" rel="noopener" class="db-insta-tile">
      <img src="${e(p.image || PLACEHOLDER)}" alt="${e(p.title)}" loading="lazy">
    </a>`).join('');

  const instaSection = `
<section class="m-section--tight" style="padding-bottom:72px">
  <div class="container db-home-container">
    ${sectionHeading('Get Inspired by Every Look', 'Follow along @' + e((shop || 'majestic_nailbox').toLowerCase().replace(/[^a-z0-9]+/g, '_')))}
    <div class="db-insta-grid">${instaCards}</div>
  </div>
</section>`;

  return `${header()}
${hero}
${heroScript}
${marquee()}
${featuredSection}
${shapesSection}
${asSeenSection}
${splitSection}
${featuresSection}
${reviewsSection}
${blogSection}
${instaSection}`;
}

function homeFeatureIcon(name) {
  const icons = {
    leaf: '<path d="M7 20c1-5 1-11 3-16 3 2 5 5 7 9 1 3-1 7-5 7H7z"/><path d="M10 8c2 1 4 3 5 5"/>',
    clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
    reuse: '<path d="m7 7 3-3 3 3M10 4v7a5 5 0 0 0 5 5h2"/><path d="m17 17-3 3-3-3M14 20v-7a5 5 0 0 0-5-5H7"/>',
    heart: '<path d="M12 21C7 18 4 14 4 9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5-3 9-6 12z"/>',
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24">${icons[name] || icons.heart}</svg>`;
}

function homePage({ banners, featured, posts, sections: cmsSections, settings }) {
  const instagram = settings.instagram || '/contact';
  const arrow = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14M14 7l5 5-5 5"/></svg>';
  const best = cmsSection(cmsSections, 'best-sellers');
  const shapeSection = cmsSection(cmsSections, 'shop-by-shape');
  const curated = cmsSection(cmsSections, 'curated');
  const seen = cmsSection(cmsSections, 'as-seen');
  const story = cmsSection(cmsSections, 'brand-story');
  const features = cmsSection(cmsSections, 'features');
  const reviews = cmsSection(cmsSections, 'reviews');
  const journal = cmsSection(cmsSections, 'journal');
  const social = cmsSection(cmsSections, 'instagram');
  const bestProducts = (best.products || []).length ? best.products : (featured || []);

  const heroSlides = (banners || []).map((banner) => {
    const embeddedVideo = banner.video ? videoFrame(banner.video, banner.title || 'Banner video', true) : '';
    const media = embeddedVideo || (banner.video
      ? `<video autoplay muted loop playsinline poster="${e(banner.image || '')}" src="${e(banner.video)}"></video>`
      : `<img src="${e(banner.image || PLACEHOLDER)}" alt="${e(banner.title || '')}" loading="eager">`);
    return `<div class="m-slide">
      <div class="m-slide__image m-slide__image--adapt" style="--aspect-ratio:1.9101">
        ${media}<div class="m-slide__overlay"></div>
        <div class="m-slide__content container"><div class="m-slide__content-inner">
          ${banner.title ? `<h1 class="m-slide__title m-slide__title--large">${e(banner.title)}</h1>` : ''}
          ${banner.subtitle ? `<p class="m-slide__description">${e(banner.subtitle)}</p>` : ''}
          ${banner.link ? `<div class="m-slide__buttons"><a href="${e(banner.link)}" class="m-button m-button--white m-slide__button-first">${e(banner.button_text || 'View collection')}</a></div>` : ''}
        </div></div>
      </div>
    </div>`;
  }).join('');
  const hero = heroSlides ? `<section class="m-section" style="padding:0"><div class="m-slideshow" data-slideshow>
    <div class="m-slideshow__track">${heroSlides}</div>
    ${(banners || []).length > 1 ? `<button class="m-slideshow__arrow m-slideshow__arrow--prev" aria-label="Previous slide">&#8249;</button><button class="m-slideshow__arrow m-slideshow__arrow--next" aria-label="Next slide">&#8250;</button><div class="m-slideshow__dots">${banners.map((_, index) => `<button class="m-slideshow__dot${index === 0 ? ' is-active' : ''}" aria-label="Slide ${index + 1}"></button>`).join('')}</div>` : ''}
  </div></section>` : '';
  const heroScript = (banners || []).length > 1 ? `<script>(()=>{const root=document.querySelector('[data-slideshow]');if(!root)return;const track=root.querySelector('.m-slideshow__track');const slides=[...root.querySelectorAll('.m-slide')];const dots=[...root.querySelectorAll('.m-slideshow__dot')];let index=0,timer;const go=n=>{index=(n+slides.length)%slides.length;track.style.transform='translateX('+(-index*100)+'%)';dots.forEach((dot,i)=>dot.classList.toggle('is-active',i===index));};const restart=()=>{clearInterval(timer);timer=setInterval(()=>go(index+1),5000);};root.querySelector('.m-slideshow__arrow--prev')?.addEventListener('click',()=>{go(index-1);restart();});root.querySelector('.m-slideshow__arrow--next')?.addEventListener('click',()=>{go(index+1);restart();});dots.forEach((dot,i)=>dot.addEventListener('click',()=>{go(i);restart();}));restart();})();</script>` : '';

  const bestHtml = bestProducts.length ? `<section class="m-section m-section-my m-section-py"><div class="container db-home-container">
    ${sectionHeading(best.title || '', best.subtitle || '')}<div class="db-grid db-grid--4">${bestProducts.map((product) => productCard(product, product.hover_image)).join('')}</div>
    ${best.button_link ? `<div class="db-section-action"><a class="m-button m-button--primary" href="${e(best.button_link)}">${e(best.button_text || 'View all')}</a></div>` : ''}
  </div></section>` : '';

  const shapeHtml = (shapeSection.items || []).length ? `<section class="m-section m-section-my m-section-py db-home-soft"><div class="container db-home-container">
    ${sectionHeading(shapeSection.title || '', shapeSection.subtitle || '')}<div class="db-grid db-grid--5">${shapeSection.items.map((item) => `<a href="${e(item.link || '#')}" class="m-collection-card m-collection-card--round"><div class="m-collection-card__image m-collection-card__image-rounded m:rounded-full m-hover-box m-hover-box--scale-up"><img src="${e(item.image || PLACEHOLDER)}" alt="${e(item.title || '')}" loading="lazy"></div><div class="m-collection-card__content"><h3 class="m-collection-card__title">${e(item.title || '')}</h3><span class="m-collection-card__link">View collection ${arrow}</span></div></a>`).join('')}</div>
  </div></section>` : '';

  const curatedHtml = (curated.items || []).length ? `<section class="m-section m-section-my m-section-py"><div class="container db-home-container">
    ${sectionHeading(curated.title || '', curated.subtitle || '')}<div class="db-curated-grid">${curated.items.map((item) => `<a class="db-curated-card" href="${e(item.link || '#')}"><img src="${e(item.image || PLACEHOLDER)}" alt="${e(item.title || '')}" loading="lazy"><span class="db-curated-card__overlay"></span><span class="db-curated-card__content">${item.label ? `<small>${e(item.label)}</small>` : ''}<strong>${e(item.title || '')}</strong><span class="rte">${item.body_html || ''}</span></span></a>`).join('')}</div>
  </div></section>` : '';

  const seenHtml = (seen.products || []).length ? `<section class="m-section db-as-seen-section"><div class="container-full">${sectionHeading(seen.title || '', seen.subtitle || '')}<div class="db-as-seen-track">${seen.products.map(asSeenCard).join('')}</div></div></section>` : '';
  const storyHtml = story.title ? `<section class="m-section m-section-my m-section-py"><div class="container db-home-container db-split"><div class="db-split__media"><img src="${e(story.image || PLACEHOLDER)}" alt="${e(story.title)}" loading="lazy"></div><div class="db-split__content">${story.eyebrow ? `<span class="m-eyebrow">${e(story.eyebrow)}</span>` : ''}<h2 class="m-section__heading h2">${e(story.title)}</h2>${story.subtitle ? `<p>${e(story.subtitle)}</p>` : ''}<div class="rte">${story.body_html || ''}</div>${story.button_link ? `<a class="m-button m-button--primary" href="${e(story.button_link)}">${e(story.button_text || 'Learn more')}</a>` : ''}</div></div></section>` : '';
  const featureHtml = (features.items || []).length ? `<section class="m-section--tight m-section-py db-home-soft"><div class="container db-home-container"><div class="db-features">${features.items.map((item) => `<div class="db-feature"><div class="db-feature__icon">${homeFeatureIcon(item.label)}</div><h4>${e(item.title || '')}</h4><div class="rte">${item.body_html || ''}</div></div>`).join('')}</div></div></section>` : '';
  const reviewHtml = (reviews.items || []).length ? `<section class="m-section m-section-my m-section-py"><div class="container db-home-container">${sectionHeading(reviews.title || '', reviews.subtitle || '')}<div class="db-reviews">${reviews.items.map((item) => `<article class="db-review"><div class="db-review__stars" aria-label="${e(item.label || '5')} out of 5 stars">${'&#9733;'.repeat(Math.max(1, Math.min(5, Number(item.label) || 5)))}</div><h3>${e(item.title || '')}</h3><div class="rte">${item.body_html || ''}</div>${item.subtitle ? `<div class="db-review__author">${e(item.subtitle)}</div>` : ''}</article>`).join('')}</div></div></section>` : '';

  const articleCards = (posts || []).slice(0, 3).map((post) => `<a href="/blog/${e(post.slug)}" class="db-journal-card"><div class="db-journal-card__media"><img src="${e(post.cover_image || PLACEHOLDER)}" alt="${e(post.title)}" loading="lazy"></div><div class="db-journal-card__meta">${fmtDate(post.published_at)}<span></span>${readingMinutes(post.content)} min read</div><h2>${e(post.title)}</h2><p>${e(post.excerpt || '')}</p><span class="db-journal-read">Read article ${arrow}</span></a>`).join('');
  const journalHtml = articleCards ? `<section class="m-section m-section-my m-section-py"><div class="container db-home-container">${sectionHeading(journal.title || '', journal.subtitle || '')}<div class="db-journal-grid">${articleCards}</div>${journal.button_link ? `<div class="db-section-action"><a class="m-button m-button--primary" href="${e(journal.button_link)}">${e(journal.button_text || 'View all')}</a></div>` : ''}</div></section>` : '';
  const socialProducts = (social.products || []).length ? social.products : bestProducts.slice(0, 6);
  const socialHtml = socialProducts.length ? `<section class="m-section--tight db-home-social"><div class="container db-home-container">${sectionHeading(social.title || '', social.subtitle || '')}<div class="db-insta-grid">${socialProducts.map((product) => `<a href="${e(instagram)}" target="_blank" rel="noopener" class="db-insta-tile"><img src="${e(product.image || PLACEHOLDER)}" alt="${e(product.title)}" loading="lazy"></a>`).join('')}</div></div></section>` : '';

  return `${header()}${hero}${heroScript}${marquee()}${bestHtml}${shapeHtml}${curatedHtml}${seenHtml}${storyHtml}${featureHtml}${reviewHtml}${journalHtml}${socialHtml}`;
}

// --- Policy / content pages (DRY for shipping/refund/privacy/terms) ---
const POLICY_CONTENT = {
  'shipping-policy': {
    title: 'Shipping Policy',
    body: `
      <p>We currently ship within Canada and to selected international destinations. Because every set is hand-finished to order, please allow 2-4 business days for production before your order is dispatched.</p>
      <h3>Processing Time</h3>
      <p>All press-on sets are made by hand, in small batches. Standard processing is 2-4 business days. During new collection launches, processing may take up to 7 business days — we'll always flag this on the product page and confirm with you before starting your order.</p>
      <h3>Shipping Options (Canada)</h3>
      <ul>
        <li><strong>Ontario Local Pickup</strong> — Free. Pickup location confirmed after ordering.</li>
        <li><strong>Canada Post Standard</strong> — $8 CAD. 3-7 business days. Free on orders over $100 CAD.</li>
        <li><strong>Canada Post Express</strong> — $18 CAD. 1-3 business days.</li>
      </ul>
      <h3>International Shipping</h3>
      <p>We ship to the US, UK, and EU. International shipping is calculated at checkout via Canada Post. The customer is responsible for any customs or duties charged by the destination country.</p>
      <h3>Tracking</h3>
      <p>Every order includes a tracking number, sent to your email or DM once your package leaves the studio.</p>
      <h3>Lost or Damaged Parcels</h3>
      <p>If your order is delayed beyond 14 business days (domestic) or 28 business days (international), or arrives damaged, contact us and we'll work with the carrier to make it right.</p>`,
  },
  'refund-policy': {
    title: 'Refund & Exchange Policy',
    body: `
      <p>Because each set is hand-finished to order, all sales are final. We do, however, want you to love your set — read on for the situations where we'll make it right.</p>
      <h3>Sizing Issues</h3>
      <p>If your set doesn't fit, contact us within 7 days of delivery. We'll remake the set in the correct size at no extra charge (you cover return shipping for the original set).</p>
      <h3>Manufacturing Defects</h3>
      <p>If a tip cracks, lifts, or arrives damaged despite correct application, send us a photo within 14 days. We'll send a replacement tip or a new set on us.</p>
      <h3>Change of Mind</h3>
      <p>Orders can be cancelled within 24 hours of placing them, before production has started. Once your set has been made, we cannot offer a refund for change of mind.</p>
      <h3>Replacements</h3>
      <p>Lost a single nail? We sell single-tip replacements for a small fee — just message us with the style name and size.</p>`,
  },
  'privacy-policy': {
    title: 'Privacy Policy',
    body: `
      <p>This Privacy Policy describes how ${e('{shop_name}')} ("we", "us", "our") collects, uses, and protects your personal information when you visit our website or contact us to place an order.</p>
      <h3>Information We Collect</h3>
      <ul>
        <li><strong>Contact information</strong> — name, email, phone, Instagram handle — when you reach out to place an order.</li>
        <li><strong>Order information</strong> — product selections, sizing, shipping address.</li>
        <li><strong>Site usage</strong> — anonymous analytics (pages visited, browser, country) to help us improve the site.</li>
      </ul>
      <h3>How We Use It</h3>
      <p>We use your information only to: respond to your enquiries, fulfil and ship your order, and improve our products and site. We do not sell or rent your personal data to anyone.</p>
      <h3>Cookies</h3>
      <p>The site uses essential cookies to remember your cart and login session, and optional analytics cookies to measure traffic. You can disable analytics cookies in your browser settings.</p>
      <h3>Data Retention</h3>
      <p>We keep order records for 7 years (required by Canadian tax law). Marketing data is kept until you ask us to delete it.</p>
      <h3>Your Rights</h3>
      <p>You can request a copy of the personal data we hold about you, or ask us to delete it, by emailing us at any time.</p>`,
  },
  'terms-of-service': {
    title: 'Terms of Service',
    body: `
      <p>By using this website and ordering from ${e('{shop_name}')}, you agree to the following terms.</p>
      <h3>Products</h3>
      <p>All press-on nails are hand-finished, in small batches. Slight variations between sets are normal and part of the handcrafted character of the product.</p>
      <h3>Ordering</h3>
      <p>Because this storefront is contact-based, placing an order begins when you message us and ends when we confirm the order details (product, size, shipping, total) in writing. Production starts only after we receive confirmation.</p>
      <h3>Pricing</h3>
      <p>All prices are in CAD. Shipping and applicable taxes are added at confirmation. We reserve the right to correct pricing errors and will always confirm the final total before charging.</p>
      <h3>Intellectual Property</h3>
      <p>All product designs, photos, and written content on this site belong to ${e('{shop_name}')}. Please don't copy or resell our designs without permission.</p>
      <h3>Limitation of Liability</h3>
      <p>Our nails are cosmetic products. Discontinue use if you experience irritation. We are not liable for allergic reactions, misuse, or damage caused by application outside of our published instructions.</p>`,
  },
};

function policyPageLegacy({ kind, title, settings }) {
  const entry = POLICY_CONTENT[kind] || { title, body: '<p>Content coming soon.</p>' };
  const shop = settings.shop_name || 'Majestic Nailbox';
  const body = entry.body.replace(/\$\{e\('\{shop_name\}'\)\}/g, e(shop)).replace(/\{shop_name\}/g, shop);
  return `${header()}
${pageBanner({ image: DEFAULT_BANNER, title: entry.title, subtitle: 'Last updated: ' + new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), breadcrumbHtml: '<a href="/">Home</a> / ' + e(entry.title) })}
${marquee()}
<section class="m-section m-section-my m-section-py">
  <div class="container db-page">
    <div class="db-policy">${body}</div>
  </div>
</section>`;
}

// --- FAQ page ---
const FAQ_ITEMS = [
  { q: 'How long do press-on nails last?', a: 'With proper application and solid nail glue, our press-on sets last up to two weeks of daily wear. Using adhesive tabs is a gentler option that lasts a few days — great for events and short-term wear.' },
  { q: 'How do I choose the right size?', a: 'Use the size guide on every product page and measure each nail (in millimetres) at the widest point. If you are between sizes, size down and gently file the inside edges for a snug fit.' },
  { q: 'How do I apply the nails?', a: 'Push back your cuticles, lightly buff the surface of your natural nail, and wipe each nail with an alcohol pad. Apply a thin layer of glue to both your nail and the press-on. Press and hold for 15-20 seconds, starting at the cuticle. Avoid water for the first hour.' },
  { q: 'Are the nails reusable?', a: 'Yes. Soak the set in warm soapy water for 10 minutes, gently peel off any glue, and store the tips in their original case. With care, a set can be worn 3-5 times.' },
  { q: 'Do you ship internationally?', a: 'Yes — we ship to Canada, the US, UK, and most of the EU. International shipping costs are calculated based on destination and weight.' },
  { q: 'How long does production take?', a: 'Each set is hand-finished to order, so production takes 2-4 business days before your order ships. We will confirm a delivery estimate when you place your order.' },
  { q: 'Can I cancel or change my order?', a: 'Yes, within 24 hours of placing it. After that, your set has likely entered production and we cannot make changes. Contact us as soon as possible.' },
  { q: 'What if a nail breaks or I lose one?', a: 'Message us! We sell single-tip replacements for a small fee, so you do not have to replace the whole set.' },
  { q: 'Do you do custom designs?', a: 'Occasionally. Send us a DM with what you have in mind and we will let you know if it is something we can take on.' },
  { q: 'Are the nails safe for natural nails?', a: 'Yes. Our press-ons are made with non-toxic, nail-safe materials. Always apply and remove them gently to protect your natural nail.' },
];

function faqPageLegacy({ settings }) {
  const items = FAQ_ITEMS.map((item, i) => `
    <details class="db-product-accordion"${i === 0 ? ' open' : ''}>
      <summary>${e(item.q)}</summary>
      <div class="db-product-accordion__body"><p>${e(item.a)}</p></div>
    </details>`).join('');

  return `${header()}
${pageBanner({ image: DEFAULT_BANNER, title: 'Frequently Asked Questions', subtitle: "Answers to the questions we get most about sizing, application, shipping, and our handmade process.", breadcrumbHtml: '<a href="/">Home</a> / FAQ' })}
${marquee()}
<section class="m-section m-section-my m-section-py">
  <div class="container db-page">
    <div class="db-faq">${items}</div>
  </div>
</section>`;
}

// --- Nail tutorial page ---
function tutorialPageLegacy({ settings }) {
  const steps = [
    { n: '1', title: 'Prep your natural nails', body: '<p>Push back your cuticles, lightly buff the surface of each nail, then wipe with an alcohol pad. A clean, oil-free nail is the secret to a long-lasting bond.</p>' },
    { n: '2', title: 'Size every nail first', body: '<p>Lay out each press-on tip before applying any glue. The right fit sits just inside your sidewalls without pinching or overlapping the skin.</p>' },
    { n: '3', title: 'Apply glue (or adhesive tabs)', body: '<p>Add a thin layer of glue to BOTH your natural nail and the back of the press-on. Wait 2-3 seconds for the glue to get tacky, then press and hold for 15-20 seconds — starting at the cuticle and rolling forward to avoid air bubbles.</p>' },
    { n: '4', title: 'Shape and seal', body: '<p>File the free edge to your desired shape. Avoid hot water for the first hour so the bond can fully cure.</p>' },
    { n: '5', title: 'Removal and storage', body: '<p>To remove, soak in warm soapy water for 10 minutes, then gently peel from the cuticle edge. Soak off any leftover glue, store the tips in their original case, and they will be ready to wear again.</p>' },
  ];

  const stepsHtml = steps.map((s) => `
    <div class="db-tutorial-step">
      <div class="db-tutorial-step__num">${e(s.n)}</div>
      <div class="db-tutorial-step__body">
        <h3>${e(s.title)}</h3>
        ${s.body}
      </div>
    </div>`).join('');

  return `${header()}
${pageBanner({ image: '/images/0326009_2.jpg', title: 'Nail Tutorial', subtitle: "A salon-perfect press-on manicure in under 15 minutes — our step-by-step routine.", breadcrumbHtml: '<a href="/">Home</a> / Nail Tutorial' })}
${marquee()}
<section class="m-section m-section-my m-section-py">
  <div class="container db-page">
    <div class="db-tutorial">${stepsHtml}</div>
    <div class="db-empty" style="text-align:center;margin-top:48px">
      <a class="m-button m-button--primary" href="/products">Shop All Nails</a>
    </div>
  </div>
</section>`;
}

function policyPage({ section }) {
  return `${header()}
${pageBanner({ image: section.image || DEFAULT_BANNER, title: section.title || '', subtitle: section.subtitle || '', breadcrumbHtml: '<a href="/">Home</a> / ' + e(section.title || '') })}
${marquee()}
<section class="m-section m-section-my m-section-py"><div class="container db-page"><div class="db-policy">${section.body_html || ''}</div></div></section>`;
}

function faqPage({ sections: cmsSections }) {
  const section = cmsSection(cmsSections, 'main');
  const items = (section.items || []).map((item, index) => `<details class="db-product-accordion"${index === 0 ? ' open' : ''}><summary>${e(item.title || '')}</summary><div class="db-product-accordion__body">${item.body_html || ''}</div></details>`).join('');
  return `${header()}
${pageBanner({ image: section.image || DEFAULT_BANNER, title: section.title || '', subtitle: section.subtitle || '', breadcrumbHtml: '<a href="/">Home</a> / FAQ' })}
${marquee()}
<section class="m-section m-section-my m-section-py"><div class="container db-page"><div class="db-faq">${items}</div></div></section>`;
}

function tutorialPage({ sections: cmsSections }) {
  const section = cmsSection(cmsSections, 'main');
  const steps = (section.items || []).map((item, index) => `<div class="db-tutorial-step"><div class="db-tutorial-step__num">${e(item.label || String(index + 1))}</div><div class="db-tutorial-step__body"><h3>${e(item.title || '')}</h3>${item.body_html || ''}</div></div>`).join('');
  return `${header()}
${pageBanner({ image: section.image || DEFAULT_BANNER, title: section.title || '', subtitle: section.subtitle || '', breadcrumbHtml: '<a href="/">Home</a> / Nail Tutorial' })}
${marquee()}
<section class="m-section m-section-my m-section-py"><div class="container db-page"><div class="db-tutorial">${steps}</div>${section.button_link ? `<div class="db-section-action"><a class="m-button m-button--primary" href="${e(section.button_link)}">${e(section.button_text || 'View products')}</a></div>` : ''}</div></section>`;
}

// --- Account login / register page (front-end only) ---
function accountPage({ mode, settings }) {
  const isRegister = mode === 'register';
  const title = isRegister ? 'Create Account' : 'Sign In';
  const subtitle = isRegister
    ? 'Save your favourite sets and message us faster next time.'
    : 'Sign in to manage your favourites and message us about an order.';
  const shop = settings.shop_name || 'Majestic Nailbox';
  const instagram = settings.instagram || '#';
  const tiktok = settings.tiktok || '#';
  const phone = settings.contact_phone || '';
  return `${header()}
${pageBanner({ image: DEFAULT_BANNER, title, subtitle, breadcrumbHtml: '<a href="/">Home</a> / ' + e(title) })}
${marquee()}
<section class="m-section m-section-my m-section-py">
  <div class="container db-page">
    <div class="db-account">
      <div class="db-form">
        <h3>${e(title)}</h3>
        ${isRegister ? `
          <form onsubmit="event.preventDefault();this.querySelector('.ok').style.display='block';this.reset();">
            <div class="field"><label>Full name</label><input type="text" required></div>
            <div class="field"><label>Email</label><input type="email" required></div>
            <div class="field"><label>Phone (optional)</label><input type="tel"></div>
            <div class="field"><label>Password</label><input type="password" required minlength="6"></div>
            <button type="submit" class="m-button m-button--primary" style="width:100%">Create Account</button>
            <p class="ok" style="display:none;margin-top:12px;font-weight:700">Welcome! Your account request is in. We'll be in touch shortly.</p>
          </form>
          <p style="margin-top:18px">Already have an account? <a href="/account/login">Sign in</a></p>
        ` : `
          <form onsubmit="event.preventDefault();this.querySelector('.ok').style.display='block';this.reset();">
            <div class="field"><label>Email</label><input type="email" required></div>
            <div class="field"><label>Password</label><input type="password" required></div>
            <button type="submit" class="m-button m-button--primary" style="width:100%">Sign In</button>
            <p class="ok" style="display:none;margin-top:12px;font-weight:700">Welcome back! Reach out anytime and our team will help you.</p>
          </form>
          <p style="margin-top:18px">New here? <a href="/account/register">Create an account</a></p>
        `}
      </div>
      <aside class="db-account-aside">
        <h3>Or just message us</h3>
        <p>${e(shop)} is contact-only. The fastest way to order is to reach out directly — no account required.</p>
        <ul>
          ${phone ? `<li>${contactIcon('phone')}<a href="tel:${e(phone.replace(/[^0-9+]/g, ''))}">${e(phone)}</a></li>` : ''}
          ${settings.instagram ? `<li>${contactIcon('instagram')}<a href="${e(instagram)}" target="_blank" rel="noopener">@majestic_nailbox</a></li>` : ''}
          ${settings.tiktok ? `<li>${contactIcon('tiktok')}<a href="${e(tiktok)}" target="_blank" rel="noopener">@majestic_press_on_nails</a></li>` : ''}
          ${settings.contact_email ? `<li>${contactIcon('phone')}<a href="mailto:${e(settings.contact_email)}">${e(settings.contact_email)}</a></li>` : ''}
        </ul>
      </aside>
    </div>
  </div>
</section>`;
}

module.exports = { productsPage, productPage, blogPage, postPage, contactPage, aboutPage, homePage, policyPage, faqPage, tutorialPage, accountPage, notFound };
