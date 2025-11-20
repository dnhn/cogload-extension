(function () {
  if (window.__cogload_initialized) return;
  window.__cogload_initialized = true;

  // Compute metrics on load + after a delay (for dashboards that render slowly)
  function runAnalysis() {
    console.log("[CogLoad] Content script running on:", window.location.href);
    const metrics = computeAllMetrics();

    chrome.storage.local.set(
      { cogloadMetrics: metrics, cogloadLastUrl: window.location.href },
      () => {
        // Optional: log to console for debugging
        console.log("[CogLoad] Metrics stored:", metrics);
      }
    );

    // Draw overlay
    drawHeatmapOverlay(metrics);
  }

  // Simple overlay: highlight body if high score; refine later to regions
  function drawHeatmapOverlay(metrics) {
    removeExistingOverlay();

    const overlay = document.createElement("div");
    overlay.id = "cogload-overlay-heatmap";

    let color;
    if (metrics.score.rawScore > 0.7) {
      color = "rgba(255, 0, 0, 0.18)"; // high load
    } else if (metrics.score.rawScore > 0.4) {
      color = "rgba(255, 165, 0, 0.16)"; // medium
    } else {
      color = "rgba(0, 128, 0, 0.12)"; // low
    }

    overlay.style.backgroundColor = color;
    document.documentElement.appendChild(overlay);
  }

  function removeExistingOverlay() {
    const existing = document.getElementById("cogload-overlay-heatmap");
    if (existing) existing.remove();
  }

  // Run when DOM is ready
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    setTimeout(runAnalysis, 1500);
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(runAnalysis, 1500);
    });
  }

  // Optional: rerun when window is resized (layout change)
  window.addEventListener("resize", () => {
    clearTimeout(window.__cogload_resizeTimer);
    window.__cogload_resizeTimer = setTimeout(runAnalysis, 800);
  });

  // Live-on-scroll support
  function installScrollHandler() {
    removeScrollHandler();
    let timer = null;
    const handler = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(runAnalysis, 500);
    };
    window.__cogload_scroll_handler = handler;
    window.addEventListener("scroll", handler, { passive: true });
  }

  function removeScrollHandler() {
    const h = window.__cogload_scroll_handler;
    if (h) {
      window.removeEventListener("scroll", h, { passive: true });
      window.__cogload_scroll_handler = null;
    }
  }

  // Initialize based on stored preference
  chrome.storage.local.get("cogloadLiveOnScroll", ({ cogloadLiveOnScroll }) => {
    if (cogloadLiveOnScroll) {
      installScrollHandler();
    } else {
      removeScrollHandler();
    }
  });

  // React to changes (when user toggles checkbox in popup)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.cogloadLiveOnScroll) {
      const newVal = changes.cogloadLiveOnScroll.newValue;
      if (newVal) installScrollHandler();
      else removeScrollHandler();
    }
  });
})();
