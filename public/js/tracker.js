/**
 * Tracker for Badge interactions
 */
class HoppyFreeShippingTracker {
  constructor(config) {
    this.config = {
      apiEndpoint: config.apiEndpoint,
      badgeId: config.badgeId,
      debug: config.debug || false,
      bar: config.bar,
      trackViewOnInit: config.trackViewOnInit
    };

    this.viewTracked = false;
    this.init();
  }

  init() {
    if (!this.config.badgeId) {
      console.error("HoppyFreeShippingTracker: Missing required configuration");
      return;
    }

    this.setupEventListeners();

   // ✅ Only track view if enabled
     if (this.config.trackViewOnInit) {
      this.trackView();
    }
  }

  /**
   * Setup event listeners for CTA + Close buttons
   */
  setupEventListeners() {
    const ctas = this.config.bar.querySelectorAll("[futureblink-shipping-bar-cta]");
    ctas.forEach((cta) => {
      cta.addEventListener("click", () => {
        this.log("CTA clicked", cta);
        this.trackEvent("cta_click");
      });
    });

  

    const closeBtns = this.config.bar.querySelectorAll("[futureblink-shipping-bar-close]");
    closeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        this.log("Close clicked", btn);
        this.trackEvent("closed");
      });
    });
  }

  setupVisibilityTracking() {
    const element = document.querySelector("[futureblink-shipping-bar]");
    if (!element) {
      this.log("Element not found");
      return;
    }
    if (!this.viewTracked) {
      this.trackView();
    }
  }

  trackView() {
    if (this.viewTracked) return;
    this.trackEvent("view");
    this.viewTracked = true;
  }

  async trackEvent(eventType) {
    try {
      const payload = {
        badge_id: this.config.badgeId,
        event_type: eventType
      };
      const response = await fetch(this.config.apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      this.log(`Event tracked: ${eventType}`, result);
    } catch (error) {
      console.error("HoppyFreeShippingTracker: Error tracking event", error);
    }
  }

  log(message, data = null) {
    if (this.config.debug) {
      console.log(`HoppyFreeShippingTracker: ${message}`, data);
    }
  }
}

// Auto-initialize if configuration is provided
if (typeof window !== "undefined" && window.TrackerConfig) {
  window.hoppyFreeShippingTracker = new HoppyFreeShippingTracker(window.TrackerConfig);
}

// Export for module usage
if (typeof module !== "undefined" && module.exports) {
  module.exports = HoppyFreeShippingTracker;
}
