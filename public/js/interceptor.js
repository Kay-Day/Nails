if (!window.hoppy_interceptor_installed) {
  window.hoppy_interceptor_installed = true;

  const originalFetch = window.fetch;
  const getCleanSections = (raw) => {
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : [String(raw)];
    return [...new Set(arr.flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean))];
  };

  window.fetch = async function (input, init) {
    const url = input?.toString() || "";
    init = init || {};
    const options = init;

    const isCartAdd = url.includes("/cart/add");
    const isCartChange = url.includes("/cart/change");
    const isCartUpdate = url.includes("/cart/update");

    // If not a cart-related request, just call original fetch
    if (!isCartAdd && !isCartChange && !isCartUpdate) {
      return originalFetch(input, init);
    }

    // --- Grab everything from window._hoppy_requirements ---
    const hoppyReq = window._hoppy_requirements || {};
    let cart = hoppyReq.cart || { items: [] };
    const widgets = Array.isArray(hoppyReq.widgets) ? hoppyReq.widgets : [];
    const bars = Array.isArray(hoppyReq.bars) ? hoppyReq.bars : [];
    const giftAddQueue = Array.isArray(hoppyReq.giftAddQueue)
      ? hoppyReq.giftAddQueue
      : [];
    const giftsToAdd = Array.isArray(hoppyReq.giftsToAdd)
      ? hoppyReq.giftsToAdd
      : [];
    const processCartPromos =
      typeof hoppyReq.processCartPromos === "function"
        ? hoppyReq.processCartPromos
        : async () => ({ add: [], delete: [] });

    let latestResponse = await originalFetch(input, init);

    try {
      const jsonData = await latestResponse.clone().json();

      // --- Update cart ---
      if (jsonData) {
        if (jsonData.items && Array.isArray(jsonData.items)) {
          const isFullCart =
            jsonData.token && typeof jsonData.item_count === "number";
          if (isFullCart) {
            const {
              id,
              token,
              note,
              updated_at,
              created_at,
              currency,
              items_subtotal_price,
              cart_level_discount_applications,
              ...cleaned
            } = jsonData;
            cart = cleaned;
          } else {
            // Partial response (e.g., Essential app) — merge items into existing cart
            for (const item of jsonData.items) {
              const idx = cart.items.findIndex((i) =>
                i.variant_id && item.variant_id
                  ? i.variant_id === item.variant_id
                  : i.id === item.id,
              );
              if (idx !== -1) {
                cart.items[idx] = { ...cart.items[idx], ...item };
              } else {
                cart.items.push(item);
              }
            }
          }
          window._hoppy_requirements.cart = cart;
        } else {
          const addedItems = Array.isArray(jsonData) ? jsonData : [jsonData];
          for (const item of addedItems) {
            const idx = cart.items.findIndex((i) =>
              i.variant_id && item.variant_id ? i.variant_id === item.variant_id : i.id === item.id,
            );
            if (idx !== -1) cart.items[idx] = { ...cart.items[idx], ...item };
            else cart.items.push(item);
          }
        }
      }
      // --- Extract variant & quantity info ---
      let variantId, addedQuantity;
      let sectionInfo = {
        sections: ["cart-drawer", "cart-icon-bubble"],
        sections_url: "/cart",
        "section-id": "main-cart",
      };

      try {
        if (options.body instanceof FormData) {
          const rawSections = options.body.getAll("sections");
          sectionInfo.sections = rawSections.length > 0 ? getCleanSections(rawSections) : sectionInfo.sections;
          sectionInfo.sections_url =
            options.body.get("sections_url") || sectionInfo.sections_url;
          sectionInfo["section-id"] =
            options.body.get("section-id") || sectionInfo["section-id"];
          variantId = options.body.get("id");
          const quantities = options.body.getAll("quantity").map(Number);
          addedQuantity = Math.max(...quantities, 1);

          options.body.delete("properties[_hoppyBundleId]");
          if (widgets.length > 0) {
            options.body.append(
              "properties[_hoppyBundleId]",
              widgets.join(","),
            );
          }
        } else if (options.body) {
          const parsed = JSON.parse(options.body);
          sectionInfo.sections = parsed.sections ? getCleanSections(parsed.sections) : sectionInfo.sections;
          sectionInfo.sections_url =
            parsed.sections_url || sectionInfo.sections_url;
          sectionInfo["section-id"] =
            parsed["section-id"] || sectionInfo["section-id"];

          if (parsed.line) {
            const lineIndex = parsed.line - 1;
            if (cart.items[lineIndex]) {
              variantId = cart.items[lineIndex].variant_id;
              addedQuantity = parseInt(parsed.quantity || 1);
            }
          } else {
            variantId = parsed.id || parsed.variantId;
            addedQuantity = parseInt(parsed.quantity || 1);
          }

          if (widgets.length > 0) {
            parsed.properties = {
              ...(parsed.properties || {}),
              _hoppyBundleId: widgets.join(","),
            };
          }

          options.body = JSON.stringify(parsed);
        }
      } catch (e) {
        console.warn("Failed to extract variant or section info", e);
      }

      // --- Apply promo logic ---
      const { add: addItems, delete: deleteLines } =
        await processCartPromos(cart);

      for (const line of deleteLines) {
        const deletedResponse = await originalFetch("/cart/change.js", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            line,
            quantity: 0,
            sections: sectionInfo.sections,
            sections_url: sectionInfo.sections_url,
          }),
        });
        const deletedData = await deletedResponse.clone().json();
        cart = deletedData;
        window._hoppy_requirements.cart = cart;
        latestResponse = deletedResponse;
      }

      for (const gift of addItems || []) {
        const alreadyQueued = giftAddQueue.some(
          (q) =>
            q.id == gift.id &&
            q.properties?._free_gift === gift.properties?._free_gift,
        );
        if (!alreadyQueued) giftAddQueue.push(gift);
      }

      // --- Free shipping / gift logic ---
      if (bars.length > 0) {
        const isGiftRequest = (() => {
          try {
            if (options.body instanceof FormData)
              return options.body.get("_isFreeGift") === "true";
            if (typeof options.body === "string") {
              // Try URLSearchParams first (for form-encoded bodies)
              try {
                const params = new URLSearchParams(options.body);
                if (params.get("_isFreeGift") === "true") return true;
                if (params.get("items")) {
                  const items = JSON.parse(params.get("items"));
                  return items.some((i) => i.properties?._isFreeGift === "true");
                }
              } catch {
                // Not URL-encoded, might be JSON
              }
              // Try JSON parse
              try {
                const parsed = JSON.parse(options.body);
                if (parsed.properties?._isFreeGift === "true") return true;
                if (Array.isArray(parsed.items))
                  return parsed.items.some(
                    (i) => i.properties?._isFreeGift === "true",
                  );
              } catch { }
            } else if (options.body) {
              const parsed = options.body;
              if (parsed.properties?._isFreeGift === "true") return true;
              if (Array.isArray(parsed.items))
                return parsed.items.some(
                  (i) => i.properties?._isFreeGift === "true",
                );
            }
          } catch { }
          return false;
        })();

        if (!isGiftRequest) {
          let removalResponse = null;
          let resolveRemoval;
          const removalPromise = new Promise((r) => (resolveRemoval = r));

          (async () => {
            try {
              const response = await latestResponse;
              let jsonData;
              try {
                jsonData = await response.clone().json();
              } catch {
                resolveRemoval();
                return;
              }

              if (jsonData?.items && Array.isArray(jsonData.items)) {
                const isFullCart =
                  jsonData.token && typeof jsonData.item_count === "number";

                if (isFullCart) {
                  const {
                    id,
                    token,
                    note,
                    updated_at,
                    created_at,
                    currency,
                    items_subtotal_price,
                    cart_level_discount_applications,
                    ...cleaned
                  } = jsonData;
                  cart = cleaned;
                } else {
                  // Partial response (e.g., Essential app) — merge items into existing cart
                  for (const item of jsonData.items) {
                    const idx = cart.items.findIndex((i) =>
                      i.variant_id && item.variant_id
                        ? i.variant_id === item.variant_id
                        : i.id === item.id,
                    );
                    if (idx !== -1) {
                      cart.items[idx] = { ...cart.items[idx], ...item };
                    } else {
                      cart.items.push(item);
                    }
                  }
                }
                window._hoppy_requirements.cart = cart;
              } else if (jsonData) {
                const addedItems = Array.isArray(jsonData)
                  ? jsonData
                  : [jsonData];
                for (const item of addedItems) {
                  const idx = cart.items.findIndex((i) =>
                    i.variant_id && item.variant_id ? i.variant_id === item.variant_id : i.id === item.id,
                  );
                  if (idx !== -1)
                    cart.items[idx] = { ...cart.items[idx], ...item };
                  else cart.items.push(item);
                }
              }

              cart.items = cart.items.map((item) => {
                if (item.properties?._isFreeGift === "true") {
                  item.original_line_price = Math.max(
                    0,
                    (item.original_line_price || 0) -
                    (item.original_price || 0),
                  );
                }
                return item;
              });

              for (const bar of bars) {
                const { contentData, freeProductAdd } = bar;

                // Skip gift processing for bars that don't have free_gift reward type
                const hasFreeGiftReward = contentData.goals?.some(
                  (g) => g.reward_type === "free_gift",
                );
                if (!hasFreeGiftReward) continue;

                const calculateMethod =
                  contentData.progress_calculation === "after_discount"
                    ? "discounted_price"
                    : "original_line_price";

                const totalPrice = cart.items.reduce((sum, item) => {
                  if (item.properties?._isFreeGift === "true") return sum;
                  const baseValue = (item[calculateMethod] || 0) / 100;
                  const multiplier =
                    calculateMethod === "discounted_price" ? item.quantity : 1;
                  return sum + baseValue * multiplier;
                }, 0);

                const totalQuantity = cart.items.reduce((sum, item) => {
                  if (item.properties?._isFreeGift === "true") return sum;
                  return (
                    sum + (contentData.unique_products ? 1 : item.quantity)
                  );
                }, 0);

                const value =
                  contentData.goal_type === "product_quantity"
                    ? totalQuantity
                    : totalPrice;
                const { hasGoalReached, isRewardType, rewardVariants } =
                  freeProductAdd(value);
                const giftRemovals = [];
                const itemsToAdd = [];
                const rewardApplication = contentData.reward_application || "all";
                // Get highest tier goal value from rewardVariants (or 0 if none)
                const highestGoalValue = rewardVariants.length > 0
                  ? rewardVariants[0].goal
                  : 0;

                // ---- REMOVAL DETECTION ----
                cart.items.forEach((item, idx) => {
                  const isFreeGift = item.properties?._isFreeGift === "true";
                  const giftGoalValue = parseFloat(
                    item.properties?._freeGiftGoal,
                  );
                  if (
                    isFreeGift &&
                    (!hasGoalReached || giftGoalValue > value || (rewardApplication === "highest" && giftGoalValue < highestGoalValue))
                  ) {
                    giftRemovals.push({
                      variant_id: item.variant_id,
                      goal: item.properties?._freeGiftGoal,
                      quantity: 0
                    });
                  }
                })

                // Additions
                if (
                  hasGoalReached &&
                  isRewardType &&
                  Array.isArray(rewardVariants)
                ) {
                  const existingGiftIds = cart.items
                    .filter((i) => i.properties?._isFreeGift === "true")
                    .map((i) => String(i.id));
                  const seenRewardIds = new Set(existingGiftIds);
                  for (const reward of rewardVariants) {
                    const rewardId = String(reward.id);
                    if (!seenRewardIds.has(rewardId)) {
                      seenRewardIds.add(rewardId);
                      itemsToAdd.push({
                        id: reward.id,
                        quantity: 1,
                        properties: {
                          _isFreeGift: "true",
                          _freeGiftGoal: String(reward.goal),
                        },
                      });
                    }
                  }
                }

                // Apply removals
                for (const itemToRemove of giftRemovals) {
                  // Fetch fresh cart to ensure we have the latest line item keys
                  const freshCart = await originalFetch("/cart.js").then(res => res.json());
                  const freshItem = freshCart.items.find(i =>
                    String(i.variant_id) === String(itemToRemove.variant_id) &&
                    i.properties?._freeGiftGoal === itemToRemove.goal
                  );

                  if (!freshItem) continue;

                  const response = await originalFetch("/cart/change.js", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Accept: "application/json",
                    },
                    body: JSON.stringify({
                      id: freshItem.key,
                      quantity: itemToRemove.quantity,
                      sections: sectionInfo.sections,
                      sections_url: sectionInfo.sections_url,
                    }),
                  });
                  // Update cart state after successful removal to keep line numbers accurate
                  if (response.ok) {
                    try {
                      const updatedCart = await response.clone().json();
                      if (updatedCart?.items) {
                        cart = updatedCart;
                        window._hoppy_requirements.cart = cart;
                        latestResponse = response;
                      }
                    } catch (e) {
                      // If we can't parse the response, remove the item from local cart
                      const itemIndex = cart.items.findIndex(
                        (i) => (i.key || String(i.id)) === item.id,
                      );
                      if (itemIndex !== -1) {
                        cart.items.splice(itemIndex, 1);
                      }
                    }
                  }
                }
                // Add gifts inline to avoid race condition with page navigation
                for (const gift of itemsToAdd) {
                  try {
                    const addResponse = await originalFetch("/cart/add.js", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                      },
                      body: JSON.stringify({
                        id: gift.id,
                        quantity: gift.quantity || 1,
                        properties: gift.properties,
                      }),
                    });
                    if (addResponse.ok) {
                      const addData = await addResponse.clone().json();
                      if (addData) {
                        const addedItems = Array.isArray(addData) ? addData : [addData];
                        for (const item of addedItems) {
                          const idx = cart.items.findIndex((i) =>
                            i.variant_id && item.variant_id ? i.variant_id === item.variant_id : i.id === item.id,
                          );
                          if (idx !== -1) cart.items[idx] = { ...cart.items[idx], ...item };
                          else cart.items.push(item);
                        }
                      }
                      // Do NOT set latestResponse here — /cart/add.js response lacks sections
                    }
                  } catch (e) {
                    console.error("Failed to add free gift inline:", e);
                  }
                }

                // Refresh sections so cart drawer/icon reflect the newly added gifts
                if (itemsToAdd.length > 0 && cart.items.length > 0) {
                  try {
                    const refreshItem = cart.items[0];
                    const refreshResponse = await originalFetch("/cart/change.js", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                      },
                      body: JSON.stringify({
                        id: refreshItem.key,
                        quantity: refreshItem.quantity,
                        sections: sectionInfo.sections,
                        // sections_url: sectionInfo.sections_url,
                      }),
                    });
                    if (refreshResponse.ok) {
                      const refreshData = await refreshResponse.clone().json();
                      if (refreshData?.items) {
                        cart = refreshData;
                        window._hoppy_requirements.cart = cart;
                      }
                      latestResponse = refreshResponse;
                    }
                  } catch (e) {
                    // ignore refresh errors
                  }
                }
              }

              resolveRemoval();
            } catch (e) {
              resolveRemoval();
              console.error("Gift calculation error:", e);
            }
          })();

          await removalPromise;
          latestResponse = removalResponse || latestResponse;
        }
      }
    } catch (err) {
      console.error("Cart interceptor error:", err);
    }

    // --- Save updated globals ---
    window._hoppy_requirements.cart = cart;
    window._hoppy_requirements.giftAddQueue = giftAddQueue;
    window._hoppy_requirements.giftsToAdd = giftsToAdd;

    return latestResponse;
  };

  // ==================== XHR Interceptor ====================

  const OriginalXHR = window.XMLHttpRequest;

  function HoppyXHR() {
    const xhr = new OriginalXHR();
    const hoppyReq = window._hoppy_requirements || {};
    let cart = hoppyReq.cart || { items: [] };
    const widgets = Array.isArray(hoppyReq.widgets) ? hoppyReq.widgets : [];
    const bars = Array.isArray(hoppyReq.bars) ? hoppyReq.bars : [];
    const giftAddQueue = Array.isArray(hoppyReq.giftAddQueue)
      ? hoppyReq.giftAddQueue
      : [];
    const giftsToAdd = Array.isArray(hoppyReq.giftsToAdd)
      ? hoppyReq.giftsToAdd
      : [];
    const processCartPromos =
      typeof hoppyReq.processCartPromos === "function"
        ? hoppyReq.processCartPromos
        : async () => ({ add: [], delete: [] });

    let requestUrl = "";
    let requestMethod = "";
    let requestBody = null;
    let requestHeaders = {};
    let isCartRequest = false;

    // Open interceptor
    const originalOpen = xhr.open;
    xhr.open = function (method, url, async, user, password) {
      requestUrl = url?.toString() || "";
      requestMethod = method;
      const isCartAdd = requestUrl.includes("/cart/add");
      const isCartChange = requestUrl.includes("/cart/change");
      const isCartUpdate = requestUrl.includes("/cart/update");
      isCartRequest = isCartAdd || isCartChange || isCartUpdate;
      return originalOpen.apply(xhr, arguments);
    };

    // setRequestHeader interceptor
    const originalSetRequestHeader = xhr.setRequestHeader;
    xhr.setRequestHeader = function (header, value) {
      requestHeaders[header] = value;
      return originalSetRequestHeader.apply(xhr, arguments);
    };

    // Send interceptor
    const originalSend = xhr.send;
    xhr.send = async function (body) {
      if (!isCartRequest) {
        return originalSend.apply(xhr, arguments);
      }

      requestBody = body;

      // --- Extract variant & quantity info and modify body ---
      let variantId, addedQuantity;
      let sectionInfo = {
        sections: ["cart-drawer", "cart-icon-bubble"],
        sections_url: "/cart",
        "section-id": "main-cart",
      };
      let modifiedBody = body;

      try {
        if (body instanceof FormData) {
          const rawSections = body.getAll("sections");
          sectionInfo.sections = rawSections.length > 0 ? getCleanSections(rawSections) : sectionInfo.sections;
          sectionInfo.sections_url =
            body.get("sections_url") || sectionInfo.sections_url;
          sectionInfo["section-id"] =
            body.get("section-id") || sectionInfo["section-id"];
          variantId = body.get("id");
          const quantities = body.getAll("quantity").map(Number);
          addedQuantity = Math.max(...quantities, 1);

          body.delete("properties[_hoppyBundleId]");
          if (widgets.length > 0) {
            body.append("properties[_hoppyBundleId]", widgets.join(","));
          }
          modifiedBody = body;
        } else if (typeof body === "string" && body) {
          const parsed = JSON.parse(body);
          sectionInfo.sections = parsed.sections ? getCleanSections(parsed.sections) : sectionInfo.sections;
          sectionInfo.sections_url =
            parsed.sections_url || sectionInfo.sections_url;
          sectionInfo["section-id"] =
            parsed["section-id"] || sectionInfo["section-id"];

          if (parsed.line) {
            const lineIndex = parsed.line - 1;
            if (cart.items[lineIndex]) {
              variantId = cart.items[lineIndex].variant_id;
              addedQuantity = parseInt(parsed.quantity || 1);
            }
          } else {
            variantId = parsed.id || parsed.variantId;
            addedQuantity = parseInt(parsed.quantity || 1);
          }

          if (widgets.length > 0) {
            parsed.properties = {
              ...(parsed.properties || {}),
              _hoppyBundleId: widgets.join(","),
            };
          }

          modifiedBody = JSON.stringify(parsed);
        }
      } catch (e) {
        console.warn("Failed to extract variant or section info from XHR", e);
      }

      // Create a promise to handle the async processing
      return new Promise((resolve, reject) => {
        // Override onload to process response
        const originalOnload = xhr.onload;
        xhr.onload = async function () {
          try {
            let jsonData = null;
            try {
              jsonData = JSON.parse(xhr.responseText);
            } catch { }

            // --- Update cart ---
            if (jsonData) {
              if (jsonData.items && Array.isArray(jsonData.items)) {
                const isFullCart =
                  jsonData.token && typeof jsonData.item_count === "number";

                if (isFullCart) {
                  const {
                    id,
                    token,
                    note,
                    updated_at,
                    created_at,
                    currency,
                    items_subtotal_price,
                    cart_level_discount_applications,
                    ...cleaned
                  } = jsonData;
                  cart = cleaned;
                } else {
                  // Partial response (e.g., Essential app) — merge items into existing cart
                  for (const item of jsonData.items) {
                    const idx = cart.items.findIndex((i) =>
                      i.variant_id && item.variant_id
                        ? i.variant_id === item.variant_id
                        : i.id === item.id,
                    );
                    if (idx !== -1) {
                      cart.items[idx] = { ...cart.items[idx], ...item };
                    } else {
                      cart.items.push(item);
                    }
                  }
                }
                window._hoppy_requirements.cart = cart;
              } else {
                const addedItems = Array.isArray(jsonData)
                  ? jsonData
                  : [jsonData];
                for (const item of addedItems) {
                  const idx = cart.items.findIndex((i) =>
                    i.variant_id && item.variant_id ? i.variant_id === item.variant_id : i.id === item.id,
                  );
                  if (idx !== -1)
                    cart.items[idx] = { ...cart.items[idx], ...item };
                  else cart.items.push(item);
                }
              }
            }

            // --- Apply promo logic ---
            const { add: addItems, delete: deleteLines } =
              await processCartPromos(cart);

            // Process deletions
            for (const line of deleteLines) {
              const deleteResponse = await originalFetch("/cart/change.js", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Accept: "application/json",
                },
                body: JSON.stringify({
                  line,
                  quantity: 0,
                  sections: sectionInfo.sections,
                  sections_url: sectionInfo.sections_url,
                }),
              });
              const deleteData = await deleteResponse.json();
              cart = deleteData;
              window._hoppy_requirements.cart = cart;
            }

            // Queue additions
            for (const gift of addItems || []) {
              const alreadyQueued = giftAddQueue.some(
                (q) =>
                  q.id == gift.id &&
                  q.properties?._free_gift === gift.properties?._free_gift,
              );
              if (!alreadyQueued) giftAddQueue.push(gift);
            }

            // --- Free shipping / gift logic ---
            if (bars.length > 0) {
              const isGiftRequest = (() => {
                try {
                  if (body instanceof FormData)
                    return body.get("_isFreeGift") === "true";
                  if (typeof body === "string") {
                    // Try URLSearchParams first (for form-encoded bodies)
                    try {
                      const params = new URLSearchParams(body);
                      if (params.get("_isFreeGift") === "true") return true;
                      if (params.get("items")) {
                        const items = JSON.parse(params.get("items"));
                        return items.some(
                          (i) => i.properties?._isFreeGift === "true",
                        );
                      }
                    } catch {
                      // Not URL-encoded, might be JSON
                    }
                    // Try JSON parse
                    try {
                      const parsed = JSON.parse(body);
                      if (parsed.properties?._isFreeGift === "true") return true;
                      if (Array.isArray(parsed.items))
                        return parsed.items.some(
                          (i) => i.properties?._isFreeGift === "true",
                        );
                    } catch { }
                  } else if (body) {
                    const parsed = body;
                    if (parsed.properties?._isFreeGift === "true") return true;
                    if (Array.isArray(parsed.items))
                      return parsed.items.some(
                        (i) => i.properties?._isFreeGift === "true",
                      );
                  }
                } catch { }
                return false;
              })();

              if (!isGiftRequest) {
                // Recalculate cart after response
                if (jsonData?.items && Array.isArray(jsonData.items)) {
                  const isFullCart =
                    jsonData.token && typeof jsonData.item_count === "number";

                  if (isFullCart) {
                    const {
                      id,
                      token,
                      note,
                      updated_at,
                      created_at,
                      currency,
                      items_subtotal_price,
                      cart_level_discount_applications,
                      ...cleaned
                    } = jsonData;
                    cart = cleaned;
                  } else {
                    // Partial response (e.g., Essential app) — merge items into existing cart
                    for (const item of jsonData.items) {
                      const idx = cart.items.findIndex((i) =>
                        i.variant_id && item.variant_id
                          ? i.variant_id === item.variant_id
                          : i.id === item.id,
                      );
                      if (idx !== -1) {
                        cart.items[idx] = { ...cart.items[idx], ...item };
                      } else {
                        cart.items.push(item);
                      }
                    }
                  }
                  window._hoppy_requirements.cart = cart;
                } else if (jsonData) {
                  const addedItems = Array.isArray(jsonData)
                    ? jsonData
                    : [jsonData];
                  for (const item of addedItems) {
                    const idx = cart.items.findIndex((i) =>
                      i.variant_id && item.variant_id ? i.variant_id === item.variant_id : i.id === item.id,
                    );
                    if (idx !== -1)
                      cart.items[idx] = { ...cart.items[idx], ...item };
                    else cart.items.push(item);
                  }
                }

                cart.items = cart.items.map((item) => {
                  if (item.properties?._isFreeGift === "true") {
                    item.original_line_price = Math.max(
                      0,
                      (item.original_line_price || 0) -
                      (item.original_price || 0),
                    );
                  }
                  return item;
                });

                for (const bar of bars) {
                  const { contentData, freeProductAdd } = bar;

                  // Skip gift processing for bars that don't have free_gift reward type
                  const hasFreeGiftReward = contentData.goals?.some(
                    (g) => g.reward_type === "free_gift",
                  );
                  if (!hasFreeGiftReward) continue;

                  const calculateMethod =
                    contentData.progress_calculation === "after_discount"
                      ? "discounted_price"
                      : "original_line_price";

                  const totalPrice = cart.items.reduce((sum, item) => {
                    if (item.properties?._isFreeGift === "true") return sum;
                    const baseValue = (item[calculateMethod] || 0) / 100;
                    const multiplier =
                      calculateMethod === "discounted_price"
                        ? item.quantity
                        : 1;
                    return sum + baseValue * multiplier;
                  }, 0);

                  const totalQuantity = cart.items.reduce((sum, item) => {
                    if (item.properties?._isFreeGift === "true") return sum;
                    return (
                      sum + (contentData.unique_products ? 1 : item.quantity)
                    );
                  }, 0);

                  const value =
                    contentData.goal_type === "product_quantity"
                      ? totalQuantity
                      : totalPrice;
                  const { hasGoalReached, isRewardType, rewardVariants } =
                    freeProductAdd(value);
                  const giftRemovals = [];
                  const itemsToAdd = [];
                  const rewardApplication = contentData.reward_application || "all";
                  // Get highest tier goal value from rewardVariants (or 0 if none)
                  const highestGoalValue = rewardVariants.length > 0
                    ? rewardVariants[0].goal
                    : 0

                  // ---- REMOVAL DETECTION ----
                  cart.items.forEach((item, idx) => {
                    const isFreeGift = item.properties?._isFreeGift === "true";
                    const giftGoalValue = parseFloat(
                      item.properties?._freeGiftGoal,
                    );
                    if (
                      isFreeGift &&
                      (!hasGoalReached || giftGoalValue > value || (rewardApplication === "highest" && giftGoalValue < highestGoalValue))
                    ) {
                      giftRemovals.push({
                        variant_id: item.variant_id,
                        goal: item.properties?._freeGiftGoal,
                        quantity: 0
                      });
                    }
                  });

                  // Additions
                  if (
                    hasGoalReached &&
                    isRewardType &&
                    Array.isArray(rewardVariants)
                  ) {
                    const existingGiftIds = cart.items
                      .filter((i) => i.properties?._isFreeGift === "true")
                      .map((i) => String(i.id));
                    const seenRewardIds = new Set(existingGiftIds);
                    for (const reward of rewardVariants) {
                      const rewardId = String(reward.id);
                      if (!seenRewardIds.has(rewardId)) {
                        seenRewardIds.add(rewardId);
                        itemsToAdd.push({
                          id: reward.id,
                          quantity: 1,
                          properties: {
                            _isFreeGift: "true",
                            _freeGiftGoal: String(reward.goal),
                          },
                        });
                      }
                    }
                  }

                  // Apply removals
                  for (const itemToRemove of giftRemovals) {
                    // Fetch fresh cart to ensure we have the latest line item keys
                    const freshCartRes = await originalFetch("/cart.js");
                    const freshCart = await freshCartRes.json();

                    const freshItem = freshCart.items.find(i =>
                      String(i.variant_id) === String(itemToRemove.variant_id) &&
                      i.properties?._freeGiftGoal === itemToRemove.goal
                    );

                    if (!freshItem) continue;

                    const response = await originalFetch("/cart/change.js", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                      },
                      body: JSON.stringify({
                        id: freshItem.key,
                        quantity: itemToRemove.quantity,
                        sections: sectionInfo.sections,
                        sections_url: sectionInfo.sections_url,
                      }),
                    });
                    // Update cart state after successful removal to keep line numbers accurate
                    if (response.ok) {
                      try {
                        const updatedCart = await response.json();
                        if (updatedCart?.items) {
                          cart = updatedCart;
                          window._hoppy_requirements.cart = cart;
                        }
                      } catch (e) {
                        // If we can't parse the response, remove the item from local cart
                        const itemIndex = cart.items.findIndex(
                          (i) => (i.key || String(i.id)) === item.id,
                        );
                        if (itemIndex !== -1) {
                          cart.items.splice(itemIndex, 1);
                        }
                      }
                    }
                  }

                  // Add gifts inline to avoid race condition with page navigation
                  for (const gift of itemsToAdd) {
                    try {
                      const addResponse = await originalFetch("/cart/add.js", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          Accept: "application/json",
                        },
                        body: JSON.stringify({
                          id: gift.id,
                          quantity: gift.quantity || 1,
                          properties: gift.properties,
                        }),
                      });
                      if (addResponse.ok) {
                        const addData = await addResponse.json();
                        if (addData) {
                          const addedItems = Array.isArray(addData) ? addData : [addData];
                          for (const item of addedItems) {
                            const idx = cart.items.findIndex((i) =>
                              i.variant_id && item.variant_id ? i.variant_id === item.variant_id : i.id === item.id,
                            );
                            if (idx !== -1) cart.items[idx] = { ...cart.items[idx], ...item };
                            else cart.items.push(item);
                          }
                        }
                      }
                    } catch (e) {
                      console.error("Failed to add free gift inline:", e);
                    }
                  }
                }
              }
            }

            // --- Save updated globals ---
            window._hoppy_requirements.cart = cart;
            window._hoppy_requirements.giftAddQueue = giftAddQueue;
            window._hoppy_requirements.giftsToAdd = giftsToAdd;
          } catch (err) {
            console.error("XHR Cart interceptor error:", err);
          }

          // Call original onload
          if (originalOnload) {
            originalOnload.apply(this, arguments);
          }
          resolve();
        };

        // Handle errors
        const originalOnerror = xhr.onerror;
        xhr.onerror = function () {
          if (originalOnerror) {
            originalOnerror.apply(this, arguments);
          }
          reject(new Error("XHR request failed"));
        };

        // Send the modified request
        originalSend.call(xhr, modifiedBody);
      });
    };

    return xhr;
  }

  // Copy static properties
  HoppyXHR.prototype = OriginalXHR.prototype;
  HoppyXHR.UNSENT = OriginalXHR.UNSENT;
  HoppyXHR.OPENED = OriginalXHR.OPENED;
  HoppyXHR.HEADERS_RECEIVED = OriginalXHR.HEADERS_RECEIVED;
  HoppyXHR.LOADING = OriginalXHR.LOADING;
  HoppyXHR.DONE = OriginalXHR.DONE;

  window.XMLHttpRequest = HoppyXHR;
} // End of if (window.hoppy_interceptor_installed === false)
