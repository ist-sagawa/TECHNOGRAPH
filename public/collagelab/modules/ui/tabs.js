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
  if (State.ui.brushPanel) State.ui.brushPanel.style('display', State.toolTab === 'BRUSH' ? 'block' : 'none');
  if (State.ui.framePanel) State.ui.framePanel.style('display', State.toolTab === 'FRAME' ? 'block' : 'none');
  if (State.ui.ditherPanel) State.ui.ditherPanel.style('display', State.toolTab === 'DITHER' ? 'block' : 'none');
  if (State.ui.textPanel) State.ui.textPanel.style('display', State.toolTab === 'TEXT' ? 'block' : 'none');
}

export function setActiveToolTab(name) {
  State.toolTab = name;

  // legacy: panel/tab active state
  updateTabButtonActive();
  updateTabVisibility();

  // legacy: interaction mode reset
  if (name === 'BRUSH') {
    State.isBrushing = true;

    State.isPlacing = false;
    State.activeFace = null;

    State.isImagePlacing = false;
    State.placingImg = null;
    State.placingImgName = '';

    State.draggingFace = null;
    State.draggingPoint = null;
    State.draggingMoved = false;
    State.connectedPoints = [];
  } else {
    State.isBrushing = false;
    State.isDrawingPermitted = false;
  }

  if (name === 'FRAME') {
    State.showFrames = true;
    if (window.syncFramesToggleButton) window.syncFramesToggleButton();
  } else {
    // 要望: Framerタブ以外では自動でフレームライン非表示
    State.showFrames = false;
    if (window.syncFramesToggleButton) window.syncFramesToggleButton();
  }

  if (window.updateModeButtonStyles) window.updateModeButtonStyles();
  State.needsCompositeUpdate = true;
}
