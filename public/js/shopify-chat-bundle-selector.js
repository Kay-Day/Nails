(function loadShopifyChatBundle() {
  const selectorScript = document.getElementById(
    'shopify-chat-bundle-selector',
  );
  if (!selectorScript) return;

  const agentSrc = selectorScript.dataset.agentSrc;
  const legacySrc = selectorScript.dataset.legacySrc;

  const loadAgentBundle = () => {
    if (
      !agentSrc ||
      document.querySelector('script[data-shopify-chat-agent-bundle]')
    )
      return;

    const preload = document.createElement('link');
    preload.rel = 'modulepreload';
    preload.href = agentSrc;
    preload.crossOrigin = '';
    document.head.appendChild(preload);

    const script = document.createElement('script');
    script.src = agentSrc;
    script.type = 'module';
    script.crossOrigin = '';
    script.fetchPriority = 'high';
    script.async = true;
    script.dataset.shopifyChatAgentBundle = 'true';
    document.head.appendChild(script);
  };

  const loadLegacyChat = () => {
    if (!legacySrc || document.getElementById('chat-button-container')) return;

    const script = document.createElement('script');
    script.id = 'chat-button-container';
    script.src = legacySrc;
    script.defer = true;

    Array.prototype.forEach.call(selectorScript.attributes, attribute => {
      if (
        attribute.name.startsWith('data-') &&
        !['data-agent-src', 'data-legacy-src'].includes(attribute.name)
      ) {
        script.setAttribute(attribute.name, attribute.value);
      }
    });

    document.head.appendChild(script);
  };

  const selectBundle = () => {
    if (document.querySelector('shopify-agent')) {
      loadAgentBundle();
    } else {
      loadLegacyChat();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', selectBundle, {once: true});
  } else {
    selectBundle();
  }
})();
