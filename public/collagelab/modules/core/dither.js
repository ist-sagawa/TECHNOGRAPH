import { MAX_DIM } from '../config.js';
import { State } from '../state.js';
import { rgbToHsb, hsbToRgb, random } from './math.js';

export function createDefaultDitherParams() {
  return {
    type: 'atkinson',
    threshold: 128,
    pixelSize: 2,
    invert: false,
    brightness: 1.0,
    contrast: 1.0,
    saturation: 1.0,
    hue: 0,
    fgColor: '#ffffff',
    bgColor: '#ffffff',
    useColor: true
  };
}

export function randomizeDithererOnly() {
  // legacyの実装は generators/randomizers.js 側で全エントリに対して行う。
  // ここでは互換のため最低限 current のみをランダム化する。
  const entry = State.currentSourceName ? State.sourceImages.find(e => e.name === State.currentSourceName) : null;
  if (!entry) return;

  entry.dither = entry.dither || { enabled: false, params: createDefaultDitherParams() };
  entry.dither.enabled = Math.random() > 0.15;
  const p = entry.dither.params;
  const types = ['atkinson', 'floydsteinberg', 'bayer', 'bayer8', 'pattern', 'simple', 'none'];
  p.type = types[Math.floor(Math.random() * types.length)];
  p.useColor = Math.random() > 0.3;
  p.invert = Math.random() > 0.8;
  p.threshold = Math.floor(random(80, 180));
  p.pixelSize = Math.floor(random(2, 6));
  p.fgColor = Math.random() > 0.5 ? '#000000' : '#333333';
}

export function ensureSourceImageLoaded(entry, cb) {

  if (entry.originalImg) {
    if (cb) cb();
    return;
  }

  if (window.incrementTask) window.incrementTask();

  // p5.js の loadImage を window 経由で使用
  window.loadImage(entry.path, (img) => {
    // 画像が大きすぎる場合はリサイズ
    if (img.width > MAX_DIM || img.height > MAX_DIM) {
      if (img.width > img.height) {
        img.resize(MAX_DIM, 0);
      } else {
        img.resize(0, MAX_DIM);
      }
    }
    entry.originalImg = img;
    // 必要であればここで初期サムネイルや表示用画像を生成する処理を追加（遅延生成でも可）
    if (window.decrementTask) window.decrementTask();
    if (cb) cb();
  });
}

function normalizeDitherType(type) {
  if (!type) return 'none';
  if (type === 'floyd' || type === 'floyd-steinberg') return 'floydsteinberg';
  if (type === 'bayer-8' || type === 'bayer_8') return 'bayer8';
  return type;
}

function clamp255(v) {
  return v < 0 ? 0 : (v > 255 ? 255 : v);
}

function getPatternBit(level, x, y) {
  // Clustered-dot order (4x4). level: 0..16 => number of white pixels.
  // We fill from center outward to create halftone-ish clusters.
  const order = [
    [1, 1], [2, 1], [1, 2], [2, 2],
    [1, 0], [2, 0], [0, 1], [3, 1],
    [0, 2], [3, 2], [1, 3], [2, 3],
    [0, 0], [3, 0], [0, 3], [3, 3]
  ];

  const cx = x & 3;
  const cy = y & 3;
  const onCount = Math.max(0, Math.min(16, Math.floor(level)));
  for (let i = 0; i < onCount; i++) {
    const p = order[i];
    if (p[0] === cx && p[1] === cy) return 1;
  }
  return 0;
}

export function applyDitherFilter(pg, type, threshold, useColor) {
  const t = normalizeDitherType(type);
  const w = pg.width;
  const h = pg.height;
  const pix = pg.pixels;

  if (t === 'pattern') {
    // Threshold acts as bias around 128 (lower threshold => brighter result).
    const bias = 128 - (Number(threshold) || 128);

    for (let i = 0; i < pix.length; i += 4) {
      if (pix[i + 3] < 128) {
        pix[i + 3] = 0;
        continue;
      }

      const x = (i / 4) % w;
      const y = Math.floor(i / 4 / w);

      if (useColor) {
        for (let c = 0; c < 3; c++) {
          const v0 = clamp255(pix[i + c] + bias);
          const level = Math.max(0, Math.min(16, Math.floor((v0 / 255) * 16 + 1e-9)));
          const bit = getPatternBit(level, x, y);
          pix[i + c] = bit ? 255 : 0;
        }
      } else {
        const gray0 = pix[i] * 0.299 + pix[i + 1] * 0.587 + pix[i + 2] * 0.114;
        const g = clamp255(gray0 + bias);
        const level = Math.max(0, Math.min(16, Math.floor((g / 255) * 16 + 1e-9)));
        const bit = getPatternBit(level, x, y);
        const out = bit ? 255 : 0;
        pix[i] = pix[i + 1] = pix[i + 2] = out;
      }

      pix[i + 3] = 255;
    }
    return;
  }

  if (t === 'simple' || t === 'bayer' || t === 'bayer8') {
    const bayerMap4 = [
      [1, 9, 3, 11],
      [13, 5, 15, 7],
      [4, 12, 2, 10],
      [16, 8, 14, 6]
    ];

    // Standard 8x8 Bayer matrix values in 0..63 range.
    // Note: we keep the same indexing style as the 4x4 map: map[x%N][y%N].
    const bayerMap8 = [
      [0, 48, 12, 60, 3, 51, 15, 63],
      [32, 16, 44, 28, 35, 19, 47, 31],
      [8, 56, 4, 52, 11, 59, 7, 55],
      [40, 24, 36, 20, 43, 27, 39, 23],
      [2, 50, 14, 62, 1, 49, 13, 61],
      [34, 18, 46, 30, 33, 17, 45, 29],
      [10, 58, 6, 54, 9, 57, 5, 53],
      [42, 26, 38, 22, 41, 25, 37, 21]
    ];

    for (let i = 0; i < pix.length; i += 4) {
      if (pix[i + 3] < 128) {
        pix[i + 3] = 0;
        continue;
      }

      const x = (i / 4) % w;
      const y = Math.floor(i / 4 / w);
      let offset = 0;
      if (t === 'bayer') {
        // Center around 8.5 to avoid a slight white bias (mean offset ~= 0)
        offset = (bayerMap4[x % 4][y % 4] - 8.5) * (255 / 16);
      } else if (t === 'bayer8') {
        // Center around 31.5 for 0..63 matrix (mean offset ~= 0)
        offset = (bayerMap8[x % 8][y % 8] - 31.5) * (255 / 64);
      }

      if (useColor) {
        pix[i] = (pix[i] + offset) < threshold ? 0 : 255;
        pix[i + 1] = (pix[i + 1] + offset) < threshold ? 0 : 255;
        pix[i + 2] = (pix[i + 2] + offset) < threshold ? 0 : 255;
      } else {
        const gray = pix[i] * 0.299 + pix[i + 1] * 0.587 + pix[i + 2] * 0.114;
        const v = (gray + offset) < threshold ? 0 : 255;
        pix[i] = pix[i + 1] = pix[i + 2] = v;
      }
      pix[i + 3] = 255;
    }
    return;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (x + y * w) * 4;
      if (pix[i + 3] < 128) {
        pix[i + 3] = 0;
        continue;
      }

      if (useColor) {
        for (let c = 0; c < 3; c++) {
          const oldP = pix[i + c];
          const newP = oldP < threshold ? 0 : 255;
          const err = oldP - newP;
          pix[i + c] = newP;
          distributeErrorColor(pix, x, y, w, h, err, t, c);
        }
      } else {
        const gray = pix[i] * 0.299 + pix[i + 1] * 0.587 + pix[i + 2] * 0.114;
        const newP = gray < threshold ? 0 : 255;
        const err = gray - newP;
        pix[i] = pix[i + 1] = pix[i + 2] = newP;
        distributeErrorColor(pix, x, y, w, h, err, t, -1);
      }
      pix[i + 3] = 255;
    }
  }
}

function distributeErrorColor(pix, x, y, w, h, err, type, channel) {
  const points = type === 'floydsteinberg'
    ? [
      { dx: 1, dy: 0, w: 7 / 16 },
      { dx: -1, dy: 1, w: 3 / 16 },
      { dx: 0, dy: 1, w: 5 / 16 },
      { dx: 1, dy: 1, w: 1 / 16 }
    ]
    : [
      { dx: 1, dy: 0, w: 1 / 8 },
      { dx: 2, dy: 0, w: 1 / 8 },
      { dx: -1, dy: 1, w: 1 / 8 },
      { dx: 0, dy: 1, w: 1 / 8 },
      { dx: 1, dy: 1, w: 1 / 8 },
      { dx: 0, dy: 2, w: 1 / 8 }
    ];

  for (const p of points) {
    const nx = x + p.dx;
    const ny = y + p.dy;
    if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
    const ni = (nx + ny * w) * 4;
    if (channel === -1) {
      pix[ni] += err * p.w;
      pix[ni + 1] += err * p.w;
      pix[ni + 2] += err * p.w;
    } else {
      pix[ni + channel] += err * p.w;
    }
  }
}

export function graphicsToDataUrl(pg, maxSide) {
  if (!pg || !pg.canvas) return '';
  const w = pg.width;
  const h = pg.height;
  const maxDim = Math.max(w, h); // windowスコープ外の場合はMathを使用
  if (!maxSide || maxDim <= maxSide) {
    return pg.canvas.toDataURL('image/png');
  }

  const scale = maxSide / maxDim;
  const tw = Math.max(1, Math.floor(w * scale));
  const th = Math.max(1, Math.floor(h * scale));
  const temp = window.createGraphics(tw, th);
  temp.pixelDensity(1);
  temp.noSmooth();
  if (temp.drawingContext) temp.drawingContext.imageSmoothingEnabled = false;
  temp.clear();
  temp.image(pg, 0, 0, tw, th);
  const data = temp.canvas.toDataURL('image/png');
  temp.remove(); // クリーンアップ
  return data;
}

function imageToDataUrl(img, maxSide) {
  if (!img) return '';
  const w0 = img.width;
  const h0 = img.height;
  const maxDim = Math.max(w0, h0);
  const scale = !maxSide || maxDim <= maxSide ? 1 : (maxSide / maxDim);
  const w = Math.max(1, Math.floor(w0 * scale));
  const h = Math.max(1, Math.floor(h0 * scale));
  const temp = window.createGraphics(w, h);
  temp.pixelDensity(1);
  temp.noSmooth();
  if (temp.drawingContext) temp.drawingContext.imageSmoothingEnabled = false;
  temp.clear();
  temp.image(img, 0, 0, w, h);
  const data = temp.canvas.toDataURL('image/png');
  temp.remove();
  return data;
}

export function reprocessSourceEntry(entry, cb) {
  if (!entry || !entry.originalImg) {
    if (cb) cb();
    return;
  }

  entry.dither = entry.dither || { enabled: false, params: createDefaultDitherParams() };

  if (!entry.dither.enabled) {
    entry.processedImg = entry.originalImg;
    // dither OFF でもグリッド/UI のためにプレビューは生成する
    entry.displayUrl = imageToDataUrl(entry.originalImg, 1024);
    entry.thumbUrl = imageToDataUrl(entry.originalImg, 96);
    if (cb) cb();
    return;
  }

  // アクティブタスクをインクリメント（インジケーター用）
  if (window.incrementTask) window.incrementTask();

  // UI更新を許可するために setTimeout を使用
  setTimeout(() => {
    internalReprocess(entry, cb);
    if (window.decrementTask) window.decrementTask();
  }, 10);
}

function internalReprocess(entry, cb) {
  const params = entry.dither && entry.dither.params ? entry.dither.params : createDefaultDitherParams();
  const pixelSize = Math.max(1, Math.floor(params.pixelSize || 1));

  const img = entry.originalImg;
  const sw0 = Math.floor(img.width / pixelSize);
  const sh0 = Math.floor(img.height / pixelSize);
  let sw = Math.max(1, sw0);
  let sh = Math.max(1, sh0);

  const maxDim = 1920;
  if (sw > maxDim || sh > maxDim) {
    const scale = maxDim / Math.max(sw, sh);
    sw = Math.floor(sw * scale);
    sh = Math.floor(sh * scale);
  }

  const temp = window.createGraphics(sw, sh);
  temp.pixelDensity(1);
  temp.noSmooth();
  if (temp.drawingContext) temp.drawingContext.imageSmoothingEnabled = false;
  temp.clear();
  temp.image(img, 0, 0, sw, sh);
  temp.loadPixels();

  for (let i = 0; i < temp.pixels.length; i += 4) {
    const a = temp.pixels[i + 3];
    if (a === 0) continue;

    let r = temp.pixels[i];
    let g = temp.pixels[i + 1];
    let b = temp.pixels[i + 2];

    r = (r - 128) * params.contrast + 128 * params.brightness;
    g = (g - 128) * params.contrast + 128 * params.brightness;
    b = (b - 128) * params.contrast + 128 * params.brightness;

    if (params.hue !== 0 || params.saturation !== 1.0) {
      let [h, s, v] = rgbToHsb(window.constrain(r, 0, 255), window.constrain(g, 0, 255), window.constrain(b, 0, 255));
      h = (h + params.hue + 360) % 360;
      s = window.constrain(s * params.saturation, 0, 1);
      [r, g, b] = hsbToRgb(h, s, v);
    }

    temp.pixels[i] = window.constrain(r, 0, 255);
    temp.pixels[i + 1] = window.constrain(g, 0, 255);
    temp.pixels[i + 2] = window.constrain(b, 0, 255);
  }

  if (params.type !== 'none') {
    applyDitherFilter(temp, params.type, params.threshold, params.useColor);
  }

  if (params.invert) {
    for (let i = 0; i < temp.pixels.length; i += 4) {
      if (temp.pixels[i + 3] === 0) continue;
      temp.pixels[i] = 255 - temp.pixels[i];
      temp.pixels[i + 1] = 255 - temp.pixels[i + 1];
      temp.pixels[i + 2] = 255 - temp.pixels[i + 2];
    }
  }

  if (!params.useColor) {
    const fg = window.color(params.fgColor || '#000000');
    const fr = window.red(fg);
    const fg_ = window.green(fg);
    const fb = window.blue(fg);

    for (let i = 0; i < temp.pixels.length; i += 4) {
      if (temp.pixels[i + 3] === 0) continue;
      const bVal = temp.pixels[i];
      // 黒（0）の部分をインク色にする
      temp.pixels[i] = fr;
      temp.pixels[i + 1] = fg_;
      temp.pixels[i + 2] = fb;
      // 元の明るさに応じてアルファ値を設定（黒いほど不透明）
      temp.pixels[i + 3] = (255 - bVal);
    }
  }

  temp.updatePixels();

  entry.processedImg = temp.get();
  entry.displayUrl = graphicsToDataUrl(temp, 1024);
  entry.thumbUrl = graphicsToDataUrl(temp, 96);

  temp.remove(); // クリーンアップ

  if (cb) cb();
}
