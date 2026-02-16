import { State } from './modules/state.js';
import { SOURCE_FILES, SOURCE_DIR, BG_FILES, BG_DIR } from './modules/config.js';
import { createUI } from './modules/ui/layout.js';
import { setupEvents } from './modules/core/events.js';
import { randomizeCrystalize } from './modules/generators/Crystal.js';
import { renderComposite, drawFrameGuides, drawCheckerboard, updateHoverState, drawPlacingPreview, drawPlacingCursorPreview } from './modules/core/render.js';
import { randomizeAll, randomizeFramerOnly, randomizeDithererOnly, randomizeDithererUsedOnly, randomizeBackgroundImageFromBgPool, randomizeFrameImagesWithRandomDither } from './modules/generators/randomizers.js';
import { ensureSourceImageLoaded, createDefaultDitherParams } from './modules/core/dither.js';
import { hash01 } from './modules/core/math.js';
import { updatePanelUI, updateImageGrid, randomizeArrangeSliders, syncDitBaselineForUsedFrames, resetDitToCenterSilently } from './modules/ui/panels.js';
import { clearCanvas } from './modules/core/canvas.js';

// 他モジュールから UI 更新を呼べるように公開
window.updatePanelUI = updatePanelUI;
window.updateImageGrid = updateImageGrid;

// --- Source sampling (performance) ---
const SOURCE_SAMPLE_SIZE = 24;

function pickRandomSubset(list, n) {
  const arr = Array.isArray(list) ? list.slice() : [];
  if (n <= 0) return [];
  if (arr.length <= n) return arr;

  // Partial Fisher-Yates shuffle: O(len) time, O(len) memory.
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (arr.length - i));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr.slice(0, n);
}

function getRandomSourceSample(allFiles, n) {
  const files = Array.isArray(allFiles) ? allFiles.filter((x) => typeof x === 'string' && x) : [];
  return pickRandomSubset(files, n);
}

function initSourceImagesFromFiles(files) {
  const prevEntries = Array.isArray(State.sourceImages) ? State.sourceImages : [];
  const localEntries = prevEntries.filter((e) => e && e.isLocal);
  const prevCurrentName = State.currentSourceName;

  const sampledEntries = (files || []).map((filename) => {
    const baseName = String(filename || '').split('/').pop() || String(filename || '');
    const stem = baseName.replace(/\.[^.]+$/, '');
    const params = createDefaultDitherParams();
    // Crystalizeでプールを入れ替えても“見え方”が急に変わりすぎないように、
    // ファイル名から決まる安定したON/OFFを使う（ランダムではない）。
    const enabled = hash01(filename) > 0.62;
    return {
      name: filename,
      path: SOURCE_DIR + filename,
      isLocal: false,
      originalImg: null,
      processedImg: null,
      // Prefer lightweight thumbnails to avoid downloading multi-megabyte sources just for the grid.
      thumbUrl: SOURCE_DIR + 'thumbs/' + stem + '.webp',
      displayUrl: '',
      dither: {
        enabled,
        params,
        baseParams: { ...params },
        baseEnabled: enabled
      },
      loading: false
    };
  });

  // Keep user-dropped local images in the source list even when we resample the pool.
  // (These are stored as blob: URLs and should remain until explicitly removed/cleared.)
  State.sourceImages = [...localEntries, ...sampledEntries];

  // Reset selection/placing to avoid dangling references to removed entries
  const keepLocalCurrent = !!(prevCurrentName && localEntries.some((e) => e?.name === prevCurrentName));
  if (!keepLocalCurrent) {
    State.currentSourceImg = null;
    State.currentSourceName = '';
    State.currentSourcePath = '';
  }
  State.isImagePlacing = false;
  State.placingImgName = null;
  State.placingImg = null;

  if (!keepLocalCurrent) {
    // Prefer picking from the sampled pool so resampling actually changes the feel.
    const pool = sampledEntries.length > 0 ? sampledEntries : State.sourceImages;
    if (pool.length > 0) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      State.currentSourceName = pick.name;
      State.currentSourcePath = pick.path;
    }
  }
}

function resampleSourcesNow() {
  const sampledSourceFiles = getRandomSourceSample(SOURCE_FILES, SOURCE_SAMPLE_SIZE);
  initSourceImagesFromFiles(sampledSourceFiles);
}

// allow UI/buttons to resample
window.resampleSourcesNow = () => {
  resampleSourcesNow();
  updatePanelUI();
  updateImageGrid();

  if (State.currentSourceName) {
    const entry = State.sourceImages.find((e) => e.name === State.currentSourceName);
    if (entry) {
      ensureSourceImageLoaded(entry, () => {
        State.currentSourceImg = entry.originalImg;
        updateImageGrid();
      });
    }
  }
};

// --- Canvas size presets ---
const CANVAS_PRESETS = [
  { w: 1920, h: 1920 },
  { w: 1920, h: 1080 },
  { w: 1080, h: 1920 }
];

function syncCanvasSizeLabel() {
  const el = State.ui && State.ui.sizeLabel && State.ui.sizeLabel.elt;
  if (!el) return;
  el.textContent = `${window.width} x ${window.height}`;
}

function syncCanvasContainerSize() {
  const el = document.getElementById('canvas-container');
  if (!el) return;

  // Base size is the "square" dimension used in the Figma layout.
  const base = 960;
  const w = Number(window.width || State.canvasW || base);
  const h = Number(window.height || State.canvasH || base);
  if (!w || !h) return;

  let cw = base;
  let ch = base;
  if (w >= h) {
    cw = base;
    ch = Math.max(1, Math.round(base * (h / w)));
  } else {
    ch = base;
    cw = Math.max(1, Math.round(base * (w / h)));
  }

  el.style.setProperty('--canvas-container-w', `${cw}px`);
  el.style.setProperty('--canvas-container-h', `${ch}px`);
}

function rescaleAllPoints(oldW, oldH, newW, newH) {
  const sx = oldW ? (newW / oldW) : 1;
  const sy = oldH ? (newH / oldH) : 1;
  const scaleFace = (face) => {
    if (!face || !Array.isArray(face.points)) return;
    face.points.forEach((p) => {
      p.x = p.x * sx;
      p.y = p.y * sy;
    });
  };
  (State.faces || []).forEach(scaleFace);
  if (State.activeFace) scaleFace(State.activeFace);
}

function recreateGraphicsLayers(w, h) {
  State.layers.composite = window.createGraphics(w, h);
  State.layers.composite.pixelDensity(1);
  State.layers.composite.noSmooth();

  State.layers.effect = window.createGraphics(w, h);
  State.layers.effect.pixelDensity(1);
  State.layers.effect.noSmooth();
}

window.setCanvasSize = (w, h) => {
  const newW = Math.max(1, Math.floor(Number(w)));
  const newH = Math.max(1, Math.floor(Number(h)));
  const oldW = window.width;
  const oldH = window.height;

  // Reset transient interactions
  State.draggingPoint = null;
  State.draggingMoved = false;
  State.draggingFace = null;
  State.connectedPoints = [];
  State.hoverPoint = null;
  State.hoverFace = null;
  State.frameTransform = null;

  // Resize canvas + rescale content
  window.resizeCanvas(newW, newH);
  rescaleAllPoints(oldW, oldH, newW, newH);
  recreateGraphicsLayers(newW, newH);

  State.canvasW = newW;
  State.canvasH = newH;
  State.needsCompositeUpdate = true;
  syncCanvasSizeLabel();
  syncCanvasContainerSize();
};

window.setCanvasPresetIndex = (idx) => {
  const i = ((Number(idx) || 0) % CANVAS_PRESETS.length + CANVAS_PRESETS.length) % CANVAS_PRESETS.length;
  State.canvasPresetIndex = i;
  const p = CANVAS_PRESETS[i];
  window.setCanvasSize(p.w, p.h);
};

window.cycleCanvasPreset = () => {
  window.setCanvasPresetIndex((State.canvasPresetIndex || 0) + 1);
};

// --- Processing indicator (legacy: Painting) ---
function syncPaintingOverlay() {
  const el = document.getElementById('painting-indicator');
  if (!el) return;
  const on = Number(State.activeTaskCount || 0) > 0;
  el.classList.toggle('active', on);
  // CSS側のネスト/ビルド差異があっても確実に制御する
  el.style.display = on ? 'block' : 'none';
}

window.incrementTask = () => {
  State.activeTaskCount = Math.max(0, Number(State.activeTaskCount || 0) + 1);
  syncPaintingOverlay();
};

window.decrementTask = () => {
  State.activeTaskCount = Math.max(0, Number(State.activeTaskCount || 0) - 1);
  syncPaintingOverlay();
};

function runWithBusyOverlay(fn) {
  if (typeof window.incrementTask === 'function') window.incrementTask();
  // 1tick 後に実行して、draw がオーバーレイを描ける余地を作る
  setTimeout(() => {
    try {
      fn();
    } catch (e) {
      console.error(e);
    } finally {
      // Force clear next tick to ensure UI update
      setTimeout(() => {
        if (typeof window.decrementTask === 'function') window.decrementTask();
      }, 0);
    }
  }, 50);
}

// グローバル公開
window.randomizeAll = () => {
  runWithBusyOverlay(() => {
    // Swap the source pool too
    if (typeof window.resampleSourcesNow === 'function') window.resampleSourcesNow();
    randomizeAll();
    updatePanelUI();
  });
};
window.randomizeCrystalize = () => {
  runWithBusyOverlay(() => {
    // Swap the source pool too
    if (typeof window.resampleSourcesNow === 'function') window.resampleSourcesNow();

    // 1) DITのパラメータをリセット
    resetDitToCenterSilently();

    // 2) フレームを作成
    randomizeCrystalize();

    // 3) 挿入される画像が選ばれる（randomizeCrystalize内でimageNameが入る）

    // 4) 使用中画像に対して dither ON/OFF・パラメータをランダム化 + 再処理
    // 5) フレームへ挿入（randomizeDithererUsedOnly 内で face.image を反映）
    randomizeDithererUsedOnly();

    // 6) この状態をDITのセンター基準として同期
    syncDitBaselineForUsedFrames();

    // 7) ARRANGEのDIT以外（Tone）をランダム化
    randomizeArrangeSliders();
    updatePanelUI();
  });
};

// Crystallize using ONLY user-dropped local images (if any), without resampling SOURCE_FILES.
// Used by the drop-image workflow so the result immediately reflects the dropped set.
window.randomizeCrystalizeLocalOnly = () => {
  runWithBusyOverlay(() => {
    const prevSources = Array.isArray(State.sourceImages) ? State.sourceImages : [];
    const localOnly = prevSources.filter((e) => e && e.isLocal);

    if (localOnly.length === 0) {
      // Fallback: just run normal crystallize without resampling
      resetDitToCenterSilently();
      randomizeCrystalize();
      randomizeDithererUsedOnly();
      syncDitBaselineForUsedFrames();
      randomizeArrangeSliders();
      updatePanelUI();
      return;
    }

    // Temporarily restrict the pool so frame image picks come from local drops.
    State.sourceImages = localOnly;
    try {
      resetDitToCenterSilently();
      randomizeCrystalize();
      randomizeDithererUsedOnly();
      syncDitBaselineForUsedFrames();
      randomizeArrangeSliders();
      updatePanelUI();
    } finally {
      State.sourceImages = prevSources;
    }
  });
};
window.randomizeFramerOnly = () => {
  runWithBusyOverlay(() => {
    randomizeFramerOnly();
    updatePanelUI();
  });
};
window.randomizeDithererOnly = () => {
  runWithBusyOverlay(() => {
    randomizeDithererOnly();
    updatePanelUI();
  });
};

window.randomizeFrameImages = () => {
  runWithBusyOverlay(() => {
    // Swap the source pool too (user request)
    if (typeof window.resampleSourcesNow === 'function') window.resampleSourcesNow();
    randomizeFrameImagesWithRandomDither();
    updatePanelUI();
  });
};

window.randomizeBackgroundImageFromBgPool = () => {
  runWithBusyOverlay(() => {
    randomizeBackgroundImageFromBgPool();
    updatePanelUI();
  });
};
window.clearCanvas = () => {
  clearCanvas();
  if (window.updateModeButtonStyles) window.updateModeButtonStyles();
  if (window.syncFramesToggleButton) window.syncFramesToggleButton();
  updatePanelUI();
};

window.preload = () => {
  // Source images initialization
  resampleSourcesNow();

  // Background-only pool initialization
  State.bgImages = (BG_FILES || []).map((filename) => {
    return {
      name: filename,
      path: (BG_DIR || SOURCE_DIR) + filename,
      originalImg: null,
      loading: false
    };
  });

  // Pick a random initial source
  // (handled in resampleSourcesNow)
};

window.setup = () => {
  const loading = window.select('#p5_loading');
  if (loading) loading.remove();

  createUI();

  const canvas = window.createCanvas(State.canvasW || 1920, State.canvasH || 1920);
  canvas.parent('canvas-container');
  State.ui.canvas = canvas;

  // Tone filter support detection (used by renderer fallback)
  try {
    const ctx = canvas?.elt?.getContext?.('2d');
    State.ui.supportsCanvasFilter = !!(ctx && 'filter' in ctx);
  } catch {
    State.ui.supportsCanvasFilter = false;
  }

  // CSS でアスペクト比を維持してコンテナ内に収める
  canvas.style('width', '100%');
  canvas.style('height', '100%');
  canvas.style('display', 'block');

  window.pixelDensity(1);
  window.noSmooth();

  recreateGraphicsLayers(window.width, window.height);

  setupEvents();

  // Painting indicator (HTML/CSS)
  if (!document.getElementById('painting-indicator')) {
    const el = document.createElement('div');
    el.id = 'painting-indicator';
    el.textContent = 'PAINTING';
    document.getElementById('canvas-container').appendChild(el);
  }
  syncPaintingOverlay();

  syncCanvasSizeLabel();
  syncCanvasContainerSize();

  // Initial Source Image Load and UI Update
  if (State.currentSourceName) {
    const entry = State.sourceImages.find(e => e.name === State.currentSourceName);
    if (entry) {
      ensureSourceImageLoaded(entry, () => {
        State.currentSourceImg = entry.originalImg;
        // UI反映: グリッドのハイライト更新
        updateImageGrid();
      });
    }
  }
};

window.draw = () => {
  updateHoverState();

  if (State.needsCompositeUpdate) {
    renderComposite();
  }

  window.background(220);
  drawCheckerboard(20);

  if (State.layers.composite) {
    window.image(State.layers.composite, 0, 0);
  }

  drawPlacingPreview();

  if (State.faces) {
    State.faces.forEach(face => {
      const isSelected = (Array.isArray(State.selectedFaces) && State.selectedFaces.includes(face)) || face === State.selectedFace;
      drawFrameGuides(face, isSelected, face === State.hoverFace, true);
    });
  }
  if (State.activeFace) {
    drawFrameGuides(State.activeFace, true, State.activeFace === State.hoverFace, false);
  }

  if (State.isPlacing) {
    window.push();
    window.fill(0);
    window.noStroke();
    window.textAlign(window.LEFT, window.TOP);
    window.textSize(18);
    window.text('CLICK CANVAS', 18, 18);
    window.pop();
  } else if (State.isImagePlacing) {
    window.push();
    window.fill(0);
    window.noStroke();
    window.textAlign(window.LEFT, window.TOP);
    window.textSize(18);
    const msg = State.placingImg
      ? 'Put the image in a frame'
      : 'Loading image… (click a frame to queue)';
    window.text(msg, 18, 18);
    window.pop();
  }

  drawPlacingCursorPreview();
};

window.windowResized = () => {
  // Fixed size canvas, no resize needed
};
