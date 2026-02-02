import { State } from '../state.js';
import { initControlsPanel, initDownloadPanel } from './panels.js';
import { setActiveToolTab } from './tabs.js';

export function createUI() {
  hideDefaultTitle();
  const appLayout = setupAppLayout();

  // 1. Canvas Container (Left)
  const canvasContainer = window.createDiv('');
  canvasContainer.id('canvas-container');
  canvasContainer.parent(appLayout);

  // UIクリックが canvas イベントとして処理されないように
  canvasContainer.elt.addEventListener('mouseenter', () => { State.overUI = false; });
  canvasContainer.elt.addEventListener('mouseleave', () => { State.overUI = true; });

  // Size label overlay (visual)
  const sizeLabel = window.createDiv(`${State.canvasW || 1080} x ${State.canvasH || 1920}`);
  sizeLabel.addClass('canvas-ui');
  sizeLabel.style('position', 'absolute');
  sizeLabel.style('bottom', '0');
  sizeLabel.style('right', '0');
  sizeLabel.style('background', '#bababa');
  sizeLabel.style('padding', '2px 6px');
  sizeLabel.style('font-size', '9px');
  sizeLabel.style('font-family', 'Space Mono');
  sizeLabel.style('cursor', 'pointer');
  sizeLabel.parent(canvasContainer);
  State.ui.sizeLabel = sizeLabel;

  // Click: cycle presets
  sizeLabel.elt.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof window.cycleCanvasPreset === 'function') window.cycleCanvasPreset();
  });

  // 2. UI Panel (Right)
  const uiPanel = window.createDiv('');
  uiPanel.id('ui-panel');
  uiPanel.parent(appLayout);

  uiPanel.elt.addEventListener('mouseenter', () => { State.overUI = true; });
  uiPanel.elt.addEventListener('mouseleave', () => { State.overUI = false; });

  // 2a. Header
  initHeader(uiPanel);

  // 2b. Controls (Sliders + Actions)
  const controls = window.createDiv('').addClass('controls-container').parent(uiPanel);
  initControlsPanel(controls);

  // 2c. Footer (Download)
  const footer = window.createDiv('').addClass('footer-row').parent(uiPanel);
  // footer-row style might be too small? 50px. Download btn fits.
  // We can reuse footer container or just append directly.
  // panels.js initDownloadPanel expects container.
  initDownloadPanel(footer);

  // Default values or legacy shim if needed
  setActiveToolTab('FRAME');
}
// 1. Header
function initHeader(parent) {
  const h = window.createDiv('').addClass('header-section').parent(parent);

  // Left: Title Area
  const titleArea = window.createDiv('').addClass('header-title-area').parent(h);
  // Note: Font "Loved by the King" is set in CSS
  window.createElement('p', 'Crystallizer').addClass('app-title').parent(titleArea);

  // Right: Info List Area
  const infoArea = window.createDiv('').addClass('header-info-area').parent(h);

  const createInfoItem = (label, value) => {
    const item = window.createDiv('').addClass('info-item').parent(infoArea);
    window.createSpan(label).addClass('info-label').parent(item);
    window.createSpan(value).addClass('info-value').parent(item);
  };

  createInfoItem('Version', '1.0');
  createInfoItem('Release', '26.01.26'); // Matches Figma
  createInfoItem('Made by', 'Sagawa');
}

function hideDefaultTitle() {
  const h1 = window.select('h1');
  if (h1 && !h1.hasClass('app-title')) h1.hide();
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
