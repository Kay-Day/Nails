(() => {
  async function getShippingData() {
    try {
      let config = window.hoppy_free_shipping;
      if (config === null) {
        const response = await fetch("/apps/shipping-bar/shipping-data");
        if (!response.ok) throw new Error("Error fetching shipping data");
        config = await response.json();
      }
      return config;
    } catch (error) {
      console.error("Error fetching shipping data", error);
      return null;
    }
  }


  /**
   * Check if any bar needs last order date conditions
   * @param {Array} bars - Array of shipping bar configurations
   * @returns {boolean} True if any bar has last_order conditions
   */
  function needsLastOrderConditions(bars) {
    return bars.some(bar => {
      const conditions = bar.placement?.enable_condition || [];
      return conditions.includes("last_order_before") || conditions.includes("last_order_after");
    });
  }

  /**
   * Calculate and send last order condition result as boolean to cart attributes
   * Uses customer data already available in window.futureblink_free_shipping_customerInfo
   * Uses AND logic: if both last_order_before and last_order_after are enabled, both must pass
   * @param {Array} bars - Array of shipping bar configurations
   * @returns {Promise<boolean>} whether the condition was met
   */
  async function fetchCustomerLastOrderConditionMet(bars) {
    const customer = window.futureblink_free_shipping_customerInfo;

    // Return false for guest users
    if (!customer) {
      return false;
    }

    try {
      const lastOrderDate = customer.lastOrderDate || '';

      // Track conditions and results
      let hasBeforeCondition = false;
      let hasAfterCondition = false;
      let beforeResult = true;  // Default to true if no condition
      let afterResult = true;   // Default to true if no condition

      // Collect all conditions from bars and evaluate
      for (const bar of bars) {
        const conditions = bar.placement?.enable_condition || [];

        if (conditions.includes('last_order_before')) {
          hasBeforeCondition = true;
          const result = checkLastOrderBefore(
            lastOrderDate,
            bar.placement?.last_order_before_value,
            bar.placement?.last_order_before_unit
          );
          // AND logic: all before conditions must pass
          beforeResult = beforeResult && result;
        }

        if (conditions.includes('last_order_after')) {
          hasAfterCondition = true;
          const result = checkLastOrderAfter(
            lastOrderDate,
            bar.placement.last_order_after_value ?? 30,
            bar.placement.last_order_after_unit ?? 'days'
          );
          // AND logic: all after conditions must pass
          afterResult = afterResult && result;
        }
      }

      // Final result: if both conditions exist, both must be true (AND logic)
      let conditionMet = true;
      if (hasBeforeCondition) conditionMet = conditionMet && beforeResult;
      if (hasAfterCondition) conditionMet = conditionMet && afterResult;

      // Send boolean to hidden cart attributes (underscore prefix hides from cart UI)
      const response = await fetch('/cart/update.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          attributes: {
            '_futureblink_last_order_condition_met': conditionMet ? 'true' : 'false',
          }
        })
      });

      if (!response.ok) {
        console.error('Failed to send customer info to cart');
        return false;
      }
      return conditionMet;
    } catch (error) {
      console.error('Error sending customer info to cart:', error);
      return false;
    }
  }

  /**
   * Ensure last order condition is evaluated and set for bars that need it
   * @param {Array} bars - Array of shipping bar configurations
   */
  async function ensureLastOrderConditionForBars(bars) {
    // Check if any bar has last_order_before or last_order_after enabled
    if (!needsLastOrderConditions(bars)) {
      return; // No bars need last order condition
    }
    // Calculate and send the boolean condition result
    await fetchCustomerLastOrderConditionMet(bars);
  }

  console.log("money format- ", window.futureBlink_money_format)


  const root = window.Shopify.routes.root || "/";

  let cart = window.futureBlink_cart;
  const currencies = window.futureBlink_currencies;
  const bars = [];
  let giftsToAdd = [];
  let giftsToRemove = [];

  function getVariantLabel(variant) {
    return variant.options ? variant.options.join(" / ") : variant.title;
  }

  function getAddToCartElement(theme) {
    const addToCartElements = document.querySelectorAll(
      `form[action*="${root}cart/add"]`,
    );

    // Define groups of themes that share the same logic
    const themesWithSharedLogic = {
      secondToLastForm: [
        "Taiga",
        "Sleek",
        "Motto",
        "Woodstock",
        "Aurora",
        "Unicorn",
        "Toyo",
        "Whisk",
      ],
      firstForm: ["Electro", "Horizon", "Fabric", "Umino"],
      secondForm: ["Zest", "Minion", "Meka", "Abode", "Tinker", "Xclusive"],
      thirdForm: ["Editions"],
      thirdFormMain: ["Testament", "Fashionopolism"],
      forthForm: ["Vantage"],
      seventhForm: ["Beyond", "Maker"],
      buy_buttons: ["Savor", "Atelier"],
    };

    // Check if the current theme schema belongs to any group and return the appropriate form element
    for (const [key, themes] of Object.entries(themesWithSharedLogic)) {
      if (themes.includes(theme.schema_name)) {
        switch (key) {
          case "secondToLastForm":
            return addToCartElements[addToCartElements.length - 2];
          case "secondForm":
            return addToCartElements[1];
          case "thirdForm":
            const formElement = addToCartElements[0];
            const formChildren = formElement.children;
            return formChildren[2];
          case "firstForm":
            return addToCartElements[0];
          case "seventhForm":
            const formElementseventhForm = addToCartElements[0];

            const formChildrenseventhForm = formElementseventhForm.children;
            return formChildrenseventhForm[7];
          case "thirdFormMain":
            return addToCartElements[2];
          case "forthForm":
            return addToCartElements[3];
          case "buy_buttons":
            const buyButton = document.querySelector('[class*="shopify-payment-button"]');
            if (buyButton) {
              return buyButton;
            }
            else {
              const cartButton = document.querySelector('[id^="BuyButtons-ProductSubmitButton"]');
              return cartButton;
            }
          default:
            // Handle the default case if needed
            return addToCartElements[0];
            break;
        }
      }
    }

    if (theme.schema_name === "Maranello") {
      return addToCartElements[addToCartElements.length - 1].parentElement;
    }
    // Default logic for themes that don't match any group
    return addToCartElements[addToCartElements.length - 1]; // Last element as default
  }

  function createNativeVariantSelect({ product, selectedVariant, onChange }) {
    const select = document.createElement("select");

    Object.assign(select.style, {
      padding: "6px",
      border: "1px solid #ddd",
      borderRadius: "4px",
      cursor: "pointer",
      backgroundColor: "#FFFFFF",
      color: "#000000",
    });

    // Filter variants based on setting
    const variantsToShow = product.variants.filter(v => v.available !== false);

    variantsToShow.forEach((v) => {
      const option = document.createElement("option");
      option.value = v.id;
      option.textContent = getVariantLabel(v);

      // Default colors
      option.style.backgroundColor = "#FFFFFF";
      option.style.color = "#000000";

      // Hover (works in Chromium browsers only)
      option.addEventListener("mouseenter", () => {
        option.style.backgroundColor = "#000000";
        option.style.color = "#FFFFFF";
      });

      option.addEventListener("mouseleave", () => {
        option.style.backgroundColor = "#FFFFFF";
        option.style.color = "#000000";
      });

      if (v.id === selectedVariant.id) option.selected = true;
      select.appendChild(option);
    });

    select.addEventListener("change", (e) => {
      const variant = variantsToShow.find((v) => v.id == e.target.value);
      if (variant) onChange(variant);
    });

    return select;
  }

  function createCustomVariantDropdown({ product, selectedVariant, onChange }) {
    let selectedVariantId = selectedVariant.id;

    // Filter variants based on setting
    const variantsToShow = product.variants.filter(v => v.available !== false);

    // Wrapper (same as before)
    const variantDropdown = document.createElement("div");
    variantDropdown.style.minWidth = "160px";
    variantDropdown.style.cursor = "pointer";
    variantDropdown.style.userSelect = "none";

    // Selected display
    const selectedDisplay = document.createElement("div");
    selectedDisplay.style.display = "flex";
    selectedDisplay.style.alignItems = "center";
    selectedDisplay.style.justifyContent = "space-between";
    selectedDisplay.style.padding = "6px";
    selectedDisplay.style.border = "1px solid #ddd";
    selectedDisplay.style.borderRadius = "4px";
    selectedDisplay.style.backgroundColor = "#FFFFFF";
    selectedDisplay.style.color = "#000000";

    const titleSpan = document.createElement("span");
    titleSpan.textContent = selectedVariant.title;

    // Arrow SVG (same as yours)
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    arrow.setAttribute("width", "20");
    arrow.setAttribute("height", "20");
    arrow.setAttribute("viewBox", "0 0 24 24");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M8 10l4 4 4-4");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "2.5");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");

    arrow.appendChild(path);

    selectedDisplay.appendChild(titleSpan);
    selectedDisplay.appendChild(arrow);

    // Dropdown body (same behavior)
    const bodyDropdown = document.createElement("div");
    bodyDropdown.style.position = "fixed";
    bodyDropdown.style.maxHeight = "200px";
    bodyDropdown.style.overflowY = "auto";
    bodyDropdown.style.backgroundColor = "#FFFFFF";
    bodyDropdown.style.border = "1px solid #ddd";
    bodyDropdown.style.zIndex = "2147483647";
    bodyDropdown.style.display = "none";

    variantsToShow.forEach((v) => {
      const option = document.createElement("div");
      option.textContent = v.title;
      option.style.padding = "6px";
      option.style.cursor = "pointer";
      option.style.backgroundColor = "#FFFFFF";
      option.style.color = "#000000";

      option.addEventListener("mouseenter", () => {
        option.style.backgroundColor = "#000000";
        option.style.color = "#FFFFFF";
      });

      option.addEventListener("mouseleave", () => {
        option.style.backgroundColor = "#FFFFFF";
        option.style.color = "#000000";
      });

      option.addEventListener("click", () => {
        selectedVariantId = v.id;
        titleSpan.textContent = v.title;
        bodyDropdown.style.display = "none";
        onChange(v);
      });

      bodyDropdown.appendChild(option);
    });

    document.body.appendChild(bodyDropdown);

    // Open dropdown
    selectedDisplay.addEventListener("click", (e) => {
      e.stopPropagation();
      const rect = selectedDisplay.getBoundingClientRect();
      bodyDropdown.style.minWidth = rect.width + "px";
      bodyDropdown.style.left = rect.left + "px";
      bodyDropdown.style.top = rect.bottom + "px";
      bodyDropdown.style.display = "block";
    });

    // Close on outside click
    document.addEventListener("click", () => {
      bodyDropdown.style.display = "none";
    });

    // Close on scroll (to avoid dropdown detaching from trigger)
    const closeOnScroll = (e) => {
      // Don't close if scrolling inside the dropdown itself
      if (e && e.target && (e.target === bodyDropdown || bodyDropdown.contains(e.target))) {
        return;
      }
      bodyDropdown.style.display = "none";
    };
    window.addEventListener("scroll", closeOnScroll, { passive: true });
    window.addEventListener("resize", closeOnScroll, { passive: true });
    // Also catch scroll inside cart drawers / modals (scroll doesn't bubble, so use capture)
    document.addEventListener("scroll", closeOnScroll, { capture: true, passive: true });

    variantDropdown.appendChild(selectedDisplay);

    return variantDropdown;
  }

  async function fetchUpsellProducts(upsellData) {
    if (upsellData.upsell_type === "upsell_same_product") {
      return [window.futureblink_free_shipping_upsellProd];
    }

    if (
      upsellData.upsell_type === "specific_prod" &&
      upsellData.upsell_prod &&
      upsellData.upsell_prod.length > 0
    ) {
      const handles = upsellData.upsell_prod.map((item) => item.handle);

      const requests = handles.map(async (handle) => {
        const res = await fetch(
          window.Shopify.routes.root + `products/${handle}.js`,
        );
        if (!res.ok) return null;
        return res.json();
      });

      const products = await Promise.all(requests);
      return products.filter(Boolean);
    }

    if (
      upsellData.upsell_type === "specific_col" &&
      upsellData.upsell_prod &&
      upsellData.upsell_prod.length > 0
    ) {
      const collectionHandles = upsellData.upsell_prod.map(
        (item) => item.handle,
      );

      const requests = collectionHandles.map(async (handle) => {
        const res = await fetch(
          window.Shopify.routes.root + `collections/${handle}/products.json`,
        );
        if (!res.ok) return [];
        const data = await res.json();
        return data.products || [];
      });

      const collectionsProducts = await Promise.all(requests);

      // flatten + randomize
      const allProducts = collectionsProducts.flat();

      const randomProducts = allProducts
        .sort(() => Math.random() - 0.5)
        .slice(0, upsellData.max_products);

      return randomProducts;
    }

    return [];
  }

  async function fetchRandomProduct() {
    try {
      // If cart is empty, fetch from the "all" collection
      const response = await fetch(
        `${window.Shopify.routes.root}collections/all/products.json?limit=5`
      );
      if (response.ok) {
        const data = await response.json();
        const products = data.products || [];
        if (products.length > 0) {
          const randomProduct = products[Math.floor(Math.random() * products.length)];
          return { id: randomProduct.id };
        }
      }

      return null;
    } catch (error) {
      console.error("Error fetching random product for recommendations:", error);
      return null;
    }
  }

  function trackLoadingSpinner(form, onStart, onFinish) {
    if (!form) return;

    // Find the spinner element (anywhere inside form)
    const spinner = form.querySelector(".loading__spinner");
    if (!spinner) {
      console.warn("[CartDispatch] No .loading__spinner found in form");
      return;
    }

    // Helper to check spinner visibility
    const isHidden = () =>
      spinner.hasAttribute("hidden") || spinner.classList.contains("hidden");

    // Wait for it to become visible (start of loading)
    const checkStart = setInterval(() => {
      if (!isHidden()) {
        clearInterval(checkStart);
        if (typeof onStart === "function") onStart();

        // Once visible, watch until it hides again
        const checkEnd = setInterval(() => {
          if (isHidden()) {
            clearInterval(checkEnd);
            if (typeof onFinish === "function") onFinish();
          }
        }, 100);
      }
    }, 100);
  }

  async function addToCartWithLoader(
    variantId,
    ctaButton,
    upsellData,
    translations,
    bar_id,
  ) {
    if (!variantId || !ctaButton) return;

    // ---- Loader helpers ----
    const startLoader = () => {
      ctaButton.disabled = true;
      ctaButton.innerHTML = `<span class="spinner"></span>`;
    };

    const stopLoader = () => {
      ctaButton.disabled = false;
      ctaButton.textContent =
        translations?.upsellButtonTextAfter ||
        upsellData.cta_text_after ||
        "Add to Cart";
    };

    // ---- Detect theme form ----
    // 1) Try the most explicit add-to-cart form selectors first
    let form = document.querySelector('form[data-type="add-to-cart-form"]');

    // 2) Look for forms with a submit button (add to cart button)
    if (!form) {
      const allForms = document.querySelectorAll('form[action*="/cart/add"]');
      for (const f of allForms) {
        // Must have a submit button or input[name="id"] to be a real add-to-cart form
        const hasSubmit = f.querySelector('button[type="submit"], input[type="submit"]');
        const hasVariantId = f.querySelector('input[name="id"]');
        if (hasSubmit && hasVariantId) {
          form = f;
          break;
        }
      }
    }

    // 3) If inside product-form custom element, find the form with both submit + variant input
    const productForm = document.querySelector("product-form");
    if (!form && productForm) {
      const forms = productForm.querySelectorAll('form');
      for (const f of forms) {
        const hasSubmit = f.querySelector('button[type="submit"], input[type="submit"]');
        const hasVariantId = f.querySelector('input[name="id"]');
        if (hasSubmit && hasVariantId) {
          form = f;
          break;
        }
      }
    }

    // 4) Last fallback: any form with /cart/add action and a submit button
    if (!form) {
      const allForms = document.querySelectorAll('form[action*="/cart/add"]');
      for (const f of allForms) {
        if (f.querySelector('button[type="submit"], input[type="submit"]')) {
          form = f;
          break;
        }
      }
    }

    // Shared properties
    const upsellPropertyKey = "_hoppy_free_shipping_upsell";
    const upsellPropertyValue = bar_id;

    try {
      // ----------------------------------------------------
      // 1) IMPULSE THEME AJAX ADD (prevent redirect to cart)
      // ----------------------------------------------------
      if (["Impulse", "Motion"].includes(window.Shopify?.theme?.schema_name)) {
        startLoader();

        const formData = new FormData();
        formData.append("id", variantId);
        formData.append("quantity", 1);
        formData.append(`properties[${upsellPropertyKey}]`, upsellPropertyValue);

        const res = await fetch("/cart/add.js", {
          method: "POST",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
          },
          body: formData,
        });

        if (!res.ok) throw new Error("Failed to add product to cart");

        const data = await res.json();

        // Check if we're on the cart page
        const isCartPage = window.location.pathname.includes("/cart");

        if (isCartPage) {
          window.location.reload();
        } else {
          // On other pages, trigger cart update events that Impulse theme listens to
          document.dispatchEvent(
            new CustomEvent("ajaxProduct:added", {
              detail: { product: data },
            })
          );

          // Also trigger a generic cart update event
          document.dispatchEvent(
            new CustomEvent("cart:updated", {
              detail: { product: data },
            })
          );

          // Fetch and update cart drawer if it exists
          const cartDrawer = document.querySelector(".drawer--cart");
          if (cartDrawer) {
            // Trigger the theme's cart drawer to refresh
            const cartResponse = await fetch("/cart.js");
            const cartData = await cartResponse.json();
            document.dispatchEvent(
              new CustomEvent("cart:refresh", {
                detail: { cart: cartData },
              })
            );
          }
        }

        stopLoader();
        return;
      }

      // ----------------------------------------------------
      // 2) THEME PRODUCT FORM SUBMIT (uses real theme form)
      // ----------------------------------------------------
      if (form) {
        startLoader();

        if (typeof trackLoadingSpinner === "function") {
          trackLoadingSpinner(form, startLoader, stopLoader);
        }

        // Save original values
        const variantInput = form.querySelector('input[name="id"]');
        const productInput = form.querySelector('input[name="product-id"]');
        const quantityInput = form.querySelector('[name="quantity"]') || document.querySelector('[name="quantity"]');
        const originalVariantValue = variantInput?.value;
        const originalProductValue = productInput?.value;
        const originalQuantityValue = quantityInput ? quantityInput.value : undefined;

        if (productInput) productInput.value = variantId;
        if (variantInput) variantInput.value = variantId;
        if (quantityInput) quantityInput.value = "1";
        // ---- Add custom properties ----
        const propertyInput = document.createElement("input");
        propertyInput.type = "hidden";
        propertyInput.name = `properties[${upsellPropertyKey}]`;
        propertyInput.value = upsellPropertyValue;
        form.appendChild(propertyInput);

        // Submit event
        const event = new SubmitEvent("submit", {
          bubbles: true,
          cancelable: true,
          submitter: form.querySelector('[type="submit"]') || null,
        });

        form.dispatchEvent(event);

        // Cleanup
        propertyInput.remove();
        if (productInput) productInput.value = originalProductValue;
        if (variantInput) variantInput.value = originalVariantValue;
        if (quantityInput && originalQuantityValue !== undefined) {
          quantityInput.value = originalQuantityValue;
        }

        stopLoader();
        return;
      }

      // ----------------------------------------------------
      // 3) REFORMATION THEME AJAX ADD
      // ----------------------------------------------------
      if (window.Shopify?.theme?.schema_name === "Reformation") {
        startLoader();

        const sectionsToRender = [
          { id: "Cart", section: "main-cart", selector: ".thb-cart-form" },
          {
            id: "Cart-Drawer",
            section: "cart-drawer",
            selector: ".cart-drawer",
          },
          {
            id: "cart-drawer-toggle",
            section: "cart-bubble",
            selector: ".thb-item-count",
          },
        ];

        const formData = new FormData();
        formData.append("id", variantId);
        formData.append("quantity", 1);

        // ---- ADD CUSTOM PROPERTY ----
        formData.append(
          `properties[${upsellPropertyKey}]`,
          upsellPropertyValue,
        );

        formData.append(
          "sections",
          sectionsToRender.map((s) => s.section),
        );
        formData.append("sections_url", window.location.pathname);

        const res = await fetch(theme.routes.cart_add_url, {
          method: "POST",
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            Accept: "application/javascript",
          },
          body: formData,
        });

        const data = await res.json();

        // Update sections
        sectionsToRender.forEach((section) => {
          const element =
            document
              .getElementById(section.id)
              ?.querySelector(section.selector) ||
            document.getElementById(section.id);

          if (element && data.sections && data.sections[section.section]) {
            element.innerHTML = new DOMParser()
              .parseFromString(data.sections[section.section], "text/html")
              .querySelector(section.selector).innerHTML;
          }
        });

        document.dispatchEvent(
          new CustomEvent("cart:item-added", {
            detail: { product: data.items ? data.items[0] : data },
          }),
        );

        stopLoader();
        return;
      }

      // ----------------------------------------------------
      // 4) FALLBACK AJAX /cart/add.js METHOD
      // ----------------------------------------------------
      startLoader();

      const res = await fetch("/cart/add.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          id: parseInt(variantId, 10),
          quantity: 1,
          properties: {
            [upsellPropertyKey]: upsellPropertyValue,
          },
        }),
      });

      if (!res.ok) throw new Error("Failed to add product to cart");

      await res.json();

      stopLoader();
      window.location.href = "/cart";
    } catch (error) {
      console.error("Add to cart failed:", error);
      stopLoader();
    }
  }

  function extractText(format) {
    if (!format) return format;

    const div = document.createElement("div");
    div.innerHTML = format;
    return div.textContent.trim();
  }


  const formatAmount = (
    contentData,
    designData,
    amount,
    storeCurrency,
    includeAnimation = true,
    forceCurrency = false
  ) => {
    // Convert amount to number
    amount = Number(amount);

    let moneyFormat = contentData.money_format === "store_default"
      ? (window.futureBlink_money_format || "{{amount}}")
      : contentData.money_format;

    const animationAttr = includeAnimation
      ? `data-animation-futureblink-shipping="${designData.price_text_animation}"`
      : "";

    moneyFormat = extractText(moneyFormat);

    const size = designData.price_text_size || "16px";
    const color = designData.price_text_color || "#000";

    // 1️⃣ Product quantity → just show number (unless forcing currency for upsell prices)
    if (contentData.goal_type === "product_quantity" && !forceCurrency) {
      return `<span ${animationAttr} class="futureblink-price-text money" style="font-size:${size}; color:${color};">${amount}</span>`;
    }

    const showSymbol = contentData.show_currency_symbol;
    const position = contentData.currency_symbol_position;

    // 2️⃣ Format number (Shopify rules)
    let formattedNumber;

    // Decimals
    if (moneyFormat.includes("amount_no_decimals")) {
      formattedNumber = Math.round(amount).toString();
    } else {
      formattedNumber = amount.toFixed(2);
    }

    let parts = formattedNumber.split(".");

    // Separators (match Shopify table)
    if (moneyFormat.includes("amount_with_comma_separator")) {
      // 1.134,65
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      formattedNumber = parts.join(",");
    } else if (moneyFormat.includes("amount_with_apostrophe_separator")) {
      // 1'134.65
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "'");
      formattedNumber = parts.join(".");
    } else if (moneyFormat.includes("amount_with_space_separator")) {
      // 1 134,65
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
      formattedNumber = parts.join(",");
    } else if (moneyFormat.includes("amount_with_period_and_space_separator")) {
      // 1 134.65
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
      formattedNumber = parts.join(".");
    } else {
      // DEFAULT ({{ amount }} and {{ amount_no_decimals }})
      // 1,134.65 or 1,135
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      formattedNumber = parts.join(".");
    }
    // 3️⃣ Extract currency symbol/text
    let symbol = "";
    if (moneyFormat) {
      // Get currency symbol from currencies object based on storeCurrency parameter (market-specific)
      // Priority: 1) Symbol from moneyFormat string, 2) Market-specific symbol, 3) ContentData currencySymbol
      const marketCurrencySymbol = (storeCurrency && window.futureBlink_currencies?.[storeCurrency]?.symbol);
      const currencySymbol = marketCurrencySymbol || contentData.currencySymbol || "";
      symbol = extractText(window.futureBlink_money_format).replace(/{{\s*amount.*?}}/g, "").trim() || (showSymbol ? currencySymbol : "");
    }

    // 4️⃣ Combine symbol + value
    let formattedValue;
    if (showSymbol && symbol) {
      formattedValue =
        position === "before"
          ? `${symbol}${formattedNumber}`
          : `${formattedNumber}${symbol}`;
    } else {
      formattedValue = `${formattedNumber} ${storeCurrency || ""}`;
    }

    // 5️⃣ Wrap in span
    return `<span ${animationAttr} class="futureblink-price-text money" style="font-size:${size}; color:${color};">${formattedValue}</span>`;
  };



  function getPriceByVariantId(variantId, productHandle = null) {
    if (window.futureblink_free_shipping_productDetails) {
      return window.futureblink_free_shipping_productDetails.price;
    } else {
      // Fetch the product JSON and return the variant price
      return fetch(`/products/${productHandle}.js`)
        .then((res) => {
          if (!res.ok) throw new Error("Product fetch failed");
          return res.json();
        })
        .then((product) => {
          const variant = product.variants.find((v) => v.id === variantId);
          if (!variant) throw new Error("Variant not found");
          return variant.price;
        });
    }
  }

  function hasProductDicount(cart) {
    return cart.items.some((item) => item.line_level_total_discount !== 0);
  }

  const AnimationHandlers = {
    count_up: (el, designData) => {
      const duration = (designData.count_up_speed || 1) * 1000;
      const originalText = el.textContent.trim();

      // Extract prefix, numeric part, suffix
      const match = originalText.match(
        /^([^0-9.,' \u00A0-]*)([0-9.,' \u00A0]+)([^0-9.,' \u00A0]*)$/,
      );
      if (!match) return;

      let prefix = match[1] || "";
      let numberStr = match[2] || "";
      let suffix = match[3] || "";

      // Always add a space before suffix (EUR)
      if (suffix && !suffix.startsWith(" ")) suffix = " " + suffix;

      // Replace NBSP with space
      numberStr = numberStr.replace(/\u00A0/g, " ");

      // --- Detect DECIMAL separator ---
      let decimalSep = null;

      const lastComma = numberStr.lastIndexOf(",");
      const lastDot = numberStr.lastIndexOf(".");

      if (lastComma > -1 && /^\d{1,2}$/.test(numberStr.slice(lastComma + 1))) {
        decimalSep = ",";
      }
      if (
        !decimalSep &&
        lastDot > -1 &&
        /^\d{1,2}$/.test(numberStr.slice(lastDot + 1))
      ) {
        decimalSep = ".";
      }

      // --- Detect THOUSANDS separator ---
      let thousandsSep = null;

      if (numberStr.includes("'")) thousandsSep = "'";
      else if (numberStr.includes(" ")) thousandsSep = " ";
      else if (decimalSep === "," && numberStr.includes("."))
        thousandsSep = ".";
      else if (decimalSep === "." && numberStr.includes(","))
        thousandsSep = ",";

      // --- Make sure decimalSep is NEVER null when decimals exist ---
      let decimals = 0;
      if (decimalSep && numberStr.includes(decimalSep)) {
        decimals = numberStr.split(decimalSep)[1].length;
      }

      // If format requires decimals but decimalSep is null → fix it
      if (
        decimals === 0 &&
        window.futureBlink_money_format?.includes("amount_with_comma_separator")
      ) {
        decimalSep = ",";
        decimals = 2;
      }

      // If thousands separator missing but original has space groups → enforce it
      if (!thousandsSep && numberStr.includes(" ")) {
        thousandsSep = " ";
      }

      // --- Parse number ---
      let normalized = numberStr;

      if (thousandsSep) {
        const esc = thousandsSep.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
        normalized = normalized.replace(new RegExp(esc, "g"), "");
      }

      if (decimalSep && decimalSep !== ".") {
        const esc = decimalSep.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
        normalized = normalized.replace(new RegExp(esc), ".");
      }

      normalized = normalized.replace(/[^\d.-]/g, "");

      const target = parseFloat(normalized);
      if (!isFinite(target)) return;

      // Animation setup
      const start = Math.max(0, target - 5);
      const startTime = performance.now();

      el.innerHTML = prefix;
      const container = document.createElement("span");
      el.appendChild(container);
      el.insertAdjacentText("beforeend", suffix);

      // Format number with repaired settings
      function formatNumber(n) {
        const fixed =
          decimals > 0 ? n.toFixed(decimals) : String(Math.round(n));
        let [intPart, decPart] = fixed.split(".");

        if (thousandsSep) {
          intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSep);
        }

        if (decimals > 0) return intPart + decimalSep + decPart;
        return intPart;
      }

      function update(t) {
        const progress = Math.min((t - startTime) / duration, 1);
        const value = start + (target - start) * progress;

        container.textContent = formatNumber(value);
        if (progress < 1) requestAnimationFrame(update);
      }

      requestAnimationFrame(update);
    },
    keyboard: (el, designData = null) => {
      const original = el.textContent;
      if (!original) return;

      const typeOnce = () => {
        el.textContent = "";

        [...original].forEach((char, index) => {
          const span = document.createElement("span");
          span.innerHTML = char === " " ? "&nbsp;" : char;
          span.style.opacity = "0";
          span.style.display = "inline-block";
          span.style.animation = "keyboard-fade 0.05s ease forwards";
          span.style.animationDelay = `${index * 0.05}s`;
          el.appendChild(span);
        });

        const totalDuration = original.length * 50 + 1000;
        setTimeout(() => {
          typeOnce();
        }, totalDuration);
      };

      if (!document.getElementById("keyboard-fade-style")) {
        const style = document.createElement("style");
        style.id = "keyboard-fade-style";
        style.innerHTML = `
        @keyframes keyboard-fade {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `;
        document.head.appendChild(style);
      }

      typeOnce();
    },
    handwriting: (el) => {
      const original = el.textContent;
      if (!original) return;

      const animateOnce = () => {
        el.innerHTML = "";

        [...original].forEach((char, index) => {
          const span = document.createElement("span");
          span.innerHTML = char === " " ? "&nbsp;" : char;
          span.style.opacity = "0";
          span.style.display = "inline-block";
          span.style.animation = "handwriting-fade 0.12s ease forwards";
          span.style.animationDelay = `${index * 0.14}s`;
          span.classList.add("handwriting-style");
          el.appendChild(span);
        });

        const totalDuration = original.length * 140 + 1000; // length-based delay + pause
        setTimeout(() => {
          animateOnce(); // Repeat
        }, totalDuration);
      };

      // Inject CSS only once
      if (!document.getElementById("handwriting-fade-style")) {
        const style = document.createElement("style");
        style.id = "handwriting-fade-style";
        style.innerHTML = `
        @keyframes handwriting-fade {
          from {
            opacity: 0;
            transform: translateY(6px) rotateZ(-3deg) scale(0.96);
            filter: blur(1px);
          }
          to {
            opacity: 1;
            transform: translateY(0) rotateZ(0deg) scale(1);
            filter: blur(0);
          }
        }
  
        .handwriting-style {
          font-family: "Brush Script MT", "Lucida Handwriting", cursive;
          font-style: italic;
          letter-spacing: 0.5px;
          line-height: 1.4;
        }
      `;
        document.head.appendChild(style);
      }

      animateOnce();
    },
    neon_glow: (el, designData) => {
      const baseColor = designData.neon_animation_color;

      // Utility to lighten hex color
      const lightenColor = (hex, amt) => {
        const num = parseInt(hex.replace("#", ""), 16);
        const r = Math.min(255, ((num >> 16) & 0xff) + amt);
        const g = Math.min(255, ((num >> 8) & 0xff) + amt);
        const b = Math.min(255, (num & 0xff) + amt);
        return `rgb(${r}, ${g}, ${b})`;
      };

      const midColor = lightenColor(baseColor, 40);
      const finalColor = lightenColor(baseColor, 80);

      // Clean up old style block
      const oldStyle = document.getElementById("neon-glow-style");
      if (oldStyle) oldStyle.remove();

      // Add updated @keyframes block
      const style = document.createElement("style");
      style.id = "neon-glow-style";
      style.innerHTML = `
      @keyframes neon-glow {
        0%, 100% {
          text-shadow:
            0 0 5px ${baseColor},
            0 0 10px ${baseColor},
            0 0 20px ${baseColor},
            0 0 40px ${midColor};
        }
        50% {
          text-shadow:
            0 0 10px ${midColor},
            0 0 20px ${midColor},
            0 0 30px ${finalColor};
        }
      }
    `;
      document.head.appendChild(style);

      // Apply the animation
      el.style.animation = "neon-glow 2.5s ease-in-out infinite";
    },
  };

  function applyCustomCss(designData, id) {
    if (designData.custom_css_applied && designData.custom_css) {
      const scope = `.futureblink-free-shipping_${id}`;
      const MOBILE_MEDIA = "@media (max-width: 767px)";
      const lines = designData.custom_css.split("\n");

      let result = "";
      let insideMedia = false;
      let insideBlock = false;
      let insideAutoMobileMedia = false;

      for (let line of lines) {
        const trimmed = line.trim();

        if (!trimmed) {
          result += "\n";
          continue;
        }

        // Preserve user media queries
        if (trimmed.startsWith("@media")) {
          insideMedia = true;
          result += `${line}\n`;
          continue;
        }

        // End of media query
        if (insideMedia && trimmed === "}") {
          insideMedia = false;
          result += "}\n";
          continue;
        }

        // Selector line
        if (trimmed.endsWith("{")) {
          insideBlock = true;

          const selectors = trimmed.slice(0, -1).split(",");

          const isMobileSelector = selectors.some((s) =>
            s.includes(".futureblink-free-shipping.mobile"),
          );

          const scopedSelectors = selectors.map((s) =>
            `${scope} ${s
              .replace(/\.futureblink-free-shipping\.mobile/g, "")
              .replace(/\.futureblink-free-shipping/g, "")
              .trim()}`,
          );

          if (isMobileSelector && !insideMedia) {
            result += `${MOBILE_MEDIA} {\n`;
            insideAutoMobileMedia = true;
          }

          result += `${scopedSelectors.join(", ")} {\n`;
          continue;
        }

        // End of block
        if (trimmed === "}") {
          insideBlock = false;
          result += "}\n";

          if (insideAutoMobileMedia) {
            result += "}\n";
            insideAutoMobileMedia = false;
          }
          continue;
        }

        // Properties inside block
        if (insideBlock) {
          if (trimmed.startsWith("/*") || trimmed.endsWith("*/")) {
            result += `${line}\n`;
          } else if (trimmed.includes(":")) {
            const parts = trimmed.split(":");
            const prop = parts[0].trim();
            const value = parts.slice(1).join(":").trim().replace(/;$/, "");
            result += `  ${prop}: ${value} !important;\n`;
          } else {
            result += `${line}\n`;
          }
          continue;
        }

        // Any other line
        result += `${line}\n`;
      }

      const style = document.createElement("style");
      style.setAttribute("data-futureblink", id);
      style.textContent = result;
      document.head.appendChild(style);
    }
  }

  function runAnimations(designData) {
    const animatedElements = document.querySelectorAll(
      "[data-animation-futureblink-shipping]",
    );
    animatedElements.forEach((el) => {
      const type = el.getAttribute("data-animation-futureblink-shipping");
      const handler = AnimationHandlers[type];
      if (handler) {
        handler(el, designData);
      }
    });
  }

  // Run after DOM loads
  // document.addEventListener("DOMContentLoaded", () => {
  //   runAnimations(designData=null);
  // });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.zIndex = "9999";
  canvas.style.pointerEvents = "none";

  let futureblink_canvas_width, futureblink_canvas_height;
  function resizeCanvas() {
    futureblink_canvas_width = canvas.width = window.innerWidth;
    futureblink_canvas_height = canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  class Firework {
    constructor(x, y, colors) {
      this.x = x;
      this.y = y;
      this.particles = [];
      this.colors = colors || ["#ff0043", "#14fc56", "#1e90ff", "#ffff00"];

      for (let i = 0; i < 100; i++) {
        this.particles.push(this.createParticle());
      }
    }

    createParticle() {
      const angle = Math.random() * 2 * Math.PI;
      const speed = Math.random() * 5 + 2;
      return {
        x: this.x,
        y: this.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        color: this.colors[Math.floor(Math.random() * this.colors.length)],
      };
    }

    update() {
      this.particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.alpha -= 0.01;
      });
      this.particles = this.particles.filter((p) => p.alpha > 0);
    }

    draw(ctx) {
      this.particles.forEach((p) => {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, 2 * Math.PI);
        ctx.fill();
      });
    }

    isDone() {
      return this.particles.length === 0;
    }
  }

  const fireworks = [];
  let animating = false;

  function animate() {
    // Transparent background: just fade old particles slightly instead of black fill
    ctx.clearRect(0, 0, futureblink_canvas_width, futureblink_canvas_height);

    fireworks.forEach((fw) => {
      fw.update();
      fw.draw(ctx);
    });

    for (let i = fireworks.length - 1; i >= 0; i--) {
      if (fireworks[i].isDone()) {
        fireworks.splice(i, 1);
      }
    }

    if (fireworks.length > 0) {
      requestAnimationFrame(animate);
    } else {
      animating = false;
      ctx.clearRect(0, 0, futureblink_canvas_width, futureblink_canvas_height);
      canvas.remove();
    }
  }

  // Public function to launch a firework
  function launchFirework() {
    if (!document.body.contains(canvas)) {
      document.body.appendChild(canvas);
      resizeCanvas();
    }

    const x = futureblink_canvas_width / 2;
    const y = futureblink_canvas_height / 2;
    fireworks.push(new Firework(x, y));

    if (!animating) {
      animating = true;
      animate();
    }
  }

  const getIconStyle = async (designData) => {
    if (!designData.icon) return null;
    const url = `/apps/shipping-bar/api/icons?icon=${encodeURIComponent(designData.icon)}&color=${encodeURIComponent(designData.icon_color)}&type=${encodeURIComponent(designData.icon.includes("outline") ? "outline" : "filled")}&size=${designData.icon_size}`;
    if (designData.iconSource === "upload") {
      return `<div style="height:${designData.icon_size}px;width:${designData.icon_size}px;background-image:url('${designData.icon}'); background-position:center center; background-color:transparent; background-repeat:no-repeat;background-size:${designData.icon_size}px; display:block;"></div>`;
    } else {
      return `<div style="height:${designData.icon_size}px;width:${designData.icon_size}px;mask-image:url('/apps/shipping-bar${designData.icon}');-webkit-mask-image:url('/apps/shipping-bar${designData.icon}'); mask-position:center;-webkit-mask-position:center;  mask-repeat:no-repeat; -webkit-mask-repeat:no-repeat; mask-size:${designData.icon_size}px; -webkit-mask-size:${designData.icon_size}px; background-color:${designData.icon_color}; display:block;"></div>`;

      // const response = await fetch(url);
      // icon = await response.json();
      // return icon
    }
  };

  const getGoalIconStyle = async (designData, iconData) => {
    if (iconData.iconSource === "upload") {
      return `<div style="height:32px;width:32px;background-image:url('${iconData.icon}'); background-position:center center; background-color:transparent; background-repeat:no-repeat;background-size:32px; display:block;"></div>`;
    } else {
      return `<div style="height:32px;width:32px;mask-image:url('/apps/shipping-bar${iconData.icon}');-webkit-mask-image:url('/apps/shipping-bar${iconData.icon}'); mask-position:center;-webkit-mask-position:center;  mask-repeat:no-repeat; -webkit-mask-repeat:no-repeat; mask-size:32px; -webkit-mask-size:32px; background-color:${designData.icon_color}; display:block;"></div>`;

      // const response = await fetch(url);
      // icon = await response.json();
      // return icon
    }
  };

  function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  }

  const getUTMParamsFromDB = (utmCodes) => {
    const utmParams = {};
    const utmPairs = utmCodes.split(",");
    utmPairs.forEach((pair) => {
      const [key, value] = pair.split("=");
      if (key && value) {
        utmParams[key.trim()] = value.trim();
      }
    });
    return utmParams;
  };

  // Visitors and UTM handling
  const getUTMParams = (string) => {
    const params = new URLSearchParams(string);
    const utmParams = {};

    params.forEach((value, key) => {
      if (key.startsWith("utm_")) {
        utmParams[key] = value;
      }
    });
    return utmParams;
  };

  function visitorsCheck(shippingBarData) {
    const sourceParam = getQueryParam("utm_source");

    // visitors array contains standard platforms (google, facebook) and/or 'utm_code' flag
    const allVisitors = shippingBarData.visitors || [];
    if (!(allVisitors.includes("facebook") && allVisitors.includes("instagram"))) {
      if (allVisitors.includes("facebook")) {
        allVisitors.push("instagram");
      }
      if (allVisitors.includes("instagram")) {
        allVisitors.push("facebook");
      }
    }

    if (!shippingBarData.allow_utm_source) return true;

    const platformVisitors = allVisitors.filter((v) => v !== "utm_code");
    const hasCustomUtmFlag =
      allVisitors.includes("utm_code") || !!shippingBarData.utmCode;

    const utmCodeFromDB = shippingBarData.utmCode || "";
    const utmParamsFromDB = getUTMParamsFromDB(utmCodeFromDB);
    const currentUtmParams = getUTMParams(window.location.search);

    // 1. Check Standard Platforms
    let isPlatformValid = false;
    if (platformVisitors.length > 0) {
      // If platform is selected, url must have matching utm_source
      isPlatformValid = platformVisitors.includes(sourceParam);
    }

    // 2. Check Custom UTM Code
    let isCustomUtmValid = false;
    if (hasCustomUtmFlag) {
      const dbEntries = Object.entries(utmParamsFromDB);
      // Only valid if we have rules to match against
      if (dbEntries.length > 0) {
        isCustomUtmValid = dbEntries.every(
          ([key, value]) => currentUtmParams[key] === value,
        );
      }
    }

    // 3. Final Decision
    // If NO restrictions (no specific platforms and no custom flag), show to everyone
    if (platformVisitors.length === 0 && !hasCustomUtmFlag) {
      return true;
    }

    // Otherwise, OR condition
    return isPlatformValid || isCustomUtmValid;
  }

  async function renderShippingBar() {
    //  try {
    //       const response = await fetch("/apps/shipping-bar/shipping-data", {
    //         method: "POST",
    //         headers: {
    //           "Content-Type": "application/json",
    //         },
    //         body: JSON.stringify({ rate: window.Shopify.currency.rate}),
    //       });

    //       const data = await response.json();

    //       if (!data.success) {
    //         console.warn("Unexpected response:", data);
    //         throw new Error("rates update failed");
    //       }

    //       console.log("rate set successfully:");
    //     } catch (error) {
    //       console.error("Error setting rates:", error);
    //     }

    const data = await getShippingData();
    if (!data) return;

    // Ensure last order date is set for bars that need it
    if (data.shipping && data.shipping.length > 0) {
      await ensureLastOrderConditionForBars(data.shipping);
    }

    const nonGoalBased = data.shipping.filter(
      (bar) => bar.type !== "goal_based",
    );
    const goalBars = data.shipping.filter((bar) => bar.type === "goal_based");


    const separatedBars = goalBars.flatMap((bar) => {
      const result = [];
      let freeGiftAssigned = false;

      // Check if this bar has any free_gift rewards
      const hasFreeGift = bar.content?.goals?.some(g => g.reward_type === "free_gift");

      // Helper to get goals for each separated bar
      // Only free_gift is assigned to first bar, other reward types remain for all bars
      const getGoalsForBar = (originalGoals, barType) => {
        if (!hasFreeGift || freeGiftAssigned) {
          // Either no free gift in original, or already assigned to first bar
          // Only change free_gift to no_discount, keep other reward types as-is
          return originalGoals.map(g => {
            if (g.reward_type === "free_gift") {
              return {
                ...g,
                reward_type: "no_discount",
                reward_value: ""
              };
            }
            return g;
          });
        }
        // First bar gets the original goals with free_gift
        freeGiftAssigned = true;
        console.log(`[Shipping Bar] Free gift assigned to: ${barType} (bar id: ${bar.id})`);
        return originalGoals;
      };

      const isLegacyCartPage = bar.cart_page?.enabled === true;


      // 1️⃣ Legacy cart_page → split (cart_page itself is NEVER emitted)
      if (isLegacyCartPage) {
        bar.cart_page.upsell_enabled = typeof bar.cart_page.upsell_enabled === "boolean" ? bar.cart_page.upsell_enabled : true;
        ["cart_page_only", "cart_drawer"].forEach((type) => {
          result.push({
            ...bar.cart_page,
            design: {
              goal_icons: [],
              upsell_section_title_size: 14,
              upsell_section_title_color: "#000000",
              multiple_goals_marker: "one",
              position: normalizePosition(bar.cart_page.design?.position, bar.cart_page.design?.sticky),
              ...bar.cart_page.design,
            },
            type,
            translations: bar.translations,
            content: { ...bar.content, goals: getGoalsForBar(bar.content.goals, type), money_format: bar.content.money_format || "store_default" },
            placement: bar.placement,
            upsell: {
              upsell_title: "",
              ...bar.upsell,
              upsell_type: !bar.cart_page.upsell_enabled
                ? "no_upsell"
                : bar.upsell.upsell_type,
            },
            placement_type: bar.cart_page.placement_type || "default",
            id: bar.id,
            shop: bar.shop,
            user: bar.user,
            name: bar.name,
            scheduled: bar.scheduled,
            discountId: bar.discountId,
            utmCode: bar.utmCode,
            visitors: bar.visitors,
            allow_utm_source: bar.allow_utm_source,
          });
        });
      }

      const allPages = ["top_bottom_page", "product_page"];
      if (!isLegacyCartPage) allPages.push("cart_page_only", "cart_drawer");
      // 2️⃣ New + normal pages (cart_page intentionally excluded)
      allPages.forEach(
        (page) => {
          bar[page].upsell_enabled = typeof bar[page].upsell_enabled === "boolean" ? bar[page].upsell_enabled : true;
          if (bar[page]?.enabled !== true) return;

          result.push({
            ...bar[page],
            design: {
              goal_icons: [],
              upsell_section_title_size: 14,
              upsell_section_title_color: "#000000",
              multiple_goals_marker: "one",
              position: normalizePosition(bar[page].design?.position, bar[page].design?.sticky),
              ...bar[page].design,
            },
            translations: bar.translations,
            content: { ...bar.content, goals: getGoalsForBar(bar.content.goals, page), money_format: bar.content.money_format || "store_default" },
            placement: bar.placement,
            upsell: {
              upsell_title: "",
              ...bar.upsell,
              upsell_type: !bar[page].upsell_enabled
                ? "no_upsell"
                : bar.upsell.upsell_type,
            },
            placement_type: bar[page].placement_type || "default",
            id: bar.id,
            shop: bar.shop,
            user: bar.user,
            name: bar.name,
            scheduled: bar.scheduled,
            discountId: bar.discountId,
            utmCode: bar.utmCode,
            visitors: bar.visitors,
            allow_utm_source: bar.allow_utm_source,
          });
        }
      );

      return result;
    });



    const finalBarsArray = [...separatedBars, ...nonGoalBased];


    finalBarsArray.map(async (shippingData, i) => {
      const migratedShippingData = convertOldToNewFormat(shippingData);

      const translations = migratedShippingData.translations;
      const matchedTranslations = translations.find(
        (t) => t.locale === window.futureblink_free_shipping_shopLanguage,
      );
      const delayInSeconds = migratedShippingData.placement.delay;

      // Handle visibility of shipping bar
      const visibility = migratedShippingData.visibility;
      let isVisible = true;

      if (visibility === "mobile" && window.innerWidth > 768) isVisible = false;
      if (visibility === "desktop" && window.innerWidth <= 768)
        isVisible = false;
      if (visibility === "desktop_mobile") isVisible = true;

      // console.log(visibility, delayInSeconds, isVisible);
      const isAllowed = await checkAllowedCountries(migratedShippingData);
      let willRender = false;
      if (
        migratedShippingData.type === "product_page" &&
        customerConditionsCheck(migratedShippingData) &&
        isAllowed &&
        visitorsCheck(migratedShippingData) &&
        productPagePlacement(
          migratedShippingData.placement.pages,
          migratedShippingData.placement.pages_type,
          migratedShippingData.placement.exclude_products,
          migratedShippingData.placement.excluded_products,
        ) &&
        isAllowed
      ) {
        willRender = true;
        defaultPage(
          migratedShippingData,
          matchedTranslations,
          "product_page",
          delayInSeconds,
        );
      }
      if (
        migratedShippingData.type === "top_bottom_page" &&
        !window.localStorage.getItem(
          `shipping_bar_${migratedShippingData.id}`,
        ) &&
        customerConditionsCheck(migratedShippingData) &&
        topBottomPlacement(
          migratedShippingData.placement.pages,
          migratedShippingData.placement.pages_type,
          migratedShippingData.placement.exclude_products,
          migratedShippingData.placement.excluded_products,
        ) &&
        isAllowed &&
        visitorsCheck(migratedShippingData)
      ) {
        willRender = true;
        topBottomPage(
          migratedShippingData,
          matchedTranslations,
          delayInSeconds,
        );
      }

      if (
        migratedShippingData.type === "cart_page" &&
        isAllowed &&
        productPagePlacement(
          migratedShippingData.placement.pages,
          migratedShippingData.placement.pages_type,
          migratedShippingData.placement.exclude_products,
          migratedShippingData.placement.excluded_products,
        ) &&
        customerConditionsCheck(migratedShippingData) &&
        visitorsCheck(migratedShippingData)
      ) {
        willRender = true;
        defaultPage(
          migratedShippingData,
          matchedTranslations,
          "cart_page",
          delayInSeconds,
        );
      }

      if (
        migratedShippingData.type === "cart_page_only" &&
        isAllowed &&
        productPagePlacement(
          migratedShippingData.placement.pages,
          migratedShippingData.placement.pages_type,
          migratedShippingData.placement.exclude_products,
          migratedShippingData.placement.excluded_products,
        ) &&
        customerConditionsCheck(migratedShippingData) &&
        visitorsCheck(migratedShippingData)
      ) {
        willRender = true;
        defaultPage(
          migratedShippingData,
          matchedTranslations,
          "cart_page_only",
          delayInSeconds,
        );
      }

      if (
        migratedShippingData.type === "cart_drawer" &&
        isAllowed &&
        productPagePlacement(
          migratedShippingData.placement.pages,
          migratedShippingData.placement.pages_type,
          migratedShippingData.placement.exclude_products,
          migratedShippingData.placement.excluded_products,
        ) &&
        customerConditionsCheck(migratedShippingData) &&
        visitorsCheck(migratedShippingData)
      ) {
        willRender = true;
        defaultPage(
          migratedShippingData,
          matchedTranslations,
          "cart_drawer",
          delayInSeconds,
        );
      }

      if (!willRender && isAllowed && customerConditionsCheck(migratedShippingData) && visitorsCheck(migratedShippingData) && migratedShippingData.content?.goals?.some(g => g.reward_type === "free_gift")) {
        bars.push({
          id: migratedShippingData.id,
          contentData: migratedShippingData.content,
          placementData: migratedShippingData.placement,
          updateProgress: () => {},
          freeProductAdd: (value) => {
            const goals = migratedShippingData.content.goals;
            const rewardApplication = migratedShippingData.content.reward_application || "all";
            const reachedGoals = goals.filter((g) => value >= g.goal);
            if (reachedGoals.length === 0) {
              return { hasGoalReached: false, isRewardType: false, rewardVariants: [] };
            }
            let rewardVariants = [];
            if (rewardApplication === "highest") {
              const highestGoal = reachedGoals.reduce((max, g) => g.goal > max.goal ? g : max, reachedGoals[0]);
              if (highestGoal.reward_type === "free_gift" && Array.isArray(highestGoal.reward_value)) {
                rewardVariants = highestGoal.reward_value
                  .map((item) => {
                    const match = item.id.match(/ProductVariant\/(\d+)/);
                    return match ? { id: parseInt(match[1], 10), goal: highestGoal.goal } : null;
                  })
                  .filter(Boolean);
              }
            } else {
              reachedGoals.forEach((goal) => {
                if (goal.reward_type === "free_gift" && Array.isArray(goal.reward_value)) {
                  const variants = goal.reward_value
                    .map((item) => {
                      const match = item.id.match(/ProductVariant\/(\d+)/);
                      return match ? { id: parseInt(match[1], 10), goal: goal.goal } : null;
                    })
                    .filter(Boolean);
                  rewardVariants = rewardVariants.concat(variants);
                }
              });
            }
            return {
              hasGoalReached: rewardVariants.length > 0,
              isRewardType: rewardVariants.length > 0,
              rewardVariants,
            };
          },
          addRecommendedProducts: null,
          box: document.createElement("div")
        });
      }


    });
  }

  renderShippingBar();

  async function defaultPage(data, translations, type, delay) {
    const clonedShippingBars = [];
    const clonedProgressBars = [];


    const rate = window.Shopify.currency.rate;
    //   const countries = window.futureBlink_countriesWithCodes
    // const country_name = sessionStorage.getItem("country_name")
    const currentStoreCurrency = window.futureBlink_storeCurrency;
    const locationCurrency = window.futureBlink_country;

    const root = window.Shopify.routes.root || "/";
    const designData = data.design;
    const contentData = data.content;
    const placementData = data.placement;
    let upsellData = data.upsell;
    const upsellFetched = { cart: false, product: false, other: false };
    let lastCartSignature = "";
    const productData = window.futureblink_free_shipping_productDetails;

    // Find the first matching item
    const matchedItem =
      contentData.specific_market_goals.length > 0 &&
      contentData.specific_market_goals.find((item) => {
        const currencies = item.currency.split(",").map((c) => c.trim());
        return currencies.includes(locationCurrency);
      });

    const goals = matchedItem?.goals || contentData.goals;
    const initial_message =
      translations?.message ||
      matchedItem?.initial_message ||
      contentData.message;
    const goal_reached_message =
      translations?.goal ||
      matchedItem?.goal_reached_message ||
      contentData.goal_reached_message;
    const storeCurrency = matchedItem
      ? currentStoreCurrency
      : data.content.currency;

    let viewed = false;

    const box =
      contentData.cta === "full"
        ? document.createElement("a")
        : document.createElement("div");


    const fonts = {
      "helvetica": "Helvetica",
      "arial": "Arial",
      "tahoma": "Tahoma",
      "treubuchet_ms": "Trebuchet MS",
      "times_new_roman": "Times New Roman",
      "georgia": "Georgia",
      "garamond": "Garamond",
      "courier_new": "Courier New",
      "brush_script": "'Brush Script MT', cursive",
      "impact": "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif",
      "segoe_UI": "Segoe UI, Segoe UI Variable Text, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif",
      "roboto": "'Roboto', sans-serif",
      "roboto_mono": "'Roboto Mono', monospace",
      "roboto_condensed": "'Roboto Condensed', sans-serif",
      "montserrat": "'Montserrat', sans-serif",
      "rubik": "'Rubik', sans-serif",
      "open_sans": "'Open Sans', sans-serif",
      "google_sans": "'Google Sans', sans-serif",
      "lato": "'Lato', sans-serif",
      "poppins": "'Poppins', sans-serif",
      "noto_sans": "'Noto Sans', sans-serif",
      "inter": "'Inter', sans-serif",
      "playfair_display": "'Playfair Display', serif",
      "arimo": "'Arimo', sans-serif",
      "oswald": "'Oswald', sans-serif",
      "raleway": "'Raleway', sans-serif",
      "nunito": "'Nunito', sans-serif",
      "nunito_sans": "'Nunito Sans', sans-serif",
      "crimson_text": "'Crimson Text', serif",
      "dm_sans": "'DM Sans', sans-serif",
      "ubuntu": "'Ubuntu', sans-serif",
      "archivo": "'Archivo', sans-serif",
      "lobster": "'Lobster', sans-serif",
      "red_hat_display": "'Red Hat Display', sans-serif",
      "pacifico": "'Pacifico', cursive",
      "oxygen": "'Oxygen', sans-serif",
      "roboto_slab": "'Roboto Slab', serif",
      "bricologe_grotesque": "'Bricolage Grotesque', sans-serif",
      "grey_qo": "'Grey Qo', cursive",
      "passions_conflict": "'Passions Conflict', cursive",
      "lovers_quarrel": "'Lovers Quarrel', cursive",
      "engagement": "'Engagement', cursive",
      "work_sans": "'Work Sans', sans-serif",
      "source_sans_3": "'Source Sans 3', sans-serif",
      "merriweather": "'Merriweather', serif",
      "bodoni_moda": "'Bodoni Moda', serif",
      "cormorant_SC": "'Cormorant SC', serif",
      "libre_caslon_text": "'Libre Caslon Text', serif",
      "libre_baskerville": "'Libre Baskerville', serif",
      "spectral": "'Spectral', serif",
      "bebas_neue": "'Bebas Neue', sans-serif",
      "anton": "'Anton', sans-serif",
      "abril_fatface": "'Abril Fatface', serif",
      "league_spartan": "'League Spartan', sans-serif",
      "great_vibes": "'Great Vibes', cursive",
      "dancing_script": "'Dancing Script', cursive",
      "allura": "'Allura', cursive",
      "satisfy": "'Satisfy', cursive",
      "sacramento": "'Sacramento', cursive",
      "playball": "'Playball', cursive",
      "amatic_SC": "'Amatic SC', sans-serif"
    };

    const isSystemFont = (font) => {
      // System fonts list
      const systemFonts = [
        "custom",
        "helvetica",
        "arial",
        "tahoma",
        "treubuchet_ms",
        "times_new_roman",
        "georgia",
        "garamond",
        "courier_new",
        "brush_script",
        "impact",
        "segoe_UI",
      ];
      return systemFonts.includes(font.toLowerCase());
    };

    if (designData.font && !isSystemFont(designData.font)) {
      const existingLink = document.getElementById(`dynamic-font-${data.type}-${data.id}`);
      if (existingLink) existingLink.remove();

      let fontForLink = designData.font.trim();

      // 2. Capitalize each word
      fontForLink = fontForLink
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("+");

      // Create new link element
      const link = document.createElement("link");
      link.id = `dynamic-font-${data.type}-${data.id}`;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css?family=${fontForLink}&display=swap`;
      link.media = "all";
      document.head.appendChild(link);
    }

    const bgStyle = {
      paddingLeft: "20px",
      paddingRight: "20px",
      paddingTop: `${designData.spacing_inside_top}px`,
      paddingBottom: `${designData.spacing_inside_bottom}px`,
      marginTop: `${designData.spacing_outside_top}px`,
      marginBottom: `${designData.spacing_outside_bottom}px`,
      background:
        designData.background === "gradient"
          ? `linear-gradient(${designData.angle}deg, ${designData.initial_color}, ${designData.final_color})`
          : designData.background === "tri_gradient"
            ? `linear-gradient(${designData.angle}deg, ${designData.initial_color}, ${designData.intermediate_color}, ${designData.final_color})`
            : designData.background === "single"
              ? designData.color
              : "",
      borderRadius: `${designData.border_radius}px`,
      borderColor: designData.border_color,
      borderWidth: `${designData.border_size}px`,
      borderStyle: "solid",
      height: "fit-content",
      marginLeft: "auto",
      marginRight: "auto",
      width: `${designData.shipping_bar_width || 100}%`,
    };

    const trackerConfig = {
      apiEndpoint: "/apps/shipping-bar/track",
      badgeId: data.id,
      debug: true,
      bar: box,
      trackViewOnInit: true, // 👈 enable auto view
    };

    const trackerConfig_add_to_cart = {
      apiEndpoint: "/apps/shipping-bar/track",
      badgeId: data.id,
      debug: true,
      bar: box,
      trackViewOnInit: false, // 👈 disable auto view
    };

    let progress = 0;


    const progress_calculation = contentData.progress_calculation;

    let calculateMethod = "original_line_price";

    if (progress_calculation === "after_discount") {
      calculateMethod = "discounted_price";
    }

    let totalPrice = cart.items.reduce(
      (sum, item) =>
        sum +
        ((item[calculateMethod] || 0) / 100) *
        (calculateMethod === "discounted_price" ? item.quantity : 1),
      0,
    );

    let totalQuantity = cart.items.reduce(
      (sum, item) =>
        sum + (contentData.unique_products ? 1 : item.quantity || 0),
      0,
    );
    progress =
      contentData.goal_type === "product_quantity" ? totalQuantity : totalPrice;

    function getMessage(added) {

      // Find the first goal that hasn't been reached yet
      let currentGoalData = goals.find((g) => added < g.goal);
      let index = goals.findIndex((g) => added < g.goal);

      // If all goals are reached, use the last one
      if (!currentGoalData) {
        currentGoalData = goals[goals.length - 1];
      }

      const remaining = currentGoalData.goal - added;

      // Case 1: Cart is empty or just started
      if (remaining === currentGoalData.goal) {
        const amountFormatted = formatAmount(
          contentData,
          designData,
          currentGoalData.goal,
          storeCurrency,
        );
        const messageTemplate = initial_message;
        // Use regex split to preserve exact spacing and punctuation
        const parts = messageTemplate.split(/(\{order-value\})/g);
        return parts.map(part => part === "{order-value}" ? amountFormatted : part).join("");
      }

      // Case 2: In progress toward the goal
      if (remaining > 0) {
        const formatedValue =
          contentData.goal_type !== "product_quantity"
            ? remaining.toFixed(2)
            : remaining;
        const amountFormatted = formatAmount(
          contentData,
          designData,
          formatedValue,
          storeCurrency,
        );
        const progressTemplate =
          translations?.progressMessage[index] ||
          currentGoalData.progress_message;
        // Use regex split to preserve exact spacing and punctuation
        const parts = progressTemplate.split(/(\{order-value-progress\})/g);
        return parts.map(part => part === "{order-value-progress}" ? amountFormatted : part).join("");
      }

      // Case 3: Goal reached
      if (contentData.show_goal_reached_message === false) {
        // keep showing progress message instead of goal-reached message
        const effectiveRemaining = remaining > 0 ? remaining : 0; // never negative
        const formatedValue =
          contentData.goal_type !== "product_quantity"
            ? effectiveRemaining.toFixed(2)
            : effectiveRemaining;

        const amountFormatted = formatAmount(
          contentData,
          designData,
          formatedValue,
          storeCurrency,
        );
        const progressTemplate =
          translations?.progressMessage[index] ||
          currentGoalData.progress_message;

        // Use regex split to preserve exact spacing and punctuation
        const parts = progressTemplate.split(/(\{order-value-progress\})/g);
        return parts.map(part => part === "{order-value-progress}" ? amountFormatted : part).join("");
      }

      const span = document.createElement("span");
      span.className = "futureblink-message";
      span.style.fontFamily = fonts[designData.font]
        ? fonts[designData.font]
        : "";
      span.style.setProperty(
        "font-weight",
        designData.font_weight || "inherit",
        "important",
      );
      span.style.fontSize = `${designData.message_size}px`;
      span.style.color = designData.goal_message_color;
      span.textContent = goal_reached_message || "";
      return span.outerHTML;
    }

    function getButtonText(added) {
      const buttonTextData = translations?.buttonText || contentData.button_text;

      // Fallback for legacy string (though we expect object now)
      if (typeof buttonTextData === 'string') return buttonTextData;
      if (!buttonTextData) return "Shop Now";

      // Find the first goal that hasn't been reached yet
      let currentGoalData = goals.find((g) => added < g.goal);
      let index = goals.findIndex((g) => added < g.goal);

      // If all goals are reached
      if (!currentGoalData) {
        return buttonTextData.goal_reached || "Shop Now";
      }

      const remaining = currentGoalData.goal - added;

      // Case 1: Start (0 progress)
      if (remaining === currentGoalData.goal && index === 0) {
        return buttonTextData.initial_message || "Shop Now";
      }

      // Case 2: In progress
      if (remaining > 0) {
        return buttonTextData.progress_messages?.[index] || buttonTextData.initial_message || "Shop Now";
      }

      // Fallback
      return buttonTextData.initial_message || "Shop Now";
    }

    // Find the current goal tier
    let currentGoalIndex = goals.findIndex((g) => progress < g.goal);

    // If progress exceeds all goals, use the last goal
    if (currentGoalIndex === -1) {
      currentGoalIndex = goals.length - 1;
    }

    const currentGoal = goals[currentGoalIndex];
    const previousGoal =
      currentGoalIndex > 0 ? goals[currentGoalIndex - 1].goal : 0;

    const tierProgress = progress - previousGoal;
    const tierTotal = currentGoal.goal - previousGoal;

    const percentageCompletion = Math.min(
      (tierProgress / tierTotal) * 100,
      100,
    );

    const finalValue =
      contentData.exclude_type === "specific_collections" &&
        cart.items.length > 0
        ? 0
        : percentageCompletion;

    const progressBar = await createProgressBar(finalValue, designData, goals.length, designData.goal_icons, goals);
    progressBar.element.setAttribute("futureblink-shipping-bar-progress", "");

    let previousProgress = 0;

    function freeProductAdd(value) {
      const goals = contentData.goals;
      const rewardApplication = contentData.reward_application || "all";

      // Find every goal that is reached
      const reachedGoals = goals.filter((g) => value >= g.goal);

      // If no goals are reached, return empty result
      if (reachedGoals.length === 0) {
        return {
          hasGoalReached: false,
          isRewardType: false,
          rewardVariants: [],
        };
      }

      // Collect all reward variants from all reached goals
      let rewardVariants = [];
      if (rewardApplication === "highest") {
        // Only get reward from the HIGHEST goal reached
        const highestGoal = reachedGoals.reduce((max, g) => g.goal > max.goal ? g : max, reachedGoals[0]);

        if (highestGoal.reward_type === "free_gift" && Array.isArray(highestGoal.reward_value)) {
          rewardVariants = highestGoal.reward_value
            .map((item) => {
              const match = item.id.match(/ProductVariant\/(\d+)/);
              return match ? { id: parseInt(match[1], 10), goal: highestGoal.goal } : null;
            })
            .filter(Boolean);
        }
      }
      else {
        reachedGoals.forEach((goal) => {
          if (
            goal.reward_type === "free_gift" &&
            Array.isArray(goal.reward_value)
          ) {
            const variants = goal.reward_value
              .map((item) => {
                const match = item.id.match(/ProductVariant\/(\d+)/);
                return match
                  ? { id: parseInt(match[1], 10), goal: goal.goal }
                  : null;
              })
              .filter(Boolean);

            rewardVariants = rewardVariants.concat(variants);
          }
        });
      }
      return {
        hasGoalReached: rewardVariants.length > 0,
        isRewardType: rewardVariants.length > 0,
        rewardVariants,
      };
    }

    function updateProgress(value, firstRun = false) {

      const previousValue = progress;
      const fireworksMode = designData.fireworks; // 'every' or 'full'


      // Early return if no change
      if ((value === previousProgress && !firstRun) || !Number.isFinite(value)) {
        return;
      }

      const isFinalGoalReached = value >= goals[goals.length - 1].goal;

      // Determine progress percentage within current tier
      let currentGoalIndex = goals.findIndex((g) => value < g.goal);
      if (currentGoalIndex === -1) currentGoalIndex = goals.length - 1;

      const currentGoal = goals[currentGoalIndex];
      const previousGoalValue =
        currentGoalIndex > 0 ? goals[currentGoalIndex - 1].goal : 0;
      const tierRange = currentGoal.goal - previousGoalValue;
      const completedInTier = value - previousGoalValue;
      let percentageCompletion = Math.min(
        (completedInTier / tierRange) * 100,
        100,
      );

      // For multi-goal view, we need global percentage (0-100% across all goals)
      if (designData.multiple_goals_marker === "all") {
        const totalGoals = goals.length;
        const baseProgress = (currentGoalIndex / totalGoals) * 100;
        const tierContribution = (percentageCompletion / 100) * (100 / totalGoals);
        percentageCompletion = baseProgress + tierContribution;
      }

      // Update UI
      progress = value;

      if (data.placement_type === "custom" || data.placement.pages_type === "custom") {
        clonedShippingBars.forEach((clonedbar, index) => {
          const clonedText = clonedbar.querySelector(
            ".futureblink-shipping-bar-message-text",
          );
          clonedText.innerHTML = getMessage(progress);
          clonedText.style.fontFamily = fonts[designData.font]
            ? fonts[designData.font]
            : "inherit";
          clonedText.style.setProperty(
            "font-weight",
            designData.font_weight || "inherit",
            "important",
          );

          // Update the corresponding cloned progress bar
          if (clonedProgressBars[index]) {
            clonedProgressBars[index].update(percentageCompletion);
          }

          // Update Cloned CTA Button
          const clonedCtaButton = clonedbar.querySelector('[futureblink-shipping-bar-cta]');
          if (clonedCtaButton) {
            clonedCtaButton.textContent = getButtonText(progress);
          }
        });
      } else {
        text.innerHTML = getMessage(progress);
        text.style.fontFamily = fonts[designData.font]
          ? fonts[designData.font]
          : "inherit";
        text.style.setProperty(
          "font-weight",
          designData.font_weight || "inherit",
          "important",
        );
        progressBar.update(percentageCompletion);

        // Update CTA Button Text
        const ctaButton = box.querySelector('[futureblink-shipping-bar-cta]');
        if (ctaButton) {
          ctaButton.textContent = getButtonText(progress);
        }
      }

      runAnimations(designData);

      // 🎆 Fireworks Logic
      const prevBelow = goals.filter((g) => previousProgress < g.goal);
      const currBelow = goals.filter((g) => progress < g.goal);
      const crossedAny = currBelow.length < prevBelow.length;
      const crossedFinal = currBelow.length === 0 && prevBelow.length > 0;

      const shouldFire =
        (fireworksMode === "every" && crossedAny) ||
        (fireworksMode === "last" && crossedFinal);

      if (shouldFire && !firstRun) {
        launchFirework();
      }

      // Save current as previous for next run
      previousProgress = progress;

      if (previousValue === 0 && value > 0 && (type === "cart_page_only" || type === "cart_drawer" || type === "cart_page") && !viewed) {
        viewed = true;
        new HoppyFreeShippingTracker(trackerConfig);
      }
    }

    let recommendedProductsAdded = false;

    const swiperWrapper = document.createElement("div");

    // Create Swiper container
    const swiperContainer = document.createElement("div");

    async function addSpecificUpsellproducts() {
      if (
        upsellData.upsell_type === "specific_prod" ||
        upsellData.upsell_type === "specific_col" ||
        upsellData.upsell_type === "upsell_same_product"
      ) {
        const upsellProducts = await fetchUpsellProducts(upsellData);

        // Default behavior: exclude products where ALL variants are sold out
        const availableProducts = upsellProducts.filter((product) => {
          // Check if product has variants
          if (product.variants && product.variants.length > 0) {
            // Product is available if at least one variant is available
            return product.variants.some((variant) => variant.available === true);
          }
          // If no variants, check product-level availability
          return product.available !== false;
        });

        availableProducts.forEach((product) => {
          const swiperSlide = document.createElement("div");
          swiperSlide.className = "swiper-slide";

          const wrapper = document.createElement("div");
          wrapper.style.display = "flex";
          wrapper.style.alignItems = "flex-start";
          wrapper.style.gap = "12px";
          wrapper.style.padding = "8px";
          wrapper.style.justifyContent = "center";
          wrapper.style.flexWrap = "wrap";

          // ---------- Product Image ----------
          const imageWrapper = document.createElement("a");
          imageWrapper.href = `/products/${product.handle}`;
          imageWrapper.target = "_blank";

          const img = document.createElement("img");
          img.src = product.featured_image
            ? product.featured_image
            : product.images[0]
              ? product.images[0].src
              : "https://via.placeholder.com/50x50";
          img.style.width = "80px";
          img.style.height = "80px";
          img.style.objectFit = "cover";
          img.style.borderRadius = "6px";

          imageWrapper.appendChild(img);

          // ---------- Details Column ----------
          const details = document.createElement("div");
          details.style.display = "flex";
          details.style.flexDirection = "column";
          details.style.gap = "6px";
          details.style.flex = "1";

          // Product title
          const titleEl = document.createElement("div");
          titleEl.textContent = product.title;

          // --- APPLY TITLE STYLES ---
          titleEl.style.fontWeight = "600";
          titleEl.style.fontSize = designData.upsell_title_size + "px";
          titleEl.style.color = designData.upsell_title_color;
          titleEl.style.fontFamily = fonts[designData.font] || "inherit";

          // Get available variants based on setting
          const availableVariants = product.variants.filter(v => v.available !== false);

          // Default variant - use first available variant
          let selectedVariant = availableVariants[0] || product.variants[0];
          let selectedVariantId = selectedVariant?.id ?? null;

          // Price element
          const priceEl = document.createElement("div");
          priceEl.className = "money";
          const price =
            selectedVariant && selectedVariant.price != null
              ? selectedVariant.price
              : "N/A";
          const finalPrice =
            upsellData.upsell_type === "specific_col" ? price : price / 100;
          priceEl.innerHTML = formatAmount(
            contentData,
            designData,
            finalPrice,
            storeCurrency,
            false,
            true,
          );

          // --- APPLY PRICE STYLES ---
          priceEl.style.fontSize = designData.upsell_price_size + "px";
          priceEl.style.color = designData.upsell_price_color;
          priceEl.style.fontFamily = fonts[designData.font] || "inherit";

          // ---------- Dropdown + Button Row ----------
          const actionRow = document.createElement("div");
          actionRow.style.flexWrap = "wrap";
          actionRow.style.display = "flex";
          actionRow.style.gap = "6px";
          actionRow.style.alignItems = "center";
          actionRow.style.justifyContent = "center";

          const USE_NATIVE_SELECT = !["Dawn"].includes(
            window.Shopify.theme.schema_name,
          );

          if (availableVariants && availableVariants.length > 1) {
            if (availableVariants.length > 1) {
              const variantUI = USE_NATIVE_SELECT
                ? createNativeVariantSelect({
                  product,
                  selectedVariant,
                  onChange: (v) => {
                    selectedVariant = v;
                    selectedVariantId = v.id;
                    let selectedVariantprice = upsellData.upsell_type === "specific_col" ? v.price : v.price / 100
                    priceEl.innerHTML = formatAmount(
                      contentData,
                      designData,
                      selectedVariantprice,
                      storeCurrency,
                      false,
                      true,
                    );
                    // Update button state when variant changes
                    updateButtonState();
                  },
                })
                : createCustomVariantDropdown({
                  product,
                  selectedVariant,
                  onChange: (v) => {
                    selectedVariant = v;
                    selectedVariantId = v.id;
                    let selectedVariantprice = upsellData.upsell_type === "specific_col" ? v.price : v.price / 100
                    priceEl.innerHTML = formatAmount(
                      contentData,
                      designData,
                      selectedVariantprice,
                      storeCurrency,
                      false,
                      true,
                    );
                    // Update button state when variant changes
                    updateButtonState();
                  },
                });

              actionRow.appendChild(variantUI);
            }
          }

          // Add to Cart button
          const ctaButton = document.createElement("button");
          ctaButton.setAttribute("futureblink-upsell-add-to-cart", "");

          // Helper function to update button state
          const updateButtonState = () => {
            ctaButton.textContent =
              translations?.upsellButtonTextBefore ||
              upsellData.cta_text_before ||
              "Add to Cart";
            ctaButton.disabled = false;
            ctaButton.style.opacity = "1";
            ctaButton.style.cursor = "pointer";
          };

          // Set initial button state
          updateButtonState();

          Object.assign(ctaButton.style, {
            padding: "8px 16px",
            backgroundColor: designData.upsell_button_color || "black",
            color: designData.upsell_button_text_color || "white",
            fontSize: designData.upsell_button_text_size
              ? designData.upsell_button_text_size + "px"
              : "",
            fontFamily: designData.font
              ? fonts[designData.font]
              : "inherit",
            borderRadius: designData.upsell_button_corner_radius
              ? designData.upsell_button_corner_radius + "px"
              : "4px",
            fontWeight: designData.upsell_button_font_weight || "bold",
            fontStyle: designData.upsell_button_font_style || "normal",
            border: "none",
            cursor: "pointer",
            width: "fit-content",
          });

          ctaButton.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();

            // Don't allow clicking sold-out button
            if (ctaButton.disabled) return;

            if (upsellData.cta_type === "view_product") {
              window.location.href = "/products/" + product.handle;
              return;
            }

            if (!selectedVariantId) return;

            await addToCartWithLoader(
              selectedVariantId,
              ctaButton,
              upsellData,
              translations,
            );
            ctaButton.textContent =
              translations?.upsellButtonTextAfter || upsellData.cta_text_after;
            // swiperContainer.swiper.slideNext();

            // ✅ Track upsell add to cart
            console.log(window.hoppyFreeShippingTracker);
            if (window.hoppyFreeShippingTracker) {
              window.hoppyFreeShippingTracker.trackEvent("add_to_cart");
            }
          });

          actionRow.appendChild(ctaButton);

          // ---------- Build Structure ----------
          details.append(titleEl, priceEl, actionRow);
          wrapper.append(imageWrapper, details);
          swiperSlide.appendChild(wrapper);
          swiperWrapper.appendChild(swiperSlide);
        });
      }
    }

    async function addRecommendedProducts() {
      const isProductPage = type === "product_page";

      // If feature disabled, return
      if (upsellData.upsell_type !== "freq_bought") return;

      // Cart page: detect cart changes and reset state so we re-fetch/re-render
      if (!isProductPage) {
        const currentCartSignature = JSON.stringify(
          (cart.items || []).map((item) => item.product_id).sort((a, b) => a - b)
        );
        if (currentCartSignature !== lastCartSignature) {
          lastCartSignature = currentCartSignature;
          recommendedProductsAdded = false;
          upsellFetched.cart = false;
          window.hoppy_free_shipping_productRecommendations[type] = [];
          swiperWrapper.innerHTML = "";
        }
      }

      // If already displayed, return immediately (as requested)
      if (recommendedProductsAdded) return;

      const recsExist = window.hoppy_free_shipping_productRecommendations[type]?.length > 0;
      if (recsExist) {
        // Just render if not added yet? Or logic expects to fall through?
        // But recommendedProductsAdded handles UI state.
        // If recs exist but not added (e.g. error previously rendered), proceed to render logic below.
      } else {
        // Need to fetch
        if (isProductPage) {
          // Product Page: Fetch once only.
          if (upsellFetched.product) return;
        } else {
          // Cart Page: signature check above already reset state; just mark for fetch
          upsellFetched.cart = false;
        }

        try {
          window.hoppy_free_shipping_productRecommendations[type] = [];

          if (isProductPage) {
            const productForFetch = productData.id;
            const response = await fetch(
              `${window.Shopify.routes.root}recommendations/products.json?product_id=${productForFetch}&limit=10&intent=${upsellData.recommendation_type}`,
            );

            if (response.ok) {
              const { products } = await response.json();
              if (products && products.length > 0) {
                window.hoppy_free_shipping_productRecommendations[type] = products || [];
                upsellFetched.product = true;
              }
            }
            // Mark as fetched to prevent retry loop
            upsellFetched.product = true;
          } else {
            const currentItems = cart.items || [];
            for (const item of currentItems) {
              const response = await fetch(
                `${window.Shopify.routes.root}recommendations/products.json?product_id=${item.product_id}&limit=10&intent=${upsellData.recommendation_type}`,
              );

              if (response.ok) {
                const { products } = await response.json();
                if (products && products.length > 0) {
                  window.hoppy_free_shipping_productRecommendations[type] = products;
                  upsellFetched.cart = true;
                  break;
                }
              }
            }
            // If loop finishes, we tried current cart. Next try only if cart changes.
          }
        } catch (error) {
          return;
        }
      }

      try {
        let recs = window.hoppy_free_shipping_productRecommendations[type];

        const max = upsellData.max_products || recs.length;

        // If recommendations are fewer than max, fetch remaining products directly
        if (recs.length < max) {
          const remaining = max - recs.length;
          try {
            const response = await fetch(
              `${window.Shopify.routes.root}collections/all/products.json?limit=${remaining + 5}`
            );
            if (response.ok) {
              const data = await response.json();
              const existingIds = new Set(recs.map(r => r.id));
              const fillProducts = (data.products || [])
                .filter(p => p && !existingIds.has(p.id))
                .sort(() => Math.random() - 0.5)
                .slice(0, remaining)
                .map(p => ({
                  ...p,
                  variants: (p.variants || []).map(v => ({
                    ...v,
                    price: typeof v.price === 'string' && v.price.includes('.')
                      ? Math.round(parseFloat(v.price) * 100)
                      : v.price
                  }))
                }));
              window.hoppy_free_shipping_productRecommendations[type].push(...fillProducts);
            }
          } catch (error) {
            // Silently ignore fallback fetch errors
          }
        }

        // Clear existing slides to prevent duplication on re-fetch
        swiperWrapper.innerHTML = "";

        for (const product of recs.slice(0, max)) {
          const swiperSlide = document.createElement("div");
          swiperSlide.className = "swiper-slide";

          const wrapper = document.createElement("div");
          wrapper.style.display = "flex";
          wrapper.style.alignItems = "flex-start";
          wrapper.style.gap = "12px";
          wrapper.style.padding = "8px";
          wrapper.style.flexWrap = "wrap";
          wrapper.style.justifyContent = "center"

          /* ------------------ PRODUCT IMAGE ------------------ */
          const imgLink = document.createElement("a");
          imgLink.href = `/products/${product.handle}`;
          imgLink.target = "_blank";

          const img = document.createElement("img");
          const firstImage = product.images?.[0];
          img.src =
            product.featured_image ||
            (typeof firstImage === "string" ? firstImage : firstImage?.src) ||
            "https://via.placeholder.com/80";
          img.alt = product.title;
          img.style.width = "80px";
          img.style.height = "80px";
          img.style.objectFit = "cover";
          img.style.borderRadius = "6px";

          imgLink.appendChild(img);

          /* ------------------ DETAILS COLUMN ------------------ */
          const details = document.createElement("div");
          details.style.display = "flex";
          details.style.flexDirection = "column";
          details.style.gap = "6px";
          details.style.flex = "1";

          const titleEl = document.createElement("div");
          titleEl.textContent = product.title;
          titleEl.style.fontWeight = "600";
          titleEl.style.fontSize = designData.upsell_title_size
            ? designData.upsell_title_size + "px"
            : "14px";
          titleEl.style.color = designData.upsell_title_color || "black";
          titleEl.style.fontFamily = fonts[designData.font] || "inherit";

          // Get available variants based on setting
          const availableVariants = product.variants.filter(v => v.available !== false);

          // Default variant - use first available variant
          let selectedVariant = availableVariants[0] || product.variants[0];
          let selectedVariantId = selectedVariant?.id ?? null;


          const priceEl = document.createElement("div");
          priceEl.className = "money";
          const price = selectedVariant ? (selectedVariant.price / 100).toFixed(2) : "0.00";

          priceEl.innerHTML = formatAmount(
            contentData,
            designData,
            price,
            storeCurrency,
            false,
            true,
          );
          priceEl.style.color = designData.upsell_price_color || "black";
          priceEl.style.fontSize = designData.upsell_price_size
            ? designData.upsell_price_size + "px"
            : "14px";
          priceEl.style.fontFamily = fonts[designData.font] || "inherit";

          const actionRow = document.createElement("div");
          actionRow.style.display = "flex";
          actionRow.style.flexWrap = "wrap";
          actionRow.style.gap = "6px";
          actionRow.style.alignItems = "center";


          const USE_NATIVE_SELECT = !["Dawn"].includes(
            window.Shopify.theme.schema_name,
          );

          if (product.variants && product.variants.length > 1) {
            if (product.variants.length > 1) {
              const variantUI = USE_NATIVE_SELECT
                ? createNativeVariantSelect({
                  product,
                  selectedVariant,
                  onChange: (v) => {
                    selectedVariant = v;
                    selectedVariantId = v.id;
                    priceEl.innerHTML = formatAmount(
                      contentData,
                      designData,
                      v.price / 100,
                      storeCurrency,
                      false,
                      true,
                    );
                  },
                })
                : createCustomVariantDropdown({
                  product,
                  selectedVariant,
                  onChange: (v) => {
                    selectedVariant = v;
                    selectedVariantId = v.id;
                    priceEl.innerHTML = formatAmount(
                      contentData,
                      designData,
                      v.price / 100,
                      storeCurrency,
                      false,
                      true,
                    );
                  },
                });

              actionRow.appendChild(variantUI);
            }
          }

          const buttonText =
            translations?.upsellButtonTextBefore || upsellData.cta_text_before;

          const addBtn = document.createElement("button");
          addBtn.textContent = buttonText;

          Object.assign(addBtn.style, {
            padding: "8px 16px",
            backgroundColor: designData.upsell_button_color || "black",
            color: designData.upsell_button_text_color || "white",
            fontFamily: designData.font
              ? fonts[designData.font]
              : "inherit",
            fontSize: designData.upsell_button_text_size
              ? designData.upsell_button_text_size + "px"
              : "",
            borderRadius: designData.upsell_button_corner_radius
              ? designData.upsell_button_corner_radius + "px"
              : "4px",
            fontWeight: designData.upsell_button_font_weight || "bold",
            fontStyle: designData.upsell_button_font_style || "normal",
            border: "none",
            cursor: "pointer",
            width: "fit-content",
          });

          addBtn.addEventListener("click", async () => {
            if (upsellData.cta_type === "view_product") {
              window.location.href = "/products/" + product.handle;
              return;
            }

            await addToCartWithLoader(
              selectedVariantId,
              addBtn,
              upsellData,
              translations,
              data.id,
            );
            swiperContainer.swiper.slideNext();
            addBtn.textContent =
              translations?.upsellButtonTextAfter || upsellData.cta_text_after;

            // ✅ Track upsell add to cart
            const hoppyTracker = new HoppyFreeShippingTracker(
              trackerConfig_add_to_cart,
            );

            hoppyTracker.trackEvent("add_to_cart");
          });

          actionRow.appendChild(addBtn);

          details.append(titleEl, priceEl, actionRow);
          wrapper.append(imgLink, details);
          swiperSlide.appendChild(wrapper);
          swiperWrapper.appendChild(swiperSlide);
        }

        if (typeof initSwiper === "function") initSwiper();
        if (swiperContainer.swiper) {
          swiperContainer.swiper.update();
          swiperContainer.swiper.slideToLoop(0, 0);
        }
        recommendedProductsAdded = true;
      } catch (error) {
        return;
      }
    }

    bars.push({
      id: data.id,
      contentData: contentData,
      placementData: placementData,
      updateProgress: updateProgress,
      freeProductAdd: freeProductAdd,
      addRecommendedProducts: addRecommendedProducts,
      box: box
    });

    box.setAttribute("futureblink-shipping-bar", ``);
    if (contentData.cta === "full") {
      box.href = contentData.cta_link || "#"; // default to "#" if no link provided
      if (contentData.cta_open_new_tab) box.target = "_blank";
      box.style.textDecoration = "none";
    }
    box.className =
      designData.background === "patterns"
        ? `fblink-pattern-${designData?.background_pattern}`
        : "";
    Object.assign(box.style, {
      ...bgStyle,
      display:"block",
      marginBottom: "15px"
    });

    const textBox = document.createElement("div");
    const text = document.createElement("div");
    text.className = "futureblink-shipping-bar-message-text";
    textBox.style.fontSize = `${designData.message_size}px`;
    textBox.className = "futureblink-message";
    textBox.style.color = designData.message_color;
    textBox.style.display = "flex";
    textBox.style.justifyContent = "center";
    textBox.style.gap = "10px";
    textBox.style.alignItems = "center";
    textBox.style.flexWrap = "wrap";
    // Append container to body or any other desired parent
    text.innerHTML = getMessage(0);
    text.style.fontFamily = fonts[designData.font]
      ? fonts[designData.font]
      : "inherit";
    text.style.setProperty(
      "font-weight",
      designData.font_weight || "inherit",
      "important",
    );
    textBox.appendChild(text);

    const iconWapper = document.createElement("div");
    iconWapper.style.display = "flex";
    iconWapper.style.justifyContent = "center";
    const iconDiv = document.createElement("div");
    iconDiv.className = "futureblink-icon";

    designData.icon_position === "before" &&
      designData.icon &&
      box.appendChild(iconWapper);
    box.appendChild(textBox);
    designData.icon_position === "after" &&
      designData.icon &&
      box.appendChild(iconWapper);
    if (designData.show_progress_bar) {
      if (designData.show_progress_bar) {
        const progressBarContainer = document.createElement("div");
        progressBarContainer.style.width = "100%";
        progressBarContainer.style.display = `flex`;
        progressBarContainer.style.justifyContent = `center`;
        const progressBarWrapper = document.createElement("div");
        progressBarWrapper.style.width = `${designData.bar_width}%`;
        progressBarWrapper.appendChild(progressBar.element);
        progressBarContainer.appendChild(progressBarWrapper);
        box.appendChild(progressBarContainer);
      }
    }

    if (contentData.cta === "button") {
      // Create the container div
      const buttonContainer = document.createElement("div");
      buttonContainer.id = "button-container";
      buttonContainer.style.display = "flex";
      buttonContainer.style.justifyContent = "center";

      // Create the button
      const link = document.createElement("a");
      link.setAttribute("futureblink-shipping-bar-cta", "");
      link.href = contentData.cta_link;
      if (contentData.cta_open_new_tab) link.target = "_blank";
      link.textContent = getButtonText(0);

      // Apply class names for hover and animation
      link.className = `futureblink-cta-button ${designData.button_hover} ${designData.button_animation}`;

      // Apply inline styles
      Object.assign(link.style, {
        border: "none",
        padding: "10px",
        width: "fit-content",
        backgroundColor: designData.button_color,
        color: designData.button_text_color,
        fontFamily: designData.font
          ? fonts[designData.font]
          : "inherit",
        fontSize: `${designData.button_text_size}px`,
        borderRadius: `${designData.button_corner_radius}px`,
        fontWeight: designData.button_font_weight,
        fontStyle: designData.button_font_style,
        textDecoration:
          designData.button_font_style === "Underline" ? "underline" : "none",
        textAlign: "center",
        whiteSpace: "nowrap",
      });

      // Append button to container
      buttonContainer.appendChild(link);

      textBox.appendChild(buttonContainer);
    }

    const container = document.createElement("div");
    container.style.height = "fit-content";
    container.id = `shipping-container-${type}`;
    container.classList.add("fb-shipping-bar-app");
    container.appendChild(box);

    let initSwiper = null;

    // Add upsell section if enabled
    if (upsellData && upsellData.upsell_type !== "no_upsell") {
      const upsellChild = document.createElement("div");
      upsellChild.style.marginTop = "10px";
      upsellChild.style.width = "100%";
      upsellChild.style.overflow = "hidden";
      upsellChild.style.padding = "0 30px";
      upsellChild.style.position = "relative";
      upsellChild.style.margin = "auto 0";
      upsellChild.style.background = "transparent";
      upsellChild.setAttribute("futureblink-shipping-bar-swiper-container", "");
      if (upsellData.upsell_title) {
        const titleDiv = document.createElement("div");
        titleDiv.id = `futureblink-upsell-title-${data.id}`;
        titleDiv.innerHTML = translations?.upsellTitle || upsellData.upsell_title;
        titleDiv.style.fontFamily = fonts[designData.font] || "inherit";
        titleDiv.style.fontSize = `${designData.upsell_section_title_size}px`;
        titleDiv.style.color = designData.upsell_section_title_color;
        titleDiv.style.marginBottom = "10px";
        titleDiv.style.textAlign = "center";
        upsellChild.appendChild(titleDiv);
      }

      swiperContainer.className = "swiper";
      swiperContainer.style.position = "static";

      // Create Swiper wrapper
      swiperWrapper.className = "swiper-wrapper";

      let swiperInitialized = false;

      // Create navigation buttons
      function initialiseSwiper(targetElement = box) {
        const prevButton = document.createElement("button");
        prevButton.id = "button-prev";
        prevButton.style.position = "absolute";
        prevButton.style.top = "50%";
        prevButton.style.transform = "translateY(-50%)";
        prevButton.style.color = designData.upsell_arrow_color;
        prevButton.style.left = "0px";
        prevButton.style.width = "fit-content";
        prevButton.style.right = "auto";
        prevButton.style.border = "none";
        prevButton.style.background = "none";
        prevButton.style.cursor = "pointer";
        prevButton.style.zIndex = "1";
        prevButton.style.padding = "0";
        prevButton.innerHTML = `
  <svg width="${designData.upsell_arrow_size}px" height="${designData.upsell_arrow_size}px" fill="none" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 16C11.744 16 11.488 15.902 11.293 15.707L6.29301 10.707C5.90201 10.316 5.90201 9.68401 6.29301 9.29301L11.293 4.29301C11.684 3.90201 12.316 3.90201 12.707 4.29301C13.098 4.68401 13.098 5.31601 12.707 5.70701L8.41401 10L12.707 14.293C13.098 14.684 13.098 15.316 12.707 15.707C12.512 15.902 12.256 16 12 16Z" fill="currentColor"/>
  </svg>
`;

        const nextButton = document.createElement("button");
        nextButton.id = "button-next";
        nextButton.style.position = "absolute";
        nextButton.style.top = "50%";
        nextButton.style.transform = "translateY(-50%)";
        nextButton.style.right = "0px";
        nextButton.style.left = "auto";
        nextButton.style.width = "fit-content";
        nextButton.style.border = "none";
        nextButton.style.background = "none";
        nextButton.style.color = designData.upsell_arrow_color;
        nextButton.style.cursor = "pointer";
        nextButton.style.zIndex = "1";
        nextButton.style.padding = "0";
        nextButton.innerHTML = `
  <svg width="${designData.upsell_arrow_size}px" height="${designData.upsell_arrow_size}px" fill="none" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path d="M8.00001 16C7.74401 16 7.48801 15.902 7.29301 15.707C6.90201 15.316 6.90201 14.684 7.29301 14.293L11.586 10L7.29301 5.70701C6.90201 5.31601 6.90201 4.68401 7.29301 4.29301C7.68401 3.90201 8.31601 3.90201 8.70701 4.29301L13.707 9.29301C14.098 9.68401 14.098 10.316 13.707 10.707L8.70701 15.707C8.51201 15.902 8.25601 16 8.00001 16Z" fill="currentColor"/>
  </svg>
`;

        let targetUpsellChild, targetSwiperContainer;

        if (!swiperInitialized) {
          // First call — assemble and use the original elements
          swiperContainer.appendChild(swiperWrapper);
          swiperContainer.appendChild(prevButton);
          swiperContainer.appendChild(nextButton);
          upsellChild.appendChild(swiperContainer);
          targetUpsellChild = upsellChild;
          targetSwiperContainer = swiperContainer;
          swiperInitialized = true;
        } else if (targetElement !== box) {
          // Subsequent calls for a different target (custom placement) — deep-clone so each target gets its own copy
          targetUpsellChild = upsellChild.cloneNode(true);
          targetSwiperContainer = targetUpsellChild.querySelector(".swiper");

          // Remove any navigation buttons that were cloned
          const existingPrev = targetUpsellChild.querySelector("#button-prev");
          const existingNext = targetUpsellChild.querySelector("#button-next");
          if (existingPrev) existingPrev.remove();
          if (existingNext) existingNext.remove();

          targetSwiperContainer.appendChild(prevButton);
          targetSwiperContainer.appendChild(nextButton);
        } else {
          // Already initialized for the default box target — avoid duplicates
          return;
        }

        targetElement.appendChild(targetUpsellChild);

        // Initialize Swiper if Swiper is available
        if (typeof Swiper !== "undefined") {
          const swiper = new Swiper(targetSwiperContainer, {
            slidesPerView: 1,
            navigation: {
              prevEl: prevButton,
              nextEl: nextButton,
            },
            autoplay: {
              delay: upsellData.slide_interval * 1000,
              disableOnInteraction: true,
            },
            loop: true,
            on: {
              init: function () {
                this.wrapperEl.style.alignItems = "center";
                this.navigation.init();
                this.navigation.update();
              },

              touchStart() {
                this.autoplay.stop();
              },
              touchMove() {
                this.autoplay.stop();
              },
              sliderMove() {
                this.autoplay.stop();
              },
              click() {
                this.autoplay.stop();
              },
            },
          });
        }
      }

      initSwiper = initialiseSwiper;
    }

    let showContainer = false;
    container.style.display = "block";

    // Function to update visibility based on screen width
    function updateVisibility() {
      const visibility = data.visibility;
      const width = window.innerWidth;
      let isVisible = true;

      if (visibility === "mobile" && width > 768) isVisible = false;
      if (visibility === "desktop" && width <= 768) isVisible = false;
      if (visibility === "desktop_mobile") isVisible = true;

      if (data.placement_type === "custom" || data.placement.pages_type === "custom") {
        clonedShippingBars.forEach((clonedContainer) => {
          clonedContainer.style.display =
            isVisible && showContainer ? "block" : "none";
        });
      } else {
        container.style.display = isVisible && showContainer ? "block" : "none";
      }
    }

    if (designData.custom_css_applied) {
      box.classList.add(`futureblink-free-shipping_${data.id}`);
      applyCustomCss(designData, data.id);
    }

    // Initial check on page load
    updateVisibility();

    // Listen for window resize event to update visibility dynamically
    window.addEventListener("resize", updateVisibility);

    showContainer = handleBadgeVisibility(container, data.scheduled, delay);

    const icon = await getIconStyle(designData);
    if (icon) {
      iconWapper.innerHTML = icon;
    }

    if (type === "product_page") {
      if (data.placement_type === "custom") {
        const customContainer = document.querySelector(
          `div[futureblink-shipping-type="${type}"][id="${data.id}"]`,
        );
        if (customContainer) {
          if (!customContainer.querySelector('[futureblink-shipping-bar]')) {
            const clonedContainer = clonedShippingBars.length === 0 ? container : container.cloneNode(true);
            clonedShippingBars.push(clonedContainer);

            // Find the progress bar element in the cloned container
            const clonedProgressBarElement = clonedContainer.querySelector(
              "[futureblink-shipping-bar-progress]",
            );
            if (clonedProgressBarElement) {
              // Create a new progress bar instance for this clone
              const clonedProgressBar = await createProgressBar(
                finalValue,
                designData,
              );
              // Replace the cloned element with the new instance
              clonedProgressBarElement.replaceWith(clonedProgressBar.element);
              clonedProgressBars.push(clonedProgressBar);
            }
            customContainer.appendChild(clonedContainer);
          }
        }
      } else {
        if (data.placement.pages_type === "custom") {
          const shippingBlocks = document.querySelectorAll(
            ".futureblink-shipping-bar-block",
          );
          shippingBlocks.forEach(async (block) => {
            if (block.id === data.id) {
              const clonedContainer = clonedShippingBars.length === 0 ? container : container.cloneNode(true);
              clonedShippingBars.push(clonedContainer);

              // Find the progress bar element in the cloned container
              const clonedProgressBarElement = clonedContainer.querySelector(
                "[futureblink-shipping-bar-progress]",
              );
              if (clonedProgressBarElement) {
                // Create a new progress bar instance for this clone
                const clonedProgressBar = await createProgressBar(
                  finalValue,
                  designData,
                );
                // Replace the cloned element with the new instance
                clonedProgressBarElement.replaceWith(clonedProgressBar.element);
                clonedProgressBars.push(clonedProgressBar);
              }

              block.appendChild(clonedContainer);
            }
          });
        } else {
          if (window.location.pathname.includes("/products")) {
            const addToCartElement = getAddToCartElement(
              window.Shopify.theme,
            );

            addToCartElement.insertAdjacentElement("afterend", container);
          }
        }
      }
    }

    const cartDrawer = type === "cart_drawer" ? true : type === "cart_page" ? !window.location.pathname.includes("/cart") : false;
    const cartPage = type === "cart_page_only" ? true : type === "cart_page" ? window.location.pathname.includes("/cart") : false;

    if (type === "cart_page_only" || type === "cart_drawer" || type === "cart_page") {
      if (data.placement_type === "custom") {
        const customContainer = document.querySelector(
          `div[futureblink-shipping-type="${type}"][id="${data.id}"]`,
        );
        if (customContainer) {
          if (!customContainer.querySelector('[futureblink-shipping-bar]')) {
            const clonedContainer = clonedShippingBars.length === 0 ? container : container.cloneNode(true);
            clonedShippingBars.push(clonedContainer);

            // Find the progress bar element in the cloned container
            const clonedProgressBarElement = clonedContainer.querySelector(
              "[futureblink-shipping-bar-progress]",
            );
            if (clonedProgressBarElement) {
              // Create a new progress bar instance for this clone
              const clonedProgressBar = await createProgressBar(
                finalValue,
                designData,
              );
              // Replace the cloned element with the new instance
              clonedProgressBarElement.replaceWith(clonedProgressBar.element);
              clonedProgressBars.push(clonedProgressBar);
            }

            customContainer.appendChild(clonedContainer);
          }
        }
      } else {
        if (data.placement.pages_type === "custom") {
          const shippingBlocks = document.querySelectorAll(
            ".futureblink-shipping-bar-block",
          );
          shippingBlocks.forEach(async (block) => {
            if (block.id === data.id) {
              const clonedContainer = clonedShippingBars.length === 0 ? container : container.cloneNode(true);
              clonedShippingBars.push(clonedContainer);

              // Find the progress bar element in the cloned container
              const clonedProgressBarElement = clonedContainer.querySelector(
                "[futureblink-shipping-bar-progress]",
              );
              if (clonedProgressBarElement) {
                // Create a new progress bar instance for this clone
                const clonedProgressBar = await createProgressBar(
                  finalValue,
                  designData,
                );
                // Replace the cloned element with the new instance
                clonedProgressBarElement.replaceWith(clonedProgressBar.element);
                clonedProgressBars.push(clonedProgressBar);
              }

              block.appendChild(clonedContainer);
            }
          });
        } else {
          if (cartDrawer && !window.location.pathname.includes("/cart")) {
            const observer = new MutationObserver(() => {
              observer.disconnect();
              const selectors = [
                `form[action="${root}cart"]`,
                "#cartForm",
                "#cart-notification",
                "#CartDrawerForm",
                "#mini-cart",
                "cart-form",
                "#cartNotificationPanel",
                ".cart__footer",
              ];

              let firstFound = selectors
                .map((selector) => ({
                  selector,
                  element: document.querySelector(selector),
                }))
                .find((item) => item.element !== null);

              if (["Hyper"].includes(window.Shopify.theme.schema_name)) {
                firstFound = {
                  selector: "Hyper",
                  element: document.querySelector(".drawer__header"),
                };
              }
              if (["Impulse", "Motion"].includes(window.Shopify.theme.schema_name)) {
                firstFound = {
                  selector: "Impulse",
                  element: document.querySelector(`form[action="${root}cart"]`),
                };
              }
              if (["Ella"].includes(window.Shopify.theme.schema_name)) {
                firstFound = {
                  selector: "Ella",
                  element: document.querySelector(`.previewCart`),
                };
              }
              if (["Cornerstone"].includes(window.Shopify.theme.schema_name)) {
                firstFound = {
                  selector: "Cornerstone",
                  element: document.querySelector(".quick-cart__main-content"),
                };
              }
              if (["Reformation"].includes(window.Shopify.theme.schema_name)) {
                firstFound = {
                  selector: "Reformation",
                  element: document.querySelector("#Cart-Drawer .side-panel-content"),
                };
              }
              if (["Concept"].includes(window.Shopify.theme.schema_name)) {
                firstFound = {
                  selector: "Concept",
                  element: document.querySelector(`[id*=MiniCart-sections]`),
                };
              }
              if (["Whisk"].includes(window.Shopify.theme.schema_name)) {
                firstFound = {
                  selector: "Whisk",
                  element: document.querySelector("#cart-drawer-contents"),
                };
              }
              if (["Wonder"].includes(window.Shopify.theme.schema_name)) {
                firstFound = {
                  selector: "Wonder",
                  element: document.querySelector(".wt-cart__drawer__header"),
                };
              }
              if (["Boost"].includes(window.Shopify.theme.schema_name)) {
                firstFound = {
                  selector: "Boost",
                  element: document.querySelector(".added-notice"),
                };
              }
              if (["Area"].includes(window.Shopify.theme.schema_name)) {
                firstFound = {
                  selector: "Area",
                  element: document.querySelector(".modal-heading"),
                };
              }
              if (["Atlantic"].includes(window.Shopify.theme.schema_name)) {
                firstFound = {
                  selector: "Atlantic",
                  element: document.querySelector(
                    ".sidebar-drawer__header-container",
                  ),
                };
              }
              if (
                ["Minion", "Sleek"].includes(window.Shopify.theme.schema_name)
              ) {
                firstFound = {
                  selector: "Minion",
                  element: document.querySelector(".drawer__heading"),
                };
              }
              if (["Charge"].includes(window.Shopify.theme.schema_name)) {
                firstFound = {
                  selector: "Charge",
                  element: document.querySelector(".cart-sidebar__header"),
                };
              }
              if (["Expanse"].includes(window.Shopify.theme.schema_name)) {
                firstFound = {
                  selector: "Expanse",
                  element: document.querySelector(".cart__scrollable"),
                };
              }
              if (["Stockholm"].includes(window.Shopify.theme.schema_name)) {
                firstFound = {
                  selector: "Stockholm",
                  element: document.querySelector(".cart-drawer__bottom"),
                };
              }
              if (["Avenue"].includes(window.Shopify.theme.schema_name)) {
                firstFound = {
                  selector: "Avenue",
                  element: document.querySelector("#cart-dropdown"),
                };
              }
              if (["Athens"].includes(window.Shopify.theme.schema_name)) {
                firstFound = {
                  selector: "Athens",
                  element: document.querySelector("[class*=drawer-header]"),
                };
              }
              if (["Unicorn"].includes(window.Shopify.theme.schema_name)) {
                firstFound = {
                  selector: "Unicorn",
                  element: document.querySelector("#cart-drawer-heading"),
                };
              }
              if (["Taiga"].includes(window.Shopify.theme.schema_name)) {
                firstFound = {
                  selector: "Taiga",
                  element: document.querySelector(".drawer-cart__header"),
                };
              }
              if (["Yuva"].includes(window.Shopify.theme.schema_name)) {
                firstFound = {
                  selector: "Yuva",
                  element: document.querySelector(".yv_side_drawer_title"),
                };
              }
              if (
                ["Blockshop", "Beyond", "Maker"].includes(
                  window.Shopify.theme.schema_name,
                )
              ) {
                firstFound = {
                  selector: "Blockshop",
                  element: document.querySelector(".cart--header"),
                };
              }
              if (["Pinnacle"].includes(window.Shopify.theme.schema_name)) {
                firstFound = {
                  selector: "Pinnacle",
                  element: document.querySelector(".cart-drawer--footer"),
                };
              }
              if (["Showcase"].includes(window.Shopify.theme.schema_name)) {
                firstFound = {
                  selector: "Showcase",
                  element: document.querySelector(""),
                };
              }

              if (["Prestige"].includes(window.Shopify.theme.schema_name)) {
                firstFound = {
                  selector: "Prestige",
                  element: document.querySelector(".cart-drawer__items"),
                };
              }
              if (firstFound?.element && !document.contains(container)) {
                switch (firstFound.selector) {
                  case `form[action="${root}cart"]`:
                    firstFound.element.parentNode.insertAdjacentElement(
                      "afterBegin",
                      container,
                    );
                    break;
                  case "#cart-notification":
                  case "#cartNotificationPanel":
                  case "#mini-cart":
                  case "cart-form":
                  case "Pinnacle":
                  case "Avenue":
                  case ".cart__footer":
                  case "Stockholm":
                  case "#CartDrawerForm":
                  case "Boost":
                  case "Reformation":
                  case "Cornerstone":
                  case "Ella":
                  case "Expanse":
                    firstFound.element.prepend(container);
                    break;
                  case "Impulse":
                    const scrollable = firstFound.element.querySelector(
                      ".drawer__scrollable",
                    );
                    scrollable.prepend(container);
                    break;
                  case "Hyper":
                    firstFound.element.appendChild(container);
                    break;
                  case "Whisk":
                  case "Concept":
                    firstFound.element.insertAdjacentElement(
                      "beforebegin",
                      container,
                    );
                    break;
                  case "Athens":
                  case "Taiga":
                  case "Blockshop":
                  case "Yuva":
                  case "Unicorn":
                  case "Charge":
                  case "Minion":
                  case "Atlantic":
                  case "Area":
                  case "Wonder":
                    firstFound.element.insertAdjacentElement(
                      "afterend",
                      container,
                    );
                    break;
                  default:
                    firstFound.element.parentNode.insertAdjacentElement(
                      "afterbegin",
                      container,
                    );
                    break;
                }
              }

              observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
              });
            });

            observer.observe(document.body, {
              childList: true,
              subtree: true,
              attributes: true,
            });
          } else if (cartPage && window.location.pathname.includes("/cart")) {
            // --- Helper: insert the container safely ---
            const insertContainer = () => {
              const theme = window.Shopify?.theme?.schema_name;
              if (!theme) return;

              const themeSelectors = {
                Warehouse: `form[action*="${root}cart"]`,
                Spotlight: `cart-items`,
                Rise: `cart-items`,
                Publisher: `cart-items`,
                Colorblock: `cart-items`,
                Origin: `cart-items`,
                Refresh: `cart-items`,
                Ride: `cart-items`,
                Studio: `cart-items`,
                Taste: `cart-items`,
                Sense: `cart-items`,
                Crave: `cart-items`,
                Craft: `cart-items`,
                Woodstock: `form[action*="${root}cart"]`,
                Dawn: "cart-items",
                Split: `form[action*="${root}cart"]`,
                Aurora: `form[action*="${root}cart"]`,
                Next: `form[action*="${root}cart"]`,
                Focal: `form[action*="${root}cart"]`,
                Impact: ".cart-header",
                Refine: ".cart-header",
                Reformation: ".cart-items",
                Release: "cart-items",
                Ignite: "#main-cart",
                Athens: "cart-items",
                Abode: "cart-items",
                Blockshop: ".cart--header",
                Beyond: ".cart--header",
                Maker: ".cart--header",
                Testament: "[data-section-type='cart']",
                Icon: "[data-section-type='cart']",
                Fashionopolism: "[data-section-type='cart']",
                Vantage: "[data-section-type='cart']",
                Paris: ".header",
                Align: ".header",
                Motion: "#CartPageForm",
                Impulse: "#CartPageForm",
                Sahara: ".cart__body",
                Ascent: ".cart-details",
                Honey: ".main-cart-wrapper",
                Local: ".cart-section",
                Vision: ".row",
                Shark: ".row",
                Concept: "main-cart",
                Sleek: "main-cart",
                Hyper: "main-cart",
                Horizon: ".header__columns.spacing-style",
                Empire: ".cartitems--list",
                Atelier: ".cart-items-component",
                Dwell :".cart-items-component"
              };

              const selector =
                themeSelectors[theme] || `form[action*="${root}cart"]`;
              const cartForm = document.querySelector(selector);

              if (cartForm && !document.contains(container)) {
                if (
                  [
                    "Warehouse",
                    "Focal",
                    "Woodstock",
                    "Aurora",
                    "Next",
                    "Split",
                  ].includes(theme)
                ) {
                  cartForm.parentNode.insertAdjacentElement(
                    "afterbegin",
                    container,
                  );
                } else if (
                  [
                    "Horizon",
                    "Impact",
                    "Refine",
                    "Blockshop",
                    "Beyond",
                    "Maker",
                    "Paris",
                    "Align",
                  ].includes(theme)
                ) {
                  cartForm.insertAdjacentElement("afterend", container);
                } else if (
                  [
                    "Ride",
                    "Atelier",
                    "Empire",
                    "Reformation",
                    "Release",
                    "Ignite",
                    "Athens",
                    "Abode",
                    "Sahara",
                    "Impulse",
                    "Ascent",
                    "Honey",
                    "Local",
                    "Vision",
                    "Shark",
                    "Concept",
                    "Sleek",
                    "Hyper",
                    "Motion"
                  ].includes(theme)
                ) {
                  cartForm.insertAdjacentElement("beforebegin", container);
                } else if (
                  [
                    "Craft",
                    "Crave",
                    "Sense",
                    "Taste",
                    "Studio",
                    "Colorblock",
                    "Refresh",
                    "Publisher",
                    "Rise",
                    "Spotlight",
                    "Origin",
                    "Dawn",
                    "Testament",
                    "Icon",
                    "Fashionopolism",
                    "Vantage",
                  ].includes(theme)
                ) {
                  cartForm.prepend(container);
                } else if (["Generated Data Theme", "Trade"].includes(theme)) {
                  const cartForms = document.querySelectorAll(selector);
                  if (cartForms.length > 1) {
                    cartForms[1].parentNode.insertAdjacentElement(
                      "afterbegin",
                      container,
                    );
                  }
                } else {
                  const cartForms = document.querySelectorAll(selector);
                  if (cartForms.length) {
                    cartForms[0].parentNode.insertAdjacentElement(
                      "afterbegin",
                      container,
                    );
                  }
                }
              }
            };

            // --- Run once immediately (covers incognito static load) ---
            insertContainer();

            // --- Observe future mutations (covers dynamic changes) ---
            const observer = new MutationObserver(insertContainer);
            observer.observe(document.body, {
              childList: true,
              subtree: true,
              attributes: true,
            });
          }
        }
      }
    }

    if (progress > 0 && type === "cart_page" && !viewed) {
      viewed = true;
      new HoppyFreeShippingTracker(trackerConfig);
    } else if (type === "product_page") {
      new HoppyFreeShippingTracker(trackerConfig);
    }

    await addRecommendedProducts();
    await addSpecificUpsellproducts();

    if (typeof initSwiper === "function") {
      if (data.placement_type === "custom" || data.placement.pages_type === "custom") {
        clonedShippingBars.forEach((clonedContainer) => {
          const mainWrapper = clonedContainer.querySelector(
            "[futureblink-shipping-bar]",
          );
          initSwiper(mainWrapper);
        });
      } else {
        initSwiper();
      }
    }

    let exclusionMap = {};
    let inclusionMap = {};

    if (
      ["specific_collections", "include_specific_collections"].includes(contentData.exclude_type) &&
      cart.items.length > 0
    ) {
      let targetCollections = [];

      targetCollections = contentData.excluded_from_goals.map((collection) =>
        // Convert to full GID so it matches what the server compares against
        `gid://shopify/Collection/${collection?.id?.split("/")?.pop()}`
      );

      // Wrap as GIDs — Admin GraphQL nodes() requires gid://shopify/Product/{id}
      const cartProductIds = cart.items.map((item) => `gid://shopify/Product/${item.product_id}`);

      let results = [];

      if (targetCollections.length > 0) {
        const res = await fetch("/apps/shipping-bar/validate-collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetCollectionIds: targetCollections,
            cartProductIds: cartProductIds,
          }),
        });

        const data = await res.json();
        results = data.results;
      }

      calculateMethod = "original_line_price";

      if (contentData.progress_calculation === "after_discount") {
        calculateMethod = "discounted_price";
      }

      if (contentData.exclude_type === "specific_collections") {
        exclusionMap = Object.fromEntries(
          // Server returns full GIDs; cart items use bare numeric product_id — extract the number
          results.map((r) => [r.productId.split("/").pop(), r.inTargetCollection]),
        );
      } else if (contentData.exclude_type === "include_specific_collections") {
        inclusionMap = Object.fromEntries(
          results.map((r) => [r.productId.split("/").pop(), r.inTargetCollection]),
        );
      }
    }

    if (contentData.exclude_type === "specific_products") {
      exclusionMap = Object.fromEntries(
        contentData.excluded_from_goals.map((r) => [
          r.id.split("/")?.pop(),
          true,
        ]),
      );
    } else if (contentData.exclude_type === "include_specific_products") {
      inclusionMap = Object.fromEntries(
        contentData.excluded_from_goals.map((r) => [
          r.id.split("/")?.pop(),
          true,
        ]),
      );
    }

    totalPrice = cart.items.reduce((sum, item) => {
      if (['specific_collections', 'specific_products'].includes(contentData.exclude_type) && exclusionMap[item.product_id]) return sum;
      if (['include_specific_collections', 'include_specific_products'].includes(contentData.exclude_type) && !inclusionMap[item.product_id]) return sum;

      const baseValue = (item[calculateMethod] || 0) / 100;
      const multiplier =
        calculateMethod === "discounted_price" ? item.quantity : 1;

      return sum + baseValue * multiplier;
    }, 0);

    totalQuantity = cart.items.reduce((sum, item) => {
      if (['specific_collections', 'specific_products'].includes(contentData.exclude_type) && exclusionMap[item.product_id]) return sum;
      if (['include_specific_collections', 'include_specific_products'].includes(contentData.exclude_type) && !inclusionMap[item.product_id]) return sum;

      return sum + (contentData.unique_products ? 1 : item.quantity);
    }, 0);

    const value =
      contentData.goal_type === "product_quantity" ? totalQuantity : totalPrice;

    updateProgress(value, true);
  }

  async function topBottomPage(data, translations, delay) {
    const clonedShippingBars = [];
    const clonedProgressBars = [];

    const rate = window.Shopify.currency.rate;

    const fonts = {
      "helvetica": "Helvetica",
      "arial": "Arial",
      "tahoma": "Tahoma",
      "treubuchet_ms": "Trebuchet MS",
      "times_new_roman": "Times New Roman",
      "georgia": "Georgia",
      "garamond": "Garamond",
      "courier_new": "Courier New",
      "brush_script": "'Brush Script MT', cursive",
      "impact": "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif",
      "segoe_UI": "Segoe UI, Segoe UI Variable Text, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif",
      "roboto": "'Roboto', sans-serif",
      "roboto_mono": "'Roboto Mono', monospace",
      "roboto_condensed": "'Roboto Condensed', sans-serif",
      "montserrat": "'Montserrat', sans-serif",
      "rubik": "'Rubik', sans-serif",
      "open_sans": "'Open Sans', sans-serif",
      "google_sans": "'Google Sans', sans-serif",
      "lato": "'Lato', sans-serif",
      "poppins": "'Poppins', sans-serif",
      "noto_sans": "'Noto Sans', sans-serif",
      "inter": "'Inter', sans-serif",
      "playfair_display": "'Playfair Display', serif",
      "arimo": "'Arimo', sans-serif",
      "oswald": "'Oswald', sans-serif",
      "raleway": "'Raleway', sans-serif",
      "nunito": "'Nunito', sans-serif",
      "nunito_sans": "'Nunito Sans', sans-serif",
      "crimson_text": "'Crimson Text', serif",
      "dm_sans": "'DM Sans', sans-serif",
      "ubuntu": "'Ubuntu', sans-serif",
      "archivo": "'Archivo', sans-serif",
      "lobster": "'Lobster', sans-serif",
      "red_hat_display": "'Red Hat Display', sans-serif",
      "pacifico": "'Pacifico', cursive",
      "oxygen": "'Oxygen', sans-serif",
      "roboto_slab": "'Roboto Slab', serif",
      "bricologe_grotesque": "'Bricolage Grotesque', sans-serif",
      "grey_qo": "'Grey Qo', cursive",
      "passions_conflict": "'Passions Conflict', cursive",
      "lovers_quarrel": "'Lovers Quarrel', cursive",
      "engagement": "'Engagement', cursive",
      "work_sans": "'Work Sans', sans-serif",
      "source_sans_3": "'Source Sans 3', sans-serif",
      "merriweather": "'Merriweather', serif",
      "bodoni_moda": "'Bodoni Moda', serif",
      "cormorant_SC": "'Cormorant SC', serif",
      "libre_caslon_text": "'Libre Caslon Text', serif",
      "libre_baskerville": "'Libre Baskerville', serif",
      "spectral": "'Spectral', serif",
      "bebas_neue": "'Bebas Neue', sans-serif",
      "anton": "'Anton', sans-serif",
      "abril_fatface": "'Abril Fatface', serif",
      "league_spartan": "'League Spartan', sans-serif",
      "great_vibes": "'Great Vibes', cursive",
      "dancing_script": "'Dancing Script', cursive",
      "allura": "'Allura', cursive",
      "satisfy": "'Satisfy', cursive",
      "sacramento": "'Sacramento', cursive",
      "playball": "'Playball', cursive",
      "amatic_SC": "'Amatic SC', sans-serif"
    };



    const contentData = data.content;
    const designData = data.design;
    const placementData = data.placement;
    const isSystemFont = (font) => {
      // System fonts list
      const systemFonts = [
        "custom",
        "helvetica",
        "arial",
        "tahoma",
        "treubuchet_ms",
        "times_new_roman",
        "georgia",
        "garamond",
        "courier_new",
        "brush_script",
        "impact",
        "segoe_UI",
      ];
      return systemFonts.includes(font.toLowerCase());
    };

    if (designData.font && !isSystemFont(designData.font)) {
      const existingLink = document.getElementById(`dynamic-font-${data.type}-${data.id}`);
      if (existingLink) existingLink.remove();

      let fontForLink = designData.font.trim();

      // 2. Capitalize each word
      fontForLink = fontForLink
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("+");

      // Create new link element
      const link = document.createElement("link");
      link.id = `dynamic-font-${data.type}-${data.id}`;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css?family=${fontForLink}&display=swap`;
      link.media = "all";
      document.head.appendChild(link);
    }

    const currentStoreCurrency = window.futureBlink_storeCurrency;
    const locationCurrency = window.futureBlink_country;

    const matchedItem =
      contentData.specific_market_goals.length > 0 &&
      contentData.specific_market_goals.find((item) => {
        const currencies = item.currency.split(",").map((c) => c.trim());
        return currencies.includes(locationCurrency);
      });

    const goals = matchedItem?.goals || contentData.goals;
    const initial_message =
      translations?.message ||
      matchedItem?.initial_message ||
      contentData.message;
    const goal_reached_message =
      translations?.goal ||
      matchedItem?.goal_reached_message ||
      contentData.goal_reached_message;
    const storeCurrency = matchedItem
      ? currentStoreCurrency
      : data.content.currency;

    let progress = 0;
    let previousProgress = 0;

    const progress_calculation = contentData.progress_calculation;

    let calculateMethod = "original_line_price";

    if (progress_calculation === "after_discount") {
      calculateMethod = "discounted_price";
    }

    let totalPrice = cart.items.reduce(
      (sum, item) =>
        sum +
        ((item[calculateMethod] || 0) / 100) *
        (calculateMethod === "discounted_price" ? item.quantity : 1),
      0,
    );

    let totalQuantity = cart.items.reduce(
      (sum, item) =>
        sum + (contentData.unique_products ? 1 : item.quantity || 0),
      0,
    );
    progress =
      contentData.goal_type === "product_quantity" ? totalQuantity : totalPrice;


    let currentGoalIndex = goals.findIndex((g) => progress < g.goal);

    // If progress exceeds all goals, use the last goal
    if (currentGoalIndex === -1) {
      currentGoalIndex = goals.length - 1;
    }

    const currentGoal = goals[currentGoalIndex];
    const previousGoal =
      currentGoalIndex > 0 ? goals[currentGoalIndex - 1].goal : 0;

    const tierProgress = progress - previousGoal;
    const tierTotal = currentGoal.goal - previousGoal;

    const percentageCompletion = Math.min(
      (tierProgress / tierTotal) * 100,
      100,
    );

    const finalValue =
      contentData.exclude_type === "specific_collections" &&
        cart.items.length > 0
        ? 0
        : percentageCompletion;

    const progressBar = await createProgressBar(finalValue, designData, goals.length, designData.goal_icons);

    progressBar.element.setAttribute("futureblink-shipping-bar-progress", "");

    function freeProductAdd(value) {
      // Find all goals that are reached
      const reachedGoals = goals.filter((g) => value >= g.goal);
      const rewardApplication = contentData.reward_application || "all";

      // If none reached, return empty structure
      if (reachedGoals.length === 0) {
        return {
          hasGoalReached: false,
          isRewardType: false,
          rewardVariants: [],
        };
      }

      // Collect reward variants from all reached goals
      let rewardVariants = [];

      if (rewardApplication === "highest") {
        // Only get reward from the HIGHEST goal reached
        const highestGoal = reachedGoals.reduce((max, g) => g.goal > max.goal ? g : max, reachedGoals[0]);

        if (highestGoal.reward_type === "free_gift" && Array.isArray(highestGoal.reward_value)) {
          rewardVariants = highestGoal.reward_value
            .map((item) => {
              const match = item.id.match(/ProductVariant\/(\d+)/);
              return match ? { id: parseInt(match[1], 10), goal: highestGoal.goal } : null;
            })
            .filter(Boolean);
        }
      } else {
        reachedGoals.forEach((goal) => {
          if (
            goal.reward_type === "free_gift" &&
            Array.isArray(goal.reward_value)
          ) {
            const variants = goal.reward_value
              .map((item) => {
                const match = item.id.match(/ProductVariant\/(\d+)/);
                return match ? { id: Number(match[1]), goal: goal.goal } : null;
              })
              .filter(Boolean);

            rewardVariants = rewardVariants.concat(variants);
          }
        });
      }
      return {
        hasGoalReached: rewardVariants.length > 0,
        isRewardType: rewardVariants.length > 0,
        rewardVariants,
      };
    }

    const bgDiv =
      contentData.cta === "full"
        ? document.createElement("a")
        : document.createElement("div");

    if (contentData.cta === "full") {
      bgDiv.href = contentData.cta_link || "#"; // fallback if link is missing
      if (contentData.cta_open_new_tab) bgDiv.target = "_blank";
      bgDiv.style.textDecoration = "none";
    }
    bgDiv.setAttribute("futureblink-shipping-bar", "");
    bgDiv.className =
      designData.background === "patterns"
        ? `fblink-pattern-${designData?.background_pattern}`
        : "";
    bgDiv.style.position = "relative";
    bgDiv.style.padding = "10px 10px";
    bgDiv.style.width = "100%";
    bgDiv.style.display = "flex";
    bgDiv.style.alignItems = "center";
    bgDiv.style.justifyContent = "center";
    bgDiv.style.flexWrap = "wrap";
    bgDiv.style.background =
      designData.background === "gradient"
        ? `linear-gradient(${designData.angle}deg, ${designData.initial_color}, ${designData.final_color})`
        : designData.background === "tri_gradient"
          ? `linear-gradient(${designData.angle}deg, ${designData.initial_color}, ${designData.intermediate_color}, ${designData.final_color})`
          : designData.background === "single"
            ? designData.color
            : "";
    bgDiv.style.fontSize = `${designData.message_size}px`;
    bgDiv.style.color = designData.message_color;
    (bgDiv.style.paddingTop = `${designData.spacing_inside_top}px`),
      (bgDiv.style.paddingBottom = `${designData.spacing_inside_bottom}px`),
      (bgDiv.style.marginTop = `${designData.spacing_outside_top}px`),
      (bgDiv.style.marginBottom = `${designData.spacing_outside_bottom}px`),
      (bgDiv.style.borderColor = designData.border_color);
    bgDiv.style.borderWidth = `${designData.border_size || 0}px`;
    bgDiv.style.borderStyle = (designData.border_size > 0) ? "solid" : "none";
    bgDiv.style.marginLeft = "auto";
    bgDiv.style.marginRight = "auto";
    bgDiv.style.width = `${designData.shipping_bar_width || 100}%`;
    bgDiv.style.gap = "6px";
    bgDiv.style.textAlign = "center";

    if (data.placement.pages_type !== "custom") {
      if (designData.position === "top_push_scroll") {
        bgDiv.style.position = "sticky";
        bgDiv.style.top = "0";
        bgDiv.style.zIndex = 1000;
      } else if (designData.position === "top_overlap") {
        bgDiv.style.position = "absolute";
        bgDiv.style.top = "0";
        bgDiv.style.left = "50%";
        bgDiv.style.transform = "translateX(-50%)";
        bgDiv.style.zIndex = 1000;
      } else if (designData.position === "top_overlap_scroll") {
        bgDiv.style.position = "fixed";
        bgDiv.style.top = "0";
        bgDiv.style.left = "50%";
        bgDiv.style.transform = "translateX(-50%)";
        bgDiv.style.zIndex = 1000;
      } else if (designData.position === "bottom_overlap_scroll") {
        bgDiv.style.position = "fixed";
        bgDiv.style.bottom = "0";
        bgDiv.style.left = "50%";
        bgDiv.style.transform = "translateX(-50%)";
        bgDiv.style.zIndex = 1000;
      }
    }

    const iconWapper = document.createElement("div");
    iconWapper.style.display = "flex";
    iconWapper.style.justifyContent = "center";

    const iconDiv = document.createElement("div");
    iconDiv.className = "futureblink-icon";

    const messageDiv = document.createElement("div");
    messageDiv.className = "futureblink-message";
    messageDiv.innerHTML = getMessage(0);
    messageDiv.style.fontFamily = fonts[designData.font]
      ? fonts[designData.font]
      : "inherit";
    messageDiv.style.fontWeight = designData.font_weight || "inherit";

    let ctaButton = null;

    if (contentData.cta === "button") {
      ctaButton = document.createElement("a");
      ctaButton.setAttribute("futureblink-shipping-bar-cta", "");
      ctaButton.href = contentData.cta_link || "#";
      if (contentData.cta_open_new_tab) ctaButton.target = "_blank";
      ctaButton.className = `futureblink-cta-button ${designData.button_hover} ${designData.button_animation}`;
      ctaButton.style.border = "none";
      ctaButton.style.padding = "10px";
      ctaButton.style.textDecoration =
        designData.button_font_style === "Underline" ? "underline" : "none";
      ctaButton.style.textAlign = "center";
      ctaButton.style.width = "fit-content";
      ctaButton.style.backgroundColor = designData.button_color;
      ctaButton.style.color = designData.button_text_color;
      ctaButton.style.fontSize = `${designData.button_text_size}px`;
      ctaButton.style.fontFamily = designData.font
        ? fonts[designData.font]
        : "inherit";
      ctaButton.style.borderRadius = `${designData.button_corner_radius}px`;
      ctaButton.style.marginLeft = "8px";
      ctaButton.style.fontWeight = designData.button_font_weight;
      ctaButton.style.fontStyle = designData.button_font_style;
      ctaButton.innerText = getButtonText(0);
    }

    const contentWrapper = document.createElement("div");
    contentWrapper.style.display = "flex";
    contentWrapper.style.alignItems = "center";
    contentWrapper.style.justifyContent = "center";
    contentWrapper.style.gap = "6px";
    contentWrapper.className = "futureblink-content-wrapper";

    if (designData.icon && designData.icon_position === "before") {
      contentWrapper.appendChild(iconWapper);
      contentWrapper.appendChild(messageDiv);
      if (ctaButton) contentWrapper.appendChild(ctaButton);
    } else if (designData.icon && designData.icon_position === "after") {
      contentWrapper.appendChild(messageDiv);
      contentWrapper.appendChild(iconWapper);
      if (ctaButton) contentWrapper.appendChild(ctaButton);
    } else {
      // No icon
      contentWrapper.appendChild(messageDiv);
      if (ctaButton) contentWrapper.appendChild(ctaButton);
    }
    bgDiv.appendChild(contentWrapper);

    if (designData.show_progress_bar) {
      const progressBarContainer = document.createElement("div");
      progressBarContainer.style.width = "100%";
      progressBarContainer.style.display = `flex`;
      progressBarContainer.style.justifyContent = `center`;
      const progressBarWrapper = document.createElement("div");
      progressBarWrapper.style.width = `${designData.bar_width}%`;
      progressBarWrapper.appendChild(progressBar.element);
      progressBarContainer.appendChild(progressBarWrapper);
      bgDiv.appendChild(progressBarContainer);
    }

    bgDiv.style.display = "none";

    function getMessage(added) {
      let currentGoalIndex = goals.findIndex((g) => added < g.goal);
      if (currentGoalIndex === -1) currentGoalIndex = goals.length - 1;

      const currentGoal = goals[currentGoalIndex];
      const remaining = currentGoal.goal - added;

      const symbol = currencies[storeCurrency].symbol ?? "";
      const currency =
        contentData.goal_type !== "product_quantity" ? storeCurrency : "";
      const showSymbol =
        contentData.goal_type !== "product_quantity"
          ? contentData.show_currency_symbol
          : false;
      const position = contentData.currency_symbol_position;

      const size = designData.price_text_size ?? "16px";
      const color = designData.price_text_color ?? "#000";

      // Case 1: No progress yet
      if (remaining === currentGoal.goal) {
        const formatted = formatAmount(
          contentData,
          designData,
          currentGoal.goal,
          storeCurrency,
        );
        const rawMessage = initial_message;
        // Use regex split to preserve exact spacing and punctuation
        const parts = rawMessage.split(/(\{order-value\})/g);
        return parts.map(part => part === "{order-value}" ? formatted : part).join("");
      }

      // Case 2: In progress
      if (remaining > 0) {
        const formattedValue =
          contentData.goal_type === "product_quantity"
            ? remaining // keep integer
            : remaining.toFixed(2); // format price

        const formatted = formatAmount(
          contentData,
          designData,
          formattedValue,
          storeCurrency,
        );
        const rawProgress =
          translations?.progressMessage[currentGoalIndex] ||
          currentGoal.progress_message ||
          contentData.progress_message ||
          "";
        // Use regex split to preserve exact spacing and punctuation
        const parts = rawProgress.split(/(\{order-value-progress\})/g);
        return parts.map(part => part === "{order-value-progress}" ? formatted : part).join("");
      }

      // Case 3: Goal reached
      if (contentData.show_goal_reached_message === false) {
        // keep showing progress message instead of goal-reached message
        const effectiveRemaining = 0; // prevent negative numbers
        const formattedValue =
          contentData.goal_type === "product_quantity"
            ? effectiveRemaining
            : effectiveRemaining.toFixed(2);

        const formatted = formatAmount(
          contentData,
          designData,
          formattedValue,
          storeCurrency,
        );
        const rawProgress =
          translations?.progressMessage[currentGoalIndex] ||
          currentGoal.progress_message ||
          contentData.progress_message ||
          "";

        // Use regex split to preserve exact spacing and punctuation
        const parts = rawProgress.split(/(\{order-value-progress\})/g);
        return parts.map(part => part === "{order-value-progress}" ? formatted : part).join("");
      }

      const span = document.createElement("span");
      span.className = "futureblink-message";
      span.style.fontFamily = fonts[designData.font]
        ? fonts[designData.font]
        : "";
      span.style.fontWeight = designData.font_weight || "inherit";
      span.style.fontSize = `${designData.message_size}px`;
      span.style.color = designData.goal_message_color;
      span.textContent = goal_reached_message || "";
      return span.outerHTML;
    }

    const icon = await getIconStyle(designData);
    if (icon) {
      iconWapper.innerHTML = icon;
    }

    function getButtonText(added) {
      const buttonTextData = translations?.buttonText || contentData.button_text;

      // Fallback for legacy string (though we expect object now)
      if (typeof buttonTextData === 'string') return buttonTextData;
      if (!buttonTextData) return "Shop Now";

      // Find the first goal that hasn't been reached yet
      let currentGoalData = goals.find((g) => added < g.goal);
      let index = goals.findIndex((g) => added < g.goal);

      // If all goals are reached
      if (!currentGoalData) {
        return buttonTextData.goal_reached || "Shop Now";
      }

      const remaining = currentGoalData.goal - added;

      // Case 1: Start (0 progress)
      if (remaining === currentGoalData.goal && index === 0) {
        return buttonTextData.initial_message || "Shop Now";
      }

      // Case 2: In progress
      if (remaining > 0) {
        return buttonTextData.progress_messages?.[index] || buttonTextData.initial_message || "Shop Now";
      }

      // Fallback
      return buttonTextData.initial_message || "Shop Now";
    }

    function updateProgress(value, firstRun = false) {
      // Early return if no change
      if ((value === previousProgress && !firstRun) || !Number.isFinite(value)) {
        return;
      }

      // Calculate wasBelow BEFORE updating previousProgress
      const wasBelow = goals.filter((g) => previousProgress < g.goal).length;

      // NOW update the values
      progress = value;
      const nowBelow = goals.filter((g) => progress < g.goal).length;

      // Calculate percentageCompletion using current value
      let currentGoalIndex = goals.findIndex((g) => value < g.goal);
      if (currentGoalIndex === -1) currentGoalIndex = goals.length - 1;

      const currentGoal = goals[currentGoalIndex];
      const previousGoalValue =
        currentGoalIndex > 0 ? goals[currentGoalIndex - 1].goal : 0;
      const tierRange = currentGoal.goal - previousGoalValue;
      const completedInTier = value - previousGoalValue;
      let percentageCompletion = Math.min(
        (completedInTier / tierRange) * 100,
        100,
      );

      // For multi-goal view, we need global percentage (0-100% across all goals)
      if (designData.multiple_goals_marker === "all") {
        const totalGoals = goals.length;
        const baseProgress = (currentGoalIndex / totalGoals) * 100;
        const tierContribution = (percentageCompletion / 100) * (100 / totalGoals);
        percentageCompletion = baseProgress + tierContribution;
      }

      // Update UI...
      if (data.placement_type === "custom" || data.placement.pages_type === "custom") {
        clonedShippingBars.forEach((clonedContainer, index) => {
          const messageDiv = clonedContainer.querySelector(".futureblink-message");
          if (messageDiv) {
            messageDiv.innerHTML = getMessage(progress);
            messageDiv.style.fontFamily = fonts[designData.font] ? fonts[designData.font] : "inherit";
            messageDiv.style.fontWeight = designData.font_weight || "inherit";
          }
          // Update Cloned CTA Button
          const clonedCtaButton = clonedContainer.querySelector('[futureblink-shipping-bar-cta]');
          if (clonedCtaButton) {
            clonedCtaButton.textContent = getButtonText(progress);
          }
          // Update Progress Bar
          if (clonedProgressBars[index]) {
            clonedProgressBars[index].update(percentageCompletion);
          }
        });
      } else {
        progressBar.update(percentageCompletion);
        messageDiv.innerHTML = getMessage(progress);
        messageDiv.style.fontFamily = fonts[designData.font]
          ? fonts[designData.font]
          : "inherit";
        messageDiv.style.fontWeight = designData.font_weight || "inherit";

        if (ctaButton) {
          ctaButton.textContent = getButtonText(progress);
        }
      }

      // Check fireworks BEFORE updating previousProgress
      const crossedAnyGoal = nowBelow < wasBelow;
      const reachedFinalGoal = nowBelow === 0 && wasBelow > 0;

      const shouldFire =
        (designData.fireworks === "every" && crossedAnyGoal) ||
        (designData.fireworks === "last" && reachedFinalGoal);

      if (shouldFire && !firstRun) {
        launchFirework();
      }

      // Update previousProgress at the END
      previousProgress = value;

      runAnimations(designData);
    }

    bars.push({
      id: data.id,
      contentData: contentData,
      placementData: placementData,
      updateProgress: updateProgress,
      freeProductAdd: freeProductAdd,
      addRecommendedProducts: null,
      box: bgDiv
    });

    let showContainer = false;
    bgDiv.style.display = "block";

    // Function to update visibility based on screen width
    function updateVisibility() {
      const visibility = data.visibility;
      const width = window.innerWidth;
      let isVisible = true;

      if (visibility === "mobile" && width > 768) isVisible = false;
      if (visibility === "desktop" && width <= 768) isVisible = false;
      if (visibility === "desktop_mobile") isVisible = true;

      const shouldWrap = width <= 768 ? "wrap" : "nowrap";

      if (data.placement_type === "custom" || data.placement.pages_type === "custom") {
        clonedShippingBars.forEach((clonedContainer) => {
          clonedContainer.style.display =
            isVisible && showContainer ? "flex" : "none";
          const wrapper = clonedContainer.querySelector(".futureblink-content-wrapper");
          if (wrapper) wrapper.style.flexWrap = shouldWrap;
        });
      } else {
        bgDiv.style.display = isVisible && showContainer ? "flex" : "none";
        contentWrapper.style.flexWrap = shouldWrap;
      }
    }

    if (designData.custom_css_applied) {
      bgDiv.classList.add(`futureblink-free-shipping_${data.id}`);
      applyCustomCss(designData, data.id);
    }

    // Initial check on page load
    updateVisibility();

    // Listen for window resize event to update visibility dynamically
    window.addEventListener("resize", updateVisibility);

   showContainer = handleBadgeVisibility(bgDiv, data.scheduled, delay);

    // Listen for cart updates from upsell buttons

    if (contentData.close_icon) {
      const closeIconDiv = document.createElement("button");
      closeIconDiv.setAttribute("futureblink-shipping-bar-close", "");
      closeIconDiv.style.position = "absolute";
      closeIconDiv.style.right = "10px";
      closeIconDiv.style.top = "50%";
      closeIconDiv.style.transform = "translateY(-50%)";

      closeIconDiv.id = `close_btn_${data.id}`;
      closeIconDiv.style.background = "transparent";
      closeIconDiv.style.outline = "none";
      closeIconDiv.style.border = "none";
      closeIconDiv.style.cursor = "pointer";

      const closeIconSvg = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      closeIconSvg.setAttribute("viewBox", "0 0 20 20");
      closeIconSvg.setAttribute("style", "width: 30px; height: 30px");
      closeIconSvg.setAttribute("focusable", "false");
      closeIconSvg.setAttribute("aria-hidden", "true");
      closeIconSvg.setAttribute("class", "Polaris-Icon__Svg");

      const closeIconPath = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      closeIconPath.setAttribute(
        "d",
        "M12.72 13.78a.75.75 0 1 0 1.06-1.06l-2.72-2.72 2.72-2.72a.75.75 0 0 0-1.06-1.06l-2.72 2.72-2.72-2.72a.75.75 0 0 0-1.06 1.06l2.72 2.72-2.72 2.72a.75.75 0 1 0 1.06 1.06l2.72-2.72 2.72 2.72Z",
      );
      closeIconPath.setAttribute("fill", designData.close_icon_color);

      closeIconSvg.appendChild(closeIconPath);
      closeIconDiv.appendChild(closeIconSvg);

      closeIconDiv.addEventListener("click", () => {
        if (bgDiv.parentNode) bgDiv.parentNode.removeChild(bgDiv);
        window.localStorage.setItem(`shipping_bar_${data.id}`, true);
      });

      bgDiv.appendChild(closeIconDiv);
    }


    if (data.placement_type === "custom") {
      const customContainer = document.querySelector(
        `div[futureblink-shipping-type="${data.type}"][id="${data.id}"]`,
      );
      if (customContainer) {
        if (!customContainer.querySelector('[futureblink-shipping-bar]')) {
          const clonedContainer = clonedShippingBars.length === 0 ? bgDiv : bgDiv.cloneNode(true);
          clonedShippingBars.push(clonedContainer);

          // Find the progress bar element in the cloned container
          const clonedProgressBarElement = clonedContainer.querySelector(
            "[futureblink-shipping-bar-progress]",
          );
          if (clonedProgressBarElement) {
            // Create a new progress bar instance for this clone
            const clonedProgressBar = await createProgressBar(finalValue, designData, goals.length, designData.goal_icons);
            // Replace the cloned element with the new instance
            clonedProgressBarElement.replaceWith(clonedProgressBar.element);
            clonedProgressBars.push(clonedProgressBar);
          }

          customContainer.appendChild(clonedContainer);

          // init close icon listener
          const closeIcon = clonedContainer.querySelector('[futureblink-shipping-bar-close]');
          if (closeIcon) {
            closeIcon.addEventListener("click", () => {
              if (clonedContainer.parentNode) clonedContainer.parentNode.removeChild(clonedContainer);
              window.localStorage.setItem(`shipping_bar_${data.id}`, true);
            });
          }
        }
      }
    } else {
      if (data.placement.pages_type === "custom") {
        const shippingBlocks = document.querySelectorAll(
          ".futureblink-shipping-bar-block",
        );
        shippingBlocks.forEach(async (block) => {
          if (block.id === data.id) {
            const clonedContainer = clonedShippingBars.length === 0 ? bgDiv : bgDiv.cloneNode(true);
            clonedShippingBars.push(clonedContainer);

            // Find the progress bar element in the cloned container
            const clonedProgressBarElement = clonedContainer.querySelector(
              "[futureblink-shipping-bar-progress]",
            );
            if (clonedProgressBarElement) {
              // Create a new progress bar instance for this clone
              const clonedProgressBar = await createProgressBar(finalValue, designData, goals.length, designData.goal_icons);
              // Replace the cloned element with the new instance
              clonedProgressBarElement.replaceWith(clonedProgressBar.element);
              clonedProgressBars.push(clonedProgressBar);
            }

            block.appendChild(clonedContainer);
          }
        });
      } else {
        document.body.prepend(bgDiv);
      }
    }

    const trackerConfig = {
      apiEndpoint: "/apps/shipping-bar/track",
      badgeId: data.id,
      debug: true,
      bar: bgDiv,
    };

    new HoppyFreeShippingTracker(trackerConfig);

    let exclusionMap = {};
    let inclusionMap = {};

    if (
      ["specific_collections", "include_specific_collections"].includes(contentData.exclude_type) &&
      cart.items.length > 0
    ) {
      let targetCollections = [];

      targetCollections = contentData.excluded_from_goals.map((collection) =>
        // Convert to full GID so it matches what the server compares against
        `gid://shopify/Collection/${collection?.id?.split("/")?.pop()}`
      );

      // Wrap as GIDs — Admin GraphQL nodes() requires gid://shopify/Product/{id}
      const cartProductIds = cart.items.map((item) => `gid://shopify/Product/${item.product_id}`);

      let results = [];

      if (targetCollections.length > 0) {
        const res = await fetch("/apps/shipping-bar/validate-collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetCollectionIds: targetCollections,
            cartProductIds: cartProductIds,
          }),
        });

        const data = await res.json();
        results = data.results;
      }

      calculateMethod = "original_line_price";

      if (contentData.progress_calculation === "after_discount") {
        calculateMethod = "discounted_price";
      }

      if (contentData.exclude_type === "specific_collections") {
        exclusionMap = Object.fromEntries(
          // Server returns full GIDs; cart items use bare numeric product_id — extract the number
          results.map((r) => [r.productId.split("/").pop(), r.inTargetCollection]),
        );
      } else if (contentData.exclude_type === "include_specific_collections") {
        inclusionMap = Object.fromEntries(
          results.map((r) => [r.productId.split("/").pop(), r.inTargetCollection]),
        );
      }
    }

    if (contentData.exclude_type === "specific_products") {
      exclusionMap = Object.fromEntries(
        contentData.excluded_from_goals.map((r) => [
          r.id.split("/")?.pop(),
          true,
        ]),
      );
    } else if (contentData.exclude_type === "include_specific_products") {
      inclusionMap = Object.fromEntries(
        contentData.excluded_from_goals.map((r) => [
          r.id.split("/")?.pop(),
          true,
        ]),
      );
    }

    totalPrice = cart.items.reduce((sum, item) => {
      if (['specific_collections', 'specific_products'].includes(contentData.exclude_type) && exclusionMap[item.product_id]) return sum;
      if (['include_specific_collections', 'include_specific_products'].includes(contentData.exclude_type) && !inclusionMap[item.product_id]) return sum;

      const baseValue = (item[calculateMethod] || 0) / 100;
      const multiplier =
        calculateMethod === "discounted_price" ? item.quantity : 1;

      return sum + baseValue * multiplier;
    }, 0);

    totalQuantity = cart.items.reduce((sum, item) => {
      if (['specific_collections', 'specific_products'].includes(contentData.exclude_type) && exclusionMap[item.product_id]) return sum;
      if (['include_specific_collections', 'include_specific_products'].includes(contentData.exclude_type) && !inclusionMap[item.product_id]) return sum;

      return sum + (contentData.unique_products ? 1 : item.quantity);
    }, 0);

    const value =
      contentData.goal_type === "product_quantity" ? totalQuantity : totalPrice;

    updateProgress(value, true);
  }

  /**
   * Calculate a past date based on value and unit
   * @param {number} value - The number of days/weeks/months
   * @param {string} unit - "days", "weeks", or "months"
   * @returns {Date} The calculated past date
   */
  function calculatePastDate(value, unit) {
    const now = new Date();
    const numValue = parseInt(value, 10);

    if (isNaN(numValue) || numValue < 0) return null;

    switch (unit) {
      case "days":
        now.setDate(now.getDate() - numValue);
        break;
      case "weeks":
        now.setDate(now.getDate() - (numValue * 7));
        break;
      case "months":
        now.setMonth(now.getMonth() - numValue);
        break;
      default:
        return null;
    }

    return now;
  }

  /**
   * Check if cart value is below the maximum threshold
   * @param {number} maxCartValue - Maximum cart value in cents
   * @param {object} cart - The cart object
   * @returns {boolean} True if cart value is below threshold
   */
  function checkCartValueBelow(maxCartValue, cart, progressCalculation) {
    if (!cart || typeof maxCartValue === "undefined" || maxCartValue === null) {
      return true; // If no cart or no limit, condition passes
    }

    let calculateMethod = "original_line_price";

    if (progressCalculation === "after_discount") {
      calculateMethod = "discounted_price";
    }
    const cartTotal = cart.items.reduce(
      (sum, item) =>
        sum +
        ((item[calculateMethod] || 0) / 100) *
        (calculateMethod === "discounted_price" ? item.quantity : 1),
      0,
    );
    const maxValue = parseFloat(maxCartValue);

    if (isNaN(maxValue)) return true;


    // Compare in same currency (both in cents)
    return cartTotal < maxValue;
  }

  /**
   * Check if last order was before a certain date
   * @param {string} lastOrderDateStr - ISO date string of last order
   * @param {number} value - Number of days/weeks/months
   * @param {string} unit - "days", "weeks", or "months"
   * @returns {boolean} True if last order was before the calculated date
   */
  function checkLastOrderBefore(lastOrderDateStr, value, unit) {
    if (!lastOrderDateStr) return true; // No orders = condition passes

    const lastOrderDate = new Date(lastOrderDateStr);
    const thresholdDate = calculatePastDate(value, unit);

    if (!thresholdDate || isNaN(lastOrderDate.getTime())) return true;

    return lastOrderDate < thresholdDate;
  }

  /**
   * Check if last order was after a certain date
   * @param {string} lastOrderDateStr - ISO date string of last order
   * @param {number} value - Number of days/weeks/months
   * @param {string} unit - "days", "weeks", or "months"
   * @returns {boolean} True if last order was after the calculated date
   */
  function checkLastOrderAfter(lastOrderDateStr, value, unit) {
    if (!lastOrderDateStr) return false; // No orders = condition fails

    const lastOrderDate = new Date(lastOrderDateStr);
    const thresholdDate = calculatePastDate(value, unit);


    if (!thresholdDate || isNaN(lastOrderDate.getTime())) return true;

    return lastOrderDate > thresholdDate;
  }

  /**
   * Check all enable conditions with AND logic
   * Follows the same pattern as the original code
   * @param {object} placement - The placement settings
   * @param {object} customer - The customer info
   * @param {object} cart - The cart object
   * @returns {boolean} True if all conditions pass (show the bar)
   */
  function checkEnableCondition(placement, customer, cart, progressCalculation) {
    // Get conditions array, default to ["always"] for backward compatibility
    const conditions = placement.enable_condition ||
      (placement.enable_condition ? [placement.enable_condition] : ["always"]);

    // If "always" is in conditions, show the bar
    if (conditions.includes("always")) {
      return true;
    }

    // Get customer data
    const totalOrders = customer?.totalOrders || 0;
    const lastOrderDate = customer?.lastOrderDate || null;

    // Check each condition with AND logic (all must pass)
    // Following the original code pattern:
    // - "orders" condition: show bar if totalOrders >= minOrders
    // - "first_time" condition: show bar if totalOrders === 0

    for (const condition of conditions) {
      switch (condition) {
        case "orders":
          const minOrders = parseInt(placement.total_orders, 10);
          if (!isNaN(minOrders) && totalOrders < minOrders) {
            // Customer hasn't reached minimum orders - don't show bar
            return false;
          }
          break;

        case "first_time":
          if (totalOrders !== 0) {
            // Not a first-time customer - don't show bar
            return false;
          }
          break;

        case "cart_value_below":
          // Cart value is below threshold - show bar
          if (!checkCartValueBelow(placement.max_cart_value, cart, progressCalculation)) {
            return false;
          }
          break;

        case "last_order_before":
          // Last order was before X days/weeks/months ago - show bar
          if (!checkLastOrderBefore(
            lastOrderDate,
            placement.last_order_before_value,
            placement.last_order_before_unit
          )) {
            return false;
          }
          break;

        case "last_order_after":
          // Last order was after X days/weeks/months ago - show bar
          if (!checkLastOrderAfter(
            lastOrderDate,
            placement.last_order_after_value,
            placement.last_order_after_unit
          )) {
            return false;
          }
          break;
      }
    }

    // All conditions passed - show the bar
    return true;
  }

  function customerConditionsCheck(data) {
    const customer = window.futureblink_free_shipping_customerInfo;

    const visibilitySetting = data.placement.visibility_by_login;

    if (visibilitySetting === "logged_in" && customer === null) {
      return false; // hide if customer must be logged in but isn't
    }

    if (customer === null) return true; // fallback: show bar if no customer info

    const tags = customer.tags;
    const spent = parseFloat(customer.lifetimeSpent / 100) || 0;
    const totalOrders = customer.totalOrders || 0;

    const {
      customer_display,
      specific_tag_for_display,
      specific_amt_for_display,
      customer_hide,
      specific_tag_for_hide,
      specific_amt_for_hide,
    } = data.placement;
    // --- 1. Check enable conditions (new multi-condition logic) ---
    if (!checkEnableCondition(data.placement, customer, cart, data.content.progress_calculation)) {
      return false;
    }

    // --- 2. Handle HIDE rules ---
    if (customer_hide === "specific_tag") {
      const specific_tags = specific_tag_for_hide
        .trim()
        .split(",")
        .map((tag) => tag.trim());
      if (specific_tags.some((tag) => tags.includes(tag))) {
        return false;
      }
    }

    if (customer_hide === "specific_amt") {
      const amt = parseFloat(specific_amt_for_hide);
      if (!isNaN(amt) && spent >= amt) {
        return false;
      }
    }

    // --- 4. Handle DISPLAY rules ---
    if (customer_display === "all") {
      return true;
    }

    if (customer_display === "specific_tag") {
      const specific_tags = specific_tag_for_display
        .trim()
        .split(",")
        .map((tag) => tag.trim());
      if (specific_tags.some((tag) => tags.includes(tag))) {
        return true;
      }
    }

    if (customer_display === "specific_amt") {
      const amt = parseFloat(specific_amt_for_display);
      if (!isNaN(amt) && spent >= amt) {
        return true;
      }
    }

    return false;
  }

  function productPagePlacement(
    pages,
    pageType,
    exclude_products,
    excluded_products,
  ) {
    const productId = window.futureblink_free_shipping_productDetails.id;
    const productTags = window.futureblink_free_shipping_productDetails.tags;
    const productCollections =
      window.futureblink_free_shipping_products.collections || [];

    if (exclude_products && exclude_products !== "none") {
      // Exclude specific products
      if (exclude_products === "specific_products") {
        const isExcluded = excluded_products.some(
          (product) => productId === product.id.split("/").pop(),
        );
        if (isExcluded) return false;
      }

      // Exclude products inside specific collections
      if (exclude_products === "specific_collections") {
        const isExcludedCollection = excluded_products.some((collection) => {
          const excludedCollectionId = Number(collection.id.split("/").pop());
          return productCollections.some(
            (productCollection) =>
              productCollection.id === excludedCollectionId,
          );
        });
        if (isExcludedCollection) return false;
      }
    }

    if (pageType === "all_product_in_specific_tags") {
      const showOnProduct = pages.find((tag) => {
        return productTags.includes(tag);
      });

      if (!showOnProduct) return false;
    }

    if (
      pageType === "all_products" &&
      !window.location.pathname.includes("/products")
    )
      return false;

    if (pageType === "specific_product") {
      let showOnProduct = pages.find((product) => {
        return productId === product.id.split("/").pop();
      });

      if (!showOnProduct) return false;
    }

    if (pageType === "all_product_in_specific_collection") {
      const showOnProduct = pages.find((collection) => {
        const collectionId = Number(collection.id.split("/").pop());
        return productCollections.some(
          (product) => product.id === collectionId,
        );
      });

      if (!showOnProduct) return false;
    }

    return true;
  }

  // function cartPagePlacement(pageType){
  //   if (pageType === "top_cart" && (!window.location.pathname.includes("/cart") && !window.location.pathname.includes("/products")) )return false;
  //   return true
  // }

  // async function fetchLocation() {
  //   const item = sessionStorage.getItem("country_code")
  //   if (item) return item
  //   try {
  //     const response = await fetch("/browsing_context_suggestions.json");
  //     if (!response.ok) throw Error("failed to fetch");
  //     const locationData = await response.json();
  //     sessionStorage.setItem("country_code", locationData.detected_values.country.handle)
  //     sessionStorage.setItem("country_name", locationData.detected_values.country_name)
  //     return locationData.detected_values.country.handle;
  //   } catch (error) {
  //   }
  // }

  function topBottomPlacement(
    pages,
    pageType,
    exclude_products,
    excluded_products,
  ) {
    const productId = window.futureblink_free_shipping_productDetails.id;
    const collectionId = window.futureblink_free_shipping_collection.id;
    const productCollections =
      window.futureblink_free_shipping_products.collections || [];

    if (exclude_products && exclude_products !== "none") {
      // Exclude specific products
      if (exclude_products === "specific_products") {
        const isExcluded = excluded_products.some(
          (product) => productId === product.id.split("/").pop(),
        );
        if (isExcluded) return false;
      }

      // Exclude products inside specific collections
      if (exclude_products === "specific_collections") {
        const isExcludedCollection = excluded_products.some((collection) => {
          const excludedCollectionId = Number(collection.id.split("/").pop());
          return productCollections.some(
            (productCollection) =>
              productCollection.id === excludedCollectionId,
          );
        });
        if (isExcludedCollection) return false;
      }
    }

    if (pageType === "home" && window.location.pathname !== "/") return false;
    if (
      pageType === "all_products" &&
      !window.location.pathname.includes("/products")
    )
      return false;
    if (
      pageType === "all_collection" &&
      !window.location.pathname.includes("/collections")
    )
      return false;

    if (pageType === "specific_product") {
      let showOnProduct = pages.find((product) => {
        return productId === product.id.split("/").pop();
      });

      if (!showOnProduct) return false;
    }

    if (pageType === "all_product_in_specific_collection") {
      const productCollections =
        window.futureblink_free_shipping_products.collections || [];
      const showOnProduct = pages.find((collection) => {
        const collectionId = Number(collection.id.split("/").pop());
        return productCollections.some(
          (product) => product.id === collectionId,
        );
      });

      if (!showOnProduct) return false;
    }
    if (pageType === "specific_collection") {
      let showOnCollection = pages.find((collection) => {
        return collectionId === collection.id.split("/").pop();
      });

      if (!showOnCollection) return false;
    }

    return true;
  }

  async function checkAllowedCountries(shippingData) {
    const countryCode = window.futureBlink_country;
    if (shippingData.placement.allowed_all_location) {
      return true;
    } else {
      return shippingData.placement.locations.some(
        (country) => country.code === countryCode,
      );
    }
  }

  function createCheckmarkSteps(progress, designData, steps = 4, goals) {
    const container = document.createElement("div");
    container.style.width = "100%";
    container.style.marginTop = `${designData.bar_space_above}px`;
    container.style.marginBottom = `${designData.bar_space_below}px`;
    container.style.position = "relative";

    const progressBarBg = document.createElement("div");
    progressBarBg.style.width = "100%";
    progressBarBg.style.height = `${designData.bar_height}px`;
    progressBarBg.style.backgroundColor = designData.progress_bar_bg_color;
    progressBarBg.style.borderRadius = `${designData.progress_bar_corner_radius}px`;
    progressBarBg.style.position = "relative";

    const progressBarFill = document.createElement("div");
    progressBarFill.classList.add("progress-bar-fill"); // Added class for reliable selection
    progressBarFill.style.width = `${progress}%`;
    progressBarFill.style.height = "100%";
    progressBarFill.style.backgroundColor = designData.progress_bar_color;
    progressBarFill.style.borderRadius = `${designData.progress_bar_corner_radius}px`;
    progressBarFill.style.transition = "width 0.5s ease";

    const hiddenElement = document.createElement("span");
    hiddenElement.style.display = "none";
    progressBarFill.appendChild(hiddenElement);

    progressBarBg.appendChild(progressBarFill);

    const stepSpacing = 100 / steps;

    for (let i = 0; i < steps; i++) {
      // For goals, we want them distributed as milestones. 
      // Goal 1 at 25% (if 4 goals), Goal 4 at 100%.
      const leftPercent = (i + 1) * stepSpacing;
      const isComplete = progress >= leftPercent;

      const step = document.createElement("div");
      step.classList.add("checkmark-step"); // Added class for reliable selection
      step.style.position = "absolute";
      step.style.top = "50%";
      step.style.left = `calc(${leftPercent}% - 12px)`;
      step.style.transform = `translateY(-50%)`;
      step.style.width = "24px";
      step.style.height = "24px";
      step.style.borderRadius = "50%";
      step.style.backgroundColor = isComplete ? "#000" : "#fff";
      step.style.border = `2px solid ${isComplete ? "#000" : "#ccc"}`;
      step.style.display = "flex";
      step.style.alignItems = "center";
      step.style.justifyContent = "center";
      step.style.transition = "all 0.3s ease";
      step.style.zIndex = 2;
      step.style.cursor = "pointer";

      // Checkmark Container
      const checkmarkContainer = document.createElement("div");
      checkmarkContainer.classList.add("checkmark-icon-container");
      checkmarkContainer.style.width = "14px";
      checkmarkContainer.style.height = "14px";
      checkmarkContainer.style.display = "flex";
      checkmarkContainer.style.alignItems = "center";
      checkmarkContainer.style.justifyContent = "center";

      if (isComplete) {
        checkmarkContainer.innerHTML = `
        <svg viewBox="0 0 20 20" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            fill="white"
            fill-rule="evenodd"
            d="M15.78 5.97a.75.75 0 0 1 0 1.06l-6.5 6.5a.75.75 0 0 1-1.06 0l-3.25-3.25a.75.75 0 1 1 1.06-1.06l2.72 2.72 5.97-5.97a.75.75 0 0 1 1.06 0Z"
          />
        </svg>
      `;
      }
      step.appendChild(checkmarkContainer);


      // Tooltip
      const tooltip = document.createElement("div");
      tooltip.textContent = goals?.[i]?.goal || "";
      tooltip.style.position = "absolute";
      tooltip.style.bottom = "150%"; // Position above
      tooltip.style.left = "50%";
      tooltip.style.transform = "translateX(-50%)";
      tooltip.style.backgroundColor = "#333";
      tooltip.style.color = "#fff";
      tooltip.style.padding = "4px 8px";
      tooltip.style.borderRadius = "4px";
      tooltip.style.fontSize = "12px";
      tooltip.style.whiteSpace = "nowrap";
      tooltip.style.zIndex = "20";
      tooltip.style.display = "none";
      tooltip.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";

      // Arrow for tooltip
      const arrow = document.createElement("div");
      arrow.style.position = "absolute";
      arrow.style.top = "100%";
      arrow.style.left = "50%";
      arrow.style.marginLeft = "-5px";
      arrow.style.borderWidth = "5px";
      arrow.style.borderStyle = "solid";
      arrow.style.borderColor = "#333 transparent transparent transparent";
      tooltip.appendChild(arrow);

      step.appendChild(tooltip);

      step.addEventListener("mouseenter", () => {
        tooltip.style.display = "block";
      });
      step.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
      });


      progressBarBg.appendChild(step);
    }

    container.appendChild(progressBarBg);
    return container;
  }

  function createCheckoutFlow(progress, designData) {
    const steps = ["Cart", "Shipping", "Review", "Payment"];
    const stepSpacing = 100 / (steps.length - 1);

    const container = document.createElement("div");
    container.style.width = "100%";
    container.style.marginTop = `${designData.bar_space_above}px`;
    container.style.marginBottom = `${designData.bar_space_below}px`;
    container.style.position = "relative";

    const progressBarBg = document.createElement("div");
    progressBarBg.style.width = "100%";
    progressBarBg.style.height = `${designData.bar_height}px`;
    progressBarBg.style.backgroundColor = designData.progress_bar_bg_color;
    progressBarBg.style.borderRadius = `${designData.progress_bar_corner_radius}px`;
    progressBarBg.style.position = "relative";

    const progressBarFill = document.createElement("div");
    progressBarFill.classList.add("checkout-progress-fill"); // ← Use class to select reliably later
    progressBarFill.style.width = `${progress}%`;
    progressBarFill.style.height = "100%";
    progressBarFill.style.backgroundColor = designData.progress_bar_color;
    progressBarFill.style.borderRadius = `${designData.progress_bar_corner_radius}px`;
    progressBarFill.style.transition = "width 0.5s ease";

    const hiddenElement = document.createElement("span");
    hiddenElement.style.display = "none";
    progressBarFill.appendChild(hiddenElement);

    progressBarBg.appendChild(progressBarFill);

    // Step Labels
    steps.forEach((label, index) => {
      const leftPercent = index * stepSpacing;
      const isComplete = progress >= leftPercent;

      const labelBox = document.createElement("div");
      labelBox.classList.add("checkout-step-label"); // ← Use class to select labels later
      labelBox.textContent = label;
      labelBox.style.position = "absolute";
      labelBox.style.top = "calc(100% + 10px)";
      labelBox.style.left = `calc(${leftPercent}% - 24px)`;
      labelBox.style.width = "48px";
      labelBox.style.textAlign = "center";
      labelBox.style.fontSize = "12px";
      labelBox.style.color = isComplete
        ? designData.progress_bar_color
        : "#555";
      labelBox.style.fontWeight = isComplete ? "600" : "400";

      progressBarBg.appendChild(labelBox);
    });

    container.appendChild(progressBarBg);
    return container;
  }

  function createNumberedSteps(progress, designData, steps = 4, goals) {
    const stepSpacing = 100 / steps;

    const container = document.createElement("div");
    container.style.width = "100%";
    container.style.marginTop = `${designData.bar_space_above}px`;
    container.style.marginBottom = `${designData.bar_space_below}px`;
    container.style.position = "relative";

    const progressBarBg = document.createElement("div");
    progressBarBg.style.width = "100%";
    progressBarBg.style.height = `${designData.bar_height}px`;
    progressBarBg.style.backgroundColor = designData.progress_bar_bg_color;
    progressBarBg.style.borderRadius = `${designData.progress_bar_corner_radius}px`;
    progressBarBg.style.position = "relative";

    const progressBarFill = document.createElement("div");
    progressBarFill.style.width = `${progress}%`;
    progressBarFill.style.height = "100%";
    progressBarFill.style.backgroundColor = designData.progress_bar_color;
    progressBarFill.style.borderRadius = `${designData.progress_bar_corner_radius}px`;
    progressBarFill.style.transition = "width 0.5s ease";
    progressBarFill.classList.add("progress-bar-fill");

    const hiddenElement = document.createElement("span");
    hiddenElement.style.display = "none";
    progressBarFill.appendChild(hiddenElement);

    progressBarBg.appendChild(progressBarFill);

    for (let i = 0; i < steps; i++) {
      const leftPercent = (i + 1) * stepSpacing;
      const isComplete = progress >= leftPercent;
      const stepNumber = i + 1;

      // Step Circle
      const stepCircle = document.createElement("div");
      stepCircle.textContent = stepNumber;
      stepCircle.style.position = "absolute";
      stepCircle.style.top = "50%";
      stepCircle.style.left = `calc(${leftPercent}% - 12px)`;
      stepCircle.style.transform = "translateY(-50%)";
      stepCircle.style.width = "24px";
      stepCircle.style.height = "24px";
      stepCircle.style.borderRadius = "50%";
      stepCircle.style.backgroundColor = isComplete
        ? designData.progress_bar_color
        : "#fff";
      stepCircle.style.border = `2px solid ${isComplete ? designData.progress_bar_color : "#ccc"}`;
      stepCircle.style.color = isComplete ? "#fff" : "#000";
      stepCircle.style.fontSize = "12px";
      stepCircle.style.fontWeight = "600";
      stepCircle.style.display = "flex";
      stepCircle.style.alignItems = "center";
      stepCircle.style.justifyContent = "center";
      stepCircle.style.transition = "all 0.3s ease";
      stepCircle.style.zIndex = 2;
      stepCircle.style.cursor = "pointer";

      // Tooltip
      const tooltip = document.createElement("div");
      tooltip.textContent = goals?.[i]?.goal || "";
      tooltip.style.position = "absolute";
      tooltip.style.bottom = "150%"; // Position above
      tooltip.style.left = "50%";
      tooltip.style.transform = "translateX(-50%)";
      tooltip.style.backgroundColor = "#333";
      tooltip.style.color = "#fff";
      tooltip.style.padding = "4px 8px";
      tooltip.style.borderRadius = "4px";
      tooltip.style.fontSize = "12px";
      tooltip.style.whiteSpace = "nowrap";
      tooltip.style.zIndex = "20";
      tooltip.style.display = "none";
      tooltip.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";

      // Arrow for tooltip
      const arrow = document.createElement("div");
      arrow.style.position = "absolute";
      arrow.style.top = "100%";
      arrow.style.left = "50%";
      arrow.style.marginLeft = "-5px";
      arrow.style.borderWidth = "5px";
      arrow.style.borderStyle = "solid";
      arrow.style.borderColor = "#333 transparent transparent transparent";
      tooltip.appendChild(arrow);

      stepCircle.appendChild(tooltip);

      stepCircle.addEventListener("mouseenter", () => {
        tooltip.style.display = "block";
      });
      stepCircle.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
      });


      progressBarBg.appendChild(stepCircle);
    }

    container.appendChild(progressBarBg);
    return container;
  }

  function createPercentageBar(progress, designData) {
    const container = document.createElement("div");
    container.style.width = "100%";
    container.style.marginTop = `${designData.bar_space_above}px`;
    container.style.marginBottom = `${designData.bar_space_below}px`;
    container.style.position = "relative";

    // Percentage text
    const percentageText = document.createElement("div");
    percentageText.textContent = `${progress.toFixed(2)}%`;
    percentageText.style.position = "absolute";
    percentageText.style.left = `${progress}%`;
    percentageText.style.top = "-20px";
    percentageText.style.whiteSpace = "nowrap";
    percentageText.style.transform = "translateX(-50%)";
    percentageText.style.color = "#000";
    percentageText.style.fontSize = "12px";
    percentageText.style.fontWeight = "500";

    // Progress bar background
    const progressBarBg = document.createElement("div");
    progressBarBg.style.width = "100%";
    progressBarBg.style.height = `${designData.bar_height}px`;
    progressBarBg.style.backgroundColor = designData.progress_bar_bg_color;
    progressBarBg.style.borderRadius = `${designData.progress_bar_corner_radius}px`;
    progressBarBg.style.position = "relative";

    // Progress bar fill
    const progressBarFill = document.createElement("div");
    progressBarFill.style.width = `${progress}%`;
    progressBarFill.style.height = "100%";
    progressBarFill.style.backgroundColor = designData.progress_bar_color;
    progressBarFill.style.borderRadius = `${designData.progress_bar_corner_radius}px`;
    progressBarFill.style.transition = "width 0.5s ease";

    const hiddenElement = document.createElement("span");
    hiddenElement.style.display = "none";
    progressBarFill.appendChild(hiddenElement);

    progressBarBg.appendChild(progressBarFill);
    container.appendChild(percentageText);
    container.appendChild(progressBarBg);

    return container;
  }

  function createStepLoaderBar(progress, designData) {
    const totalSegments = 7;
    const filledSegments = Math.round((progress / 100) * totalSegments);

    const container = document.createElement("div");

    container.style.width = "100%";
    container.style.display = "flex";
    container.style.marginTop = `${designData.bar_space_above}px`;
    container.style.marginBottom = `${designData.bar_space_below}px`;
    container.style.gap = "4px";

    for (let i = 0; i < totalSegments; i++) {
      const segment = document.createElement("div");
      segment.style.flex = "1";
      segment.style.height = `${designData.bar_height}px`;
      segment.style.backgroundColor =
        i < filledSegments
          ? designData.progress_bar_color
          : designData.progress_bar_bg_color;
      segment.style.borderRadius = `${designData.progress_bar_corner_radius}px`;
      segment.style.transition = "background-color 0.3s ease";
      segment.style.position = "relative";

      // Dot inside the segment
      const dot = document.createElement("div");
      dot.className = "segment-dot";
      dot.style.width = "6px";
      dot.style.height = "6px";
      dot.style.borderRadius = "50%";
      dot.style.backgroundColor = "#fff";
      dot.style.position = "absolute";
      dot.style.top = "50%";
      dot.style.left = "50%";
      dot.style.transform = "translate(-50%, -50%)";
      dot.style.opacity = i < filledSegments ? "1" : "0"; // Hide if not filled

      segment.appendChild(dot);
      container.appendChild(segment);
    }

    return container;
  }

  function createTooltipTracker(progress, designData) {
    const container = document.createElement("div");
    container.style.width = "100%";
    container.style.marginTop = `${designData.bar_space_above}px`;
    container.style.marginBottom = `${designData.bar_space_below}px`;
    container.style.position = "relative";

    const progressBarBg = document.createElement("div");
    progressBarBg.style.width = "100%";
    progressBarBg.style.height = `${designData.bar_height}px`;
    progressBarBg.style.backgroundColor = designData.progress_bar_bg_color;
    progressBarBg.style.borderRadius = `${designData.progress_bar_corner_radius}px`;
    progressBarBg.style.position = "relative";

    const progressFill = document.createElement("div");
    progressFill.style.height = `${designData.bar_height}px`;
    progressFill.style.backgroundColor = designData.progress_bar_color;
    progressFill.style.borderRadius = `${designData.progress_bar_corner_radius}px`;
    progressFill.style.transition = "width 0.5s ease";
    progressFill.style.position = "relative";
    progressFill.style.width = `${progress}%`;
    progressFill.style.overflow = "visible";

    // HoppyFreeShippingTracker circle
    const tracker = document.createElement("div");
    tracker.style.position = "absolute";
    tracker.style.top = "50%";
    tracker.style.right = "0";
    tracker.style.transform = "translate(50%, -50%)";
    tracker.style.width = `${designData.bar_height + 8}px`;
    tracker.style.height = `${designData.bar_height + 8}px`;
    tracker.style.backgroundColor = designData.progress_bar_color;
    tracker.style.borderRadius = "50%";
    tracker.style.border = "2px solid white";
    tracker.style.cursor = "pointer";

    // Tooltip
    const tooltip = document.createElement("div");
    tooltip.textContent = `${progress.toFixed(2)}%`;
    tooltip.style.position = "absolute";
    tooltip.style.bottom = "125%";
    tooltip.style.left = "50%";
    tooltip.style.transform = "translateX(-50%)";
    tooltip.style.backgroundColor = "#000";
    tooltip.style.color = "#fff";
    tooltip.style.padding = "4px 8px";
    tooltip.style.borderRadius = "4px";
    tooltip.style.fontSize = "12px";
    tooltip.style.whiteSpace = "nowrap";
    tooltip.style.textAlign = "center";
    tooltip.style.zIndex = "10";
    tooltip.style.display = "none";

    // Tooltip arrow
    const arrow = document.createElement("div");
    arrow.style.position = "absolute";
    arrow.style.top = "100%";
    arrow.style.left = "50%";
    arrow.style.transform = "translateX(-50%)";
    arrow.style.width = "0";
    arrow.style.height = "0";
    arrow.style.borderLeft = "6px solid transparent";
    arrow.style.borderRight = "6px solid transparent";
    arrow.style.borderTop = "6px solid #000";

    tooltip.appendChild(arrow);
    tracker.appendChild(tooltip);

    tracker.addEventListener("mouseenter", () => {
      tooltip.style.display = "block";
    });

    tracker.addEventListener("mouseleave", () => {
      tooltip.style.display = "none";
    });

    progressFill.appendChild(tracker);
    progressBarBg.appendChild(progressFill);
    container.appendChild(progressBarBg);

    // Attach references for update logic
    container._progressFill = progressFill;
    container._tooltip = tooltip;

    return container;
  }

  function createBasicBar(progress, designData) {
    const progressBarContainer = document.createElement("div");
    progressBarContainer.style.marginTop = `${designData.bar_space_above}px`;
    progressBarContainer.style.marginBottom = `${designData.bar_space_below}px`;
    progressBarContainer.style.width = "100%";

    const progressBarBackground = document.createElement("div");
    progressBarBackground.style.width = "100%";
    progressBarBackground.style.height = `${designData.bar_height}px`;
    progressBarBackground.style.backgroundColor =
      designData.progress_bar_bg_color;
    progressBarBackground.style.borderRadius = `${designData.progress_bar_corner_radius}px`;
    progressBarBackground.style.position = "relative";

    const progressBarForeground = document.createElement("div");
    progressBarForeground.classList.add("basic-bar-fill"); // ✅ Add class for reliable query
    progressBarForeground.style.width = `${progress}%`;
    progressBarForeground.style.height = "100%";
    progressBarForeground.style.backgroundColor = designData.progress_bar_color;
    progressBarForeground.style.transition = "width 0.5s ease";
    progressBarForeground.style.borderRadius = `${designData.progress_bar_corner_radius}px`;

    const hiddenElement = document.createElement("span");
    hiddenElement.style.display = "none";
    progressBarForeground.appendChild(hiddenElement);

    progressBarBackground.appendChild(progressBarForeground);
    progressBarContainer.appendChild(progressBarBackground);
    return progressBarContainer;
  }



  async function createIconSteps(progress, designData, steps = 4, icons = [], goals) {
    const stepSpacing = 100 / steps;
    const container = document.createElement("div");
    container.style.width = "100%";
    container.style.marginTop = `${designData.bar_space_above}px`;
    container.style.marginBottom = `${designData.bar_space_below}px`;
    container.style.position = "relative";

    const progressBarBg = document.createElement("div");
    progressBarBg.style.width = "100%";
    progressBarBg.style.height = `${designData.bar_height}px`;
    progressBarBg.style.backgroundColor = designData.progress_bar_bg_color;
    progressBarBg.style.borderRadius = `${designData.progress_bar_corner_radius}px`;
    progressBarBg.style.position = "relative";

    const progressBarFill = document.createElement("div");
    progressBarFill.style.width = `${progress}%`;
    progressBarFill.style.height = "100%";
    progressBarFill.style.backgroundColor = designData.progress_bar_color;
    progressBarFill.style.borderRadius = `${designData.progress_bar_corner_radius}px`;
    progressBarFill.style.transition = "width 0.5s ease";
    progressBarFill.classList.add("progress-bar-fill");

    const hiddenElement = document.createElement("span");
    hiddenElement.style.display = "none";
    progressBarFill.appendChild(hiddenElement);

    progressBarBg.appendChild(progressBarFill);

    for (let i = 0; i < steps; i++) {
      const leftPercent = (i + 1) * stepSpacing;
      const isComplete = progress >= leftPercent;

      const iconData = icons[i] || {};
      const hasIcon = iconData.icon && iconData.iconSource;

      const stepContainer = document.createElement("div");
      stepContainer.classList.add("icon-step");
      stepContainer.style.position = "absolute";
      stepContainer.style.top = "50%";
      stepContainer.style.left = `calc(${leftPercent}% - 12px)`;
      stepContainer.style.transform = "translateY(-50%)";
      stepContainer.style.width = "33px";
      stepContainer.style.height = "33px";
      stepContainer.style.borderRadius = "50%";
      stepContainer.style.backgroundColor = isComplete
        ? designData.progress_bar_color
        : designData.progress_bar_bg_color;
      stepContainer.style.border = `2px solid ${isComplete ? designData.progress_bar_color : "#ccc"}`;
      stepContainer.style.display = "flex";
      stepContainer.style.alignItems = "center";
      stepContainer.style.justifyContent = "center";
      stepContainer.style.transition = "all 0.3s ease";
      stepContainer.style.zIndex = 2;
      stepContainer.style.overflow = "visible"; // Allow tooltip to show
      stepContainer.style.cursor = "pointer";

      // Inner Icon Div (masked)
      const iconStyle = await getGoalIconStyle(designData, iconData);
      // We'll wrap the icon style in a div to preserve its own structure
      const iconWrapper = document.createElement('div');
      iconWrapper.style.width = '100%';
      iconWrapper.style.height = '100%';
      iconWrapper.style.overflow = 'hidden';
      iconWrapper.style.borderRadius = '50%';
      iconWrapper.innerHTML = iconStyle;
      stepContainer.appendChild(iconWrapper);

      // Tooltip
      const tooltip = document.createElement("div");
      tooltip.textContent = goals?.[i]?.goal || "";
      tooltip.style.position = "absolute";
      tooltip.style.bottom = "150%"; // Position above
      tooltip.style.left = "50%";
      tooltip.style.transform = "translateX(-50%)";
      tooltip.style.backgroundColor = "#333";
      tooltip.style.color = "#fff";
      tooltip.style.padding = "4px 8px";
      tooltip.style.borderRadius = "4px";
      tooltip.style.fontSize = "12px";
      tooltip.style.whiteSpace = "nowrap";
      tooltip.style.zIndex = "20";
      tooltip.style.display = "none";
      tooltip.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";

      // Arrow for tooltip
      const arrow = document.createElement("div");
      arrow.style.position = "absolute";
      arrow.style.top = "100%";
      arrow.style.left = "50%";
      arrow.style.marginLeft = "-5px";
      arrow.style.borderWidth = "5px";
      arrow.style.borderStyle = "solid";
      arrow.style.borderColor = "#333 transparent transparent transparent";
      tooltip.appendChild(arrow);

      stepContainer.appendChild(tooltip);

      stepContainer.addEventListener("mouseenter", () => {
        tooltip.style.display = "block";
      });
      stepContainer.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
      });

      progressBarBg.appendChild(stepContainer);
    }

    container.appendChild(progressBarBg);
    return container;
  }



  async function createProgressBar(progress, designData, steps, icons, goals) {
    switch (designData.bar_type) {
      case "basic_bar": {
        const container = createBasicBar(progress, designData);
        const fill = container.querySelector(".basic-bar-fill"); // ✅ Safer selector
        return {
          element: container,
          update: (newProgress) => {
            fill.style.width = `${newProgress}%`;
          },
        };
      }

      case "step_loader": {
        const container = createStepLoaderBar(progress, designData);
        const segments = [...container.children];
        return {
          element: container,
          update: (newProgress) => {
            const total = segments.length;
            const filled = Math.round((newProgress / 100) * total);
            segments.forEach((segment, index) => {
              segment.style.backgroundColor =
                index < filled
                  ? designData.progress_bar_color
                  : designData.progress_bar_bg_color;
            });
          },
        };
      }

      case "tooltip_tracker": {
        const container = createTooltipTracker(progress, designData);

        return {
          element: container,
          update: (newProgress) => {
            container._progressFill.style.width = `${newProgress}%`;
            container._tooltip.textContent = `${newProgress.toFixed(2)}%`;
          },
        };
      }

      case "percentage_bar": {
        const container = createPercentageBar(progress, designData);
        const text = container.querySelector("div");
        const fill = container.querySelector("div:nth-child(2) > div");
        return {
          element: container,
          update: (newProgress) => {
            fill.style.width = `${newProgress}%`;
            text.textContent = `${newProgress.toFixed(2)}%`;
            text.style.left = `${newProgress}%`;
          },
        };
      }

      case "numbered_steps": {
        const container = createNumberedSteps(progress, designData, steps, goals);
        const stepsEls = container.querySelectorAll(
          'div[style*="position: absolute"][style*="50%"]',
        );
        return {
          element: container,
          update: (newProgress) => {
            const stepSpacing = 100 / stepsEls.length;
            stepsEls.forEach((el, i) => {
              const isComplete = newProgress >= (i + 1) * stepSpacing;
              el.style.backgroundColor = isComplete
                ? designData.progress_bar_color
                : designData.progress_bar_bg_color;
              el.style.borderColor = isComplete
                ? designData.progress_bar_color
                : "#ccc";
              el.style.color = isComplete ? "#fff" : "#000";
            });

            const fill = container.querySelector(".progress-bar-fill"); // Use reliable class
            if (fill) fill.style.width = `${newProgress}%`;
          },
        };
      }

      case "checkmark_steps": {
        const container = createCheckmarkSteps(progress, designData, steps, goals);
        const stepsEls = container.querySelectorAll(".checkmark-step"); // Select by class now
        return {
          element: container,
          update: (newProgress) => {
            const stepSpacing = 100 / stepsEls.length;
            stepsEls.forEach((el, i) => {
              const isComplete = newProgress >= (i + 1) * stepSpacing;
              el.style.backgroundColor = isComplete
                ? designData.progress_bar_color
                : designData.progress_bar_bg_color;
              el.style.borderColor = isComplete ? "#000" : "#ccc";

              const checkmarkContainer = el.querySelector(".checkmark-icon-container");
              if (checkmarkContainer) {
                checkmarkContainer.innerHTML = isComplete
                  ? `<svg viewBox="0 0 20 20" width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg">
                       <path fill="white" fill-rule="evenodd" d="M15.78 5.97a.75.75 0 0 1 0 1.06l-6.5 6.5a.75.75 0 0 1-1.06 0l-3.25-3.25a.75.75 0 1 1 1.06-1.06l2.72 2.72 5.97-5.97a.75.75 0 0 1 1.06 0Z"/>
                     </svg>`
                  : "";
              }
            });

            const fill = container.querySelector(".progress-bar-fill"); // Reliable selector for fill bar
            fill.style.width = `${newProgress}%`;
          },
        };
      }

      case "checkout_flow": {
        const container = createCheckoutFlow(progress, designData);
        const fill = container.querySelector(".checkout-progress-fill"); // Reliable selector
        const labels = container.querySelectorAll(".checkout-step-label"); // Reliable selector

        return {
          element: container,
          update: (newProgress) => {
            const stepSpacing = 100 / (labels.length - 1);
            labels.forEach((label, i) => {
              const isComplete = newProgress >= i * stepSpacing;
              label.style.color = isComplete
                ? designData.progress_bar_color
                : "#555";
              label.style.fontWeight = isComplete ? "600" : "400";
            });
            fill.style.width = `${newProgress}%`;
          },
        };
      }

      case "icon_steps": {
        const container = await createIconSteps(progress, designData, steps, icons, goals);
        const stepsEls = container.querySelectorAll(".icon-step");
        return {
          element: container,
          update: (newProgress) => {
            const stepSpacing = 100 / stepsEls.length;
            stepsEls.forEach((el, i) => {
              const isComplete = newProgress >= (i + 1) * stepSpacing;
              el.style.backgroundColor = isComplete
                ? designData.progress_bar_color
                : designData.progress_bar_bg_color;
              el.style.borderColor = `2px solid ${isComplete ? designData.progress_bar_color : "#ccc"}`;

              // Update icon color/content if needed
              const iconWrapper = el.querySelector('div'); // The wrapper div
              if (iconWrapper && iconWrapper.firstElementChild) {
                const iconElement = iconWrapper.firstElementChild;
                // Only update color if it's a mask (not an uploaded image)
                // Uploaded images use background-image, masks use mask-image
                const isMask = iconElement.style.maskImage || iconElement.style.webkitMaskImage;
                if (isMask) {
                  iconElement.style.backgroundColor = isComplete ? "#fff" : (designData.progress_bar_color || "#000");
                }
              }

              const textInner = el.querySelector('span'); // The number fallback
              if (textInner) {
                textInner.style.color = isComplete ? "#fff" : "#000";
              }
            });

            const fill = container.querySelector(".progress-bar-fill");
            if (fill) fill.style.width = `${newProgress}%`;
          }
        };
      }

      default:
        return null;
    }
  }

  //  function observeXHR() {
  //     if (['Atlantic', 'Boost', 'Yuva', 'Infinity',"Empire"].includes(window.Shopify.theme.schema_name)) return true
  //     if (['Editions'].includes(window.Shopify.theme.schema_name) && window.location.pathname.includes("/cart")) return true
  //     return false
  //   }
  const originalFetch = window.fetch;

  // Tracks the last cart items signature so validate-collections only fires on actual cart changes
  let _lastCartItemsSignature = null;
  // Persists validate-collections results across interval ticks; cleared only on cart change
  let _cachedFetchedBarIds = [];

  let _processGiftQueueRunning = false;

  async function processGiftQueue() {
    // Skip this tick if a previous run is still awaiting an async operation (e.g. validate-collections)
    // Without this, overlapping ticks can call updateProgress with an empty exclusionMap
    // causing the excluded product to briefly flash as included.
    if (_processGiftQueueRunning) return;
    _processGiftQueueRunning = true;
    // use global cart if available, otherwise fallback to local cart

    if (window._hoppy_requirements.cart) {
      cart = window._hoppy_requirements.cart;
    }

    if (window._hoppy_requirements.giftsToAdd) {
      giftsToAdd = window._hoppy_requirements.giftsToAdd;
    }

    try {
      // Get current snapshot of queues
      const toAdd = [...giftsToAdd];

      // Clear queues immediately to prevent duplicates
      giftsToAdd = [];
      window._hoppy_requirements.giftsToAdd = [];

      // Process additions using the same logic as addToCartWithLoader
      if (toAdd.length > 0) {
        for (const addRequest of toAdd) {
          // ---- Detect theme form ----
          let form = document.querySelector(
            'form[data-type="add-to-cart-form"]',
          );
          const productForm = document.querySelector("product-form");
          if (!form && productForm) {
            form = productForm.querySelector("form");
          }

          // Get variant ID from first item
          const variantId = addRequest.items[0].id;
          const properties = addRequest.items[0].properties || {};

          // ----------------------------------------------------
          // 1) THEME PRODUCT FORM SUBMIT (uses real theme form)
          // ----------------------------------------------------
          if (form) {
            // Save original values
            const variantInput = form.querySelector('input[name="id"]');
            const productInput = form.querySelector('input[name="product-id"]');
            const originalVariantValue = variantInput?.value;
            const originalProductValue = productInput?.value;

            if (productInput) productInput.value = variantId;
            if (variantInput) variantInput.value = variantId;

            // ---- Add custom properties ----
            const propertyInputs = [];
            for (const [key, value] of Object.entries(properties)) {
              const propertyInput = document.createElement("input");
              propertyInput.type = "hidden";
              propertyInput.name = `properties[${key}]`;
              propertyInput.value = value;
              form.appendChild(propertyInput);
              propertyInputs.push(propertyInput);
            }

            // Submit event
            const event = new SubmitEvent("submit", {
              bubbles: true,
              cancelable: true,
              submitter: form.querySelector('[type="submit"]') || null,
            });

            form.dispatchEvent(event);

            // Cleanup
            propertyInputs.forEach((input) => input.remove());
            if (productInput) productInput.value = originalProductValue;
            if (variantInput) variantInput.value = originalVariantValue;

            continue; // Skip to next iteration
          }

          // ----------------------------------------------------
          // 2) REFORMATION THEME AJAX ADD
          // ----------------------------------------------------
          if (window.Shopify?.theme?.schema_name === "Reformation") {
            const sectionsToRender = [
              { id: "Cart", section: "main-cart", selector: ".thb-cart-form" },
              {
                id: "Cart-Drawer",
                section: "cart-drawer",
                selector: ".cart-drawer",
              },
              {
                id: "cart-drawer-toggle",
                section: "cart-bubble",
                selector: ".thb-item-count",
              },
            ];

            const formData = new FormData();
            formData.append("id", variantId);
            formData.append("quantity", addRequest.items[0].quantity || 1);

            // ---- ADD CUSTOM PROPERTIES ----
            for (const [key, value] of Object.entries(properties)) {
              formData.append(`properties[${key}]`, value);
            }

            formData.append(
              "sections",
              sectionsToRender.map((s) => s.section),
            );
            formData.append("sections_url", window.location.pathname);

            const res = await originalFetch(theme.routes.cart_add_url, {
              method: "POST",
              headers: {
                "X-Requested-With": "XMLHttpRequest",
                Accept: "application/javascript",
              },
              body: formData,
            });

            const data = await res.json();

            // Update sections
            sectionsToRender.forEach((section) => {
              const element =
                document
                  .getElementById(section.id)
                  ?.querySelector(section.selector) ||
                document.getElementById(section.id);

              if (element && data.sections && data.sections[section.section]) {
                element.innerHTML = new DOMParser()
                  .parseFromString(data.sections[section.section], "text/html")
                  .querySelector(section.selector).innerHTML;
              }
            });

            document.dispatchEvent(
              new CustomEvent("cart:item-added", {
                detail: { product: data.items ? data.items[0] : data },
              }),
            );

            continue; // Skip to next iteration
          }

          // ----------------------------------------------------
          // 3) FALLBACK AJAX /cart/add.js METHOD
          // ----------------------------------------------------
          const res = await originalFetch("/cart/add.js", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              id: parseInt(variantId, 10),
              quantity: addRequest.items[0].quantity || 1,
              properties: properties,
            }),
          });

          if (!res.ok) throw new Error("Failed to add gift product to cart");

          await res.json();
        }
      }

      // ALWAYS refresh cart and update progress (even if no gifts changed)
      if (toAdd.length > 0) {
        const response = await originalFetch("/cart.js");
        const freshCart = await response.json();

        // Fix gift prices
        freshCart.items = freshCart.items.map((item) => {
          if (item.properties?._isFreeGift === "true") {
            item.original_line_price = Math.max(
              0,
              (item.original_line_price || 0) - (item.original_price || 0),
            );
          }
          return item;
        });

        cart = freshCart;
      }

      // Compute a lightweight signature of current cart items to detect changes
      const currentCartSignature = JSON.stringify(
        (cart.items || []).map((item) => ({
          id: item.id,
          product_id: item.product_id,
          quantity: item.quantity,
        })).sort((a, b) => a.id - b.id)
      );
      const cartItemsChanged = currentCartSignature !== _lastCartItemsSignature;
      if (cartItemsChanged) {
        _lastCartItemsSignature = currentCartSignature;
        // Cart changed — clear cached exclusion results so they are re-fetched
        _cachedFetchedBarIds = [];
      }

      // ALWAYS update progress bars after ANY cart operation
      // Use the persistent cache so exclusion results survive across ticks
      const fetchedBarIds = _cachedFetchedBarIds;

      for (const bar of bars) {
        const { contentData, updateProgress, addRecommendedProducts, placementData, box } = bar;
        let targetCollections = [];
        if (["specific_collections", "include_specific_collections"].includes(contentData.exclude_type)) {
          targetCollections = contentData.excluded_from_goals.map((collection) =>
            // Convert to full GID so the server-side excludedSet comparison works
            `gid://shopify/Collection/${collection?.id?.split("/")?.pop()}`
          );
        }

        // Wrap as GIDs — Shopify Admin GraphQL nodes() requires gid://shopify/Product/{id}
        const cartProductIds = cart.items.map((item) => `gid://shopify/Product/${item.product_id}`);
        const existing = fetchedBarIds.find((b) => b.id === bar.id);
        let results = existing ? existing.results : [];

        // Only call validate-collections when cart items actually changed
        if (cartItemsChanged && targetCollections.length > 0 && !existing) {
          const res = await originalFetch(
            "/apps/shipping-bar/validate-collections",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                targetCollectionIds: targetCollections,
                cartProductIds: cartProductIds,
              }),
            },
          );

          const data = await res.json();
          results = data.results;
          fetchedBarIds.push({ id: bar.id, results: results });
        }

        const { progress_calculation } = contentData;
        let calculateMethod = "original_line_price";

        if (progress_calculation === "after_discount") {
          calculateMethod = "discounted_price";
        }

        let exclusionMap = {};
        let inclusionMap = {};

        if (contentData.exclude_type === "specific_collections") {
          exclusionMap = Object.fromEntries(
            // Server returns full GIDs; cart items use bare numeric product_id — extract the number
            results.map((r) => [r.productId.split("/").pop(), r.inTargetCollection]),
          );
        } else if (contentData.exclude_type === "include_specific_collections") {
          inclusionMap = Object.fromEntries(
            results.map((r) => [r.productId.split("/").pop(), r.inTargetCollection]),
          );
        }

        if (contentData.exclude_type === "specific_products") {
          exclusionMap = Object.fromEntries(
            contentData.excluded_from_goals.map((r) => [
              r.id.split("/")?.pop(),
              true,
            ]),
          );
        } else if (contentData.exclude_type === "include_specific_products") {
          inclusionMap = Object.fromEntries(
            contentData.excluded_from_goals.map((r) => [
              r.id.split("/")?.pop(),
              true,
            ]),
          );
        }

        // Calculate totals - FREE GIFTS COUNT AS 0
        const totalPrice = cart.items.reduce((sum, item) => {
          // Skip excluded products
          if (['specific_collections', 'specific_products'].includes(contentData.exclude_type) && exclusionMap[item.product_id]) return sum;
          if (['include_specific_collections', 'include_specific_products'].includes(contentData.exclude_type) && !inclusionMap[item.product_id]) return sum;

          // Skip free gift items - they should not count toward goal
          if (item.properties?._isFreeGift === "true") return sum;

          const baseValue = (item[calculateMethod] || 0) / 100;
          const multiplier =
            calculateMethod === "discounted_price" ? item.quantity : 1;
          return sum + baseValue * multiplier;
        }, 0);

        const totalQuantity = cart.items.reduce((sum, item) => {
          // Skip excluded products
          if (['specific_collections', 'specific_products'].includes(contentData.exclude_type) && exclusionMap[item.product_id]) return sum;
          if (['include_specific_collections', 'include_specific_products'].includes(contentData.exclude_type) && !inclusionMap[item.product_id]) return sum;

          // Skip free gift items - they should not count toward goal
          if (item.properties?._isFreeGift === "true") return sum;

          return sum + (contentData.unique_products ? 1 : item.quantity);
        }, 0);

        const value =
          contentData.goal_type === "product_quantity"
            ? totalQuantity
            : totalPrice;
        updateProgress(value);

        // Add recommended products after cart update (only if gifts were added)
        if (typeof addRecommendedProducts === "function") {
          await addRecommendedProducts();
        }
        if (placementData.enable_condition.includes("cart_value_below")) {
          if (!checkCartValueBelow(placementData.max_cart_value, cart, contentData.progressCalculation)) {
            box.style.display = 'none';
          }
          else if (box._delayElapsed) {
            box.style.display = "block";
          }
        }
      }
    } catch (error) {
      console.error("Gift processing failed:", error);
    } finally {
      _processGiftQueueRunning = false;
    }
  }

  // Start the interval - checks every 500ms
  setInterval(processGiftQueue, 500);

  // Ensure global state exists
  window._hoppy_requirements = window._hoppy_requirements || {};
  const h = window._hoppy_requirements;

  // Variables required for FREE SHIPPING ONLY
  h.cart = h.cart || cart; // cart object
  h.bars = h.bars || bars; // free-shipping bars config
  h.giftsToAdd = h.giftsToAdd || giftsToAdd; // queue for free-shipping gifts

  const defaultCustomCss = `
.futureblink-free-shipping { 

}

.futureblink-free-shipping .futureblink-message {

}

.futureblink-free-shipping .futureblink-icon {

}

.futureblink-free-shipping .futureblink-cta-button {

}

.futureblink-free-shipping .futureblink-price-text {

}
`;

  function normalizeUpsellEnabled(obj = {}) {
    return {
      ...obj,
      upsell_enabled:
        typeof obj.upsell_enabled === "boolean" ? obj.upsell_enabled : true,
    };
  }


  function convertOldToNewFormat(state) {
    const {
      content = {},
      design = {},
      placement = {},
      upsell = {},
      scheduled = {},
      translations = [],
      ...rest
    } = state;



    const mergedGoals =
      content.goals?.length > 0
        ? content.goals.map((goal) => ({
          ...goal,
          reward_type: goal.reward_type ?? "free_shipping",
          reward_value: goal.reward_value ?? "",
        }))
        : [
          {
            goal: content.goal ?? 50,
            progress_message:
              content.progress_message ??
              "You’re only {order-value-progress} away from free shipping!",
            reward_type: "free_shipping",
            reward_value: "",
          },
        ];

    return {
      ...rest,
      translations: normalizeTranslations(translations, mergedGoals.length),
      discountId: rest.discountId ?? null,
      scheduled: scheduled ?? {
        start: null,
        end: null,
      },
      upsell: {
        upsell_type: "no_upsell",
        recommendation_type: "related",
        auto_slide: true,
        slide_interval: 5,
        max_products: 3,
        cta_text_before: "Add to Cart",
        cta_text_after: "Add Another",
        upsell_title: "",
        cta_type: "add_to_cart",
        upsell_prod: [],
        ...upsell,
      },
      placement: {
        customer_display: "all",
        visibility_by_login: "all",
        specific_tag_for_display: "",
        specific_amt_for_display: "",
        customer_hide: "none",
        specific_tag_for_hide: "",
        specific_amt_for_hide: "",
        excluded_products: [],
        pages_type: "all_products",
        pages: [],
        allowed_all_location: true,
        delay: 0,
        locations: [],
        ...normalizeEnableCondition(placement || {}),
        exclude_products: normalizeExcludeProducts(placement?.exclude_products),
      },
      design: {
        ...{
          goal_icons: [],
          multiple_goals_marker: "one",
          background: "single",
          background_pattern: "none",
          price_text_size: 16,
          price_text_color: "#000000",
          price_text_animation: "none",
          show_progress_bar: true,
          bar_type: "basic_bar",
          bar_width: 90,
          font_weight: "inherit",
          button_color: "#000000",
          button_text_size: 16,
          button_text_color: "#FFFFFF",
          button_corner_radius: 10,
          button_style: "round",
          button_font_weight: "bold",
          button_font_style: "normal",
          button_animation: "none",
          button_hover: "none",
          shipping_bar_width: 100,
          count_up_speed: 1,
          neon_animation_color: "#9d4edd",
          bar_height: 8,
          bar_space_above: 10,
          bar_space_below: 20,
          custom_css:
            typeof defaultCustomCss !== "undefined" ? defaultCustomCss : "",
          custom_css_applied: false,
          fireworks: "none",
          icon: "",
          iconSource: "",
          icon_size: 32,
          icon_color: "#000000",
          icon_position: "before",
          upsell_title_size: 14,
          upsell_title_color: "#000000",
          upsell_price_color: "#000000",
          upsell_price_size: 14,
          upsell_arrow_size: 20,
          upsell_arrow_color: "#000000",
          upsell_button_color: "#000000",
          upsell_button_text_size: 14,
          upsell_button_text_color: "#FFFFFF",
          upsell_button_corner_radius: 10,
          upsell_button_style: "round",
          upsell_button_font_weight: "bold",
          upsell_button_font_style: "normal",
          upsell_section_title_size: 14,
          upsell_section_title_color: "#000000",
          ...design,
          position: state.type === "top_bottom_page"
            ? normalizePosition(design?.position, design?.sticky)
            : design?.position,
        },
        ...design,
      },
      content: {
        ...{
          exclude_type: "none",
          money_format: "store_default",
          excluded_from_goals: [],
          unique_products: false,
          discount_combination: false,
          close_icon: false,
          cta: "none",
          show_currency_symbol: false,
          currency_symbol_position: "before",
          button_text: "Shop Now",
          cta_link: "https://www.shopify.com",
          goal_type: "cart_total_amount",
          specific_market_goals: [],
          multiple_market: false,
          show_goal_reached_message: true,
        },
        ...content,
        progress_calculation: normalizeProgressCalculate(
          content.progress_calculation,
        ),
        goals: mergedGoals,
        button_text: normalizeButtonText(content?.button_text, mergedGoals.length),
      },
    };
  }

  function normalizeEnableCondition(placement = {}) {
    // If already in new format, return as is
    if (placement.enable_conditions) {
      return placement;
    }

    // Convert old single value to array format
    const oldCondition = placement.enable_condition;
    let enableCondition = ["always"]; // default

    if (oldCondition && oldCondition !== "always") {
      // Map old values to new values
      const conditionMap = {
        "orders": "orders",
        "first_time": "first_time"
      };
      enableCondition = [conditionMap[oldCondition] || oldCondition];
    }

    return {
      ...placement,
      enable_conditions: enableCondition,
      // Add default values for new fields
      max_cart_value: placement.max_cart_value ?? 0,
      last_order_before_value: placement.last_order_before_value ?? 30,
      last_order_before_unit: placement.last_order_before_unit ?? "days",
      last_order_after_value: placement.last_order_after_value ?? 30,
      last_order_after_unit: placement.last_order_after_unit ?? "days",
    };
  }


  function normalizeProgressCalculate(value) {
    if (!value) return "before_discount";
    if (["before_discount_cart", "before_discount_product"].includes(value)) {
      return "before_discount";
    }
    if (["after_discount_cart", "after_discount_product"].includes(value)) {
      return "after_discount";
    }
    return value;
  }

  function normalizeExcludeProducts(value) {
    if (value === true || value === "true") {
      return "specific_products";
    }

    if (value === false || value === "false") {
      return "none";
    }

    // If value is already a valid string, return it
    if (
      value === "specific_products" ||
      value === "specific_collections" ||
      value === "none"
    ) {
      return value;
    }

    // Default fallback
    return "none";
  }

  function normalizeTranslations(translations = [], goalsCount = 1) {
    return translations.map((t) => {
      let buttonText = t.buttonText;
      if (typeof t.buttonText === "string") {
        buttonText = {
          initial_message: t.buttonText,
          progress_messages: new Array(goalsCount).fill(t.buttonText),
          goal_reached: t.buttonText
        };
      } else if (!t.buttonText) {
        buttonText = {
          initial_message: "",
          progress_messages: new Array(goalsCount).fill(""),
          goal_reached: ""
        }
      }

      return {
        language: t.language ?? "",
        locale: t.locale ?? "",

        // New format expects string (CSS / color etc.)
        message: typeof t.message === "string" ? t.message : (t.message ?? ""),

        // ✅ preserve old string by wrapping in array
        progressMessage: Array.isArray(t.progressMessage)
          ? t.progressMessage
          : typeof t.progressMessage === "string"
            ? [t.progressMessage]
            : [""],

        goal: typeof t.goal === "string" ? t.goal : (t.goal ?? ""),

        // Missing fields added as empty strings
        buttonText: buttonText,
        upsellButtonTextBefore: t.upsellButtonTextBefore ?? "",
        upsellButtonTextAfter: t.upsellButtonTextAfter ?? "",
        upsellTitle: t.upsellTitle ?? "",
      };
    });
  }

  function normalizeButtonText(buttonText, goalsCount = 1) {
    if (!buttonText) {
      return {
        initial_message: "Shop Now",
        progress_messages: new Array(goalsCount).fill("Shop Now"),
        goal_reached: "Shop Now"
      };
    }
    if (typeof buttonText === "string") {
      return {
        initial_message: buttonText,
        progress_messages: new Array(goalsCount).fill(buttonText),
        goal_reached: buttonText
      };
    }
    return buttonText;
  }

  function handleBadgeVisibility(bar, scheduled, delay) {
    const now = Date.now();
    const { start, end } = scheduled || {};
    const delayInMs = delay * 1000;

    // Utility to show with delay
    const show = () =>
        setTimeout(() => {
        bar.style.display = "block";
        bar._delayElapsed = true;
        }, delayInMs);
    const hideAt = (ms) =>
      setTimeout(() => {
        bar.style.display = "none";
      }, ms);

    // Case 1: No start, no end → always visible
    if (!start && !end) {
      show();
      return true;
    }

    // Case 2: Only end → show now, hide at end
    if (!start && end) {
      show();
      const timeToHide = end - now;

      if (timeToHide > 0) {
        hideAt(timeToHide);
        return true;
      } else {
        bar.style.display = "none";
        return false;
      }
    }

    // Case 3: Only start → show at start, stay visible
    if (start && !end) {
      if (now >= start) {
        show();
        return true;
      } else {
        bar.style.display = "none";
        setTimeout(
          () => {
            bar.style.display = "block";
            bar._delayElapsed = true;
          },
          start - now + delayInMs,
        );
        return false;
    }
    }

    // Case 4: Both start and end → show at start, hide at end
    if (start && end) {
      if (now >= end) {
        bar.style.display = "none";
        return false; // expired
      }

      if (now < start) {
        bar.style.display = "none";
        const waitForStart = start - now + delayInMs;
        setTimeout(() => {
          bar.style.display = "block";
          bar._delayElapsed = true;
          const hideAfter = end - start;
          if (hideAfter > 0) hideAt(hideAfter);
        }, waitForStart);
        return false;
      }

      // now between start and end
      show();
      const timeToHide = end - now;
      hideAt(timeToHide);
      return true;
    }

    return false; // fallback (should never hit)
  }
  function normalizePosition(position, sticky) {
    const validPositions = [
      "top_push",
      "top_push_scroll",
      "top_overlap",
      "top_overlap_scroll",
      "bottom_overlap_scroll",
    ];

    if (validPositions.includes(position)) {
      return position;
    }

    const isSticky = sticky === true || sticky === "true";

    if (position === "bottom") {
      return "bottom_overlap_scroll";
    }

    if (position === "top") {
      return isSticky ? "top_push_scroll" : "top_push";
    }

    return "top_push";
  }
})();
