const refreshBtn = document.getElementById("refresh");
const refreshBtnOriginalText = refreshBtn.textContent;
const liveCheck = document.getElementById("live");

// ------------------ Helpers ------------------

async function getCurrentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function isSupportedUrl(url) {
  if (!url) return false;
  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("file://")
  );
}

// ------------------ UI Rendering ------------------

function updateMetricsUI(metrics) {
  const scoreEl = document.getElementById("score");
  const badgeEl = document.getElementById("badge");
  const depthEl = document.getElementById("depth");
  const densityEl = document.getElementById("density");
  const fragmentEl = document.getElementById("fragment");
  const interactionsEl = document.getElementById("interactions");

  if (!metrics) {
    scoreEl.textContent = "No data";
    badgeEl.textContent = "Open a supported page.";
    badgeEl.className = "badge";

    depthEl.textContent = "";
    densityEl.textContent = "";
    fragmentEl.textContent = "";
    interactionsEl.textContent = "";
    return;
  }

  // Score (0–1) → human readable number (0–100)
  scoreEl.textContent = (metrics.rawScore * 100).toFixed(1);

  // Load label comes from scoring.js
  const label = metrics.label || "Unknown";
  badgeEl.textContent = label;

  if (label === "High Load") badgeEl.className = "badge high";
  else if (label === "Medium Load") badgeEl.className = "badge medium";
  else badgeEl.className = "badge low";

  // Detail lines
  depthEl.textContent = `Max DOM depth: ${metrics.maxDepth}`;
  densityEl.textContent = `Interactive elements in view: ${metrics.interactiveInView}`;
  fragmentEl.textContent = `Layout regions: ${metrics.fragmentation}`;
  interactionsEl.textContent = `Last analyzed: ${new Date(
    metrics.timestamp
  ).toLocaleTimeString()}`;
}

async function loadMetrics() {
  refreshBtn.disabled = false;
  refreshBtn.textContent = refreshBtnOriginalText;
  chrome.storage.local.get("cogloadMetrics", ({ cogloadMetrics }) => {
    updateMetricsUI(cogloadMetrics);
  });
}

// ------------------ Refresh Button ------------------

refreshBtn.addEventListener("click", async () => {
  const tab = await getCurrentTab();
  if (!isSupportedUrl(tab.url)) return;
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Analyzing…";

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      if (typeof computeAllMetrics === "function") {
        const metrics = computeAllMetrics();
        chrome.storage.local.set({
          cogloadMetrics: metrics,
          cogloadLastUrl: window.location.href,
        });
        if (typeof drawHeatmapOverlay === "function") {
          drawHeatmapOverlay(metrics);
        }
      }
    },
  });

  setTimeout(loadMetrics, 400);
});

// ------------------ Live Analysis ------------------

liveCheck.addEventListener("click", async () => {
  await chrome.storage.local.set({ cogloadLiveOnScroll: liveCheck.checked });
});

// ------------------ On Popup Open ------------------

(async () => {
  const tab = await getCurrentTab();
  const unsupportedBanner = document.getElementById("unsupported");
  const pageUrlEl = document.getElementById("page-url");

  // Always show the URL of the page being analyzed
  if (tab?.url) {
    try {
      const u = new URL(tab.url);
      pageUrlEl.textContent = "Analyzing: " + u.hostname + u.pathname;
    } catch {
      pageUrlEl.textContent = "Analyzing: " + tab.url;
    }
  } else {
    pageUrlEl.textContent = "Analyzing: (unknown page)";
  }

  // Unsupported Page (chrome:// etc.)
  if (!isSupportedUrl(tab.url)) {
    unsupportedBanner.style.display = "block";
    refreshBtn.disabled = true;
    refreshBtn.style.opacity = 0.5;
    refreshBtn.style.cursor = "not-allowed";

    updateMetricsUI(null);
    return;
  }

  // Supported page → Enable button
  unsupportedBanner.style.display = "none";
  refreshBtn.disabled = false;
  refreshBtn.style.opacity = 1;
  refreshBtn.style.cursor = "pointer";

  // Retrieve stored metrics + last scanned URL
  const stored = await chrome.storage.local.get([
    "cogloadLastUrl",
    "cogloadMetrics",
  ]);

  const lastUrl = stored.cogloadLastUrl;
  const currentUrl = tab.url;

  // Auto-run analysis when URL changes or no metrics exist yet
  if (currentUrl !== lastUrl || !stored.cogloadMetrics) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        if (typeof computeAllMetrics === "function") {
          const metrics = computeAllMetrics();
          chrome.storage.local.set({
            cogloadMetrics: metrics,
            cogloadLastUrl: window.location.href,
          });
          if (typeof drawHeatmapOverlay === "function") {
            drawHeatmapOverlay(metrics);
          }
        }
      },
    });

    setTimeout(loadMetrics, 400);
  } else {
    loadMetrics();
  }

  // Initialize live checkbox from storage (default false)
  try {
    const s = await chrome.storage.local.get("cogloadLiveOnScroll");
    liveCheck.checked = !!s.cogloadLiveOnScroll;
  } catch (e) {
    liveCheck.checked = false;
  }

  // Listen for metric updates written by the content script (e.g., after scroll)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.cogloadMetrics) {
      const newMetrics = changes.cogloadMetrics.newValue;
      // Update UI immediately when metrics change
      updateMetricsUI(newMetrics);
    }
    if (changes.cogloadLiveOnScroll) {
      // Keep the checkbox in sync if changed elsewhere
      liveCheck.checked = !!changes.cogloadLiveOnScroll.newValue;
    }
  });
})();
