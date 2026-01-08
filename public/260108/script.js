let selectedImg;
let ditheredImg;
let currentImgPath = '';
let overUI = false;
let lastSelectedType = 'atkinson';
let sourceImages = [];

// Dither parameters
let params = {
  type: 'atkinson',
  threshold: 128,
  pixelSize: 2,
  invert: false,
  brightness: 1.0,
  contrast: 1.0,
  saturation: 1.0,
  hue: 0,
  fgColor: '#ffffff',
  bgColor: '#000000',
  useColor: true
};

const IMAGE_DIR = '/260108/';
const IMAGE_FILES = [
  "out_two_stage_00296_.avif", "out_two_stage_00297_.avif", "out_two_stage_00298_.avif", "out_two_stage_00299_.avif", "out_two_stage_00300_.avif",
  "out_two_stage_00301_.avif", "out_two_stage_00302_.avif", "out_two_stage_00303_.avif", "out_two_stage_00304_.avif", "out_two_stage_00305_.avif",
  "out_two_stage_00306_.avif", "out_two_stage_00307_.avif", "out_two_stage_00308_.avif", "out_two_stage_00309_.avif", "out_two_stage_00310_.avif",
  "out_two_stage_00311_.avif", "out_two_stage_00312_.avif", "out_two_stage_00313_.avif", "out_two_stage_00314_.avif", "out_two_stage_00315_.avif",
  "out_two_stage_00316_.avif", "out_two_stage_00317_.avif", "out_two_stage_00318_.avif", "out_two_stage_00319_.avif", "out_two_stage_00320_.avif"
];

function preload() {
  const randomIndex = floor(random(IMAGE_FILES.length));
  const randomFilename = IMAGE_FILES[randomIndex];
  const firstImagePath = IMAGE_DIR + randomFilename;
  selectedImg = loadImage(firstImagePath);
  currentImgPath = randomFilename;
}

function setup() {
  const loading = select('#p5_loading');
  if (loading) loading.remove();

  // Initialize source images from presets
  sourceImages = IMAGE_FILES.map(filename => ({
    name: filename,
    path: IMAGE_DIR + filename,
    isLocal: false
  }));

  // Retinaディスプレイ等での描画ズレを防ぐため、ピクセル密度を1に固定
  pixelDensity(1);

  // 1920x1920の解像度で作成
  createCanvas(1920, 1920);
  createUI();
  
  // 初期処理
  updateDither();
}

function createUI() {
  const ui = createDiv();
  ui.addClass('ui-container');
  
  // Guard against painting when mouse is over UI
  ui.elt.addEventListener('mouseenter', () => { overUI = true; });
  ui.elt.addEventListener('mouseleave', () => { overUI = false; });
  ui.elt.addEventListener('mousedown', (e) => { e.stopPropagation(); });

  const title = createElement('h2', '1. SELECT IMAGE');
  title.parent(ui);
  
  // Dedicated Drop Zone
  let dropZone = createDiv('Drop Images Here');
  dropZone.parent(ui);
  dropZone.addClass('drop-zone');

  const handleDroppedFile = (file) => {
    if (file.type === 'image') {
      loadImage(file.data, (img) => {
        selectedImg = img;
        currentImgPath = file.name;
        
        // Add to source images if not already there
        if (!sourceImages.find(si => si.name === file.name)) {
          sourceImages.unshift({
            name: file.name,
            path: file.data, // This is the base64 data
            isLocal: true
          });
          updateImageGrid();
        }
        
        updateDither();
      });
    }
  };

  dropZone.drop(handleDroppedFile);
  
  // Drag feedback
  dropZone.elt.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style('border-color', '#fff');
    dropZone.style('background', '#444');
  });
  
  dropZone.elt.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.style('border-color', '#444');
    dropZone.style('background', '#222');
  });

  let fileInput = createFileInput(handleDroppedFile);
  fileInput.parent(dropZone);
  fileInput.attribute('accept', 'image/*');
  fileInput.style('display', 'none');

  dropZone.elt.addEventListener('click', () => fileInput.elt.click());
  
  const title2 = createElement('h2', '2. DITHER SETTINGS');
  title2.parent(ui);

  const controls = createDiv();
  controls.parent(ui);
  controls.style('display', 'flex');
  controls.style('flex-direction', 'column');
  controls.style('gap', '3px');
  controls.style('margin-bottom', '15px');

  // Effect Toggle Button
  let toggleBtn = createButton('TOGGLE EFFECT ON/OFF');
  toggleBtn.parent(controls);
  toggleBtn.style('width', '100%');
  toggleBtn.style('margin-bottom', '10px');
  toggleBtn.style('padding', '8px');
  toggleBtn.style('background', '#fff');
  toggleBtn.style('color', '#000');
  toggleBtn.style('border', 'none');
  toggleBtn.style('font-family', 'var(--font-mono)');
  toggleBtn.style('font-size', '10px');
  toggleBtn.style('font-weight', 'bold');
  toggleBtn.style('cursor', 'pointer');
  
  // Dither Type select needs to be accessible
  let typeSelect;

  toggleBtn.mousePressed(() => {
    if (params.type !== 'none') {
      lastSelectedType = params.type;
      params.type = 'none';
      toggleBtn.style('background', '#444');
      toggleBtn.style('color', '#888');
    } else {
      params.type = lastSelectedType;
      toggleBtn.style('background', '#fff');
      toggleBtn.style('color', '#000');
    }
    typeSelect.selected(params.type);
    updateDither();
  });

  function createControl(labelStr, minVal, maxVal, defaultVal, step, key) {
    let row = createDiv();
    row.parent(controls);
    row.style('display', 'flex');
    row.style('justify-content', 'space-between');
    row.style('align-items', 'center');
    
    let label = createSpan(labelStr);
    label.parent(row);
    label.style('font-size', '9px');
    
    let valDisp = createSpan(defaultVal);
    valDisp.parent(row);
    valDisp.style('font-size', '9px');
    valDisp.style('font-family', 'monospace');

    let slider = createSlider(minVal, maxVal, defaultVal, step);
    slider.parent(controls);
    slider.style('width', '100%');
    slider.input(() => {
      params[key] = slider.value();
      valDisp.html(params[key]);
      updateDither();
    });
    return slider;
  }

  // Dither Type
  let typeRow = createDiv();
  typeRow.parent(controls);
  typeRow.style('display', 'flex');
  typeRow.style('justify-content', 'space-between');
  typeRow.style('align-items', 'center');
  typeRow.style('margin-bottom', '5px');
  let typeLabel = createSpan('Type:');
  typeLabel.parent(typeRow);
  typeLabel.style('font-size', '9px');
  
  typeSelect = createSelect();
  typeSelect.parent(typeRow);
  typeSelect.option('Atkinson', 'atkinson');
  typeSelect.option('Floyd-Steinberg', 'floydsteinberg');
  typeSelect.option('Bayer', 'bayer');
  typeSelect.option('Simple', 'simple');
  typeSelect.option('None', 'none');
  typeSelect.selected(params.type);
  typeSelect.style('font-size', '9px');
  typeSelect.changed(() => {
    params.type = typeSelect.value();
    if (params.type !== 'none') {
      lastSelectedType = params.type;
      toggleBtn.style('background', '#fff');
      toggleBtn.style('color', '#000');
    } else {
      toggleBtn.style('background', '#444');
      toggleBtn.style('color', '#888');
    }
    updateDither();
  });

  createControl('Threshold:', 0, 255, 128, 1, 'threshold');
  createControl('Pixel Size:', 1, 100, 2, 1, 'pixelSize');
  createControl('Brightness:', 0.1, 3.0, 1.0, 0.05, 'brightness');
  createControl('Contrast:', 0.1, 3.0, 1.0, 0.05, 'contrast');
  createControl('Saturation:', 0.0, 2.0, 1.0, 0.05, 'saturation');
  createControl('Hue:', -180, 180, 0, 1, 'hue');

  const colorRow = createDiv();
  colorRow.parent(controls);
  colorRow.style('display', 'flex');
  colorRow.style('justify-content', 'space-between');
  colorRow.style('margin-top', '5px');

  const fgColPicker = createColorPicker(params.fgColor);
  fgColPicker.parent(colorRow);
  fgColPicker.style('width', '45%');
  fgColPicker.input(() => { params.fgColor = fgColPicker.value(); });

  const bgColPicker = createColorPicker(params.bgColor);
  bgColPicker.parent(colorRow);
  bgColPicker.style('width', '45%');
  bgColPicker.input(() => { params.bgColor = bgColPicker.value(); });

  // Invert checkbox
  let invRow = createDiv();
  invRow.parent(controls);
  invRow.style('display', 'flex');
  invRow.style('gap', '10px');
  invRow.style('align-items', 'center');
  invRow.style('margin-top', '5px');
  
  let invCheck = createCheckbox(' Invert', params.invert);
  invCheck.parent(invRow);
  invCheck.style('font-size', '9px');
  invCheck.changed(() => {
    params.invert = invCheck.checked();
    updateDither();
  });

  let colorCheck = createCheckbox(' Use Original Color', params.useColor);
  colorCheck.parent(invRow);
  colorCheck.style('font-size', '9px');
  colorCheck.changed(() => {
    params.useColor = colorCheck.checked();
    updateDither();
  });

  // Download button
  let downloadBtn = createButton('DOWNLOAD IMAGE');
  downloadBtn.parent(controls);
  downloadBtn.style('width', '100%');
  downloadBtn.style('margin-top', '10px');
  downloadBtn.style('padding', '8px');
  downloadBtn.style('background', '#222');
  downloadBtn.style('color', '#fff');
  downloadBtn.style('border', '1px solid #444');
  downloadBtn.style('font-family', 'var(--font-mono)');
  downloadBtn.style('font-size', '10px');
  downloadBtn.style('cursor', 'pointer');
  downloadBtn.mousePressed(() => {
    let timestamp = year() + nf(month(), 2) + nf(day(), 2) + "_" + nf(hour(), 2) + nf(minute(), 2) + nf(second(), 2);
    
    // エフェクトされた画像部分だけを等倍（1920x1920）で作成
    let exportBuffer = createGraphics(1920, 1920);
    exportBuffer.pixelDensity(1);
    exportBuffer.noSmooth();
    
    // 完全な透明から開始
    exportBuffer.clear();
    
    // 背景色が完全に透明（または非常にアルファ値が低い）でない場合のみ背景を描画
    // カラーピッカーの値からアルファを取得するのは難しいため、
    // ここではもしユーザーが背景を透明にしたい場合を考慮して制御
    // 一旦、画像をダウンロードする際は背景を含めるのが一般的だが、
    // 背景色を描画すると透明PNGの透過性が失われるため。
    // 「背景色」という概念と「透過」の両立のため、一旦背景描画をスキップするか
    // 判定を入れる必要があるが、ひとまず「背景を描画しない」モードで透過を優先してみる
    
    /* 
    exportBuffer.fill(params.bgColor);
    exportBuffer.noStroke();
    exportBuffer.rect(0, 0, 1920, 1920);
    */
    
    let imgToDraw = ditheredImg || selectedImg;
    if (imgToDraw) {
      // アスペクト比を維持して中央に配置
      let scale = min(1920 / imgToDraw.width, 1920 / imgToDraw.height);
      let w = imgToDraw.width * scale;
      let h = imgToDraw.height * scale;
      let x = (1920 - w) / 2;
      let y = (1920 - h) / 2;
      
      if (ditheredImg && !params.useColor) {
        exportBuffer.tint(params.fgColor);
      }
      
      // 描画モードを適切に設定（透明度を維持）
      exportBuffer.imageMode(CENTER);
      exportBuffer.image(imgToDraw, 1920/2, 1920/2, w, h);
    }
    
    // 背景色が透明なら、その透明度を維持したまま保存、そうでなければ背景色で塗りつぶし
    // ただしダウンロードされるファイルが正しく見えるよう、一時的に背景を反映
    let outImg = exportBuffer.get();
    outImg.save(`dithered_${timestamp}`, 'png');
    exportBuffer.remove();
  });

  const subtitle = createElement('h2', '3. SOURCE IMAGES');
  subtitle.parent(ui);

  const grid = createDiv();
  grid.addClass('image-grid');
  grid.parent(ui);
  grid.id('image-grid-container');
  
  updateImageGrid();
}

function updateImageGrid() {
  const grid = select('#image-grid-container');
  if (!grid) return;
  
  grid.html(''); // Clear existing
  
  sourceImages.forEach(imgData => {
    const thumb = createDiv();
    thumb.addClass('image-thumb');
    thumb.style('background-image', `url(${imgData.path})`);
    thumb.parent(grid);
    thumb.mousePressed(() => {
      loadSelectedImage(imgData.path, imgData.name);
      selectAll('.image-thumb').forEach(el => el.removeClass('selected'));
      thumb.addClass('selected');
    });
    
    if (imgData.name === currentImgPath) thumb.addClass('selected');
  });
}

function loadSelectedImage(fullPath, filename) {
  loadImage(fullPath, (img) => {
    selectedImg = img;
    currentImgPath = filename;
    updateDither();
  });
}

function updateDither() {
  if (!selectedImg) return;
  
  // 作業用の一時的な画像を作成（pixelSizeに合わせてリサイズ）
  let sw = floor(selectedImg.width / params.pixelSize);
  let sh = floor(selectedImg.height / params.pixelSize);
  
  // 処理負荷軽減のため最大サイズを制限
  let maxDim = 1200;
  if (sw > maxDim || sh > maxDim) {
    let scale = maxDim / max(sw, sh);
    sw = floor(sw * scale);
    sh = floor(sh * scale);
  }

  let temp = createGraphics(sw, sh);
  temp.pixelDensity(1);
  temp.image(selectedImg, 0, 0, sw, sh);
  temp.loadPixels();
  
  // Color correction BEFORE dithering
  for (let i = 0; i < temp.pixels.length; i += 4) {
    let r = temp.pixels[i];
    let g = temp.pixels[i+1];
    let b = temp.pixels[i+2];

    // Brightness / Contrast (Multiplier based)
    r = (r - 128) * params.contrast + 128 * params.brightness;
    g = (g - 128) * params.contrast + 128 * params.brightness;
    b = (b - 128) * params.contrast + 128 * params.brightness;

    // Hue / Saturation
    if (params.hue !== 0 || params.saturation !== 1.0) {
      let [h, s, v] = rgbToHsb(constrain(r, 0, 255), constrain(g, 0, 255), constrain(b, 0, 255));
      h = (h + params.hue + 360) % 360;
      s = constrain(s * params.saturation, 0, 1);
      [r, g, b] = hsbToRgb(h, s, v);
    }

    temp.pixels[i] = constrain(r, 0, 255);
    temp.pixels[i+1] = constrain(g, 0, 255);
    temp.pixels[i+2] = constrain(b, 0, 255);
  }

  if (params.type !== 'none') {
    applyDitherFilter(temp, params.type, params.threshold, params.useColor);
  }
  
  // Invert
  if (params.invert) {
    for (let i = 0; i < temp.pixels.length; i += 4) {
      temp.pixels[i] = 255 - temp.pixels[i];
      temp.pixels[i+1] = 255 - temp.pixels[i+1];
      temp.pixels[i+2] = 255 - temp.pixels[i+2];
    }
  }
  
  // 透明度とカラーモードの最終処理
  if (!params.useColor) {
    // 2色モード: 明るさをアルファに変換
    for (let i = 0; i < temp.pixels.length; i += 4) {
      // もともと透明だったピクセルはそのままにする
      if (temp.pixels[i+3] === 0) continue;
      
      let b = temp.pixels[i]; // すでにモノクロ
      temp.pixels[i] = 255;
      temp.pixels[i+1] = 255;
      temp.pixels[i+2] = 255;
      temp.pixels[i+3] = b;
    }
  } else {
    // カラーモード: そのまま（applyDitherFilterでアルファ制御済み）
  }
  
  temp.updatePixels();
  ditheredImg = temp;
}

function applyDitherFilter(pg, type, threshold, isColor) {
  let w = pg.width;
  let h = pg.height;
  let pix = pg.pixels;

  if (type === 'simple' || type === 'bayer') {
    let bayerMap = [
      [1, 9, 3, 11], [13, 5, 15, 7], [4, 12, 2, 10], [16, 8, 14, 6]
    ];
    for (let i = 0; i < pix.length; i += 4) {
      // アルファ値が低い（透明）場合は処理をスキップ
      if (pix[i+3] < 128) {
        pix[i+3] = 0;
        continue;
      }

      let x = (i/4) % w;
      let y = floor((i/4) / w);
      let offset = (type === 'bayer') ? (bayerMap[x % 4][y % 4] - 8) * (255/16) : 0;
      
      if (isColor) {
        pix[i] = (pix[i] + offset) < threshold ? 0 : 255;
        pix[i+1] = (pix[i+1] + offset) < threshold ? 0 : 255;
        pix[i+2] = (pix[i+2] + offset) < threshold ? 0 : 255;
      } else {
        let gray = pix[i] * 0.299 + pix[i+1] * 0.587 + pix[i+2] * 0.114;
        pix[i] = pix[i+1] = pix[i+2] = (gray + offset) < threshold ? 0 : 255;
      }
      pix[i+3] = 255; // 不透明な領域は255に固定
    }
  } else {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let i = (x + y * w) * 4;
        
        // アルファ値が低い（透明）場合は処理をスキップ
        if (pix[i+3] < 128) {
          pix[i+3] = 0;
          continue;
        }

        if (isColor) {
          for (let c = 0; c < 3; c++) {
            let oldP = pix[i + c];
            let newP = oldP < threshold ? 0 : 255;
            let err = oldP - newP;
            pix[i + c] = newP;
            distributeErrorColor(pix, x, y, w, h, err, type, c);
          }
        } else {
          let gray = pix[i] * 0.299 + pix[i+1] * 0.587 + pix[i+2] * 0.114;
          let newP = gray < threshold ? 0 : 255;
          let err = gray - newP;
          pix[i] = pix[i+1] = pix[i+2] = newP;
          distributeErrorColor(pix, x, y, w, h, err, type, -1);
        }
        pix[i+3] = 255; // 処理したピクセルは不透明に
      }
    }
  }
}

function distributeErrorColor(pix, x, y, w, h, err, type, channel) {
  const points = (type === 'floydsteinberg') ? [
    {dx: 1, dy: 0, w: 7/16}, {dx: -1, dy: 1, w: 3/16}, {dx: 0, dy: 1, w: 5/16}, {dx: 1, dy: 1, w: 1/16}
  ] : [
    {dx: 1, dy: 0, w: 1/8}, {dx: 2, dy: 0, w: 1/8}, {dx: -1, dy: 1, w: 1/8}, {dx: 0, dy: 1, w: 1/8}, {dx: 1, dy: 1, w: 1/8}, {dx: 0, dy: 2, w: 1/8}
  ];

  for (let p of points) {
    let nx = x + p.dx;
    let ny = y + p.dy;
    if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
      let ni = (nx + ny * w) * 4;
      if (channel === -1) {
        pix[ni] += err * p.w; pix[ni+1] += err * p.w; pix[ni+2] += err * p.w;
      } else {
        pix[ni + channel] += err * p.w;
      }
    }
  }
}


function draw() {
  background(255);
  
  let imgToDraw = ditheredImg || selectedImg;
  
  if (imgToDraw) {
    const canvasSize = min(width, height) * 0.9;
    const scale = min(canvasSize / imgToDraw.width, canvasSize / imgToDraw.height);
    const w = imgToDraw.width * scale;
    const h = imgToDraw.height * scale;
    const x = (width - w) / 2;
    const y = (height - h) / 2;
    
    noSmooth();

    // 背景色の描画
    fill(params.bgColor);
    noStroke();
    rect(x, y, w, h);
    
    // 前景（ディザドット）の描画
    if (ditheredImg && !params.useColor) {
      tint(params.fgColor);
    }
    image(imgToDraw, x, y, w, h);
    noTint();
    
    // Info text
    fill(0);
    noStroke();
    textFont('Space Mono');
    textSize(20);
    textAlign(LEFT, BOTTOM);
    let info = currentImgPath.toUpperCase() + " | " + params.type.toUpperCase() + " | PX:" + params.pixelSize;
    text(info, 40, height - 40);
  }
}

function windowResized() {
  // CSSでリサイズを管理
}


// Helper for Hue/Saturation/Brightness
function rgbToHsb(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, v = max;
  let d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max === min) {
    h = 0;
  } else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s, v];
}

function hsbToRgb(h, s, v) {
  let r, g, b;
  let i = Math.floor(h / 60) % 6;
  let f = h / 60 - Math.floor(h / 60);
  let p = v * (1 - s);
  let q = v * (1 - f * s);
  let t = v * (1 - (1 - f) * s);
  switch (i) {
    case 0: r = v, g = t, b = p; break;
    case 1: r = q, g = v, b = p; break;
    case 2: r = p, g = v, b = t; break;
    case 3: r = p, g = q, b = v; break;
    case 4: r = t, g = p, b = v; break;
    case 5: r = v, g = p, b = q; break;
  }
  return [r * 255, g * 255, b * 255];
}
