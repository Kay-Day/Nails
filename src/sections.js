const fs = require('fs');
const path = require('path');

// Pull reusable theme sections (verbatim markup + their CSS/JS links) out of the
// scraped homepage so other pages render them identically to runzie.ca.
const HOME_FILE = path.join(__dirname, '..', 'public', 'home', 'index.html');
const html = fs.readFileSync(HOME_FILE, 'utf8');

function slice(startMarker, endMarker) {
  const s = html.indexOf(startMarker);
  if (s === -1) return '';
  const e = html.indexOf(endMarker, s);
  if (e === -1) return '';
  return html.slice(s, e + endMarker.length);
}

// Scrolling promotion ("chạy chữ"): from its CSS link through the closing tag.
let SCROLLING_PROMOTION = slice('<link href="css/scrolling-promotion.css"', '</m-scrolling-promotion>') + '\n  </div>\n</section>';

// Safety fallback if markers ever change
if (!SCROLLING_PROMOTION.includes('m-scrolling-promotion')) {
  SCROLLING_PROMOTION = '';
}

function scrollingPromotion() {
  return SCROLLING_PROMOTION;
}

module.exports = { scrollingPromotion };
