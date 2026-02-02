import { State } from '../state.js';

function updateTabButtonActive() {
  const btns = State.ui && State.ui.tabButtons;
  if (!btns) return;

  Object.entries(btns).forEach(([key, btn]) => {
    if (!btn) return;
    if (State.toolTab === key) btn.addClass('active');
    else btn.removeClass('active');
  });
}

export function updateTabVisibility() {
  if (!State.ui) return;
  if (State.ui.framePanel) State.ui.framePanel.style('display', State.toolTab === 'FRAME' ? 'block' : 'none');
  if (State.ui.ditherPanel) State.ui.ditherPanel.style('display', State.toolTab === 'DITHER' ? 'block' : 'none');
}

export function setActiveToolTab(name) {
  State.toolTab = name;

  // legacy: panel/tab active state
  updateTabButtonActive();
  updateTabVisibility();

  // legacy: interaction mode reset (brush removed)
  State.isPlacing = false;
  State.activeFace = null;
  State.isImagePlacing = false;
  State.placingImg = null;
  State.placingImgName = '';
  State.draggingFace = null;
  State.draggingPoint = null;
  State.draggingMoved = false;
  State.connectedPoints = [];

  // ガイド表示（showFrames）は「描画」専用。
  // 要望: 基本は見せない（自動でONにしない）。必要なら F キーで手動トグル。
  if (name !== 'FRAME') {
    State.showFrames = false;
  }
  if (window.syncFramesToggleButton) window.syncFramesToggleButton();

  if (window.updateModeButtonStyles) window.updateModeButtonStyles();
  State.needsCompositeUpdate = true;
}
