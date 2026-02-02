import { State } from '../state.js';
import { initBrushPanel, initFramePanel, initDitherPanel, initTextPanel, initSourcePanel, initDownloadPanel } from './panels.js';
import { createLabeledSliderRef, styleSmallButton } from './controls.js';
import { setActiveToolTab } from './tabs.js';

export function createUI() {
  hideDefaultTitle();
  const appLayout = setupAppLayout();

  const topRegion = window.createDiv('');
  topRegion.id('top-region');
  topRegion.parent(appLayout);

  const bottomPanel = window.createDiv('');
  bottomPanel.id('bottom-panel');
  bottomPanel.parent(appLayout);

  const leftPanel = initLeftPanel(topRegion);
  const centerPanel = initCenterPanel(topRegion);
  const rightPanel = initRightPanel(topRegion);

  initBottomPanel(bottomPanel);

  // パネルコンテンツの初期化
  initBrushPanel(State.ui.brushPanel);
  initFramePanel(State.ui.framePanel);
  initDitherPanel(State.ui.ditherPanel);
  initTextPanel(State.ui.textPanel);

  // ダウンロードエリア
  const downloadArea = window.createDiv('').parent(leftPanel).style('margin-top', 'auto');
  initDownloadPanel(downloadArea);

  // デフォルトタブ
  setActiveToolTab(State.toolTab || 'BRUSH');
}

function hideDefaultTitle() {
  const h1 = window.select('h1');
  if (h1) h1.hide();
}

function setupAppLayout() {
  let appLayout = window.select('main');
  if (!appLayout) {
    appLayout = window.createElement('main');
  } else {
    appLayout.html('');
  }
  appLayout.id('app-layout');
  appLayout.show();
  return appLayout;
}

function initLeftPanel(parent) {
  const p = window.createDiv('').id('left-panel').addClass('side-panel').parent(parent);
  window.createDiv('Collage Lab ver1.0').addClass('app-title').parent(p);

  const btns = window.createDiv('').parent(p).style('display', 'flex').style('flex-direction', 'column').style('gap', '10px');

  window.createButton('Random All').parent(btns).mousePressed(() => window.randomizeAll());
  window.createButton('Random Brusher').parent(btns).mousePressed(() => window.randomizeBrusherOnly());
  window.createButton('Random Framer').parent(btns).mousePressed(() => window.randomizeFramerOnly());
  window.createButton('Random Ditherer').parent(btns).mousePressed(() => window.randomizeDithererOnly());

  window.createButton('Random BG (BG Pool)').parent(btns).mousePressed(() => {
    if (window.randomizeBackgroundImageFromBgPool) window.randomizeBackgroundImageFromBgPool();
  });

  const clearBtn = window.createButton('CLEAR CANVAS').parent(btns);
  clearBtn.style('margin-top', '6px');
  clearBtn.mousePressed(() => {
    if (window.clearCanvas) window.clearCanvas();
  });

  window.createButton('✨ CRYSTALIZED ✨').parent(btns).addClass('crystalized-btn').style('margin-top', '15px').mousePressed(() => window.randomizeCrystalize());

  // --- Crystal Tone Controls ---
  State.crystalTone = State.crystalTone || {
    enabled: true,
    brightness: 1.0,
    contrast: 1.0,
    saturation: 1.0,
    hue: 0
  };

  const applyCrystalToneDefaults = () => {
    State.crystalTone.enabled = true;
    State.crystalTone.hue = 0;
    State.crystalTone.saturation = 1.0;
    State.crystalTone.brightness = 1.0;
    State.crystalTone.contrast = 1.0;
  };

  const toneBox = window.createDiv('').parent(p);
  toneBox.style('margin-top', '12px');
  toneBox.style('padding-top', '10px');
  toneBox.style('border-top', '1px solid rgba(0,0,255,0.25)');

  window.createDiv('Crystal Tone').parent(toneBox).style('font-size', '10px').style('font-weight', 'bold');

  const enableRow = window.createDiv('').parent(toneBox);
  enableRow.style('display', 'flex');
  enableRow.style('justify-content', 'space-between');
  enableRow.style('align-items', 'center');
  enableRow.style('gap', '8px');
  enableRow.style('margin', '6px 0 2px');

  const toneToggle = window.createCheckbox('Enable', !!State.crystalTone.enabled).parent(enableRow);
  toneToggle.changed(() => {
    State.crystalTone.enabled = toneToggle.checked();
    State.needsCompositeUpdate = true;
  });

  const resetBtn = window.createButton('Reset').parent(enableRow);
  styleSmallButton(resetBtn);
  resetBtn.style('width', 'auto');

  const ui = {};
  ui.hue = createLabeledSliderRef(toneBox, 'Hue', -180, 180, State.crystalTone.hue || 0, 1, (v) => {
    State.crystalTone.hue = Number(v);
    State.needsCompositeUpdate = true;
  });
  ui.saturation = createLabeledSliderRef(toneBox, 'Saturation', 0.0, 2.0, State.crystalTone.saturation ?? 1.0, 0.01, (v) => {
    State.crystalTone.saturation = Number(v);
    State.needsCompositeUpdate = true;
  });
  ui.brightness = createLabeledSliderRef(toneBox, 'Brightness', 0.2, 2.0, State.crystalTone.brightness ?? 1.0, 0.01, (v) => {
    State.crystalTone.brightness = Number(v);
    State.needsCompositeUpdate = true;
  });
  ui.contrast = createLabeledSliderRef(toneBox, 'Contrast', 0.2, 2.0, State.crystalTone.contrast ?? 1.0, 0.01, (v) => {
    State.crystalTone.contrast = Number(v);
    State.needsCompositeUpdate = true;
  });

  const syncToneUIFromState = () => {
    toneToggle.checked(!!State.crystalTone.enabled);
    ui.hue.setValueSilently(State.crystalTone.hue ?? 0);
    ui.saturation.setValueSilently(State.crystalTone.saturation ?? 1.0);
    ui.brightness.setValueSilently(State.crystalTone.brightness ?? 1.0);
    ui.contrast.setValueSilently(State.crystalTone.contrast ?? 1.0);
  };

  const resetTone = () => {
    applyCrystalToneDefaults();
    syncToneUIFromState();
    State.needsCompositeUpdate = true;
  };

  resetBtn.mousePressed(resetTone);

  // Expose for Crystalize (must reset every time)
  window.resetCrystalTone = resetTone;

  // Keep a reference (optional, for future sync)
  State.ui = State.ui || {};
  State.ui.crystalTone = { toggle: toneToggle, resetBtn, ...ui };



  return p;
}

function initCenterPanel(parent) {
  const p = window.createDiv('').id('center-panel').parent(parent);
  p.elt.addEventListener('mouseenter', () => State.overUI = false);
  p.elt.addEventListener('mouseleave', () => State.overUI = true);
  return p;
}

function initRightPanel(parent) {
  const p = window.createDiv('').id('right-panel').addClass('side-panel').parent(parent);
  const header = window.createDiv('').addClass('tab-header').parent(p);

  State.ui = State.ui || {};
  State.ui.tabButtons = State.ui.tabButtons || {};

  // タブ
  ['Brasher', 'Framer', 'Ditherer', 'Textile'].forEach((label, i) => {
    const key = ['BRUSH', 'FRAME', 'DITHER', 'TEXT'][i];
    const btn = window.createButton(label).addClass('tab-btn').parent(header);
    State.ui.tabButtons[key] = btn;
    btn.mousePressed(() => {
      setActiveToolTab(key);
    });
  });

  const content = window.createDiv('').addClass('panel-content').parent(p);

  // State.ui に参照を保存
  State.ui.brushPanel = window.createDiv('').parent(content).addClass('tool-panel');
  State.ui.framePanel = window.createDiv('').parent(content).addClass('tool-panel');
  State.ui.ditherPanel = window.createDiv('').parent(content).addClass('tool-panel');
  State.ui.textPanel = window.createDiv('').parent(content).addClass('tool-panel');

  return p;
}

function initBottomPanel(parent) {
  window.createDiv('Source').id('source-label').parent(parent);
  initSourcePanel(parent);
}
