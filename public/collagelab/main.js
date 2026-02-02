import { State } from './modules/state.js';
import { SOURCE_FILES, SOURCE_DIR, BG_FILES, BG_DIR } from './modules/config.js';
import { createUI } from './modules/ui/layout.js';
import { setupEvents } from './modules/core/events.js';
import { randomizeCrystalize } from './modules/generators/Crystal.js';
import { renderComposite, drawFrameGuides, drawCheckerboard, drawBrushCursor, brushPaintIfNeeded, updateHoverState, drawPlacingPreview, drawPlacingCursorPreview } from './modules/core/render.js';
import { randomizeAll, randomizeBrusherOnly, randomizeFramerOnly, randomizeDithererOnly, randomizeBackgroundColor, randomizeBackgroundImage, randomizeBackgroundImageFromBgPool } from './modules/generators/randomizers.js';
import { ensureSourceImageLoaded, createDefaultDitherParams } from './modules/core/dither.js';
import { updatePanelUI, updateImageGrid, updatePolygonBrush } from './modules/ui/panels.js';
import { clearCanvas } from './modules/core/canvas.js';

// 他モジュールから UI 更新を呼べるように公開
window.updatePanelUI = updatePanelUI;
window.updateImageGrid = updateImageGrid;

// --- Processing indicator (legacy: Painting) ---
function syncPaintingOverlay() {
  const el = document.getElementById('painting-indicator');
  if (!el) return;
  const on = Number(State.activeTaskCount || 0) > 0;
  el.classList.toggle('active', on);
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
    } finally {
      if (typeof window.decrementTask === 'function') window.decrementTask();
    }
  }, 0);
}

// グローバル公開
window.randomizeAll = () => {
  runWithBusyOverlay(() => {
    randomizeAll();
    updatePanelUI();
  });
};
window.randomizeCrystalize = () => {
  runWithBusyOverlay(() => {
    randomizeCrystalize();
    updatePanelUI();
  });
};
window.randomizeBrusherOnly = () => {
  runWithBusyOverlay(() => {
    randomizeBrusherOnly();
    updatePanelUI();
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
window.randomizeBackgroundColor = () => {
  runWithBusyOverlay(() => {
    randomizeBackgroundColor();
    updatePanelUI();
  });
};
window.randomizeBackgroundImage = () => {
  runWithBusyOverlay(() => {
    randomizeBackgroundImage();
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
  State.sourceImages = SOURCE_FILES.map(filename => {
    return {
      name: filename,
      path: SOURCE_DIR + filename,
      isLocal: false,
      originalImg: null,
      processedImg: null,
      thumbUrl: '',
      displayUrl: '',
      dither: {
        enabled: false,
        params: createDefaultDitherParams()
      },
      loading: false
    };
  });

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
  if (State.sourceImages.length > 0) {
    const pick = State.sourceImages[Math.floor(Math.random() * State.sourceImages.length)];
    State.currentSourceName = pick.name;
    State.currentSourcePath = pick.path;
  }
};

window.setup = () => {
  const loading = window.select('#p5_loading');
  if (loading) loading.remove();

  createUI();

  const canvas = window.createCanvas(1920, 1920);
  canvas.parent('center-panel');
  State.ui.canvas = canvas;

  // CSSでレスポンシブ表示させるためにスタイル調整
  canvas.style('width', '100%');
  canvas.style('height', '100%');
  canvas.style('object-fit', 'contain');

  window.pixelDensity(1);
  window.noSmooth();

  State.layers.brush = window.createGraphics(window.width, window.height);
  State.layers.brush.pixelDensity(1);
  State.layers.brush.noSmooth();

  State.layers.composite = window.createGraphics(window.width, window.height);
  State.layers.composite.pixelDensity(1);
  State.layers.composite.noSmooth();

  State.layers.effect = window.createGraphics(window.width, window.height);
  State.layers.effect.pixelDensity(1);
  State.layers.effect.noSmooth();

  setupEvents();

  // Painting indicator (HTML/CSS)
  if (!document.getElementById('painting-indicator')) {
    const el = document.createElement('div');
    el.id = 'painting-indicator';
    el.textContent = 'PAINTING';
    document.getElementById('center-panel').appendChild(el);
  }
  syncPaintingOverlay();

  // カーソルリング（DOM）
  const cursorRing = window.createDiv('');
  cursorRing.id('cursor-ring');
  cursorRing.style('position', 'fixed');
  cursorRing.style('border', '1px solid #000');
  cursorRing.style('border-radius', '50%');
  cursorRing.style('pointer-events', 'none');
  cursorRing.style('z-index', '9999');
  cursorRing.style('display', 'none');
  State.ui.cursorRing = cursorRing;

  // Initial Source Image Load and UI Update
  if (State.currentSourceName) {
    const entry = State.sourceImages.find(e => e.name === State.currentSourceName);
    if (entry) {
      ensureSourceImageLoaded(entry, () => {
        State.currentSourceImg = entry.originalImg;
        // UI反映: グリッドのハイライトとブラシプレビューの更新
        updateImageGrid();
        updatePolygonBrush();
        // brush preset points set? defaulting to empty/state default
      });
    }
  }
};

window.draw = () => {
  brushPaintIfNeeded();

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
  } else if (State.isImagePlacing && State.placingImg) {
    window.push();
    window.fill(0);
    window.noStroke();
    window.textAlign(window.LEFT, window.TOP);
    window.textSize(18);
    window.text('Put the image in a frame', 18, 18);
    window.pop();
  }

  drawBrushCursor();
  drawPlacingCursorPreview();
};

window.windowResized = () => {
  // Fixed size canvas, no resize needed
};
