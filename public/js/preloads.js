
    (function() {
      var preconnectOrigins = ["https://cdn.shopify.com"];
      var scripts = ["/cdn/shopifycloud/checkout-web/assets/c1/polyfills.iRHCMwIP.js","/cdn/shopifycloud/checkout-web/assets/c1/app.Dw8p-8qq.js","/cdn/shopifycloud/checkout-web/assets/c1/esnext-vendor.CKn7Sh4T.js","/cdn/shopifycloud/checkout-web/assets/c1/context-browser.DXqut5yt.js","/cdn/shopifycloud/checkout-web/assets/c1/shared-is-shop-pay-active.B1YnJwE3.js","/cdn/shopifycloud/checkout-web/assets/c1/Title.VgK6Sjbi.js","/cdn/shopifycloud/checkout-web/assets/c1/images-payment-icon.BfafdrDF.js","/cdn/shopifycloud/checkout-web/assets/c1/graphql-PaymentSessionMutation.C7TMWo_y.js","/cdn/shopifycloud/checkout-web/assets/c1/NotFound.Bo3OwmfS.js","/cdn/shopifycloud/checkout-web/assets/c1/types-UnauthenticatedErrorModalPayload.BVIQ625x.js","/cdn/shopifycloud/checkout-web/assets/c1/phone-phoneCountryCode.P39vQhv8.js","/cdn/shopifycloud/checkout-web/assets/c1/utils-getCommonShopPayExternalTelemetryAttributes.DBUYGOBc.js","/cdn/shopifycloud/checkout-web/assets/c1/graphql-ShopPayCheckoutSessionQuery.D_WCK3VJ.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useShopPayCheckoutGqlVersion.CVlBygsd.js","/cdn/shopifycloud/checkout-web/assets/c1/graphql-UserPrivacySettingsSetMutation.DIZPmfoO.js","/cdn/shopifycloud/checkout-web/assets/c1/hydrate.DNiL4_jU.js","/cdn/shopifycloud/checkout-web/assets/c1/locale-en.C7CPf_05.js","/cdn/shopifycloud/checkout-web/assets/c1/page-OnePage.BtCJsL73.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useWalletsTimeout.BX24cGyA.js","/cdn/shopifycloud/checkout-web/assets/c1/remember-me-hooks.DHjOCoBD.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useStableHostMethodsReferences.mfDtDndz.js","/cdn/shopifycloud/checkout-web/assets/c1/MarketsProDisclaimer.XCH5ud-1.js","/cdn/shopifycloud/checkout-web/assets/c1/SplitDeliveryMerchandiseContainer.B-w9QYSw.js","/cdn/shopifycloud/checkout-web/assets/c1/useShopPayButtonClassName.I7KozTN_.js","/cdn/shopifycloud/checkout-web/assets/c1/OffsitePaymentFailed.CPHIsYC5.js","/cdn/shopifycloud/checkout-web/assets/c1/ChangeCompanyLocationLink.C3u2KNqa.js","/cdn/shopifycloud/checkout-web/assets/c1/WalletsSandbox-WalletSandbox.BIXelITG.js","/cdn/shopifycloud/checkout-web/assets/c1/BillingAddressForm.BXqGMVjX.js","/cdn/shopifycloud/checkout-web/assets/c1/PhoneField.DW48sgUu.js","/cdn/shopifycloud/checkout-web/assets/c1/images-flag-icon.C_eXYJRt.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useCanChangeCompanyLocation.DVIBZONv.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useForceShopPayUrl.CmwyqTdU.js","/cdn/shopifycloud/checkout-web/assets/c1/GooglePayButton-index.C9dxTvEk.js","/cdn/shopifycloud/checkout-web/assets/c1/PendingShipping.DR7BvLxU.js","/cdn/shopifycloud/checkout-web/assets/c1/CompactChoiceList.DIkuXW-l.js","/cdn/shopifycloud/checkout-web/assets/c1/ImpressionEventCapture.B94HaxON.js","/cdn/shopifycloud/checkout-web/assets/c1/AutocompleteField-hooks.DXbdNQhe.js","/cdn/shopifycloud/checkout-web/assets/c1/LocalizationExtensionField.D6oZaWmB.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useShopPayPaymentRequiredMethod.CVxwyrx3.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useUpdateCheckoutAddress.Cb8p2Fyo.js","/cdn/shopifycloud/checkout-web/assets/c1/billing-address-hooks.CnMc2m5n.js","/cdn/shopifycloud/checkout-web/assets/c1/WalletLogo.D21_5FMs.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useGeneralPaymentErrorMessage.2cqtlVaP.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useShowShopPayOptin.BYwE0xgV.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useShowCreateMoreAccountsGdprTreatment.DxHaUQma.js","/cdn/shopifycloud/checkout-web/assets/c1/PaymentLine.D620rXcX.js","/cdn/shopifycloud/checkout-web/assets/c1/Section.Bilsxl7R.js","/cdn/shopifycloud/checkout-web/assets/c1/MobileOrderSummary.BiYNtH82.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useOnePageFormSubmit.9yY-OQ4E.js","/cdn/shopifycloud/checkout-web/assets/c1/PayPalOverCaptureInfoBanner.-uoa8rtY.js","/cdn/shopifycloud/checkout-web/assets/c1/utilities-get-negotiation-input.C88Vx5NZ.js","/cdn/shopifycloud/checkout-web/assets/c1/useUnauthenticatedErrorModal.SwC6qgU9.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useShopCashCheckoutEligibility.Nr5qZywC.js","/cdn/shopifycloud/checkout-web/assets/c1/redemption-constants.Cu2A-vp8.js","/cdn/shopifycloud/checkout-web/assets/c1/BillingAddressSelector.c6SWQ9nD.js","/cdn/shopifycloud/checkout-web/assets/c1/PaymentErrorBanner.Bhi-xyga.js","/cdn/shopifycloud/checkout-web/assets/c1/StockProblems-StockProblemsLineItemList.Bf9gG8Yv.js","/cdn/shopifycloud/checkout-web/assets/c1/DutyOptions.B94n9f_o.js","/cdn/shopifycloud/checkout-web/assets/c1/ShipmentBreakdown.vcSIeIL0.js","/cdn/shopifycloud/checkout-web/assets/c1/MerchandiseModal.4NL-Q1gP.js","/cdn/shopifycloud/checkout-web/assets/c1/extension-targets-shipping-options.BP1xFxpv.js","/cdn/shopifycloud/checkout-web/assets/c1/StackedMerchandisePreview.Bezx_AUo.js","/cdn/shopifycloud/checkout-web/assets/c1/EstimatedDeliveryContent.C5OVoAuP.js","/cdn/shopifycloud/checkout-web/assets/c1/ShippingMethodSelector.CMeZkuZb.js","/cdn/shopifycloud/checkout-web/assets/c1/SubscriptionPriceBreakdown.C1Fdo9Mh.js","/cdn/shopifycloud/checkout-web/assets/c1/DeliveryMethodLineFact.C1uLmWVM.js","/cdn/shopifycloud/checkout-web/assets/c1/ShippingGroupsSummaryLine.2g4ZosPP.js","/cdn/shopifycloud/checkout-web/assets/c1/utilities-publishMessage.D3phRXof.js"];
      var styles = ["/cdn/shopifycloud/checkout-web/assets/c1/assets/app.CLSvSssP.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/is-shop-pay-active.C-ppsiYq.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/Title.B9aTfaSK.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/index.Dtf6UAfE.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/OnePage.CqQsGb7U.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/SplitDeliveryMerchandiseContainer.B4YRyik9.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/LocalizationExtensionField.DEw2Ynt6.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/MobileOrderSummary.CqVkJv9Z.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/useOnePageFormSubmit.CtCAWdWo.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/WalletLogo.CIy8uDiZ.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/ChangeCompanyLocationLink.uqpm88mq.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/CompactChoiceList.BEvzDDvy.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/Section.CU18S7Ap.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/useShopPayButtonClassName.BrcQzLuH.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/DutyOptions.LcqrKXE1.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/BillingAddressForm.Dj0n4Opx.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/PhoneField.CtVCy8Ci.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/EstimatedDeliveryContent.Dl_bEC_c.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/useUnauthenticatedErrorModal.0LqF4awG.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/PayPalOverCaptureInfoBanner.CuS5ve3d.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/WalletSandbox.CnR7qNLY.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/ShippingMethodSelector.B0hio2RO.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/SubscriptionPriceBreakdown.vTcdVGq4.css","/cdn/shopifycloud/checkout-web/assets/c1/assets/StackedMerchandisePreview.D6OuIVjc.css"];
      var fontPreconnectUrls = [];
      var fontPrefetchUrls = [];
      var imgPrefetchUrls = ["https://cdn.shopify.com/s/files/1/0802/7665/2319/files/Runzie_354x100px_x320.png?v=1743206978"];

      function preconnect(url, callback) {
        var link = document.createElement('link');
        link.rel = 'dns-prefetch preconnect';
        link.href = url;
        link.crossOrigin = '';
        link.onload = link.onerror = callback;
        document.head.appendChild(link);
      }

      function preconnectAssets() {
        var resources = preconnectOrigins.concat(fontPreconnectUrls);
        var index = 0;
        (function next() {
          var res = resources[index++];
          if (res) preconnect(res, next);
        })();
      }

      function prefetch(url, as, callback) {
        var link = document.createElement('link');
        if (link.relList.supports('prefetch')) {
          link.rel = 'prefetch';
          link.fetchPriority = 'low';
          link.as = as;
          if (as === 'font') link.type = 'font/woff2';
          link.href = url;
          link.crossOrigin = '';
          link.onload = link.onerror = callback;
          document.head.appendChild(link);
        } else {
          var xhr = new XMLHttpRequest();
          xhr.open('GET', url, true);
          xhr.onloadend = callback;
          xhr.send();
        }
      }

      function prefetchAssets() {
        var resources = [].concat(
          scripts.map(function(url) { return [url, 'script']; }),
          styles.map(function(url) { return [url, 'style']; }),
          fontPrefetchUrls.map(function(url) { return [url, 'font']; }),
          imgPrefetchUrls.map(function(url) { return [url, 'image']; })
        );
        var index = 0;
        function run() {
          var res = resources[index++];
          if (res) prefetch(res[0], res[1], next);
        }
        var next = (self.requestIdleCallback || setTimeout).bind(self, run);
        next();
      }

      function onLoaded() {
        try {
          if (parseFloat(navigator.connection.effectiveType) > 2 && !navigator.connection.saveData) {
            preconnectAssets();
            prefetchAssets();
          }
        } catch (e) {}
      }

      if (document.readyState === 'complete') {
        onLoaded();
      } else {
        addEventListener('load', onLoaded);
      }
    })();
  