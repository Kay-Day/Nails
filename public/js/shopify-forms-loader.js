// custom web component to host the form within shadow root
(function() {
  // This placeholder will be replaced during build with the environment-specific element name
  const elementName = 'shopify-forms-embed';

  if (!customElements.get(elementName)) {
    customElements.define(
      elementName,
      class extends HTMLElement {
        constructor() {
          super();
          const shadowRoot = this.attachShadow({mode: 'open'});

          const formStyles = window.formStyles;
          if (!formStyles || !(formStyles instanceof Map)) {
            throw new Error('Failed to load form styles');
          }

          Array.from(formStyles.values()).forEach((styleSheet) => {
            try {
              const sheet = new CSSStyleSheet();
              sheet.replaceSync(styleSheet);
              shadowRoot.adoptedStyleSheets.push(sheet);
            } catch (error) {
              const style = document.createElement('style');
              style.textContent = styleSheet;
              shadowRoot.appendChild(style);
            }
          });

          // Create a MutationObserver to watch for changes in the shadow DOM
          const observer = new MutationObserver(() => {
            if (shadowRoot.innerHTML !== '') {
              this.style.display = 'block';
            }
          });

          observer.observe(shadowRoot, {childList: true, subtree: true});
        }
      },
    );
  }
})();

(function loader() {
  const src = document.currentScript.src;
  const indexSrc = src.replace(
    /(shopify-forms-loader(-dev|-staging(-\d)?)?\.js|loader\.js)$/,
    'index.js',
  );

  const script = document.createElement('script');
  script.src = indexSrc;
  script.type = 'module';
  script.defer = true;
  script.async = true;

  document.currentScript.parentNode.appendChild(script);
})();
