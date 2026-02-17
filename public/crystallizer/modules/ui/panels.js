import { State } from '../state.js';
import { createLabeledSliderRef } from './controls.js';
import { ensureSourceImageLoaded, reprocessSourceEntry, createDefaultDitherParams } from '../core/dither.js';
import { sortPointsClockwise, hash01 } from '../core/math.js';
import { renderComposite } from '../core/render.js';
import { randomizeBackgroundImageFromBgPool } from '../generators/randomizers.js';

// UI Reference Storage for Sync
const UIr = {
  tone: {},
  dither: {},
  thumbs: null,
  transformBtn: null,
  transformBtnGenerate: null,
  alphaBtn: null,
  syncAlphaBtn: null,
  sendNameInput: null,
  sendMessageInput: null
};

// ARRANGE hue range: keep global hue shifts subtle.
const TONE_HUE_MIN = -60;
const TONE_HUE_MAX = 60;
function clampToneHue(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(TONE_HUE_MIN, Math.min(TONE_HUE_MAX, Math.round(n)));
}

function getUsedFaceImageNames() {
  const namesWithImage = new Set();
  const namesWithNameOnly = new Set();

  (State.faces || []).forEach((f) => {
    if (!f || !f.imageName) return;
    namesWithNameOnly.add(f.imageName);
    if (f.image) namesWithImage.add(f.imageName);
  });

  // Prefer faces that are actually rendered (have image loaded)
  return namesWithImage.size > 0 ? namesWithImage : namesWithNameOnly;
}

function cancelImagePlacing() {
  if (!State.isImagePlacing) return;
  State.isImagePlacing = false;
  State.placingImg = null;
  State.placingImgName = '';
  State.pendingImagePlaceFace = null;
  State.needsCompositeUpdate = true;
  refreshThumbnails();
}
window.cancelImagePlacing = cancelImagePlacing;

// Sync Active State
export function syncTransformButton() {
  const buttons = [UIr.transformBtn, UIr.transformBtnGenerate].filter(Boolean);
  buttons.forEach((btn) => {
    if (State.frameFreeTransform) btn.addClass('active');
    else btn.removeClass('active');
  });
}
// Backward-compat shims
window.syncTransformButton = syncTransformButton;
window.syncFramesToggleButton = syncTransformButton;

// 1. Controls Panel
export function initControlsPanel(container) {

  // SOURCEサムネ/ドロップゾーン以外を押したら「画像配置モード」を解除
  // （ボタン操作や余白クリックで解除したい）
  if (container?.elt) {
    container.elt.addEventListener('pointerdown', (e) => {
      const t = e?.target;
      if (!t) return;
      if (t.closest?.('.thumb-item') || t.closest?.('.thumb-remove') || t.closest?.('.drop-zone-large')) return;
      cancelImagePlacing();
    }, true);
  }

  // --- GENERATE SECTION ---
  createSection(container, 'GENERATE');
  const genContent = window.createDiv('').addClass('operation-content').parent(container);
  const row1 = window.createDiv('').addClass('generate-row').parent(genContent);

  const cryBtn = window.createButton('✨️ CRYSTALIZE ✨️').parent(row1);
  cryBtn.addClass('btn-blue');
  cryBtn.mousePressed(() => {
    cancelImagePlacing();
    if (window.randomizeCrystalize) window.randomizeCrystalize();
  });

  const toggleTransformMode = () => {
    cancelImagePlacing();
    State.frameFreeTransform = !State.frameFreeTransform;
    State.frameTransformAll = State.frameFreeTransform;
    State.frameTransform = null;

    if (State.frameFreeTransform) {
      const faces = (State.faces || []).filter((f) => f && f.points && f.points.length >= 3);
      State.selectedFaces = faces;
      State.selectedFace = faces.length ? faces[faces.length - 1] : null;
    }

    syncTransformButton();
    State.needsCompositeUpdate = true;
  };

  const rndImgBtn = window.createButton('RND IMG').parent(row1);
  rndImgBtn.addClass('btn-square');
  rndImgBtn.addClass('rnd-img-btn');
  rndImgBtn.mousePressed(() => {
    cancelImagePlacing();
    if (window.randomizeFrameImages) window.randomizeFrameImages();
    else if (window.randomizeAll) window.randomizeAll();
  });

  const rndBgBtn = window.createButton('RND BG').parent(row1);
  rndBgBtn.addClass('btn-square');
  rndBgBtn.mousePressed(() => {
    cancelImagePlacing();
    if (window.randomizeBackgroundImageFromBgPool) window.randomizeBackgroundImageFromBgPool();
  });

  const distortBtn = window.createButton('DISTORT').parent(row1);
  distortBtn.addClass('btn-square');
  distortBtn.mousePressed(() => {
    cancelImagePlacing();
    runDistort();
  });

  // SPでは ARRANGE セクション自体を隠しているため、GENERATE列にTRANSFORMを用意する
  const transGenBtn = window.createButton('TRANSFORM').parent(row1);
  transGenBtn.addClass('btn-square');
  transGenBtn.addClass('generate-transform-btn');
  UIr.transformBtnGenerate = transGenBtn;
  syncTransformButton();
  transGenBtn.mousePressed(toggleTransformMode);

  // --- ARRANGE SECTION ---
  createSection(container, 'ARRANGE');
  const arrContent = window.createDiv('').addClass('operation-content arrange').parent(container);
  const arrRow = window.createDiv('').addClass('arrange-row').parent(arrContent);

  const slidersCol = window.createDiv('').addClass('sliders-col').parent(arrRow);
  initToneSliders(slidersCol);

  const transCol = window.createDiv('').addClass('transform-col').parent(arrRow);
  const transBtn = window.createButton('TRANSFORM').parent(transCol);
  transBtn.addClass('transform-btn');
  UIr.transformBtn = transBtn;
  syncTransformButton();

  transBtn.mousePressed(() => {
    toggleTransformMode();
  });

  // --- SOURCE IMAGE SECTION ---
  createSection(container, 'SOURCE IMAGE');
  const srcContent = window.createDiv('').addClass('operation-content').parent(container);
  srcContent.style('height', '100%');
  const srcRow = window.createDiv('').addClass('source-row').parent(srcContent);

  const thumbsCol = window.createDiv('').addClass('thumbs-col').parent(srcRow);
  UIr.thumbs = thumbsCol;
  refreshThumbnails();

  const actionsCol = window.createDiv('').addClass('source-actions').parent(srcRow);

  const dropZone = window.createDiv('DROP IMG').parent(actionsCol);
  dropZone.addClass('drop-zone-large');
  setupDropZone(dropZone);

  const clearBtn = window.createButton('CLEAR ALL').parent(actionsCol);
  clearBtn.addClass('source-clear-btn');
  clearBtn.mousePressed(() => {
    cancelImagePlacing();
    clearAllSourceImages();
  });
}

let ditApplyTimer = 0;
function scheduleApplyDitAdjust() {
  if (ditApplyTimer) window.clearTimeout(ditApplyTimer);
  // Debounce so dragging doesn't reprocess constantly
  ditApplyTimer = window.setTimeout(() => {
    ditApplyTimer = 0;
    applyDitAdjustToUsedFrames();
  }, 200);
}

export function syncDitBaselineForUsedFrames() {
  const allEntries = Array.isArray(State.sourceImages) ? State.sourceImages : [];
  if (allEntries.length === 0) return;

  const usedNames = getUsedFaceImageNames();
  if (usedNames.size === 0) return;

  const baseDefaults = createDefaultDitherParams();
  allEntries.forEach((entry) => {
    if (!entry || !usedNames.has(entry.name)) return;
    entry.dither = entry.dither || { enabled: false, params: createDefaultDitherParams() };
    entry.dither.params = entry.dither.params || createDefaultDitherParams();
    entry.dither.baseParams = { ...baseDefaults, ...entry.dither.params };
    entry.dither.baseEnabled = !!entry.dither.enabled;
  });
}
window.syncDitBaselineForUsedFrames = syncDitBaselineForUsedFrames;

// Crystalize用: DITスライダーだけを0に戻す（ditherの再処理はしない）
export function resetDitToCenterSilently() {
  if (ditApplyTimer) {
    window.clearTimeout(ditApplyTimer);
    ditApplyTimer = 0;
  }

  State.globalDitherAdjust = State.globalDitherAdjust || {};
  State.globalDitherAdjust.dit = 0;
  if (UIr.dither.dit) UIr.dither.dit.setValueSilently(0);
}
window.resetDitToCenterSilently = resetDitToCenterSilently;

export function resetArrangeSlidersToDefault() {
  if (ditApplyTimer) {
    window.clearTimeout(ditApplyTimer);
    ditApplyTimer = 0;
  }

  State.crystalTone = {
    enabled: true,
    hue: 0,
    saturation: 1.0,
    brightness: 1.0,
    contrast: 1.0
  };
  State.crystalTone.enabled = true;

  State.globalDitherAdjust = State.globalDitherAdjust || {};
  const prevDit = Number(State.globalDitherAdjust.dit ?? 0);
  State.globalDitherAdjust.dit = 0;

  if (UIr.tone.hue) UIr.tone.hue.setValueSilently(0);
  if (UIr.tone.saturation) UIr.tone.saturation.setValueSilently(1.0);
  if (UIr.tone.brightness) UIr.tone.brightness.setValueSilently(1.0);
  if (UIr.tone.contrast) UIr.tone.contrast.setValueSilently(1.0);
  if (UIr.dither.dit) UIr.dither.dit.setValueSilently(0);

  // DITが非0だった場合のみ、使用中フレームのparamsをベースへ戻して再処理する
  // ※ enabledは触らない（Crystalizeでエフェクトが消えた感を防ぐ）
  if (Math.abs(prevDit) >= 1e-6) {
    const allEntries = Array.isArray(State.sourceImages) ? State.sourceImages : [];
    const usedNames = getUsedFaceImageNames();
    const entries = allEntries.filter((e) => e && usedNames.has(e.name));
    const baseDefaults = createDefaultDitherParams();

    entries.forEach((entry) => {
      entry.dither = entry.dither || { enabled: false, params: createDefaultDitherParams() };
      entry.dither.params = entry.dither.params || createDefaultDitherParams();

      if (entry.dither.baseParams) {
        entry.dither.params = { ...baseDefaults, ...entry.dither.baseParams };
      } else {
        entry.dither.baseParams = { ...baseDefaults, ...entry.dither.params };
        entry.dither.baseEnabled = !!entry.dither.enabled;
      }
    });

    let i = 0;
    const refreshUI = () => {
      if (window.updateImageGrid) window.updateImageGrid();
      if (window.updatePanelUI) window.updatePanelUI();
    };

    const step = () => {
      if (i >= entries.length) {
        State.needsCompositeUpdate = true;
        refreshUI();
        return;
      }

      const entry = entries[i++];
      ensureSourceImageLoaded(entry, () => {
        reprocessSourceEntry(entry, () => {
          if (entry.name === State.currentSourceName) {
            State.currentSourceImg = entry.processedImg || entry.originalImg;
            State.currentSourcePath = entry.displayUrl || entry.path;
          }
          State.needsCompositeUpdate = true;
          if (i % 2 === 0) refreshUI();
          window.setTimeout(step, 0);
        });
      });
    };

    if (entries.length > 0) {
      step();
      return;
    }
  }

  State.needsCompositeUpdate = true;
}
window.resetArrangeSlidersToDefault = resetArrangeSlidersToDefault;

export function randomizeArrangeSliders() {
  State.crystalTone = State.crystalTone || { enabled: true, hue: 0, saturation: 1.0, brightness: 1.0, contrast: 1.0 };
  State.crystalTone.enabled = true;

  // Keep ranges modest so it feels like "ARRANGE moved" rather than a full re-roll.
  const rand = (min, max) => min + Math.random() * (max - min);
  State.crystalTone.hue = clampToneHue(rand(TONE_HUE_MIN, TONE_HUE_MAX));
  State.crystalTone.saturation = Number(rand(0.75, 1.85).toFixed(2));
  State.crystalTone.brightness = Number(rand(0.85, 1.80).toFixed(2));
  State.crystalTone.contrast = Number(rand(0.85, 1.85).toFixed(2));

  if (UIr.tone.hue) UIr.tone.hue.setValueSilently(State.crystalTone.hue);
  if (UIr.tone.saturation) UIr.tone.saturation.setValueSilently(State.crystalTone.saturation);
  if (UIr.tone.brightness) UIr.tone.brightness.setValueSilently(State.crystalTone.brightness);
  if (UIr.tone.contrast) UIr.tone.contrast.setValueSilently(State.crystalTone.contrast);

  State.needsCompositeUpdate = true;
}
window.randomizeArrangeSliders = randomizeArrangeSliders;

function ensureDitherBase(entry) {
  entry.dither = entry.dither || { enabled: false, params: createDefaultDitherParams() };
  entry.dither.params = entry.dither.params || createDefaultDitherParams();
  if (!entry.dither.baseParams) {
    // 単純な params オブジェクトを「ベースライン」として保持（浅いコピーで十分）
    entry.dither.baseParams = { ...createDefaultDitherParams(), ...entry.dither.params };
    entry.dither.baseEnabled = !!entry.dither.enabled;
  }
  return entry.dither.baseParams;
}

function applyDitAdjustToUsedFrames() {
  const allEntries = Array.isArray(State.sourceImages) ? State.sourceImages : [];
  if (allEntries.length === 0) return;

  const usedNames = getUsedFaceImageNames();
  if (usedNames.size === 0) return;

  const entries = allEntries.filter((e) => e && usedNames.has(e.name));
  if (entries.length === 0) return;

  State.globalDitherAdjust = State.globalDitherAdjust || { dit: 0 };
  const dit = Math.max(-1, Math.min(1, Number(State.globalDitherAdjust.dit ?? 0)));
  const baseDefaults = createDefaultDitherParams();

  const clampInt = (v, min, max) => Math.max(min, Math.min(max, Math.round(v)));
  const clampFloat = (v, min, max) => Math.max(min, Math.min(max, Number(v)));

  const refreshUI = () => {
    if (window.updateImageGrid) window.updateImageGrid();
    if (window.updatePanelUI) window.updatePanelUI();
  };

  // 中央（DIT=0）は「現状をベースラインとして更新」する。
  // ここで基準値を更新しておくと、左右に振った時の変化が「現在の状態からの相対」になる。
  //（何も変わらない時は再処理しない）
  if (Math.abs(dit) < 1e-6) {
    entries.forEach((entry) => {
      if (!entry) return;
      entry.dither = entry.dither || { enabled: false, params: createDefaultDitherParams() };
      entry.dither.params = entry.dither.params || createDefaultDitherParams();
      entry.dither.baseParams = { ...baseDefaults, ...entry.dither.params };
      entry.dither.baseEnabled = !!entry.dither.enabled;
      // 左端で強制OFFしていた履歴があれば、ベースライン更新時に解除状態として扱う
      if (entry.dither.offByDit) {
        entry.dither.offByDit = false;
        delete entry.dither.prevEnabledBeforeDitOff;
      }
    });
    State.needsCompositeUpdate = true;
    refreshUI();
    return;
  }

  // 左端（DIT=-1付近）は「使用中フレームのディザーを強制OFF」にする。
  // その際、元の enabled 状態を保持して、左端から戻した時に復元できるようにする。
  const forceOff = dit <= -0.999;

  let i = 0;
  const step = () => {
    if (i >= entries.length) {
      State.needsCompositeUpdate = true;
      refreshUI();
      return;
    }

    const entry = entries[i++];
    if (!entry) {
      window.setTimeout(step, 0);
      return;
    }

    const baseP = { ...baseDefaults, ...ensureDitherBase(entry) };
    // 左端では強制OFF
    if (forceOff) {
      if (!entry.dither.offByDit) {
        entry.dither.offByDit = true;
        entry.dither.prevEnabledBeforeDitOff = !!entry.dither.enabled;
      }
      entry.dither.enabled = false;
      // OFF中は params をベースラインで固定（スライダー操作の副作用で値がズレないように）
      entry.dither.params = { ...baseP };

      ensureSourceImageLoaded(entry, () => {
        reprocessSourceEntry(entry, () => {
          if (entry.name === State.currentSourceName) {
            State.currentSourceImg = entry.processedImg || entry.originalImg;
            State.currentSourcePath = entry.displayUrl || entry.path;
          }

          (State.faces || []).forEach((face) => {
            if (!face) return;
            if (face.imageName === entry.name) {
              face.image = entry.processedImg || entry.originalImg;
            }
          });

          State.needsCompositeUpdate = true;
          if (i % 2 === 0) refreshUI();
          window.setTimeout(step, 0);
        });
      });
      return;
    }

    // 以前に左端で強制OFFしていた場合、左端から離れたタイミングで enabled を復元する
    if (entry.dither.offByDit) {
      entry.dither.offByDit = false;
      const restore =
        entry.dither.prevEnabledBeforeDitOff ??
        entry.dither.baseEnabled ??
        true;
      entry.dither.enabled = !!restore;
      delete entry.dither.prevEnabledBeforeDitOff;
    }

    // DIT は「強度/粒度の調整」が主目的で、ON/OFF を勝手に切り替えない（左端強制OFFを除く）
    const curEnabled = !!entry.dither.enabled;

    // エントリごとに安定した揺らぎを入れて、全体が同じ見た目に収束しないようにする
    const r0 = hash01(entry.name);
    const r1 = hash01(entry.name + '|b');
    const r2 = hash01(entry.name + '|c');
    const abs = Math.abs(dit);
    const jThr = (r0 * 2 - 1) * (18 * abs);
    const jPix = (r1 * 2 - 1) * (3 * abs);
    // Hue は色ズレとして強く見えるので、揺らぎは控えめにする
    const jHue = (r2 * 2 - 1) * (6 * abs);

    const next = { ...baseP };

    // DIT をスイープした時に収束しないよう、係数もエントリごとに少し変える
    const sA = 0.85 + r0 * 0.3; // 0.85..1.15
    const sB = 0.85 + r1 * 0.3;
    const baseThr = Number(baseP.threshold ?? 128);
    const basePx = Math.max(1, Number(baseP.pixelSize ?? 2));
    const baseCon = Number(baseP.contrast ?? 1.0);
    const baseBri = Number(baseP.brightness ?? 1.0);
    const baseSat = Number(baseP.saturation ?? 1.0);
    const baseHue = Number(baseP.hue ?? 0);

    if (dit < 0) {
      // ベースラインから相対的に弱める（共通のニュートラル値へ無理に寄せない）
      const t = -dit; // 0..1
      const wThr = 1 - t * (0.70 * sB);
      const wCol = 1 - t * (0.55 * sA);

      next.threshold = clampInt(128 + (baseThr - 128) * wThr + jThr, 0, 255);
      next.pixelSize = clampInt(basePx * (1 - t * (0.65 * sA)) + jPix, 1, 24);
      next.contrast = clampFloat(1 + (baseCon - 1) * wCol, 0.3, 2.2);
      next.brightness = clampFloat(1 + (baseBri - 1) * (1 - t * (0.35 * sB)), 0.3, 2.2);
      next.saturation = clampFloat(1 + (baseSat - 1) * (1 - t * (0.55 * sA)), 0.0, 3.0);
      next.hue = clampInt(baseHue * (1 - t * (0.60 * sB)) + jHue, -180, 180);

      // Preserve on/off state
      entry.dither.enabled = curEnabled;
      entry.dither.params = next;
    } else {
      // Strengthen relative to baseline; still keep relative differences.
      const t = dit; // 0..1
      const kThr = 1 + t * (0.95 * sB);
      const kCol = 1 + t * (0.80 * sA);
      // Extra kick when strengthening: keep it subtle.
      const hueKick = (r2 * 2 - 1) * (8 * t);

      next.threshold = clampInt(128 + (baseThr - 128) * kThr + jThr, 0, 255);
      next.pixelSize = clampInt(basePx * (1 + t * (1.80 * sA)) + jPix, 1, 24);
      next.contrast = clampFloat(1 + (baseCon - 1) * kCol, 0.3, 2.2);
      next.brightness = clampFloat(1 + (baseBri - 1) * (1 + t * (0.35 * sB)), 0.3, 2.2);
      next.saturation = clampFloat(1 + (baseSat - 1) * (1 + t * (0.55 * sA)), 0.0, 3.0);
      next.hue = clampInt(baseHue + hueKick + jHue, -180, 180);

      entry.dither.enabled = curEnabled;
      entry.dither.params = next;
    }

    ensureSourceImageLoaded(entry, () => {
      reprocessSourceEntry(entry, () => {
        // Update current source preview
        if (entry.name === State.currentSourceName) {
          State.currentSourceImg = entry.processedImg || entry.originalImg;
          State.currentSourcePath = entry.displayUrl || entry.path;
        }

        // Update any frames using this image
        (State.faces || []).forEach((face) => {
          if (!face) return;
          if (face.imageName === entry.name) {
            face.image = entry.processedImg || entry.originalImg;
          }
        });

        State.needsCompositeUpdate = true;
        if (i % 2 === 0) refreshUI();
        window.setTimeout(step, 0);
      });
    });
  };

  step();
}

// Download is typically at the bottom. 
// We will export initDownloadPanel and call it from layout.js for the bottom area.

export function initDownloadPanel(container) {
  const col = window.createDiv('').addClass('footer-col').parent(container);
  const row = window.createDiv('').addClass('footer-row-inner').parent(col);

  const dlBtn = window.createDiv('DOWNLOAD').parent(row);
  dlBtn.addClass('download-section');
  dlBtn.mousePressed(() => {
    cancelImagePlacing();
    runDownload();
  });

  // name/message inputs (below buttons)
  const meta = window.createDiv('').addClass('footer-meta').parent(col);
  const rememberedName = (() => {
    try { return localStorage.getItem('crystalizer.send.name') || ''; } catch { return ''; }
  })();

  const nameInput = window.createInput(rememberedName);
  nameInput.addClass('send-input');
  nameInput.attribute('placeholder', 'name');
  nameInput.parent(meta);

  const msgInput = window.createElement('textarea', '');
  msgInput.addClass('send-textarea');
  msgInput.attribute('placeholder', 'message');
  msgInput.parent(meta);

  const sendBtn = window.createButton('SEND').parent(col);
  sendBtn.addClass('send-btn');
  sendBtn.elt.setAttribute('title', 'Send the current image to Sanity');
  sendBtn.mousePressed(async () => {
    cancelImagePlacing();
    const originalLabel = sendBtn.elt.textContent;
    sendBtn.elt.textContent = 'SENDING…';
    sendBtn.elt.disabled = true;
    try {
      const name = (UIr.sendNameInput?.value?.() ?? UIr.sendNameInput?.elt?.value ?? '').trim();
      const message = (UIr.sendMessageInput?.value?.() ?? UIr.sendMessageInput?.elt?.value ?? '').trim();

      // Remember name locally for convenience
      try {
        if (name) localStorage.setItem('crystalizer.send.name', name);
      } catch { }

      const res = await window.sendToSanityFromCanvas?.({ name, message });
      if (res?.ok) sendBtn.elt.textContent = 'SENT';
      else sendBtn.elt.textContent = 'FAILED';
      window.setTimeout(() => {
        sendBtn.elt.textContent = originalLabel;
        sendBtn.elt.disabled = false;
      }, 1200);
    } catch (err) {
      console.error(err);
      sendBtn.elt.textContent = 'FAILED';
      window.setTimeout(() => {
        sendBtn.elt.textContent = originalLabel;
        sendBtn.elt.disabled = false;
      }, 1200);
    }
  });

  UIr.sendNameInput = nameInput;
  UIr.sendMessageInput = msgInput;

  // SP: place Back button under SEND
  const backBtn = window.createButton('BACK').parent(col);
  backBtn.addClass('send-btn');
  backBtn.addClass('back-to-gallery-btn');
  backBtn.elt.setAttribute('title', 'Back to gallery');
  backBtn.mousePressed(() => {
    cancelImagePlacing();
    try {
      window.location.href = '/crystallizer/';
    } catch {
      // noop
    }
  });

  const bgBtn = window.createButton('ALPHA').parent(row);
  bgBtn.addClass('download-toggle');

  const syncBgBtn = () => {
    const on = !!State.transparentBg;
    if (on) bgBtn.addClass('active');
    else bgBtn.removeClass('active');
    bgBtn.elt.setAttribute('aria-pressed', String(on));
  };
  syncBgBtn();

  UIr.alphaBtn = bgBtn;
  UIr.syncAlphaBtn = syncBgBtn;

  bgBtn.mousePressed(() => {
    cancelImagePlacing();
    State.transparentBg = !State.transparentBg;
    State.needsCompositeUpdate = true;
    syncBgBtn();
  });
}

export function syncAlphaButton() {
  if (typeof UIr.syncAlphaBtn === 'function') UIr.syncAlphaBtn();
}
window.syncAlphaButton = syncAlphaButton;

// --- Helpers ---

function createSection(parent, text) {
  const h = window.createDiv('').addClass('section-header '+String(text).toLowerCase()).parent(parent);
  window.createDiv(text).addClass('section-label').parent(h);
  h.style('height', '40px');
}

function initToneSliders(parent) {
  // Init State if missing
  State.crystalTone = State.crystalTone || { enabled: true, brightness: 1.0, contrast: 1.0, saturation: 1.0, hue: 0 };
  State.crystalTone.enabled = true;

  // Clamp any legacy/stale value before binding UI
  State.crystalTone.hue = clampToneHue(State.crystalTone.hue ?? 0);

  UIr.tone.hue = createLabeledSliderRef(parent, 'HUE', TONE_HUE_MIN, TONE_HUE_MAX, State.crystalTone.hue || 0, 1, (v) => {
    State.crystalTone.hue = clampToneHue(v);
    State.needsCompositeUpdate = true;
  });
  UIr.tone.saturation = createLabeledSliderRef(parent, 'SAT', 0.0, 2.0, State.crystalTone.saturation ?? 1.0, 0.01, (v) => {
    State.crystalTone.saturation = Number(v);
    State.needsCompositeUpdate = true;
  });
  UIr.tone.brightness = createLabeledSliderRef(parent, 'BRI', 0.0, 2.0, State.crystalTone.brightness ?? 1.0, 0.01, (v) => {
    State.crystalTone.brightness = Number(v);
    State.needsCompositeUpdate = true;
  });
  UIr.tone.contrast = createLabeledSliderRef(parent, 'CON', 0.0, 2.0, State.crystalTone.contrast ?? 1.0, 0.01, (v) => {
    State.crystalTone.contrast = Number(v);
    State.needsCompositeUpdate = true;
  });

  // Dither strength (DIT): center = current, left = OFF, right = stronger
  State.globalDitherAdjust = State.globalDitherAdjust || { dit: 0 };
  const clampDit = (v) => Math.max(-1, Math.min(1, Number(v)));
  UIr.dither.dit = createLabeledSliderRef(parent, 'DIT', -1.0, 1.0, clampDit(State.globalDitherAdjust.dit ?? 0), 0.01, (v) => {
    State.globalDitherAdjust.dit = clampDit(v);
    scheduleApplyDitAdjust();
  });
}

function runDistort() {
  const amount = 10;
  const distortFace = (face) => {
    if (!face || !face.points || face.points.length < 3) return;
    for (const pt of face.points) {
      pt.x = window.constrain(pt.x + window.random(-amount, amount), 0, window.width);
      pt.y = window.constrain(pt.y + window.random(-amount, amount), 0, window.height);
    }
    face.points = sortPointsClockwise(face.points);
  };
  (State.faces || []).forEach((f) => distortFace(f));
  if (State.activeFace) distortFace(State.activeFace);
  State.needsCompositeUpdate = true;
}
window.runDistort = runDistort;

function runDownload() {
  const pg = State.layers.composite;
  if (!pg || !pg.canvas) return;
  const filename = `crystallizer_${Date.now()}.png`;
  const a = document.createElement('a');
  a.href = pg.canvas.toDataURL('image/png');
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  State.needsCompositeUpdate = true;
}

async function sendToSanityFromCanvas(meta = {}) {
  const pg = State.layers.composite;
  if (!pg || !pg.canvas) return { ok: false, error: 'No composite canvas' };

  const prevTransparentBg = !!State.transparentBg;

  // If BG is not set, pick a random BG (and wait for the image to load) before exporting.
  if (!State.canvasBgImg && Array.isArray(State.bgImages) && State.bgImages.length > 0) {
    await new Promise((resolve) => {
      randomizeBackgroundImageFromBgPool({ onDone: () => resolve(true) });
    });
  }

  const captureCompositePngBlob = async () => {
    // Ensure composite is up-to-date at the moment of capture.
    if (State.needsCompositeUpdate) {
      try { renderComposite(); } catch { }
    }

    const blob = await new Promise((resolve) => {
      try {
        pg.canvas.toBlob((b) => resolve(b), 'image/png');
      } catch {
        resolve(null);
      }
    });

    const makeBlobFallback = async () => {
      try {
        const dataUrl = pg.canvas.toDataURL('image/png');
        const r = await fetch(dataUrl);
        const b = await r.blob();
        return b && b.size > 0 ? b : null;
      } catch {
        return null;
      }
    };

    const finalBlob = (blob && blob.size > 0) ? blob : await makeBlobFallback();
    if (!finalBlob) return null;

    // Normalize to an explicit PNG blob (some runtimes may produce a Blob with empty/odd type)
    try {
      const ab = await finalBlob.arrayBuffer();
      return new Blob([ab], { type: 'image/png' });
    } catch {
      return finalBlob;
    }
  };

  // 1) Background export (force transparentBg=false temporarily)
  State.transparentBg = false;
  State.needsCompositeUpdate = true;
  try { renderComposite(); } catch { }
  const pngBlob = await captureCompositePngBlob();
  if (!pngBlob) return { ok: false, error: 'Failed to create PNG blob' };

  // 2) Transparent export (force transparentBg=true temporarily)
  State.transparentBg = true;
  State.needsCompositeUpdate = true;
  const pngTransparentBlob = await captureCompositePngBlob();
  State.transparentBg = prevTransparentBg;
  State.needsCompositeUpdate = true;
  try { renderComposite(); } catch { }

  if (!pngTransparentBlob) return { ok: false, error: 'Failed to create transparent PNG blob' };

  // Lightweight diagnostics (helps debug "Invalid image" from Sanity)
  try {
    const head = new Uint8Array(await pngBlob.slice(0, 16).arrayBuffer());
    const hex = Array.from(head).map((b) => b.toString(16).padStart(2, '0')).join(' ');
    console.log('[SEND] blob', { size: pngBlob.size, type: pngBlob.type, headHex: hex });
  } catch { }
  try {
    const head = new Uint8Array(await pngTransparentBlob.slice(0, 16).arrayBuffer());
    const hex = Array.from(head).map((b) => b.toString(16).padStart(2, '0')).join(' ');
    console.log('[SEND] transparent blob', { size: pngTransparentBlob.size, type: pngTransparentBlob.type, headHex: hex });
  } catch { }

  const ts = Date.now();
  const filename = `crystallizer_${ts}.png`;
  const filenameTransparent = `crystallizer_${ts}_transparent.png`;
  const fd = new FormData();
  fd.append('file', pngBlob, filename);
  fd.append('fileTransparent', pngTransparentBlob, filenameTransparent);
  fd.append('title', filename.replace(/\.png$/i, ''));
  if (meta?.date) fd.append('date', String(meta.date));
  if (meta?.externalId) fd.append('id', String(meta.externalId));
  if (meta?.name) fd.append('name', String(meta.name));
  if (meta?.message) fd.append('message', String(meta.message));

  const res = await fetch('/api/crystallizer/upload', {
    method: 'POST',
    body: fd
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const step = json?.step;
    const status = json?.status || res.status;
    const msg =
      json?.error ||
      json?.response?.message ||
      json?.response?.error?.description ||
      json?.responseText ||
      'Unknown error';

    console.error('Sanity upload failed', { status, step, json });
    try {
      window.alert(`UPLOAD FAILED\nstatus: ${status}${step ? `\nstep: ${step}` : ''}\n${msg}`);
    } catch { }

    return { ok: false, status, step, response: json };
  }
  console.log('Sanity upload ok', json);
  return json;
}
window.sendToSanityFromCanvas = sendToSanityFromCanvas;

function setupDropZone(dropZone) {
  const fileInput = window.createFileInput((file) => handleFileSelect(file), true);
  fileInput.parent(dropZone.parent()); // Attach somewhere invisible

  // iOS Safari can block programmatic .click() on <input type="file"> if it's display:none.
  // Keep it visually hidden but present.
  try {
    fileInput.style('position', 'fixed');
    fileInput.style('left', '-9999px');
    fileInput.style('top', '0');
    fileInput.style('width', '1px');
    fileInput.style('height', '1px');
    fileInput.style('opacity', '0');
    fileInput.style('pointer-events', 'none');
  } catch { }

  const openPicker = (e) => {
    try { e?.preventDefault?.(); } catch { }
    try { e?.stopPropagation?.(); } catch { }
    // Must be directly in a user gesture.
    try { fileInput.elt.click(); } catch { }
  };

  // p5's mousePressed can be flaky on some mobile browsers; use DOM events too.
  dropZone.mousePressed(() => openPicker());
  try {
    dropZone.elt.addEventListener('pointerdown', openPicker, { passive: false });
    dropZone.elt.addEventListener('click', openPicker, { passive: false });
  } catch { }

  const el = dropZone.elt;
  el.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style('background', '#b0b0b0'); });
  el.addEventListener('dragleave', () => { dropZone.style('background', '#d9d9d9'); });
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style('background', '#d9d9d9');
    const files = Array.from(e.dataTransfer?.files || []).filter(f => String(f.type || '').startsWith('image/'));
    if (files.length > 0) handleRawFiles(files);
  });
}

function handleFileSelect(p5File) {
  if (!p5File) return;

  const looksLikeImageName = (name) => {
    const n = String(name || '').toLowerCase();
    return /\.(png|jpe?g|gif|webp|avif|heic|heif)$/i.test(n);
  };

  const isImageLike = () => {
    const t = String(p5File.type || '').toLowerCase();
    // p5.File sometimes provides type="image" + subtype="jpeg" (not a full mime).
    if (t === 'image') return true;
    if (t.startsWith('image/')) return true;
    // Some mobile browsers may not provide a reliable mime type.
    if (!t && looksLikeImageName(p5File.name)) return true;
    return false;
  };

  if (!isImageLike()) return;

  // Prefer the original File object when available.
  if (p5File.file) {
    addLocalSource(p5File.file);
    return;
  }

  // Fallback: some runtimes only provide data URL.
  const data = String(p5File.data || '');
  if (data.startsWith('data:image/')) {
    try {
      const [meta, b64] = data.split(',');
      const mime = (meta.match(/data:([^;]+)/)?.[1]) || 'image/png';
      const bin = atob(b64 || '');
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      const name = p5File.name || `local_${Date.now()}`;
      const file = new File([blob], name, { type: mime });
      addLocalSource(file);
    } catch { }
  }
}

function handleRawFile(file) {
  addLocalSource(file);
}

function handleRawFiles(files) {
  (files || []).forEach((f) => {
    if (!f || !String(f.type || '').startsWith('image/')) return;
    addLocalSource(f);
  });
}

function removeSourceEntry(entry) {
  if (!entry) return;

  // remove from list
  State.sourceImages = (State.sourceImages || []).filter(e => e !== entry);

  // revoke local blob
  if (entry.isLocal && entry.path && typeof entry.path === 'string' && entry.path.startsWith('blob:')) {
    try { URL.revokeObjectURL(entry.path); } catch { }
  }

  // if current removed, pick next
  if (State.currentSourceName === entry.name) {
    const next = (State.sourceImages || [])[0] || null;
    if (next) {
      State.currentSourceName = next.name;
      State.currentSourcePath = next.path;
      ensureSourceImageLoaded(next, () => {
        State.currentSourceImg = next.processedImg || next.originalImg;
        State.needsCompositeUpdate = true;
        refreshThumbnails();
      });
    } else {
      State.currentSourceName = '';
      State.currentSourcePath = '';
      State.currentSourceImg = null;
      State.needsCompositeUpdate = true;
    }
  } else {
    State.needsCompositeUpdate = true;
  }

  refreshThumbnails();
}

function clearAllSourceImages() {
  const all = Array.isArray(State.sourceImages) ? State.sourceImages : [];

  // revoke local blob URLs
  all.forEach((entry) => {
    if (!entry) return;
    if (entry.isLocal && entry.path && typeof entry.path === 'string' && entry.path.startsWith('blob:')) {
      try { URL.revokeObjectURL(entry.path); } catch { }
    }
  });

  State.sourceImages = [];
  State.currentSourceName = '';
  State.currentSourcePath = '';
  State.currentSourceImg = null;
  State.isImagePlacing = false;
  State.placingImgName = '';
  State.placingImg = null;
  State.pendingImagePlaceFace = null;
  State.needsCompositeUpdate = true;
  refreshThumbnails();
}

let autoCrystalizeTimer = 0;
let autoCrystalizeAttempts = 0;
function scheduleAutoCrystalizeFromLocal() {
  if (autoCrystalizeTimer) window.clearTimeout(autoCrystalizeTimer);
  autoCrystalizeTimer = window.setTimeout(() => {
    autoCrystalizeTimer = 0;

    const all = Array.isArray(State.sourceImages) ? State.sourceImages : [];
    const locals = all.filter((e) => e && e.isLocal);
    if (locals.length === 0) return;

    const stillLoading = locals.some((e) => e.loading || !e.originalImg);
    if (stillLoading && autoCrystalizeAttempts < 20) {
      autoCrystalizeAttempts++;
      scheduleAutoCrystalizeFromLocal();
      return;
    }
    autoCrystalizeAttempts = 0;

    try {
      if (typeof window.randomizeCrystalizeLocalOnly === 'function') window.randomizeCrystalizeLocalOnly();
      else if (typeof window.randomizeCrystalize === 'function') window.randomizeCrystalize();
    } catch { }
  }, 250);
}

function addLocalSource(file) {
  const url = URL.createObjectURL(file);
  const uniqueName = `local_${Date.now()}_${file.name}`;
  const entry = {
    name: uniqueName, path: url, isLocal: true, originalImg: null, processedImg: null,
    dither: { enabled: false, params: createDefaultDitherParams() }, loading: true
  };
  State.sourceImages.unshift(entry);
  State.currentSourceName = entry.name;
  State.currentSourcePath = entry.path;

  // Debounced: if user drops multiple files, crystallize once after they are ready.
  scheduleAutoCrystalizeFromLocal();

  ensureSourceImageLoaded(entry, () => {
    reprocessSourceEntry(entry, () => {
      entry.loading = false;
      State.currentSourceImg = entry.originalImg;
      State.needsCompositeUpdate = true;
      refreshThumbnails();

      scheduleAutoCrystalizeFromLocal();
    });
  });
}

function refreshThumbnails() {
  if (!UIr.thumbs) return;
  UIr.thumbs.html('');

  (State.sourceImages || []).forEach(entry => {
    const div = window.createDiv('');
    div.addClass('thumb-item');
    // 青枠は「フレーム挿入モード（画像配置モード）」中だけ表示する
    if (State.isImagePlacing && entry.name === State.placingImgName) div.addClass('active');

    // Background image
    const url = entry.thumbUrl || entry.path; // Use path if thumb missing (local blob)
    div.style('background-image', `url(${url})`);

    // remove button (shown on hover)
    const rm = window.createDiv('×');
    rm.addClass('thumb-remove');
    rm.parent(div);
    rm.elt.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    rm.elt.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeSourceEntry(entry);
    });

    const enterPlacingMode = () => {
      State.currentSourceName = entry.name;
      State.currentSourcePath = entry.path;

      // クリック時点で「配置モード」に入る（ロード待ちでも状態は立てる）
      State.isImagePlacing = true;
      State.placingImgName = entry.name;
      State.placingImg = entry.processedImg || entry.originalImg || null;
      State.needsCompositeUpdate = true;
      refreshThumbnails();

      // Wait for load if needed
      ensureSourceImageLoaded(entry, () => {
        const img = entry.processedImg || entry.originalImg;
        State.currentSourceImg = img;

        // ロード完了後に placingImg を確定
        State.placingImg = img;

        // ロード待ち中にフレームクリックが発生していた場合は自動で適用
        if (State.pendingImagePlaceFace) {
          State.pendingImagePlaceFace.image = img;
          State.pendingImagePlaceFace.imageName = entry.name;
          State.selectedFace = State.pendingImagePlaceFace;
          State.pendingImagePlaceFace = null;
        }
        State.needsCompositeUpdate = true;
        refreshThumbnails();
      });
    };

    // p5.Element の mousePressed は環境によって取りこぼすことがあるため、DOM イベントも併用する
    // pointerdown + click の二重発火を避ける
    let lastArmAt = 0;
    div.elt.addEventListener('pointerdown', (e) => {
      // 削除ボタンの操作は除外（rm 側で stopPropagation 済み）
      if (e?.target?.closest?.('.thumb-remove')) return;
      lastArmAt = performance.now();
      enterPlacingMode();
    });
    div.elt.addEventListener('click', (e) => {
      if (e?.target?.closest?.('.thumb-remove')) return;
      const now = performance.now();
      if (now - lastArmAt < 250) return;
      enterPlacingMode();
    });

    // 互換: 念のため p5 の mousePressed も残す
    div.mousePressed(() => enterPlacingMode());

    div.parent(UIr.thumbs);
  });
}

// Global Update
export function updatePanelUI() {
  const t = State.crystalTone;
  if (t) {
    t.hue = clampToneHue(t.hue ?? 0);
    if (UIr.tone.hue) UIr.tone.hue.setValueSilently(t.hue);
    if (UIr.tone.saturation) UIr.tone.saturation.setValueSilently(t.saturation);
    if (UIr.tone.brightness) UIr.tone.brightness.setValueSilently(t.brightness);
    if (UIr.tone.contrast) UIr.tone.contrast.setValueSilently(t.contrast);
  }
  if (UIr.dither.dit && State.globalDitherAdjust) {
    UIr.dither.dit.setValueSilently(State.globalDitherAdjust.dit ?? 0);
  }
  syncAlphaButton();
  refreshThumbnails();
}

// Deprecated export shim
export function initFooterPanel() { } // Removed, handled by initDownloadPanel/initControlsPanel
export function updateImageGrid() { refreshThumbnails(); } // Map to new thumb refresher
