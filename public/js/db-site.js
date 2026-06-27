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
  });
})();
