(function () {
  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  ready(function () {
    var drawer = document.querySelector('#m-menu-drawer');
    var menuButton = document.querySelector('.m-menu-button');
    var hamburger = menuButton && menuButton.querySelector('.m-hamburger-box');
    var mobileHeader = document.querySelector('.m-header__mobile');
    var searchPopup = document.querySelector('[data-search-popup]');
    var searchWrapper = searchPopup && searchPopup.querySelector('.m-search-popup--wrapper');
    var searchForm = searchPopup && searchPopup.querySelector('form[role="search"]');
    var searchInput = searchPopup && searchPopup.querySelector('[data-search-input]');
    if (searchPopup && searchPopup.parentElement !== document.body) {
      document.body.appendChild(searchPopup);
    }

    function syncBodyLock() {
      var menuOpen = drawer && drawer.classList.contains('open');
      var searchOpen = searchPopup && searchPopup.classList.contains('db-is-open');
      document.body.classList.toggle('db-overlay-open', Boolean(menuOpen || searchOpen));
    }

    function sizeDrawer() {
      if (!drawer || !drawer.classList.contains('open')) return;
      var top = drawer.getBoundingClientRect().top;
      drawer.style.height = Math.max(0, window.innerHeight - top) + 'px';
    }

    function setMenu(open) {
      if (!drawer || !menuButton) return;
      drawer.classList.toggle('open', open);
      hamburger && hamburger.classList.toggle('active', open);
      mobileHeader && mobileHeader.classList.toggle('header-drawer-open', open);
      menuButton.setAttribute('aria-expanded', String(open));
      if (open) {
        sizeDrawer();
        var firstLink = drawer.querySelector('.m-menu-mobile__link');
        window.setTimeout(function () {
          firstLink && firstLink.focus();
        }, 180);
      } else {
        drawer.querySelectorAll('.m-megamenu-mobile.open').forEach(function (submenu) {
          submenu.classList.remove('open');
        });
        drawer.style.height = '';
      }
      syncBodyLock();
    }

    if (menuButton && drawer) {
      menuButton.setAttribute('role', 'button');
      menuButton.setAttribute('tabindex', '0');
      menuButton.setAttribute('aria-controls', 'm-menu-drawer');
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', 'Open navigation menu');
      menuButton.addEventListener('click', function (event) {
        event.preventDefault();
        setMenu(!drawer.classList.contains('open'));
      });
      menuButton.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setMenu(!drawer.classList.contains('open'));
        }
      });
      drawer.querySelector('.m-menu-drawer__backdrop')?.addEventListener('click', function () {
        setMenu(false);
      });
      drawer.addEventListener('click', function (event) {
        var toggle = event.target.closest('.m-menu-mobile__toggle-button');
        if (toggle) {
          event.preventDefault();
          event.stopPropagation();
          var submenu = toggle.nextElementSibling;
          submenu && submenu.classList.add('open');
          return;
        }
        var back = event.target.closest('.m-menu-mobile__back-button');
        if (back) {
          event.preventDefault();
          back.closest('.m-megamenu-mobile')?.classList.remove('open');
        }
      });
      window.addEventListener('resize', sizeDrawer);
    }

    function setSearch(open) {
      if (!searchPopup || !searchWrapper) return;
      searchPopup.classList.toggle('db-is-open', open);
      searchPopup.style.visibility = open ? 'visible' : 'hidden';
      searchPopup.style.opacity = open ? '1' : '0';
      searchWrapper.classList.toggle('m-show-search', open);
      if (open) {
        setMenu(false);
        window.setTimeout(function () {
          searchInput && searchInput.focus();
        }, 100);
      }
      syncBodyLock();
    }

    if (searchPopup) {
      if (searchForm) searchForm.action = '/products';
      document.querySelectorAll('[data-open-search-popup]').forEach(function (opener) {
        opener.setAttribute('role', 'button');
        opener.setAttribute('tabindex', '0');
        opener.setAttribute('aria-label', 'Search products');
        opener.addEventListener('click', function (event) {
          event.preventDefault();
          setSearch(true);
        });
        opener.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setSearch(true);
          }
        });
      });
      searchPopup.querySelectorAll('[data-close-search]').forEach(function (button) {
        button.addEventListener('click', function () {
          setSearch(false);
        });
      });
      searchPopup.querySelector('[data-clear-search]')?.addEventListener('click', function () {
        if (searchInput) {
          searchInput.value = '';
          searchInput.focus();
        }
      });
      searchPopup.addEventListener('click', function (event) {
        if (event.target === searchPopup) setSearch(false);
      });
      searchForm?.addEventListener('submit', function (event) {
        if (!searchInput || !searchInput.value.trim()) {
          event.preventDefault();
          searchInput && searchInput.focus();
        }
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (searchPopup && searchPopup.classList.contains('db-is-open')) {
        setSearch(false);
      } else if (drawer && drawer.classList.contains('open')) {
        setMenu(false);
        menuButton && menuButton.focus();
      }
    });

    // ---- Homepage email signup popup (per-email discount code) ----
    initSignupPopup();
    // ---- Footer "Join Our Email List" form ----
    initFooterSignup();
  });

  function initFooterSignup() {
    document.querySelectorAll('[data-footer-signup]').forEach(function (form) {
      var msg = form.parentElement.querySelector('[data-footer-signup-msg]');
      var input = form.querySelector('input[type="email"]');
      var btn = form.querySelector('button');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = (input.value || '').trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          if (msg) { msg.hidden = false; msg.className = 'db-footer-signup__msg is-error'; msg.textContent = 'Please enter a valid email.'; }
          return;
        }
        btn.disabled = true;
        fetch('/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'email=' + encodeURIComponent(email),
        }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
          .then(function (res) {
            btn.disabled = false;
            if (!res.ok) { if (msg) { msg.hidden = false; msg.className = 'db-footer-signup__msg is-error'; msg.textContent = 'Something went wrong. Please try again.'; } return; }
            if (msg) {
              msg.hidden = false;
              msg.className = 'db-footer-signup__msg is-success';
              msg.innerHTML = 'Thank you! Your ' + res.data.percent + '% off code: <strong>' + res.data.code + '</strong>';
            }
            form.reset();
          })
          .catch(function () { btn.disabled = false; if (msg) { msg.hidden = false; msg.className = 'db-footer-signup__msg is-error'; msg.textContent = 'Network error. Please try again.'; } });
      });
    });
  }

  function initSignupPopup() {
    var config = window.__mncSignup;
    if (!config || !config.enabled) return;
    // Show only on the homepage (identified by the hero slideshow).
    if (!document.querySelector('.m-slideshow, [data-slideshow]')) return;
    var STORAGE_KEY = 'mnc_signup_v1';
    try { if (localStorage.getItem(STORAGE_KEY)) return; } catch (e) {}

    var overlay = document.createElement('div');
    overlay.className = 'mnc-signup';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Email signup');
    overlay.innerHTML =
      '<div class="mnc-signup__backdrop" data-signup-close></div>' +
      '<div class="mnc-signup__card">' +
        '<button type="button" class="mnc-signup__close" data-signup-close aria-label="Close">&times;</button>' +
        '<div class="mnc-signup__body">' +
          '<h2 class="mnc-signup__title"></h2>' +
          '<p class="mnc-signup__subtitle"></p>' +
          '<form class="mnc-signup__form" novalidate>' +
            '<input type="email" name="email" class="mnc-signup__input" placeholder="Your email address" autocomplete="email" required />' +
            '<button type="submit" class="mnc-signup__submit">Get my code</button>' +
          '</form>' +
          '<div class="mnc-signup__error" hidden></div>' +
        '</div>' +
        '<div class="mnc-signup__success" hidden>' +
          '<div class="mnc-signup__badge">Your discount</div>' +
          '<div class="mnc-signup__percent"></div>' +
          '<p class="mnc-signup__note">Use this code when you contact us to order:</p>' +
          '<div class="mnc-signup__code" data-signup-code></div>' +
          '<button type="button" class="mnc-signup__submit" data-signup-copy>Copy code</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.querySelector('.mnc-signup__title').textContent = config.title || 'Get a discount';
    overlay.querySelector('.mnc-signup__subtitle').textContent = config.subtitle || '';

    var form = overlay.querySelector('.mnc-signup__form');
    var input = overlay.querySelector('.mnc-signup__input');
    var errorBox = overlay.querySelector('.mnc-signup__error');
    var bodyEl = overlay.querySelector('.mnc-signup__body');
    var successEl = overlay.querySelector('.mnc-signup__success');

    function open() { overlay.classList.add('is-open'); document.body.classList.add('mnc-signup-open'); }
    function close() { overlay.classList.remove('is-open'); document.body.classList.remove('mnc-signup-open'); try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) {} }

    overlay.querySelectorAll('[data-signup-close]').forEach(function (b) { b.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('is-open')) close(); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errorBox.hidden = true;
      var email = (input.value || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { errorBox.textContent = 'Please enter a valid email.'; errorBox.hidden = false; return; }
      var submitBtn = form.querySelector('.mnc-signup__submit');
      submitBtn.disabled = true; submitBtn.textContent = 'Sending…';
      fetch('/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'email=' + encodeURIComponent(email),
      }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (res) {
          submitBtn.disabled = false; submitBtn.textContent = 'Get my code';
          if (!res.ok) { errorBox.textContent = res.data && res.data.error === 'invalid_email' ? 'Please enter a valid email.' : 'Something went wrong. Please try again.'; errorBox.hidden = false; return; }
          overlay.querySelector('.mnc-signup__percent').textContent = res.data.percent + '% OFF';
          overlay.querySelector('[data-signup-code]').textContent = res.data.code;
          bodyEl.hidden = true; successEl.hidden = false;
          try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
        })
        .catch(function () { submitBtn.disabled = false; submitBtn.textContent = 'Get my code'; errorBox.textContent = 'Network error. Please try again.'; errorBox.hidden = false; });
    });

    overlay.querySelector('[data-signup-copy]').addEventListener('click', function () {
      var code = overlay.querySelector('[data-signup-code]').textContent;
      var btn = this;
      if (navigator.clipboard) { navigator.clipboard.writeText(code).then(function () { btn.textContent = 'Copied!'; setTimeout(function () { btn.textContent = 'Copy code'; }, 1500); }); }
    });

    window.setTimeout(open, 2500);
  }
})();
