// [LEGACY] このファイルは現在の CollageLab では読み込まれていません。
// 参照: /collagelab/ は /collagelab/main.js (module版) をエントリとして使用します。
// ここは過去版のバックアップ用途として残しています（整理対象）。

// CollageLab: frames (260109) + brush (260107) + effects (260108)

// --- Frames (260109 core) ---
let faces = [];
let activeFace = null;
let selectedFace = null;
/**
 * CollageLab legacy entrypoint (monolithic).
 *
 * 互換のため `public/collagelab/script.js` は残しますが、
 * 実体は `public/collagelab/legacy/script.js` に退避しました。
 *
 * 現在の `/collagelab/` ページはモジュール版（`public/collagelab/main.js`）を読み込みます。
 */
(function loadLegacyCollageLab() {
  // ここが読まれるケースは基本的に手動/過去参照なので、分かりやすく警告を出す
  try {
    // eslint-disable-next-line no-console
    console.warn('[CollageLab] legacy script loader: /collagelab/legacy/script.js を読み込みます');
  } catch (_) {
    // ignore
  }

  const legacySrc = '/collagelab/legacy/script.js';
  const s = document.createElement('script');
  s.src = legacySrc;
  s.defer = true;
  document.head.appendChild(s);
})();
let lastSelectedEffectType = 'atkinson';
let effectParams = {
  type: 'atkinson',
  threshold: 128,
  pixelSize: 2,
  invert: false,
  brightness: 1.0,
  contrast: 1.0,
  saturation: 1.0,
  hue: 0,
  fgColor: '#000000',
  bgColor: '#ffffff',
  useColor: true
};

let connectedPoints = []; // Shared vertices across frames for collective movement

// --- Layers ---
let allLayers = []; // array of { type: 'frame', data: face } or { type: 'brush', data: graphics }
let brushLayer; // The *active* brush graphics
let compositeLayer;
let effectLayer = null; // p5.Graphics
let needsCompositeUpdate = true;
let needsEffectUpdate = true;

// --- UI refs ---
let newFaceBtn;
let framesToggleBtn;
let randomShapeBtn;
let randomAllImagesBtn;
let placeImageBtn;
let clearBrushBtn;
let effectToggleBtn;
let effectTypeSelect;
let downloadBtn;

let effectThreshold;
let effectPixelSize;
let effectBrightness;
let effectContrast;
let effectSaturation;
let effectHue;
let effectFgPicker;
let effectInvertCheck;
let effectUseColorCheck;

let ditherPreviewContainer;
let ditherPreviewImg;

let tabBrushBtn;
let tabFrameBtn;
let tabDitherBtn;
let tabTextBtn;
let toolTab = 'BRUSH';
let framePanel;
let brushPanel;
let ditherPanel;
let textPanel;

let textInput;
let fontSizeSlider;
let textColorPicker;
let draggingTextLayer = null;
let paintingIndicator;
let activeTaskCount = 0;

let titleDither;
let ditherPreviewTitle;
let titleSource;
let dropZone;
let grid;

let brushAreaTitle;
let undoBtn, clearPtsBtn, rectBtn, circleBtn;

let canvasBgColor = '#ffffff';
let canvasBgAlpha = 255;
let canvasBgImg = null;
let canvasBgImgName = '';
let bgPicker, bgAlphaSlider;

const SOURCE_DIR = '/collagelab/source/';
const SOURCE_FILES = [
  // Reduced set (~half)
  // lions
  'lion1.avif',
  'lion2.avif',
  'lion3.avif',
  'lion4.avif',
  'lion5.avif',
  'lion6.avif',
  'lion7.avif',
  'lion8.avif',
  'lion9.avif',
  'lion10.avif',

  // out_two_stage (mix)
  'out_two_stage_00235_.avif',
  'out_two_stage_00248_.avif',
  'out_two_stage_00254_.avif',
  'out_two_stage_00266_.avif',
  'out_two_stage_xl_00015_.avif',

  // out_two_stage (260108 subset)
  'out_two_stage_00296_.avif',
  'out_two_stage_00298_.avif',
  'out_two_stage_00300_.avif',
  'out_two_stage_00302_.avif',
  'out_two_stage_00304_.avif',
  'out_two_stage_00306_.avif',
  'out_two_stage_00308_.avif',
  'out_two_stage_00310_.avif',
  'out_two_stage_00312_.avif',
  'out_two_stage_00314_.avif',
  'out_two_stage_00316_.avif',
  'out_two_stage_00318_.avif'
];

function preload() {
  sourceImages = SOURCE_FILES.map((filename) => makeSourceEntry(filename, SOURCE_DIR + filename, false));

  const pick = sourceImages[floor(random(sourceImages.length))];
  if (pick) {
    currentSourceName = pick.name;
    currentSourcePath = pick.path;
  }
}

function setup() {
  const loading = select('#p5_loading');
  if (loading) loading.remove();

  pixelDensity(1);
  const cnv = createCanvas(1920, 1920);
  noSmooth();
  if (drawingContext) drawingContext.imageSmoothingEnabled = false;

  // Initial layout creation before canvas parenting
  createUI();

  paintingIndicator = createDiv('NOW PAINTING...');
  paintingIndicator.id('painting-indicator');
  paintingIndicator.parent('center-panel');
  paintingIndicator.hide();

  cnv.parent('center-panel');

  brushLayer = createGraphics(width, height);
  brushLayer.pixelDensity(1);
  brushLayer.noSmooth();
  if (brushLayer.drawingContext) brushLayer.drawingContext.imageSmoothingEnabled = false;
  brushLayer.clear();

  compositeLayer = createGraphics(width, height);
  compositeLayer.pixelDensity(1);
  compositeLayer.noSmooth();
  if (compositeLayer.drawingContext) compositeLayer.drawingContext.imageSmoothingEnabled = false;
  compositeLayer.clear();

  setBrushPresetPoints('rect');

  if (currentSourceName) {
    setCurrentSourceByName(currentSourceName);
  }
}

function createUI() {
  hideDefaultTitle();
  const appLayout = setupAppLayout();

  const topRegion = createDiv('').id('top-region').parent(appLayout);
  const bottomPanel = createDiv('').id('bottom-panel').parent(appLayout);

  const leftPanel = initLeftPanel(topRegion);
  const centerPanel = initCenterPanel(topRegion);
  const rightPanel = initRightPanel(topRegion);

  initBottomPanel(bottomPanel);

  // Initialize specific panel contents
  initBrushPanelUI();
  initFramePanelUI();
  initDitherPanelUI();
  initTextPanelUI();

  // Download section in left panel
  const downloadArea = createDiv('').parent(leftPanel).style('margin-top', 'auto');
  initDownloadPanelUI(downloadArea);

  setActiveToolTab('BRUSH');
}

function initFramePanelUI() {
  const container = createDiv('');
  container.parent(framePanel);

  newFaceBtn = createButton('MAKE NEW FRAME!');
  newFaceBtn.style('width', '100%');
  newFaceBtn.parent(container);
  newFaceBtn.mousePressed(() => {
    setActiveToolTab('FRAME');
    showFrames = true;
    updateFramesToggleButton();
    exitBrushMode();
    isImagePlacing = false;
    placingImg = null;
    placingImgName = '';
    finalizeActiveFace();
    activeFace = { points: [], image: null, imageName: '' };
    isPlacing = true;
    needsCompositeUpdate = true;
    needsEffectUpdate = true;
    updateModeButtonStyles();
  });

  framesToggleBtn = createButton('FRAMES: ON');
  framesToggleBtn.style('width', '100%');
  framesToggleBtn.parent(container);
  framesToggleBtn.mousePressed(() => {
    showFrames = !showFrames;
    hoverPoint = null;
    draggingPoint = null;
    draggingMoved = false;
    draggingFace = null;
    updateFramesToggleButton();
  });

  randomShapeBtn = createButton('RANDOM SHAPE');
  randomShapeBtn.style('width', '100%');
  randomShapeBtn.parent(container);
  randomShapeBtn.mousePressed(() => {
    setActiveToolTab('FRAME');
    showFrames = true;
    updateFramesToggleButton();
    exitBrushMode();
    isImagePlacing = false;
    finalizeActiveFace();
    activeFace = null;
    isPlacing = false;
    const f = createRandomFace();
    if (f) {
      faces.push(f);
      allLayers.push({ type: 'frame', data: f });
      selectedFace = f;
      brushLayer = null;
    }
    needsCompositeUpdate = true;
    needsEffectUpdate = true;
  });

  placeImageBtn = createButton('PUT IMAGE IN FRAME');
  placeImageBtn.style('width', '100%');
  placeImageBtn.parent(container);
  placeImageBtn.mousePressed(() => {
    setActiveToolTab('FRAME');
    if (!currentSourceImg) return;
    startPlacingImage(currentSourceImg, currentSourceName);
    updateModeButtonStyles();
  });

  randomAllImagesBtn = createButton('RANDOM IMAGES');
  randomAllImagesBtn.style('width', '100%');
  randomAllImagesBtn.parent(container);
  randomAllImagesBtn.mousePressed(() => {
    setActiveToolTab('FRAME');
    applyRandomImagesToAllFrames();
  });

  updateFramesToggleButton();
  updateModeButtonStyles();
}

function updateModeButtonStyles() {
  if (!newFaceBtn || !placeImageBtn) return;
  // Reset all
  [newFaceBtn, placeImageBtn].forEach(btn => {
    btn.style('background', '#fff');
    btn.style('color', '#0000ff');
    btn.style('outline', 'none');
  });

  if (isPlacing) {
    newFaceBtn.style('background', '#0000ff');
    newFaceBtn.style('color', '#fff');
    newFaceBtn.style('outline', '2px solid #fff');
  }

  if (isImagePlacing) {
    placeImageBtn.style('background', '#0000ff');
    placeImageBtn.style('color', '#fff');
    placeImageBtn.style('outline', '2px solid #fff');
  }
}

// function updateModeButtonStyles exists below

function initBrushPanelUI() {
  brushAreaTitle = createElement('h2', 'Brush Shape');
  brushAreaTitle.parent(brushPanel);

  brushPreviewContainer = createDiv('');
  brushPreviewContainer.parent(brushPanel);
  brushPreviewContainer.addClass('preview-container');
  brushPreviewContainer.style('position', 'relative');

  brushPreviewImg = createImg(currentSourcePath || '', 'preview');
  brushPreviewImg.parent(brushPreviewContainer);
  brushPreviewImg.addClass('preview-img');
  brushPreviewImg.style('width', '100%');
  brushPreviewImg.style('height', 'auto');
  brushPreviewImg.style('display', 'block');
  brushPreviewImg.style('object-fit', 'contain');
  brushPreviewImg.style('pointer-events', 'none');
  brushPreviewImg.elt.draggable = false;

  brushPointSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  brushPointSvg.setAttribute(
    'style',
    'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:5;'
  );
  brushPreviewContainer.elt.appendChild(brushPointSvg);

  brushPreviewContainer.elt.addEventListener('mousedown', (e) => {
    if (e.target !== brushPreviewContainer.elt) return;
    e.stopPropagation();
    const rect = brushPreviewContainer.elt.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    brushPts.push({ x, y });
    createBrushMarker(x, y);
    updateBrushLines();
    if (brushPts.length >= 3) updatePolygonBrush();
  });

  const brushActionRow = createDiv('');
  brushActionRow.parent(brushPanel);
  brushActionRow.style('display', 'grid');
  brushActionRow.style('grid-template-columns', '1fr 1fr');
  brushActionRow.style('gap', '4px');

  undoBtn = createButton('Undo');
  undoBtn.parent(brushActionRow);
  undoBtn.mousePressed(() => {
    if (brushPts.length > 0) {
      brushPts.pop();
      const m = brushMarkers.pop();
      if (m) m.remove();
      updateBrushLines();
      updatePolygonBrush();
    }
  });

  clearPtsBtn = createButton('Clear');
  clearPtsBtn.parent(brushActionRow);
  clearPtsBtn.mousePressed(() => {
    clearBrushPoints();
    brushStamp = null;
  });

  rectBtn = createButton('Rect');
  rectBtn.parent(brushActionRow);
  rectBtn.mousePressed(() => setBrushPresetPoints('rect'));

  circleBtn = createButton('Circle');
  circleBtn.parent(brushActionRow);
  circleBtn.mousePressed(() => setBrushPresetPoints('circle'));

  createLabeledSlider(brushPanel, 'Size', 20, 600, brushSize, 1, (v) => {
    brushSize = v;
  });
  createLabeledSlider(brushPanel, 'Opacity', 0, 100, brushOpacity, 1, (v) => {
    brushOpacity = v;
  });
  createLabeledSlider(brushPanel, 'Scatter', 0, 150, brushScatter, 1, (v) => {
    brushScatter = v;
  });
  createLabeledSlider(brushPanel, 'Amount', 0, 10, brushAmount, 0.05, (v) => {
    brushAmount = v;
  });

  clearBrushBtn = createButton('CLEAR ALL BRUSHES');
  clearBrushBtn.parent(brushPanel);
  clearBrushBtn.style('width', '100%');
  clearBrushBtn.mousePressed(() => {
    allLayers = allLayers.filter(l => l.type !== 'brush');
    brushLayer = null;
    needsCompositeUpdate = true;
    needsEffectUpdate = true;
  });
}

function initDitherPanelUI() {
  ditherPreviewTitle = createElement('h2', 'Processed Preview');
  ditherPreviewTitle.parent(ditherPanel);

  ditherPreviewContainer = createDiv('');
  ditherPreviewContainer.parent(ditherPanel);
  ditherPreviewContainer.addClass('preview-container');
  ditherPreviewContainer.style('position', 'relative');

  ditherPreviewImg = createImg(currentSourcePath || '', 'dither preview');
  ditherPreviewImg.parent(ditherPreviewContainer);
  ditherPreviewImg.addClass('preview-img');
  ditherPreviewImg.style('width', '100%');
  ditherPreviewImg.style('height', 'auto');
  ditherPreviewImg.style('display', 'block');
  ditherPreviewImg.style('object-fit', 'contain');
  ditherPreviewImg.elt.draggable = false;

  effectToggleBtn = createButton('DITHER: OFF');
  effectToggleBtn.style('width', '100%');
  effectToggleBtn.parent(ditherPanel);
  effectToggleBtn.mousePressed(() => {
    const entry = getCurrentSourceEntry();
    if (!entry) return;
    entry.dither.enabled = !entry.dither.enabled;
    syncEffectFromEntry(entry);
    requestCurrentSourceReprocess();
  });
  updateEffectToggle();

  updateEffectToggle();

  const typeRow = createDiv('');
  typeRow.parent(ditherPanel);
  typeRow.style('display', 'flex');
  typeRow.style('justify-content', 'space-between');
  typeRow.style('align-items', 'center');
  typeRow.style('margin-top', '4px');

  const typeLabel = createSpan('Type:');
  typeLabel.parent(typeRow);
  typeLabel.style('font-size', '9px');

  effectTypeSelect = createSelect();
  effectTypeSelect.parent(typeRow);
  effectTypeSelect.option('Atkinson', 'atkinson');
  effectTypeSelect.option('Floyd-Steinberg', 'floydsteinberg');
  effectTypeSelect.option('Bayer', 'bayer');
  effectTypeSelect.option('Simple', 'simple');
  effectTypeSelect.option('None', 'none');
  effectTypeSelect.selected(effectParams.type);
  effectTypeSelect.style('font-size', '9px');
  effectTypeSelect.changed(() => {
    effectParams.type = effectTypeSelect.value();
    if (effectParams.type !== 'none') lastSelectedEffectType = effectParams.type;
    const entry = getCurrentSourceEntry();
    if (!entry) return;
    entry.dither.params.type = effectParams.type;
    requestCurrentSourceReprocess();
  });

  effectThreshold = createLabeledSliderRef(ditherPanel, 'Threshold', 0, 255, effectParams.threshold, 1, (v) => {
    effectParams.threshold = v;
    const entry = getCurrentSourceEntry();
    if (!entry) return;
    entry.dither.params.threshold = v;
    requestCurrentSourceReprocess();
  });
  effectPixelSize = createLabeledSliderRef(ditherPanel, 'Pixel Size', 1, 100, effectParams.pixelSize, 1, (v) => {
    effectParams.pixelSize = v;
    const entry = getCurrentSourceEntry();
    if (!entry) return;
    entry.dither.params.pixelSize = v;
    requestCurrentSourceReprocess();
  });
  effectBrightness = createLabeledSliderRef(ditherPanel, 'Brightness', 0.1, 3.0, effectParams.brightness, 0.05, (v) => {
    effectParams.brightness = v;
    const entry = getCurrentSourceEntry();
    if (!entry) return;
    entry.dither.params.brightness = v;
    requestCurrentSourceReprocess();
  });
  effectContrast = createLabeledSliderRef(ditherPanel, 'Contrast', 0.1, 3.0, effectParams.contrast, 0.05, (v) => {
    effectParams.contrast = v;
    const entry = getCurrentSourceEntry();
    if (!entry) return;
    entry.dither.params.contrast = v;
    requestCurrentSourceReprocess();
  });
  effectSaturation = createLabeledSliderRef(ditherPanel, 'Saturation', 0.0, 2.0, effectParams.saturation, 0.05, (v) => {
    effectParams.saturation = v;
    const entry = getCurrentSourceEntry();
    if (!entry) return;
    entry.dither.params.saturation = v;
    requestCurrentSourceReprocess();
  });
  effectHue = createLabeledSliderRef(ditherPanel, 'Hue', -180, 180, effectParams.hue, 1, (v) => {
    effectParams.hue = v;
    const entry = getCurrentSourceEntry();
    if (!entry) return;
    entry.dither.params.hue = v;
    requestCurrentSourceReprocess();
  });

  effectFgPicker = createColorPicker(effectParams.fgColor);
  effectFgPicker.parent(ditherPanel);
  effectFgPicker.style('width', '100%');
  effectFgPicker.style('margin-top', '1px');
  effectFgPicker.input(() => {
    effectParams.fgColor = effectFgPicker.value();
    const entry = getCurrentSourceEntry();
    if (!entry) return;
    entry.dither.params.fgColor = effectParams.fgColor;
    requestCurrentSourceReprocess();
  });

  const invRow = createDiv('');
  invRow.parent(ditherPanel);
  invRow.style('display', 'flex');
  invRow.style('gap', '10px');
  invRow.style('align-items', 'center');
  invRow.style('margin-top', '1px');

  effectInvertCheck = createCheckbox(' Invert', effectParams.invert);
  effectInvertCheck.parent(invRow);
  effectInvertCheck.style('font-size', '9px');
  effectInvertCheck.changed(() => {
    effectParams.invert = effectInvertCheck.checked();
    const entry = getCurrentSourceEntry();
    if (!entry) return;
    entry.dither.params.invert = effectParams.invert;
    requestCurrentSourceReprocess();
  });

  effectUseColorCheck = createCheckbox(' Color', effectParams.useColor);
  effectUseColorCheck.parent(invRow);
  effectUseColorCheck.style('font-size', '9px');
  effectUseColorCheck.changed(() => {
    effectParams.useColor = effectUseColorCheck.checked();
    const entry = getCurrentSourceEntry();
    if (!entry) return;
    entry.dither.params.useColor = effectParams.useColor;
    requestCurrentSourceReprocess();
  });
}

function initTextPanelUI() {
  const title = createElement('h2', 'Add Text Layer');
  title.parent(textPanel);

  const row1 = createDiv('');
  row1.parent(textPanel);
  row1.style('margin-bottom', '12px');

  const labelText = createSpan('Text:');
  labelText.parent(row1);
  labelText.style('font-size', '10px');
  labelText.style('display', 'block');
  labelText.style('margin-bottom', '4px');

  textInput = createInput('Collage');
  textInput.parent(row1);
  textInput.style('width', '100%');
  textInput.style('padding', '8px');
  textInput.style('background', '#fff');
  textInput.style('border', 'none');
  textInput.style('color', '#0000ff');
  textInput.style('font-family', '"Space Mono", monospace');

  fontSizeSlider = createLabeledSlider(textPanel, 'Size', 10, 500, 100, 1, (v) => {
    // optional live preview?
  });

  const row2 = createDiv('');
  row2.parent(textPanel);
  row2.style('margin-bottom', '12px');
  row2.style('display', 'flex');
  row2.style('justify-content', 'space-between');
  row2.style('align-items', 'center');

  const labelColor = createSpan('Color:');
  labelColor.parent(row2);
  labelColor.style('font-size', '10px');

  textColorPicker = createColorPicker('#000000');
  textColorPicker.parent(row2);
  textColorPicker.style('width', '60px');

  const addBtn = createButton('ADD TEXT TO CANVAS');
  addBtn.parent(textPanel);
  styleButton(addBtn);
  addBtn.mousePressed(() => {
    const txt = textInput.value();
    if (!txt) return;
    const layer = {
      type: 'text',
      text: txt,
      size: fontSizeSlider.value(),
      color: textColorPicker.value(),
      x: width / 2,
      y: height / 2
    };
    allLayers.push(layer);
    needsCompositeUpdate = true;
  });

  const clearTextBtn = createButton('CLEAR ALL TEXT');
  clearTextBtn.parent(textPanel);
  styleSmallButton(clearTextBtn);
  clearTextBtn.style('margin-top', '20px');
  clearTextBtn.style('width', '100%');
  clearTextBtn.mousePressed(() => {
    allLayers = allLayers.filter(l => l.type !== 'text');
    needsCompositeUpdate = true;
  });
}

function initSourcePanelUI(parent) {
  const dropZone = createDiv('DROP IMAGES');
  dropZone.parent(parent);
  dropZone.addClass('drop-zone');

  const handleDroppedFile = (file) => {
    if (file.type !== 'image') return;
    loadImage(file.data, (img) => {
      let entry = getSourceEntryByName(file.name);
      if (!entry) {
        entry = makeSourceEntry(file.name, file.data, true);
        sourceImages.unshift(entry);
      }
      entry.originalImg = img;
      entry.processedImg = null;
      entry.thumbUrl = '';
      entry.displayUrl = '';
      setCurrentSourceByName(entry.name);
    });
  };

  dropZone.drop(handleDroppedFile);

  const fileInput = createFileInput(handleDroppedFile);
  fileInput.parent(dropZone);
  fileInput.attribute('accept', 'image/*');
  fileInput.style('display', 'none');
  dropZone.elt.addEventListener('click', () => fileInput.elt.click());

  const grid = createDiv();
  grid.parent(parent);
  grid.id('image-grid-container');

  // Map vertical wheel to horizontal scroll
  grid.elt.addEventListener('wheel', (e) => {
    if (e.deltaY !== 0) {
      grid.elt.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });

  updateImageGrid();
}

function initDownloadPanelUI(ui) {
  // --- DOWNLOAD section (separate area) ---
  const downloadSection = createDiv('');
  downloadSection.parent(ui);
  downloadSection.addClass('ui-section');

  // --- BACKGROUND section ---
  const bgControls = createDiv('');
  bgControls.parent(downloadSection);
  bgControls.style('margin-bottom', '16px');
  bgControls.style('padding', '10px');
  bgControls.style('background', 'rgba(0,0,0,0.2)');
  bgControls.style('border-radius', '4px');
  bgControls.style('display', 'flex');
  bgControls.style('flex-direction', 'column');
  bgControls.style('gap', '8px');

  const bgLabel = createSpan('CANVAS BACKGROUND');
  bgLabel.parent(bgControls);
  bgLabel.style('font-size', '10px');
  bgLabel.style('font-weight', 'bold');
  bgLabel.style('letter-spacing', '0.05em');

  const bgPickerRow = createDiv('');
  bgPickerRow.parent(bgControls);
  bgPickerRow.style('display', 'flex');
  bgPickerRow.style('gap', '8px');
  bgPickerRow.style('align-items', 'center');

  bgPicker = createColorPicker(canvasBgColor);
  bgPicker.parent(bgPickerRow);
  bgPicker.style('flex', '1');
  bgPicker.style('height', '30px');
  bgPicker.style('border', 'none');
  bgPicker.input(() => {
    canvasBgColor = bgPicker.value();
    needsCompositeUpdate = true;
  });

  const alphaRow = createDiv('');
  alphaRow.parent(bgControls);
  alphaRow.style('display', 'flex');
  alphaRow.style('justify-content', 'space-between');

  const alphaLabel = createSpan('Opacity');
  alphaLabel.parent(alphaRow);
  alphaLabel.style('font-size', '9px');

  bgAlphaSlider = createSlider(0, 255, canvasBgAlpha, 1);
  bgAlphaSlider.parent(bgControls);
  bgAlphaSlider.style('width', '100%');
  bgAlphaSlider.input(() => {
    canvasBgAlpha = bgAlphaSlider.value();
    needsCompositeUpdate = true;
  });

  const bgImgBtns = createDiv('');
  bgImgBtns.parent(bgControls);
  bgImgBtns.style('display', 'flex');
  bgImgBtns.style('flex-direction', 'column');
  bgImgBtns.style('gap', '4px');
  bgImgBtns.style('margin-top', '8px');

  const setAsBgBtn = createButton('SET CURRENT SOURCE AS BG');
  setAsBgBtn.parent(bgImgBtns);
  styleSmallButton(setAsBgBtn);
  setAsBgBtn.style('width', '100%');
  setAsBgBtn.mousePressed(() => {
    const entry = getCurrentSourceEntry();
    if (!entry) return;
    ensureSourceImageLoaded(entry, () => {
      reprocessSourceEntry(entry, () => {
        canvasBgImg = entry.processedImg || entry.originalImg;
        canvasBgImgName = entry.name;
        needsCompositeUpdate = true;
      });
    });
  });

  const clearBgImgBtn = createButton('CLEAR BG IMAGE');
  clearBgImgBtn.parent(bgImgBtns);
  styleSmallButton(clearBgImgBtn);
  clearBgImgBtn.style('width', '100%');
  clearBgImgBtn.mousePressed(() => {
    canvasBgImg = null;
    canvasBgImgName = '';
    needsCompositeUpdate = true;
  });

  const randomBgRow = createDiv('');
  randomBgRow.parent(bgControls);
  randomBgRow.style('display', 'flex');
  randomBgRow.style('gap', '4px');
  randomBgRow.style('margin-top', '4px');

  const rndColorBtn = createButton('RND COLOR');
  rndColorBtn.parent(randomBgRow);
  styleSmallButton(rndColorBtn);
  rndColorBtn.style('flex', '1');
  rndColorBtn.style('font-size', '8px');
  rndColorBtn.mousePressed(() => randomizeBackgroundColor());

  const rndImgBtn = createButton('RND IMAGE');
  rndImgBtn.parent(randomBgRow);
  styleSmallButton(rndImgBtn);
  rndImgBtn.style('flex', '1');
  rndImgBtn.style('font-size', '8px');
  rndImgBtn.mousePressed(() => randomizeBackgroundImage());

  downloadBtn = createButton('DOWNLOAD PNG');
  styleButton(downloadBtn);
  downloadBtn.parent(downloadSection);
  downloadBtn.mousePressed(() => {
    downloadTransparentPng();
  });
}

// default
// (Initializers moved into createUI)

function setActiveToolTab(name) {
  toolTab = name;

  if (tabBrushBtn) tabBrushBtn.removeClass('active');
  if (tabFrameBtn) tabFrameBtn.removeClass('active');
  if (tabDitherBtn) tabDitherBtn.removeClass('active');
  if (tabTextBtn) tabTextBtn.removeClass('active');

  if (name === 'BRUSH') tabBrushBtn.addClass('active');
  if (name === 'FRAME') tabFrameBtn.addClass('active');
  if (name === 'DITHER') tabDitherBtn.addClass('active');
  if (name === 'TEXT') tabTextBtn.addClass('active');

  if (framePanel) framePanel.style('display', name === 'FRAME' ? 'block' : 'none');
  if (brushPanel) brushPanel.style('display', name === 'BRUSH' ? 'block' : 'none');
  if (ditherPanel) ditherPanel.style('display', name === 'DITHER' ? 'block' : 'none');
  if (textPanel) textPanel.style('display', name === 'TEXT' ? 'block' : 'none');

  // Interaction mode
  if (name === 'BRUSH') {
    isBrushing = true;
    isPlacing = false;
    activeFace = null;
    isImagePlacing = false;
    placingImg = null;
    placingImgName = '';
    draggingFace = null;
    draggingPoint = null;
  } else {
    isBrushing = false;
    isDrawingPermitted = false;
  }

  if (name === 'FRAME') {
    showFrames = true;
    updateFramesToggleButton();
  }

  updateModeButtonStyles();
}

function styleButton(btn) {
  btn.style('width', '100%');
  btn.style('padding', '10px');
  btn.style('border', 'none');
  btn.style('font-family', '"Space Mono", monospace');
  btn.style('font-size', '11px');
  btn.style('font-weight', 'bold');
  btn.style('cursor', 'pointer');
  btn.style('background', '#fff');
  btn.style('color', '#0000ff');
  btn.style('text-transform', 'uppercase');
}

function styleSmallButton(btn) {
  btn.style('padding', '8px');
  btn.style('border', 'none');
  btn.style('font-family', '"Space Mono", monospace');
  btn.style('font-size', '10px');
  btn.style('font-weight', 'bold');
  btn.style('cursor', 'pointer');
  btn.style('background', '#fff');
  btn.style('color', '#0000ff');
}

function createLabeledSlider(parent, labelStr, minVal, maxVal, defaultVal, step, onChange) {
  const row = createDiv('');
  row.parent(parent);
  row.style('display', 'flex');
  row.style('justify-content', 'space-between');
  row.style('align-items', 'center');
  row.style('margin-top', '1px');

  const label = createSpan(labelStr + ':');
  label.parent(row);
  label.style('font-size', '9px');
  label.style('color', '#fff');

  const valDisp = createSpan(defaultVal);
  valDisp.parent(row);
  valDisp.style('font-size', '9px');
  valDisp.style('font-family', 'monospace');
  valDisp.style('color', '#fff');

  const slider = createSlider(minVal, maxVal, defaultVal, step);
  slider.parent(parent);
  slider.style('width', '100%');
  slider.input(() => {
    const v = slider.value();
    valDisp.html(v);
    onChange(v);
  });
  return slider;
}

function createLabeledSliderRef(parent, labelStr, minVal, maxVal, defaultVal, step, onChange) {
  const row = createDiv('');
  row.parent(parent);
  row.style('display', 'flex');
  row.style('justify-content', 'space-between');
  row.style('align-items', 'center');
  row.style('margin-top', '1px');

  const label = createSpan(labelStr + ':');
  label.parent(row);
  label.style('font-size', '9px');
  label.style('color', '#fff');

  const valDisp = createSpan(defaultVal);
  valDisp.parent(row);
  valDisp.style('font-size', '9px');
  valDisp.style('font-family', 'monospace');
  valDisp.style('color', '#fff');

  const slider = createSlider(minVal, maxVal, defaultVal, step);
  slider.parent(parent);
  slider.style('width', '100%');
  slider.input(() => {
    const v = slider.value();
    valDisp.html(v);
    onChange(v);
  });

  return {
    slider,
    setValueSilently: (v) => {
      slider.value(v);
      valDisp.html(v);
    }
  };
}

function createDefaultDitherParams() {
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

function makeSourceEntry(name, path, isLocal) {
  return {
    name,
    path,
    isLocal,
    originalImg: null,
    processedImg: null,
    thumbUrl: '',
    displayUrl: '',
    dither: {
      enabled: false,
      params: createDefaultDitherParams()
    }
  };
}

function getSourceEntryByName(name) {
  return sourceImages.find((s) => s.name === name) || null;
}

function getCurrentSourceEntry() {
  return currentSourceName ? getSourceEntryByName(currentSourceName) : null;
}

function incrementTask() {
  activeTaskCount++;
  if (paintingIndicator) paintingIndicator.style('display', 'block');
}

function decrementTask() {
  activeTaskCount--;
  if (activeTaskCount <= 0) {
    activeTaskCount = 0;
    if (paintingIndicator) paintingIndicator.style('display', 'none');
  }
}

function ensureSourceImageLoaded(entry, cb) {
  if (!entry) return;
  if (entry.originalImg) {
    cb();
    return;
  }
  incrementTask();
  loadImage(entry.path, (img) => {
    entry.originalImg = img;
    decrementTask();
    cb();
  });
}

function syncEffectFromEntry(entry) {
  if (!entry) return;
  effectEnabled = !!entry.dither.enabled;
  Object.assign(effectParams, entry.dither.params);
  updateEffectToggle();

  if (effectTypeSelect) effectTypeSelect.selected(effectParams.type);
  if (effectThreshold) effectThreshold.setValueSilently(effectParams.threshold);
  if (effectPixelSize) effectPixelSize.setValueSilently(effectParams.pixelSize);
  if (effectBrightness) effectBrightness.setValueSilently(effectParams.brightness);
  if (effectContrast) effectContrast.setValueSilently(effectParams.contrast);
  if (effectSaturation) effectSaturation.setValueSilently(effectParams.saturation);
  if (effectHue) effectHue.setValueSilently(effectParams.hue);
  if (effectFgPicker) effectFgPicker.value(effectParams.fgColor);
  if (effectInvertCheck) effectInvertCheck.checked(!!effectParams.invert);
  if (effectUseColorCheck) effectUseColorCheck.checked(!!effectParams.useColor);
}

function requestCurrentSourceReprocess() {
  const entry = getCurrentSourceEntry();
  if (!entry) return;
  entry.dither.enabled = !!entry.dither.enabled;
  Object.assign(entry.dither.params, effectParams);

  ensureSourceImageLoaded(entry, () => {
    reprocessSourceEntry(entry, () => {
      currentSourceImg = entry.processedImg || entry.originalImg;
      currentSourcePath = entry.displayUrl || entry.path;
      updateBrushPreviewImage();
      updatePolygonBrush();
      updateImageGrid();
      needsCompositeUpdate = true;
    });
  });
}

function reprocessSourceEntry(entry, cb) {
  if (!entry || !entry.originalImg) {
    if (cb) cb();
    return;
  }

  if (!entry.dither.enabled) {
    entry.processedImg = entry.originalImg;
    entry.thumbUrl = '';
    entry.displayUrl = '';
    if (cb) cb();
    return;
  }

  incrementTask();
  // Using setTimeout to allow the UI (and the indicator) to show up 
  // before the heavy processing blocks the main thread
  setTimeout(() => {
    try {
      const params = entry.dither.params;
      const pixelSize = max(1, floor(params.pixelSize || 1));

      // ... actual processing happens here ...
      // (Wait, I need to wrap the existing logic)
      internalReprocess(entry, params, pixelSize);
    } catch (e) { console.error(e); }
    decrementTask();
    if (cb) cb();
  }, 10);
}

function internalReprocess(entry, params, pixelSize) {

  const sw0 = floor(entry.originalImg.width / pixelSize);
  const sh0 = floor(entry.originalImg.height / pixelSize);
  let sw = max(1, sw0);
  let sh = max(1, sh0);

  const maxDim = 1920;
  if (sw > maxDim || sh > maxDim) {
    const scale = maxDim / max(sw, sh);
    sw = floor(sw * scale);
    sh = floor(sh * scale);
  }

  const temp = createGraphics(sw, sh);
  temp.pixelDensity(1);
  temp.noSmooth();
  if (temp.drawingContext) temp.drawingContext.imageSmoothingEnabled = false;
  temp.clear();
  temp.image(entry.originalImg, 0, 0, sw, sh);
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
      let [h, s, v] = rgbToHsb(constrain(r, 0, 255), constrain(g, 0, 255), constrain(b, 0, 255));
      h = (h + params.hue + 360) % 360;
      s = constrain(s * params.saturation, 0, 1);
      [r, g, b] = hsbToRgb(h, s, v);
    }

    temp.pixels[i] = constrain(r, 0, 255);
    temp.pixels[i + 1] = constrain(g, 0, 255);
    temp.pixels[i + 2] = constrain(b, 0, 255);
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
    const fg = color(params.fgColor || '#000000');
    const fr = red(fg);
    const fg_ = green(fg);
    const fb = blue(fg);

    for (let i = 0; i < temp.pixels.length; i += 4) {
      if (temp.pixels[i + 3] === 0) continue;
      // In monochrome dithered output, pix[i] is either 0 or 255.
      // We want the 'black' parts (0) to be the foreground color.
      // b is the brightness/value after dither. 
      const b = temp.pixels[i];
      const alpha = (255 - b); // 0 (white) becomes 0 alpha, 255 (black was turned to 0) becomes 255 alpha? 
      // Wait, applyDitherFilter sets pix[i] to 0 for dark, 255 for light.
      // If we want 'ink' for dark parts:
      temp.pixels[i] = fr;
      temp.pixels[i + 1] = fg_;
      temp.pixels[i + 2] = fb;
      temp.pixels[i + 3] = (255 - b);
    }
  }

  temp.updatePixels();

  entry.processedImg = temp.get();
  entry.displayUrl = graphicsToDataUrl(temp, 1024);
  entry.thumbUrl = graphicsToDataUrl(temp, 96);

  if (cb) cb();
}

function graphicsToDataUrl(pg, maxSide) {
  if (!pg || !pg.canvas) return '';
  const w = pg.width;
  const h = pg.height;
  const maxDim = max(w, h);
  if (!maxSide || maxDim <= maxSide) {
    return pg.canvas.toDataURL('image/png');
  }

  const scale = maxSide / maxDim;
  const tw = max(1, floor(w * scale));
  const th = max(1, floor(h * scale));
  const temp = createGraphics(tw, th);
  temp.pixelDensity(1);
  temp.noSmooth();
  if (temp.drawingContext) temp.drawingContext.imageSmoothingEnabled = false;
  temp.clear();
  temp.image(pg, 0, 0, tw, th);
  return temp.canvas.toDataURL('image/png');
}

function updateFramesToggleButton() {
  if (!framesToggleBtn) return;
  framesToggleBtn.html(showFrames ? '(F) FRAMES: ON' : '(F) FRAMES: OFF');
  if (showFrames) {
    framesToggleBtn.style('background', '#000');
    framesToggleBtn.style('color', '#fff');
    framesToggleBtn.style('border', '1px solid #fff');
  } else {
    framesToggleBtn.style('background', '#fff');
    framesToggleBtn.style('color', '#000');
    framesToggleBtn.style('border', 'none');
  }
}

function updateEffectToggle() {
  if (!effectToggleBtn) return;
  if (effectEnabled) {
    effectToggleBtn.html('DITHER: ON');
    effectToggleBtn.style('background', '#fff');
    effectToggleBtn.style('color', '#000');
    effectToggleBtn.style('border', 'none');
  } else {
    effectToggleBtn.html('DITHER: OFF');
    effectToggleBtn.style('background', '#444');
    effectToggleBtn.style('color', '#888');
    effectToggleBtn.style('border', 'none');
  }
}

function exitBrushMode() {
  isBrushing = false;
  isDrawingPermitted = false;
}

function createRandomFace() {
  const count = floor(random(3, 10));
  const r = random(140, 800);
  const margin = 24;
  const cx = random(r + margin, width - r - margin);
  const cy = random(r + margin, height - r - margin);

  const pts = [];
  for (let i = 0; i < count; i++) {
    const baseA = (TWO_PI * i) / count;
    const a = baseA + random(-0.35, 0.35);
    const rr = r * random(0.45, 1.0);
    const x = cx + cos(a) * rr;
    const y = cy + sin(a) * rr;
    pts.push({ x: constrain(x, 0, width), y: constrain(y, 0, height) });
  }

  const sorted = sortPointsClockwise(pts);
  return { points: sorted, image: null, imageName: '' };
}

function updateImageGrid() {
  const grid = select('#image-grid-container');
  if (!grid) return;

  grid.html('');

  sourceImages.forEach((imgData) => {
    const thumb = createDiv();
    thumb.addClass('image-thumb');
    thumb.style('background-image', `url(${imgData.thumbUrl || imgData.path})`);
    thumb.parent(grid);

    thumb.mousePressed(() => {
      setCurrentSourceByName(imgData.name);
      selectAll('.image-thumb').forEach((el) => el.removeClass('selected'));
      thumb.addClass('selected');

      // If in frame mode, automatically enter "PUT IMAGE" mode when a source image is clicked
      if (toolTab === 'FRAME') {
        ensureSourceImageLoaded(imgData, () => {
          // Note: setCurrentSourceByName already calls reprocess, 
          // but we need to ensure we use the potentially already reprocessed img
          const imgToUse = imgData.processedImg || imgData.originalImg;
          startPlacingImage(imgToUse, imgData.name);
        });
      }
    });

    if (imgData.name === currentSourceName) thumb.addClass('selected');
  });
}

function setCurrentSourceByName(filename) {
  const entry = getSourceEntryByName(filename);
  if (!entry) return;

  currentSourceName = entry.name;
  currentSourcePath = entry.displayUrl || entry.path;

  ensureSourceImageLoaded(entry, () => {
    syncEffectFromEntry(entry);
    reprocessSourceEntry(entry, () => {
      currentSourceImg = entry.processedImg || entry.originalImg;
      currentSourcePath = entry.displayUrl || entry.path;
      updateBrushPreviewImage();
      updatePolygonBrush();
      updateImageGrid();
      needsCompositeUpdate = true;
    });
  });
}

function updateBrushPreviewImage() {
  if (!brushPreviewImg) return;
  brushPreviewImg.attribute('src', currentSourcePath || '');

  // Keep DITHER preview in sync with current source (processed or original).
  if (ditherPreviewImg) {
    ditherPreviewImg.attribute('src', currentSourcePath || '');
  }
}

function startPlacingImage(img, name) {
  // Finalize active polygon if valid
  finalizeActiveFace();

  isPlacing = false;
  exitBrushMode();
  isImagePlacing = true;
  placingImg = img;
  placingImgName = name || '';

  updateModeButtonStyles();
}

function finalizeActiveFace() {
  if (activeFace && activeFace.points && activeFace.points.length >= 3) {
    faces.push(activeFace);
    allLayers.push({ type: 'frame', data: activeFace });
    selectedFace = activeFace;
    brushLayer = null; // Next brush starts a new layer on top
  }
  activeFace = null;
  updateModeButtonStyles();
}

function applyImageToFace(face, img, name) {
  if (!face) return;
  face.image = img;
  face.imageName = name || '';
  needsCompositeUpdate = true;
}

function applyRandomImagesToAllFrames() {
  if (!sourceImages || sourceImages.length === 0) return;

  exitBrushMode();
  isImagePlacing = false;
  placingImg = null;
  placingImgName = '';

  const targets = [];
  for (const f of faces) {
    if (f && f.points && f.points.length >= 3) targets.push(f);
  }
  if (activeFace && activeFace.points && activeFace.points.length >= 3) {
    targets.push(activeFace);
  }
  if (targets.length === 0) return;

  for (const face of targets) {
    const pick = sourceImages[floor(random(sourceImages.length))];
    if (!pick) continue;
    ensureSourceImageLoaded(pick, () => {
      reprocessSourceEntry(pick, () => {
        applyImageToFace(face, pick.processedImg || pick.originalImg, pick.name);
      });
    });
  }
}

function randomizeAll() {
  randomizeDithererOnly();
  randomizeBackground();
  randomizeFramerOnly();
  randomizeBrusherOnly();
}

function randomizeBrusherOnly() {
  const brushCount = floor(random(3, 7));
  for (let i = 0; i < brushCount; i++) {
    brushLayer = null;
    brushOpacity = floor(random(30, 80));
    brushSize = floor(random(80, 250));
    brushScatter = floor(random(10, 60));
    setBrushPresetPoints(random() > 0.5 ? 'rect' : 'circle');

    const pick = sourceImages[floor(random(sourceImages.length))];
    if (pick) {
      ensureSourceImageLoaded(pick, () => {
        currentSourceImg = pick.processedImg || pick.originalImg;
        currentSourceName = pick.name;
        currentSourcePath = pick.displayUrl || pick.path;
        updatePolygonBrush();
        updateBrushPreviewImage();
        updateImageGrid();

        let curX = random(width);
        let curY = random(height);
        const segments = floor(random(40, 100));
        let vx = random(-8, 8);
        let vy = random(-8, 8);
        for (let s = 0; s < segments; s++) {
          curX += vx;
          curY += vy;
          vx += random(-2, 2);
          vy += random(-2, 2);
          vx = constrain(vx, -15, 15);
          vy = constrain(vy, -15, 15);
          if (curX < 0 || curX > width) vx *= -1;
          if (curY < 0 || curY > height) vy *= -1;
          stampBrushAt(curX, curY);
        }
        needsCompositeUpdate = true;
      });
    }
  }
}

function randomizeFramerOnly() {
  faces = [];
  allLayers = allLayers.filter(l => l.type !== 'frame');
  activeFace = null;
  selectedFace = null;

  const frameCount = floor(random(3, 8));
  for (let i = 0; i < frameCount; i++) {
    const f = createRandomFace();
    if (f) {
      faces.push(f);
      allLayers.push({ type: 'frame', data: f });
    }
  }
  applyRandomImagesToAllFrames();
  needsCompositeUpdate = true;
}

function setRandomDitherToEntry(entry) {
  if (!entry) return;
  entry.dither.enabled = random() > 0.15;
  const p = entry.dither.params;
  const types = ['atkinson', 'floydsteinberg', 'bayer', 'simple', 'none'];
  p.type = random(types);
  p.useColor = random() > 0.3;
  p.invert = random() > 0.8;
  p.threshold = floor(random(80, 180));
  p.pixelSize = floor(random(2, 6));
  p.fgColor = random() > 0.5 ? '#000000' : '#333333';
  if (random() > 0.8) p.fgColor = random(['#cc0000', '#0000cc', '#006600']);

  if (random() > 0.5) {
    p.contrast = random(1.0, 1.8);
    p.saturation = random(0.5, 1.5);
    p.hue = floor(random(-30, 30));
  } else {
    p.contrast = random(0.8, 2.5);
    p.saturation = random(0.0, 2.0);
    p.hue = floor(random(-180, 180));
  }
}

function randomizeDithererOnly() {
  sourceImages.forEach(entry => {
    setRandomDitherToEntry(entry);
    ensureSourceImageLoaded(entry, () => {
      reprocessSourceEntry(entry, () => {
        if (entry.name === currentSourceName) {
          effectEnabled = entry.dither.enabled;
          Object.assign(effectParams, entry.dither.params);
          syncEffectFromEntry(entry);
          currentSourceImg = entry.processedImg || entry.originalImg;
          currentSourcePath = entry.displayUrl || entry.path;
          updateBrushPreviewImage();
          updatePolygonBrush();
        }
        updateImageGrid();
        needsCompositeUpdate = true;
      });
    });
  });
}

function randomizeBackgroundColor() {
  canvasBgImg = null;
  canvasBgImgName = '';

  let r, g, b;
  const dice = random();

  if (dice < 0.5) {
    // Variations of BLUE (Core aesthetic)
    r = random(0, 50);
    g = random(0, 100);
    b = random(150, 255);
  } else if (dice < 0.8) {
    // Grayscale (Black, White, Gray)
    const v = random() > 0.5 ? random(0, 40) : random(210, 255);
    r = g = b = v;
  } else if (dice < 0.95) {
    // Deep dark colors
    r = random(0, 30);
    g = random(0, 30);
    b = random(0, 30);
  } else {
    // Bold accent colors (Rare)
    r = random(150, 255);
    g = random(0, 100);
    b = random(0, 100);
  }

  canvasBgColor = '#' + hex(floor(r), 2) + hex(floor(g), 2) + hex(floor(b), 2);
  if (bgPicker) bgPicker.value(canvasBgColor);

  canvasBgAlpha = 255;
  if (bgAlphaSlider) bgAlphaSlider.value(255);

  needsCompositeUpdate = true;
}

function randomizeBackgroundImage() {
  const pick = sourceImages[floor(random(sourceImages.length))];
  if (pick) {
    setRandomDitherToEntry(pick);
    ensureSourceImageLoaded(pick, () => {
      reprocessSourceEntry(pick, () => {
        canvasBgImg = pick.processedImg || pick.originalImg;
        canvasBgImgName = pick.name;
        needsCompositeUpdate = true;
      });
    });
  }
}

function randomizeBackground() {
  randomizeBackgroundColor();
}

function randomizeCrystalize() {
  // Clear existing
  faces = [];
  allLayers = allLayers.filter((l) => l.type !== 'frame');
  activeFace = null;
  selectedFace = null;

  randomizeBackground();

  // 1. Crystal Base Shape (Variable width/height)
  const mx = width / 2;
  const my = height / 2;
  const isBroad = random() > 0.5;
  const widthMult = isBroad ? random(2.0, 4.5) : random(0.8, 1.6);
  const hScale = isBroad ? random(0.7, 1.1) : 1.0;

  const basePoly = [
    { x: mx + random(-15, 15) * widthMult, y: my + (height / 2 - 50) * hScale }, // Bottom Point
    { x: mx + random(180, 320) * widthMult, y: my + (height * 0.05) * hScale + random(-50, 50) },
    { x: mx + random(250, 450) * widthMult, y: my - (height * 0.2) * hScale + random(-50, 50) },
    { x: mx + random(-100, 100) * widthMult, y: my - (height / 2 - 50) * hScale }, // Top
    { x: mx - random(250, 450) * widthMult, y: my - (height * 0.2) * hScale + random(-50, 50) },
    { x: mx - random(180, 320) * widthMult, y: my + (height * 0.05) * hScale + random(-50, 50) }
  ];

  // Rotate base shape for diagonal effect
  const rot = random(-PI / 6, PI / 6);
  const cosA = cos(rot);
  const sinA = sin(rot);
  const cy = height / 2;
  basePoly.forEach(p => {
    let dx = p.x - mx;
    let dy = p.y - cy;
    p.x = constrain(mx + dx * cosA - dy * sinA, 0, width);
    p.y = constrain(cy + dx * sinA + dy * cosA, 0, height);
  });

  let polyList = [basePoly];

  // 2. Recursive Splitting (Geometric / Faceting)
  const layerCount = floor(random(3, 6));
  for (let s = 0; s < layerCount; s++) {
    const nextList = [];

    // Pick a line that passes through the "core" area to ensure meaningful splits
    const angle = random(TWO_PI);
    const nx = cos(angle);
    const ny = sin(angle);
    // Line passes through a point within the central core
    const sx = mx + random(-400, 400);
    const sy = my + random(-400, 400);

    for (const poly of polyList) {
      const parts = splitPolygonByLine(poly, sx, sy, nx, ny);
      if (parts.length > 1) {
        nextList.push(...parts);
      } else {
        nextList.push(poly);
      }
    }
    polyList = nextList;
  }

  // 3. Randomize Global Dither for the crystal set (optional but good)
  if (random() > 0.4) randomizeDithererOnly();

  // 4. Create Frames (Simplify and Triangulate)
  polyList.forEach((pts) => {
    if (pts.length < 3) return;

    // Remove redundant points along straight edges (simplify collinear points)
    let simplified = [];
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[(i + pts.length - 1) % pts.length];
      const p2 = pts[i];
      const p3 = pts[(i + 1) % pts.length];
      // Area of triangle formed by p1, p2, p3
      const area = Math.abs((p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y)) / 2);
      if (area > 5.0) { // Keep only clear corners
        simplified.push(p2);
      }
    }

    const sorted = sortPointsClockwise(simplified);
    if (sorted.length < 3) return;

    // Fan triangulation (works for convex polygons)
    for (let i = 1; i < sorted.length - 1; i++) {
      const tri = [
        { x: constrain(sorted[0].x, 0, width), y: constrain(sorted[0].y, 0, height) },
        { x: constrain(sorted[i].x, 0, width), y: constrain(sorted[i].y, 0, height) },
        { x: constrain(sorted[i + 1].x, 0, width), y: constrain(sorted[i + 1].y, 0, height) }
      ];
      const area = Math.abs(polygonSignedArea(tri));
      if (area < 15000) continue; // Drastically increased threshold for fewer, larger triangles

      const f = { points: tri, image: null, imageName: '' };
      faces.push(f);
      allLayers.push({ type: 'frame', data: f });

      // Pick image
      const pick = sourceImages[floor(random(sourceImages.length))];
      if (pick) {
        ensureSourceImageLoaded(pick, () => {
          reprocessSourceEntry(pick, () => {
            applyImageToFace(f, pick.processedImg || pick.originalImg, pick.name);
          });
        });
      }
    }
  });

  needsCompositeUpdate = true;
  setActiveToolTab('FRAME');
}

function splitPolygonByLine(poly, sx, sy, nx, ny) {
  // nx, ny is the line normal
  // side = (px-sx)*nx + (py-sy)*ny
  const sideA = [];
  const sideB = [];

  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % poly.length];

    const d1 = (p1.x - sx) * nx + (p1.y - sy) * ny;
    const d2 = (p2.x - sx) * nx + (p2.y - sy) * ny;

    if (d1 >= 0) sideA.push(p1);
    if (d1 <= 0) sideB.push(p1);

    if ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) {
      // Intersection
      const t = d1 / (d1 - d2);
      const ix = p1.x + t * (p2.x - p1.x);
      const iy = p1.y + t * (p2.y - p1.y);
      const inter = { x: ix, y: iy };
      sideA.push(inter);
      sideB.push(inter);
    }
  }

  if (sideA.length < 3 || sideB.length < 3) return [poly];
  return [sideA, sideB];
}

function stampBrushAt(x, y) {
  if (!brushStamp) return;

  // Ensure we have an active brush layer at the top of the stack
  if (!brushLayer || allLayers.length === 0 || allLayers[allLayers.length - 1].data !== brushLayer) {
    brushLayer = createGraphics(width, height);
    brushLayer.pixelDensity(1);
    brushLayer.noSmooth();
    if (brushLayer.drawingContext) brushLayer.drawingContext.imageSmoothingEnabled = false;
    brushLayer.clear();
    allLayers.push({ type: 'brush', data: brushLayer });
  }

  const scatter = brushScatter;
  const baseSize = brushSize;
  const opacity255 = map(brushOpacity, 0, 100, 0, 255);

  const dx = x + random(-scatter, scatter);
  const dy = y + random(-scatter, scatter);

  brushLayer.push();
  brushLayer.translate(dx, dy);
  brushLayer.rotate(random(TWO_PI));
  brushLayer.imageMode(CENTER);
  brushLayer.tint(255, opacity255);

  const dynamicScale = random(0.8, 1.2);
  const w = baseSize * dynamicScale;
  const ratio = brushStamp.height / brushStamp.width;

  if (brushLayer.drawingContext) brushLayer.drawingContext.imageSmoothingEnabled = false;
  brushLayer.image(brushStamp, 0, 0, w, w * ratio);
  brushLayer.pop();
}

function polygonSignedArea(pts) {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function sortPointsClockwise(pts) {
  if (!pts || pts.length <= 2) return pts;

  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pts.length;
  cy /= pts.length;

  const sorted = [...pts].sort((a, b) => {
    const aa = Math.atan2(a.y - cy, a.x - cx);
    const bb = Math.atan2(b.y - cy, b.x - cx);
    return aa - bb;
  });

  // In screen coordinates (y down), positive area corresponds to clockwise ordering.
  if (polygonSignedArea(sorted) < 0) sorted.reverse();
  return sorted;
}

function pointInPolygon(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y;
    const xj = pts[j].x, yj = pts[j].y;
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function findNearbyPoint(x, y, radius = 14) {
  const r2 = radius * radius;

  if (activeFace && activeFace.points && activeFace.points.length > 0) {
    for (let i = 0; i < activeFace.points.length; i++) {
      const p = activeFace.points[i];
      const dx = x - p.x;
      const dy = y - p.y;
      if (dx * dx + dy * dy <= r2) return { face: activeFace, index: i };
    }
  }

  for (let fi = faces.length - 1; fi >= 0; fi--) {
    const f = faces[fi];
    if (!f.points || f.points.length === 0) continue;
    for (let i = 0; i < f.points.length; i++) {
      const p = f.points[i];
      const dx = x - p.x;
      const dy = y - p.y;
      if (dx * dx + dy * dy <= r2) return { face: f, index: i };
    }
  }

  return null;
}

function getPointsBounds(pts) {
  let minX = pts[0].x;
  let minY = pts[0].y;
  let maxX = pts[0].x;
  let maxY = pts[0].y;
  for (let i = 1; i < pts.length; i++) {
    minX = Math.min(minX, pts[i].x);
    minY = Math.min(minY, pts[i].y);
    maxX = Math.max(maxX, pts[i].x);
    maxY = Math.max(maxY, pts[i].y);
  }
  return { minX, minY, maxX, maxY };
}

function findTopmostFaceAt(x, y) {
  if (activeFace && activeFace.points && activeFace.points.length >= 3) {
    if (pointInPolygon(x, y, activeFace.points)) return activeFace;
  }

  for (let idx = faces.length - 1; idx >= 0; idx--) {
    const f = faces[idx];
    if (f.points && f.points.length >= 3 && pointInPolygon(x, y, f.points)) {
      return f;
    }
  }
  return null;
}

function findTextLayerAt(x, y) {
  for (let i = allLayers.length - 1; i >= 0; i--) {
    const layer = allLayers[i];
    if (layer.type === 'text') {
      const halfW = (layer.size * layer.text.length * 0.3); // simple heuristic
      const halfH = layer.size * 0.5;
      if (x > layer.x - halfW && x < layer.x + halfW &&
        y > layer.y - halfH && y < layer.y + halfH) {
        return layer;
      }
    }
  }
  return null;
}

function mousePressed() {
  if (overUI) return;
  if (!overUI) isDrawingPermitted = true;

  const isOutsideCanvas = mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height;
  if (isOutsideCanvas) {
    if (isPlacing) {
      finalizeActiveFace();
      isPlacing = false;
      needsCompositeUpdate = true;
    }
    return;
  }

  if (isBrushing) return;

  if (handlePointDragStart()) return;
  if (handleTextDragStart()) return;
  if (handleFaceDragStart()) return;
  if (handleImagePlacement()) return;
  if (handlePointPlacement()) return;

  handleSelection();
}

function mouseDragged() {
  if (overUI) return;
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;
  if (isBrushing) return;
  if (!showFrames) return;

  if (handlePointDragMove()) return;
  if (handleTextDragMove()) return;
  if (handleFaceDragMove()) return;
}

function mouseReleased() {
  isDrawingPermitted = false;

  if (isBrushing) return;

  if (!showFrames) return;

  if (draggingFace) {
    draggingFace = null;
  }

  if (!draggingPoint) return;

  const face = draggingPoint.face;
  const idx = draggingPoint.index;

  if (face && face.points && idx >= 0 && idx < face.points.length) {
    if (!draggingMoved) {
      face.points.splice(idx, 1);
      if (face.points.length < 3) {
        face.image = null;
        face.imageName = '';
        // If it's a frame that lost its shape, we could remove it from allLayers,
        // but keeping it with 0 points is safely handled by render. 
        // For cleanliness, let's remove it if it has < 3 points.
        if (face.points.length < 3) {
          faces = faces.filter(f => f !== face);
          allLayers = allLayers.filter(l => l.data !== face);
        }
      }
    }
  }

  draggingFace = null;
  draggingTextLayer = null;
  draggingPoint = null;
  draggingMoved = false;
  needsCompositeUpdate = true;
}

function keyPressed() {
  if (key === 'f' || key === 'F') {
    showFrames = !showFrames;
    hoverPoint = null;
    draggingPoint = null;
    draggingMoved = false;
    draggingFace = null;
    updateFramesToggleButton();
  }
}

function brushPaintIfNeeded() {
  if (!isBrushing) return;
  if (!isDrawingPermitted || !mouseIsPressed || overUI) return;
  if (!brushStamp) return;
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;

  const amt = brushAmount;
  if (amt < 1) {
    if (random() < amt) brushPaintOnce();
  } else {
    for (let i = 0; i < floor(amt); i++) brushPaintOnce();
    if (random() < amt - floor(amt)) brushPaintOnce();
  }
}

function brushPaintOnce() {
  const scatter = brushScatter;

  const x = mouseX + random(-scatter, scatter);
  const y = mouseY + random(-scatter, scatter);

  stampBrushAt(x, y);

  needsCompositeUpdate = true;
  needsEffectUpdate = true;
}

function renderComposite() {
  compositeLayer.clear();

  // Apply choose-able background
  const bg = color(canvasBgColor);
  compositeLayer.background(red(bg), green(bg), blue(bg), canvasBgAlpha);

  // Apply Background Image if exists
  if (canvasBgImg) {
    compositeLayer.push();
    if (compositeLayer.drawingContext) compositeLayer.drawingContext.imageSmoothingEnabled = false;
    // Cover the canvas
    const scale = Math.max(width / canvasBgImg.width, height / canvasBgImg.height);
    const w = canvasBgImg.width * scale;
    const h = canvasBgImg.height * scale;
    compositeLayer.imageMode(CENTER);
    compositeLayer.image(canvasBgImg, width / 2, height / 2, w, h);
    compositeLayer.pop();
  }

  // Iterate through all layers in order of creation (z-index)
  for (const layer of allLayers) {
    if (layer.type === 'brush') {
      compositeLayer.image(layer.data, 0, 0);
    } else if (layer.type === 'frame') {
      const face = layer.data;
      if (face && face.points && face.points.length >= 3 && face.image) {
        drawFaceImageClippedTo(compositeLayer, face);
      }
    } else if (layer.type === 'text') {
      compositeLayer.push();
      compositeLayer.fill(layer.color);
      compositeLayer.noStroke();
      compositeLayer.textAlign(CENTER, CENTER);
      compositeLayer.textFont('Asset');
      compositeLayer.textSize(layer.size);

      // Manual letter spacing implementation
      const txt = layer.text;
      const chars = txt.split('');
      const spacing = layer.size * -0.2; // -0.2em

      let totalWidth = 0;
      for (let i = 0; i < chars.length; i++) {
        totalWidth += compositeLayer.textWidth(chars[i]);
        if (i < chars.length - 1) totalWidth += spacing;
      }

      let startX = layer.x - totalWidth / 2;
      let currentX = startX;

      compositeLayer.textAlign(LEFT, CENTER); // Use LEFT for manual positioning
      for (let i = 0; i < chars.length; i++) {
        const charW = compositeLayer.textWidth(chars[i]);
        compositeLayer.text(chars[i], currentX, layer.y);
        currentX += charW + spacing;
      }
      compositeLayer.pop();
    }
  }

  // Draw the current active face on the very top while it's being placed
  if (activeFace && activeFace.points && activeFace.points.length >= 3 && activeFace.image) {
    drawFaceImageClippedTo(compositeLayer, activeFace);
  }

  needsCompositeUpdate = false;
}

function drawFaceImageClippedTo(pg, face) {
  const entry = face && face.imageName ? getSourceEntryByName(face.imageName) : null;
  const img = entry && entry.processedImg ? entry.processedImg : face.image;
  const pts = face.points;
  if (!img || !pts || pts.length < 3) return;

  const ctx = pg.drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.clip();

  // Fit image to cover polygon bounding box
  const b = getPointsBounds(pts);
  const boxW = Math.max(1, b.maxX - b.minX);
  const boxH = Math.max(1, b.maxY - b.minY);

  const scale = Math.max(boxW / img.width, boxH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const x = cx - w / 2;
  const y = cy - h / 2;

  ctx.imageSmoothingEnabled = false;
  pg.image(img, x, y, w, h);

  ctx.restore();
}

function updateEffect() {
  if (!compositeLayer) return;

  const sw0 = floor(width / effectParams.pixelSize);
  const sh0 = floor(height / effectParams.pixelSize);
  let sw = max(1, sw0);
  let sh = max(1, sh0);

  // keep full-res up to 1920 to preserve quality
  const maxDim = 1920;
  if (sw > maxDim || sh > maxDim) {
    const scale = maxDim / max(sw, sh);
    sw = floor(sw * scale);
    sh = floor(sh * scale);
  }

  const temp = createGraphics(sw, sh);
  temp.pixelDensity(1);
  temp.noSmooth();
  temp.clear();
  temp.image(compositeLayer, 0, 0, sw, sh);
  temp.loadPixels();

  // Color correction BEFORE dithering
  for (let i = 0; i < temp.pixels.length; i += 4) {
    const a = temp.pixels[i + 3];
    if (a === 0) continue;

    let r = temp.pixels[i];
    let g = temp.pixels[i + 1];
    let b = temp.pixels[i + 2];

    r = (r - 128) * effectParams.contrast + 128 * effectParams.brightness;
    g = (g - 128) * effectParams.contrast + 128 * effectParams.brightness;
    b = (b - 128) * effectParams.contrast + 128 * effectParams.brightness;

    if (effectParams.hue !== 0 || effectParams.saturation !== 1.0) {
      let [h, s, v] = rgbToHsb(constrain(r, 0, 255), constrain(g, 0, 255), constrain(b, 0, 255));
      h = (h + effectParams.hue + 360) % 360;
      s = constrain(s * effectParams.saturation, 0, 1);
      [r, g, b] = hsbToRgb(h, s, v);
    }

    temp.pixels[i] = constrain(r, 0, 255);
    temp.pixels[i + 1] = constrain(g, 0, 255);
    temp.pixels[i + 2] = constrain(b, 0, 255);
  }

  if (effectParams.type !== 'none') {
    applyDitherFilter(temp, effectParams.type, effectParams.threshold, effectParams.useColor);
  }

  if (effectParams.invert) {
    for (let i = 0; i < temp.pixels.length; i += 4) {
      if (temp.pixels[i + 3] === 0) continue;
      temp.pixels[i] = 255 - temp.pixels[i];
      temp.pixels[i + 1] = 255 - temp.pixels[i + 1];
      temp.pixels[i + 2] = 255 - temp.pixels[i + 2];
    }
  }

  if (!effectParams.useColor) {
    for (let i = 0; i < temp.pixels.length; i += 4) {
      if (temp.pixels[i + 3] === 0) continue;
      const b = temp.pixels[i];
      temp.pixels[i] = 255;
      temp.pixels[i + 1] = 255;
      temp.pixels[i + 2] = 255;
      temp.pixels[i + 3] = b;
    }
  }

  temp.updatePixels();
  effectLayer = temp;
  needsEffectUpdate = false;
}

function applyDitherFilter(pg, type, threshold, isColor) {
  const w = pg.width;
  const h = pg.height;
  const pix = pg.pixels;

  if (type === 'simple' || type === 'bayer') {
    const bayerMap = [
      [1, 9, 3, 11],
      [13, 5, 15, 7],
      [4, 12, 2, 10],
      [16, 8, 14, 6]
    ];

    for (let i = 0; i < pix.length; i += 4) {
      if (pix[i + 3] < 128) {
        pix[i + 3] = 0;
        continue;
      }

      const x = (i / 4) % w;
      const y = floor(i / 4 / w);
      const offset = type === 'bayer' ? (bayerMap[x % 4][y % 4] - 8) * (255 / 16) : 0;

      if (isColor) {
        pix[i] = pix[i] + offset < threshold ? 0 : 255;
        pix[i + 1] = pix[i + 1] + offset < threshold ? 0 : 255;
        pix[i + 2] = pix[i + 2] + offset < threshold ? 0 : 255;
      } else {
        const gray = pix[i] * 0.299 + pix[i + 1] * 0.587 + pix[i + 2] * 0.114;
        const v = gray + offset < threshold ? 0 : 255;
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

      if (isColor) {
        for (let c = 0; c < 3; c++) {
          const oldP = pix[i + c];
          const newP = oldP < threshold ? 0 : 255;
          const err = oldP - newP;
          pix[i + c] = newP;
          distributeErrorColor(pix, x, y, w, h, err, type, c);
        }
      } else {
        const gray = pix[i] * 0.299 + pix[i + 1] * 0.587 + pix[i + 2] * 0.114;
        const newP = gray < threshold ? 0 : 255;
        const err = gray - newP;
        pix[i] = pix[i + 1] = pix[i + 2] = newP;
        distributeErrorColor(pix, x, y, w, h, err, type, -1);
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

function drawFrameGuides(face, isActive, isHover, isCompleted) {
  const pts = face.points;
  if (!pts || pts.length === 0) return;

  if (!showFrames) return;

  const frameStroke = isCompleted ? color(255, 0, 0) : color(0);
  const dotFill = isCompleted ? color(255, 0, 0) : color(0);

  // fill when no image
  if (pts.length >= 3 && !face.image) {
    noStroke();
    if (isCompleted) {
      fill(255, 210, 210, isActive ? 80 : 55);
    } else {
      fill(0, isActive ? 35 : 20);
    }
    beginShape();
    for (const p of pts) vertex(p.x, p.y);
    endShape(CLOSE);
  }

  stroke(frameStroke);
  strokeWeight(isHover ? 4 : (isActive ? 2 : 1));
  noFill();
  beginShape();
  for (const p of pts) vertex(p.x, p.y);
  endShape(pts.length >= 3 ? CLOSE : undefined);

  // dots
  noStroke();
  fill(dotFill);
  const baseDotSize = 10;
  const hoverDotSize = 18;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const isDotHover = !!(hoverPoint && hoverPoint.face === face && hoverPoint.index === i);
    circle(p.x, p.y, isDotHover ? hoverDotSize : baseDotSize);
  }
}

function draw() {
  // brush paint
  brushPaintIfNeeded();

  // hover updates
  hoverPoint = null;
  if (showFrames && !overUI && !isBrushing) {
    if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
      hoverPoint = findNearbyPoint(mouseX, mouseY, 14);
    }
  }

  hoverFace = null;
  if (isImagePlacing && placingImg) {
    hoverFace = findTopmostFaceAt(mouseX, mouseY);
  }

  if (needsCompositeUpdate) renderComposite();

  background(220); // neutral desk color

  // Checkerboard for transparency
  drawCheckerboard(20);

  image(compositeLayer, 0, 0);

  // guides on top
  for (const face of faces) {
    drawFrameGuides(face, face === selectedFace, face === hoverFace, true);
  }
  if (activeFace) {
    drawFrameGuides(activeFace, true, activeFace === hoverFace, false);
  }

  // hint
  if (isPlacing) {
    push();
    noStroke();
    fill(0);
    textAlign(LEFT, TOP);
    textSize(18);
    text('CLICK CANVAS', 18, 18);
    pop();
  } else if (isImagePlacing && placingImg) {
    push();
    noStroke();
    fill(0);
    textAlign(LEFT, TOP);
    textSize(18);
    text('Put the image in a frame', 18, 18);
    pop();
  } else if (isBrushing) {
    push();
    noStroke();
    fill(0);
    textAlign(LEFT, TOP);
    textSize(18);
    text('Paint on canvas', 18, 18);
    pop();
  }

  // brush cursor
  drawBrushCursor();

  // cursor-follow image preview during placing
  if (isImagePlacing && placingImg) {
    push();
    noSmooth();
    imageMode(CENTER);

    const maxSize = 140;
    const s = min(maxSize / placingImg.width, maxSize / placingImg.height);
    const pw = placingImg.width * s;
    const ph = placingImg.height * s;

    const px = mouseX + 90;
    const py = mouseY + 40;

    noFill();
    stroke(0);
    strokeWeight(1);
    rectMode(CENTER);
    rect(px, py, pw + 8, ph + 8);

    image(placingImg, px, py, pw, ph);
    pop();
  }
}

function downloadTransparentPng() {
  if (needsCompositeUpdate) renderComposite();

  const outImg = compositeLayer.get();

  const ts = getTimestampYYMMDDHHMMSS();
  outImg.save(`frameimg_${ts}`, 'png');
}

function getTimestampYYMMDDHHMMSS() {
  const d = new Date();
  const yy = String(d.getFullYear() % 100).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yy}${mm}${dd}${hh}${mi}${ss}`;
}

// --- Brush area helpers (ported from 260107) ---
function clearBrushPoints() {
  brushPts = [];
  brushMarkers.forEach((m) => m.remove());
  brushMarkers = [];
  updateBrushLines();
}

function setBrushPresetPoints(type) {
  clearBrushPoints();

  if (type === 'rect') {
    brushPts = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 }
    ];
  } else if (type === 'circle') {
    const num = 32;
    for (let i = 0; i < num; i++) {
      const angle = (TWO_PI * i) / num;
      brushPts.push({
        x: 0.5 + 0.5 * cos(angle),
        y: 0.5 + 0.5 * sin(angle)
      });
    }
  }

  brushPts.forEach((p) => createBrushMarker(p.x, p.y));
  updateBrushLines();
  updatePolygonBrush();
}

function createBrushMarker(x, y) {
  const parent = brushPreviewContainer;
  if (!parent) return;

  const m = createDiv('');
  m.parent(parent);
  m.style('position', 'absolute');
  m.style('width', '12px');
  m.style('height', '12px');
  m.style('background', '#f00');
  m.style('border', '1px solid #fff');
  m.style('border-radius', '50%');
  m.style('transform', 'translate(-50%, -50%)');
  m.style('cursor', 'move');
  m.style('z-index', '20');
  m.style('left', x * 100 + '%');
  m.style('top', y * 100 + '%');

  let isDragging = false;

  m.elt.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    isDragging = true;
    overUI = true;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const rect = parent.elt.getBoundingClientRect();
    let nx = (e.clientX - rect.left) / rect.width;
    let ny = (e.clientY - rect.top) / rect.height;
    nx = Math.max(0, Math.min(1, nx));
    ny = Math.max(0, Math.min(1, ny));
    m.style('left', nx * 100 + '%');
    m.style('top', ny * 100 + '%');
    const idx = brushMarkers.indexOf(m);
    if (idx !== -1) {
      brushPts[idx] = { x: nx, y: ny };
      updateBrushLines();
    }
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      overUI = false;
      updatePolygonBrush();
    }
  });

  const removeHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const idx = brushMarkers.indexOf(m);
    if (idx !== -1) {
      brushPts.splice(idx, 1);
      brushMarkers.splice(idx, 1);
      m.remove();
      updateBrushLines();
      updatePolygonBrush();
    }
  };

  m.elt.addEventListener('contextmenu', removeHandler);
  m.elt.addEventListener('dblclick', removeHandler);

  brushMarkers.push(m);
}

function updateBrushLines() {
  if (!brushPointSvg) return;
  while (brushPointSvg.firstChild) brushPointSvg.removeChild(brushPointSvg.firstChild);
  if (brushPts.length < 2) return;

  brushPointSvg.setAttribute('viewBox', '0 0 100 100');
  brushPointSvg.setAttribute('preserveAspectRatio', 'none');

  const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  const pointsStr = brushPts.map((p) => `${p.x * 100},${p.y * 100}`).join(' ');
  poly.setAttribute('points', pointsStr);
  poly.setAttribute('style', 'fill:rgba(255,0,0,0.2); stroke:#f00; stroke-width:2');
  brushPointSvg.appendChild(poly);
}

function updatePolygonBrush() {
  if (!currentSourceImg || brushPts.length < 3) {
    brushStamp = null;
    return;
  }

  const img = currentSourceImg;
  const w = img.width;
  const h = img.height;
  const realPts = brushPts.map((p) => ({ x: p.x * w, y: p.y * h }));

  const minX = min(realPts.map((p) => p.x));
  const minY = min(realPts.map((p) => p.y));
  const maxX = max(realPts.map((p) => p.x));
  const maxY = max(realPts.map((p) => p.y));
  const bw = maxX - minX;
  const bh = maxY - minY;
  if (bw < 1 || bh < 1) return;

  const pg = createGraphics(bw, bh);
  pg.pixelDensity(1);
  pg.noSmooth();
  if (pg.drawingContext) pg.drawingContext.imageSmoothingEnabled = false;
  pg.clear();

  pg.noStroke(); // CRITICAL: remove default black border
  pg.fill(255);
  pg.beginShape();
  for (const p of realPts) pg.vertex(p.x - minX, p.y - minY);
  pg.endShape(CLOSE);
  pg.drawingContext.clip();
  pg.image(img, -minX, -minY);

  brushStamp = pg;
}

function drawBrushCursor() {
  if (!cursorRing) return;
  if (!isBrushing || overUI || !brushStamp) {
    cursorRing.style('display', 'none');
    return;
  }

  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) {
    cursorRing.style('display', 'none');
    return;
  }

  const canvasElt = document.querySelector('canvas');
  if (!canvasElt) return;
  const rect = canvasElt.getBoundingClientRect();
  const screenScale = rect.width / width;
  const visualSize = brushSize * screenScale;

  cursorRing.style('display', 'block');
  cursorRing.style('left', mouseX * screenScale + rect.left + 'px');
  cursorRing.style('top', mouseY * screenScale + rect.top + 'px');
  cursorRing.style('width', visualSize + 'px');
  cursorRing.style('height', visualSize + 'px');
}

// Hue/Saturation helpers (from 260108)
function rgbToHsb(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const maxV = Math.max(r, g, b);
  const minV = Math.min(r, g, b);
  let h;
  let s;
  const v = maxV;
  const d = maxV - minV;
  s = maxV === 0 ? 0 : d / maxV;
  if (maxV === minV) {
    h = 0;
  } else {
    switch (maxV) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h * 360, s, v];
}

function hsbToRgb(h, s, v) {
  let r;
  let g;
  let b;
  const i = Math.floor(h / 60) % 6;
  const f = h / 60 - Math.floor(h / 60);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }
  return [r * 255, g * 255, b * 255];
}
function drawCheckerboard(size) {
  noStroke();
  for (let y = 0; y < height; y += size * 2) {
    for (let x = 0; x < width; x += size * 2) {
      fill(245);
      rect(x, y, size, size);
      rect(x + size, y + size, size, size);
      fill(255);
      rect(x + size, y, size, size);
      rect(x, y + size, size, size);
    }
  }
}

// --- Interaction Handlers (Refactored) ---

function handlePointDragStart() {
  if (!showFrames) return false;
  const hit = findNearbyPoint(mouseX, mouseY, 14);
  if (hit) {
    draggingPoint = hit;
    draggingMoved = false;
    dragStartX = mouseX;
    dragStartY = mouseY;
    selectedFace = hit.face;

    // Find all points that are "connected" (at the same spot)
    connectedPoints = [];
    const px = hit.face.points[hit.index].x;
    const py = hit.face.points[hit.index].y;

    faces.forEach(f => {
      f.points.forEach((p, idx) => {
        const d2 = (p.x - px) * (p.x - px) + (p.y - py) * (p.y - py);
        if (d2 < 4) { // within 2px
          connectedPoints.push({ face: f, index: idx });
        }
      });
    });
    return true;
  }
  return false;
}

function handleTextDragStart() {
  const txtLayer = findTextLayerAt(mouseX, mouseY);
  if (txtLayer) {
    draggingTextLayer = {
      layer: txtLayer,
      offsetX: txtLayer.x - mouseX,
      offsetY: txtLayer.y - mouseY
    };
    return true;
  }
  return false;
}

function handleFaceDragStart() {
  if (showFrames && !isPlacing && !(isImagePlacing && placingImg)) {
    const target = findTopmostFaceAt(mouseX, mouseY);
    if (target) {
      // If SHIFT is held, prepare to move ALL frames
      const facesToMove = keyIsDown(SHIFT) ? faces : [target];

      draggingFace = {
        face: target,
        faces: facesToMove,
        startX: mouseX,
        startY: mouseY,
        // Store original points for all moving faces
        origStates: facesToMove.map(f => ({
          face: f,
          pts: f.points.map(p => ({ x: p.x, y: p.y }))
        }))
      };
      selectedFace = target;
      return true;
    }
  }
  return false;
}

function handleImagePlacement() {
  if (isImagePlacing && placingImg) {
    const target = findTopmostFaceAt(mouseX, mouseY);
    if (target) {
      applyImageToFace(target, placingImg, placingImgName);
      selectedFace = target;
    }
    return true;
  }
  return false;
}

function handlePointPlacement() {
  if (isPlacing && activeFace) {
    activeFace.points.push({ x: mouseX, y: mouseY });
    if (activeFace.points.length >= 3) {
      activeFace.points = sortPointsClockwise(activeFace.points);
    }
    needsCompositeUpdate = true;
    return true;
  }
  return false;
}

function handleSelection() {
  selectedFace = null;
  for (let idx = faces.length - 1; idx >= 0; idx--) {
    const f = faces[idx];
    if (f.points && f.points.length >= 3 && pointInPolygon(mouseX, mouseY, f.points)) {
      selectedFace = f;
      break;
    }
  }
}

function handlePointDragMove() {
  if (draggingPoint) {
    const movedDist2 = (mouseX - dragStartX) * (mouseX - dragStartX) + (mouseY - dragStartY) * (mouseY - dragStartY);
    if (movedDist2 > 9) draggingMoved = true;

    // Move all connected points synchronously
    connectedPoints.forEach(cp => {
      cp.face.points[cp.index].x = constrain(mouseX, 0, width);
      cp.face.points[cp.index].y = constrain(mouseY, 0, height);
    });

    needsCompositeUpdate = true;
    return true;
  }
  return false;
}

function handleTextDragMove() {
  if (draggingTextLayer) {
    draggingTextLayer.layer.x = constrain(mouseX + draggingTextLayer.offsetX, 0, width);
    draggingTextLayer.layer.y = constrain(mouseY + draggingTextLayer.offsetY, 0, height);
    needsCompositeUpdate = true;
    return true;
  }
  return false;
}

function handleFaceDragMove() {
  if (draggingFace) {
    const dxWanted = mouseX - draggingFace.startX;
    const dyWanted = mouseY - draggingFace.startY;

    draggingFace.origStates.forEach(state => {
      const face = state.face;
      const orig = state.pts;

      for (let i = 0; i < face.points.length; i++) {
        face.points[i].x = constrain(orig[i].x + dxWanted, 0, width);
        face.points[i].y = constrain(orig[i].y + dyWanted, 0, height);
      }
    });

    needsCompositeUpdate = true;
    return true;
  }
  return false;
}

// --- UI Helpers (Refactored) ---

function hideDefaultTitle() {
  const h1 = select('h1');
  if (h1) h1.hide();
}

function setupAppLayout() {
  let appLayout = select('main');
  if (!appLayout) {
    appLayout = createElement('main');
  } else {
    appLayout.html('');
  }
  appLayout.id('app-layout');
  appLayout.show();
  return appLayout;
}

function initLeftPanel(parent) {
  const leftPanel = createDiv('').id('left-panel').addClass('side-panel').parent(parent);

  const appTitle = createDiv('Collage Lab ver1.0').addClass('app-title').parent(leftPanel);

  const leftBtns = createDiv('').parent(leftPanel)
    .style('display', 'flex')
    .style('flex-direction', 'column');

  createButton('Random All').parent(leftBtns).mousePressed(() => randomizeAll());
  createButton('Random Brusher').parent(leftBtns).mousePressed(() => randomizeBrusherOnly());
  createButton('Random Framer').parent(leftBtns).mousePressed(() => randomizeFramerOnly());
  createButton('Random Ditherer').parent(leftBtns).mousePressed(() => randomizeDithererOnly());

  const btnCrystal = createButton('✨ CRYSTALIZED ✨').parent(leftBtns)
    .addClass('crystalized-btn')
    .style('margin-top', '15px')
    .style('border', '4px solid #0000ff')
    .mousePressed(() => randomizeCrystalize());

  // Download section placeholder (filled by createUI logic)
  return leftPanel;
}

function initCenterPanel(parent) {
  const centerPanel = createDiv('').id('center-panel').parent(parent);
  centerPanel.elt.addEventListener('mouseenter', () => overUI = false);
  centerPanel.elt.addEventListener('mouseleave', () => overUI = true);
  return centerPanel;
}

function initRightPanel(parent) {
  const rightPanel = createDiv('').id('right-panel').addClass('side-panel').parent(parent);

  const tabHeader = createDiv('').addClass('tab-header').parent(rightPanel);

  tabBrushBtn = createTabBtn('Brasher', 'BRUSH', tabHeader);
  tabFrameBtn = createTabBtn('Framer', 'FRAME', tabHeader);
  tabDitherBtn = createTabBtn('Ditherer', 'DITHER', tabHeader);
  tabTextBtn = createTabBtn('Textile', 'TEXT', tabHeader);

  const rightContent = createDiv('').addClass('panel-content').parent(rightPanel);

  brushPanel = createDiv('').parent(rightContent).addClass('tool-panel');
  framePanel = createDiv('').parent(rightContent).addClass('tool-panel');
  ditherPanel = createDiv('').parent(rightContent).addClass('tool-panel');
  textPanel = createDiv('').parent(rightContent).addClass('tool-panel');

  return rightPanel;
}

function createTabBtn(label, tabName, parent) {
  const btn = createButton(label).addClass('tab-btn').parent(parent);
  btn.mousePressed(() => setActiveToolTab(tabName));
  return btn;
}

function initBottomPanel(parent) {
  const sourceLabel = createDiv('Source').id('source-label').parent(parent);
  initSourcePanelUI(parent);
}
