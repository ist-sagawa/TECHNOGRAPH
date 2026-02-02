import { State } from '../state.js';
import { random, hsbToRgb } from '../core/math.js';
import { ensureSourceImageLoaded, reprocessSourceEntry, createDefaultDitherParams } from '../core/dither.js';
import { applyImageToFace } from '../core/frame.js';

function randomInkHexColor() {
  // Vibrant-ish color (avoid near-gray) for ink mapping.
  const h = random(0, 360);
  const s = random(0.65, 1.0);
  const v = random(0.55, 1.0);
  const [r, g, b] = hsbToRgb(h, s, v);
  const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function randomizeAll() {
  randomizeCrystalize();
  randomizeBrusherOnly();
  randomizeFramerOnly();
  randomizeDithererOnly();
  randomizeBackgroundColor();
  randomizeBackgroundImage();
}

export function randomizeDithererOnly() {
  if (!State.sourceImages || State.sourceImages.length === 0) return;

  // legacy感: 変化が分かるように none は基本的に避ける
  const types = ['atkinson', 'floydsteinberg', 'bayer', 'bayer8', 'pattern', 'simple'];

  // 画面で使っているソース（current / frames / BG）は即反映させる
  const usedNames = new Set();
  if (State.currentSourceName) usedNames.add(State.currentSourceName);
  if (State.canvasBgImgName) usedNames.add(State.canvasBgImgName);
  (State.faces || []).forEach((f) => {
    if (f && f.imageName) usedNames.add(f.imageName);
  });

  State.sourceImages.forEach((entry) => {
    entry.dither = entry.dither || { enabled: false, params: createDefaultDitherParams() };
    entry.dither.params = entry.dither.params || createDefaultDitherParams();

    // 少なくとも使用中のものは ON（randomize を押して何も変わらない感を防ぐ）
    entry.dither.enabled = usedNames.has(entry.name) ? true : (Math.random() > 0.15);
    const p = entry.dither.params;
    p.type = types[Math.floor(Math.random() * types.length)];
    p.useColor = Math.random() > 0.3;
    p.invert = Math.random() > 0.8;
    p.threshold = Math.floor(random(50, 210));
    p.pixelSize = Math.floor(random(1, 10));
    p.brightness = random(0.8, 1.2);
    p.contrast = random(0.8, 1.2);
    p.saturation = random(0.8, 1.2);
    p.hue = Math.floor(random(-20, 20));
    // When using ink-color mode (Use Color OFF), randomize the ink color.
    if (!p.useColor) {
      p.fgColor = randomInkHexColor();
    }
  });

  // legacy互換: 全エントリを再処理して、グリッド/見た目が確実に変わるようにする
  // UIを固めないために 1件ずつキュー処理
  let i = 0;
  const refreshUI = () => {
    if (window.updateImageGrid) window.updateImageGrid();
    if (window.updatePanelUI) window.updatePanelUI();
  };

  const step = () => {
    if (i >= State.sourceImages.length) {
      // 最後にまとめて更新
      State.needsCompositeUpdate = true;
      refreshUI();
      return;
    }

    const entry = State.sourceImages[i++];
    ensureSourceImageLoaded(entry, () => {
      reprocessSourceEntry(entry, () => {
        // current は UI/プレビューも更新
        if (entry.name === State.currentSourceName) {
          State.currentSourceImg = entry.processedImg || entry.originalImg;
          State.currentSourcePath = entry.displayUrl || entry.path;
        }

        // BG がこのエントリなら差し替え
        if (State.canvasBgImgName && entry.name === State.canvasBgImgName) {
          State.canvasBgImg = entry.processedImg || entry.originalImg;
        }

        // 逐次 UI 更新（負荷軽減のため適度に）
        if (i % 3 === 0) refreshUI();
        State.needsCompositeUpdate = true;

        window.setTimeout(step, 0);
      });
    });
  };

  step();
}

export function randomizeCrystalize() {
  import('./Crystal.js').then(m => m.randomizeCrystalize());
}

export function randomizeBrusherOnly() {
  State.brushSize = Math.floor(random(20, 300));
  State.brushOpacity = Math.floor(random(10, 100));
  State.brushScatter = Math.floor(random(0, 50));
}

export function randomizeFramerOnly() {
  State.isCrystalized = false;
  State.faces = [];
  State.allLayers = State.allLayers.filter(l => l.type !== 'frame');
  State.activeFace = null;
  State.selectedFace = null;

  const count = Math.floor(random(1, 6));
  const w = window.width;
  const h = window.height;

  for (let i = 0; i < count; i++) {
    const cx = random(w * 0.1, w * 0.9);
    const cy = random(h * 0.1, h * 0.9);
    const rad = random(100, 400);
    const pts = [];
    const corners = Math.floor(random(3, 8));
    for (let j = 0; j < corners; j++) {
      const ang = (window.TWO_PI * j) / corners + random(-0.2, 0.2);
      const r = rad * random(0.5, 1.2);
      pts.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
    }

    const f = { points: pts, image: null, imageName: '' };

    if (State.sourceImages.length > 0) {
      const pick = State.sourceImages[Math.floor(random(State.sourceImages.length))];
      if (pick) {
        ensureSourceImageLoaded(pick, () => {
          reprocessSourceEntry(pick, () => {
            applyImageToFace(f, pick.processedImg || pick.originalImg, pick.name);
          });
        });
      }
    }

    State.faces.push(f);
    State.allLayers.push({ type: 'frame', data: f });
  }
  State.needsCompositeUpdate = true;
}

export function randomizeBackgroundColor() {
  const r = Math.floor(random(0, 255));
  const g = Math.floor(random(0, 255));
  const b = Math.floor(random(0, 255));
  State.canvasBgColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  State.canvasBgImg = null;
  State.needsCompositeUpdate = true;
}

export function randomizeBackgroundImage() {
  if (State.sourceImages.length === 0) return;
  const pick = State.sourceImages[Math.floor(random(State.sourceImages.length))];
  ensureSourceImageLoaded(pick, () => {
    reprocessSourceEntry(pick, () => {
      State.canvasBgImg = pick.processedImg || pick.originalImg;
      State.canvasBgImgName = pick.name;
      State.canvasBgColor = '#ffffff';
      // Usually if image is set, color is behind it.
      State.needsCompositeUpdate = true;
    });
  });
}

// Background-only image pool (8 images in /collagelab/source/)
export function randomizeBackgroundImageFromBgPool() {
  if (!State.bgImages || State.bgImages.length === 0) return;
  const pick = State.bgImages[Math.floor(random(State.bgImages.length))];
  if (!pick) return;

  ensureSourceImageLoaded(pick, () => {
    State.canvasBgImg = pick.originalImg;
    State.canvasBgImgName = pick.name;
    State.canvasBgColor = '#ffffff';
    State.needsCompositeUpdate = true;
  });
}
