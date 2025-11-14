//
// ========================================================
//  SCORING + METRICS ENGINE FOR COGNITIVE LOAD EXTENSION
// ========================================================
//  Includes:
//   - DOM depth scanning
//   - Interactive element density
//   - Layout fragmentation
//   - Cognitive Load Theory scoring model
//   - Packaging for popup UI
// ========================================================
//

// --------------------------------------------
// 1. DOM Depth
// --------------------------------------------
function computeMaxDepth(root = document.body) {
  let maxDepth = 0;

  function dfs(node, depth) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
    maxDepth = Math.max(maxDepth, depth);
    for (const child of node.children) dfs(child, depth + 1);
  }

  dfs(root, 1);
  return maxDepth;
}

// --------------------------------------------
// 2. Interactive Density
// --------------------------------------------
function computeInteractiveDensity() {
  const selectors = [
    "a[href]",
    "button",
    "input",
    "select",
    "textarea",
    "[role='button']",
    "[role='link']"
  ];

  const elems = document.querySelectorAll(selectors.join(","));
  const viewportH = window.innerHeight;
  const viewportW = window.innerWidth;

  let countInView = 0;

  elems.forEach(el => {
    const rect = el.getBoundingClientRect();
    const visible =
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < viewportH &&
      rect.left < viewportW;

    if (visible) countInView += 1;
  });

  const area = viewportH * viewportW || 1;
  const density = countInView / area;

  return {
    interactiveInView: countInView,
    density
  };
}

// --------------------------------------------
// 3. Layout Fragmentation
// --------------------------------------------
// Rough count of major visual regions
function computeLayoutFragmentation() {
  const children = Array.from(document.body.children);
  let regions = 0;

  children.forEach(el => {
    const rect = el.getBoundingClientRect();
    const visible =
      rect.width > 100 &&
      rect.height > 100 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth;

    if (visible) regions += 1;
  });

  return regions;
}

// --------------------------------------------
// 4. Cognitive Load Theory Scoring
// --------------------------------------------
// Using CLT-aligned weights:
//  - Density: extraneous load → 45%
//  - Fragmentation: split-attention → 30%
//  - Depth: intrinsic load → 25%
function computeCognitiveLoadScore({ maxDepth, densityInfo, fragmentation }) {
  const interactiveInView = densityInfo.interactiveInView;

  // --- Normalization (scaled to 0–1) ---

  // Structural complexity (intrinsic load)
  const depthTerm = Math.min(maxDepth / 20, 1);  

  // Interaction density (extraneous load)
  const densityTerm = Math.min(interactiveInView / 20, 1);

  // Split-attention effect
  const fragmentTerm = Math.min(fragmentation / 5, 1);

  // --- Weighted sum ---
  const score =
    0.25 * depthTerm +
    0.45 * densityTerm +
    0.30 * fragmentTerm;

  // --- Labeling ---
  let label;
  if (score > 0.7) label = "High Load";
  else if (score > 0.4) label = "Medium Load";
  else label = "Low Load";

  return {
    rawScore: score,
    label,
    depthTerm,
    densityTerm,
    fragmentTerm
  };
}

// --------------------------------------------
// 5. Bundle all metrics for popup UI
// --------------------------------------------
function computeAllMetrics() {
  const maxDepth = computeMaxDepth();
  const densityInfo = computeInteractiveDensity();
  const fragmentation = computeLayoutFragmentation();

  const scoring = computeCognitiveLoadScore({
    maxDepth,
    densityInfo,
    fragmentation
  });

  return {
    // Raw measurements
    maxDepth,
    interactiveInView: densityInfo.interactiveInView,
    density: densityInfo.density,
    fragmentation,
    timestamp: Date.now(),

    // Scoring results
    rawScore: scoring.rawScore,
    label: scoring.label,
    depthTerm: scoring.depthTerm,
    densityTerm: scoring.densityTerm,
    fragmentTerm: scoring.fragmentTerm
  };
}