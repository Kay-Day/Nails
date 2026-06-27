(function () {
  function sanitizeHtml(html) {
    var template = document.createElement('template');
    template.innerHTML = String(html || '');
    template.content.querySelectorAll('script, style, iframe, object, embed, form, input, button').forEach(function (node) {
      node.remove();
    });
    template.content.querySelectorAll('*').forEach(function (node) {
      Array.from(node.attributes).forEach(function (attribute) {
        var name = attribute.name.toLowerCase();
        var value = attribute.value.trim();
        if (name.indexOf('on') === 0 || ((name === 'href' || name === 'src') && /^javascript:/i.test(value))) {
          node.removeAttribute(attribute.name);
        }
      });
    });
    return template.innerHTML;
  }

  function initRichEditors() {
    document.querySelectorAll('[data-rich-editor]').forEach(function (editor) {
      var source = editor.parentElement.querySelector('[data-rich-source]');
      var content = editor.querySelector('[data-rich-content]');
      if (!source || !content) return;
      content.innerHTML = sanitizeHtml(source.value);

      function sync() {
        source.value = sanitizeHtml(content.innerHTML);
      }

      editor.querySelectorAll('[data-rich-command]').forEach(function (button) {
        button.addEventListener('click', function () {
          content.focus();
          document.execCommand(button.dataset.richCommand, false);
          sync();
        });
      });
      editor.querySelector('[data-rich-block]')?.addEventListener('change', function (event) {
        content.focus();
        document.execCommand('formatBlock', false, '<' + event.target.value + '>');
        sync();
      });
      editor.querySelector('[data-rich-link]')?.addEventListener('click', function () {
        var url = window.prompt('Link URL');
        if (!url) return;
        content.focus();
        document.execCommand('createLink', false, url);
        sync();
      });
      content.addEventListener('input', sync);
      content.addEventListener('blur', sync);
      content.addEventListener('paste', function (event) {
        event.preventDefault();
        var text = event.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
      });
      editor.closest('form')?.addEventListener('submit', sync);
    });
  }

  function videoEmbedUrl(value) {
    try {
      var url = new URL(value, window.location.origin);
      var host = url.hostname.replace(/^www\./, '');
      var id = '';
      if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
      if (host.endsWith('youtube.com')) {
        id = url.searchParams.get('v') || '';
        if (!id && /^\/(?:embed|shorts)\//.test(url.pathname)) id = url.pathname.split('/')[2] || '';
      }
      if (id) return 'https://www.youtube.com/embed/' + encodeURIComponent(id);
      if (host.endsWith('vimeo.com')) {
        id = url.pathname.split('/').filter(Boolean).find(function (part) { return /^\d+$/.test(part); }) || '';
        if (id) return 'https://player.vimeo.com/video/' + id;
      }
    } catch (error) {
      return '';
    }
    return '';
  }

  function previewUrl(value) {
    var url = String(value || '').trim();
    return /^www\./i.test(url) ? 'https://' + url : url;
  }

  function initMediaFields() {
    document.querySelectorAll('[data-media-field]').forEach(function (field) {
      var kind = field.dataset.mediaKind || 'image';
      var currentUrl = field.dataset.currentUrl || '';
      var fileInput = field.querySelector('[data-media-file]');
      var urlInput = field.querySelector('[data-media-url]');
      var removeInput = field.querySelector('[data-media-remove]');
      var preview = field.querySelector('[data-media-preview]');
      var status = field.querySelector('[data-media-status]');
      var objectUrl = '';
      var timer = null;

      function clearObjectUrl() {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = '';
      }

      function show(url, sourceLabel) {
        clearObjectUrl();
        preview.innerHTML = '';
        status.textContent = '';
        url = previewUrl(url);
        if (!url) {
          preview.classList.add('is-empty');
          status.textContent = 'No media selected';
          return;
        }
        preview.classList.remove('is-empty');

        if (kind === 'image') {
          var image = document.createElement('img');
          image.alt = 'Media preview';
          image.onload = function () { status.textContent = sourceLabel + ' - preview ready'; };
          image.onerror = function () { status.textContent = 'Preview failed. Use a direct image URL.'; };
          image.src = url;
          preview.appendChild(image);
          return;
        }

        var embed = videoEmbedUrl(url);
        if (embed) {
          var frame = document.createElement('iframe');
          frame.src = embed;
          frame.title = 'Video preview';
          frame.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture';
          frame.allowFullscreen = true;
          preview.appendChild(frame);
          status.textContent = sourceLabel + ' - embedded video';
          return;
        }

        var video = document.createElement('video');
        video.controls = true;
        video.preload = 'metadata';
        video.onloadedmetadata = function () { status.textContent = sourceLabel + ' - preview ready'; };
        video.onerror = function () { status.textContent = 'Preview failed. Use MP4, WebM, YouTube, or Vimeo URL.'; };
        video.src = url;
        preview.appendChild(video);
      }

      if (currentUrl) show(currentUrl, 'Current media');
      else show('', '');

      fileInput?.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) {
          show(urlInput?.value.trim() || currentUrl, urlInput?.value.trim() ? 'External URL' : 'Current media');
          return;
        }
        if (removeInput) removeInput.checked = false;
        objectUrl = URL.createObjectURL(file);
        var localUrl = objectUrl;
        preview.innerHTML = '';
        preview.classList.remove('is-empty');
        if (kind === 'image') {
          var image = document.createElement('img');
          image.alt = 'Selected file preview';
          image.src = localUrl;
          preview.appendChild(image);
        } else {
          var video = document.createElement('video');
          video.controls = true;
          video.muted = true;
          video.src = localUrl;
          preview.appendChild(video);
        }
        status.textContent = file.name + ' - selected for upload';
      });

      urlInput?.addEventListener('input', function () {
        window.clearTimeout(timer);
        timer = window.setTimeout(function () {
          var value = urlInput.value.trim();
          if (value) {
            if (removeInput) removeInput.checked = false;
            if (fileInput) fileInput.value = '';
          }
          show(value || currentUrl, value ? 'External URL' : 'Current media');
        }, 250);
      });

      removeInput?.addEventListener('change', function () {
        if (removeInput.checked) {
          clearObjectUrl();
          if (fileInput) fileInput.value = '';
          if (urlInput) urlInput.value = '';
          preview.innerHTML = '';
          preview.classList.add('is-empty');
          status.textContent = 'Current media will be removed when saved';
        } else {
          show(urlInput?.value.trim() || currentUrl, urlInput?.value.trim() ? 'External URL' : 'Current media');
        }
      });
    });
  }

  function initGalleryPreviews() {
    document.querySelectorAll('[data-gallery-input]').forEach(function (input) {
      var preview = input.parentElement.querySelector('[data-gallery-preview]');
      if (!preview) return;
      var objectUrls = [];

      input.addEventListener('change', function () {
        objectUrls.forEach(function (url) { URL.revokeObjectURL(url); });
        objectUrls = [];
        preview.innerHTML = '';
        Array.from(input.files || []).forEach(function (file) {
          var url = URL.createObjectURL(file);
          objectUrls.push(url);
          var item = document.createElement('div');
          item.className = 'gallery-edit__item';
          var image = document.createElement('img');
          image.src = url;
          image.alt = file.name;
          image.title = file.name;
          item.appendChild(image);
          preview.appendChild(item);
        });
      });
    });
  }

  function initAdminMenu() {
    var sidebar = document.querySelector('.sidebar');
    var toggle = document.querySelector('.sidebar__toggle');
    var nav = document.querySelector('#admin-navigation');
    if (!sidebar || !toggle || !nav) return;

    function setOpen(open) {
      sidebar.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close admin menu' : 'Open admin menu');
    }

    toggle.addEventListener('click', function () {
      setOpen(!sidebar.classList.contains('is-open'));
    });
    nav.addEventListener('click', function (event) {
      if (event.target.closest('a') && window.innerWidth <= 860) setOpen(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && sidebar.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 860) setOpen(false);
    });
  }

  function initAdmin() {
    initAdminMenu();
    initRichEditors();
    initMediaFields();
    initGalleryPreviews();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdmin, { once: true });
  } else {
    initAdmin();
  }
})();
