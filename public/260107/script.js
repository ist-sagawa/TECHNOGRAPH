let imgs = [];
let img;
let currentImgIndex = 0;
let sizeSlider, opacitySlider, scatterSlider;
let brush素材 = null;
let pts = [];
let currentPtIdx = 0;
let markers = [];
let pointSvg; // For drawing lines
let overUI = false;

function preload() {
  for (let i = 1; i <= 19; i++) {
    imgs.push(loadImage(`lion${i}.avif`));
  }
}

let cursorRing;

function setup() {
  // 1. Drawing Area setup
  createCanvas(1920, 1920);
  clear();
  imageMode(CENTER);

  // Brush Cursor (Visual feedback only)
  cursorRing = createDiv('');
  cursorRing.style('position', 'fixed');
  cursorRing.style('border', '1px solid rgba(255, 255, 255, 0.8)');
  cursorRing.style('box-shadow', '0 0 2px rgba(0,0,0,0.8)');
  cursorRing.style('border-radius', '50%');
  cursorRing.style('pointer-events', 'none');
  cursorRing.style('transform', 'translate(-50%, -50%)');
  cursorRing.style('z-index', '9999');
  cursorRing.style('display', 'none');
  cursorRing.style('mix-blend-mode', 'difference');

  img = imgs[currentImgIndex];

  // 2. UI Container setup
  let ui = createDiv('');
  ui.position(20, 20);
  ui.style('background', 'rgba(0, 0, 0, 0.95)');
  ui.style('padding', '20px');
  ui.style('display', 'flex');
  ui.style('flex-direction', 'column');
  ui.style('gap', '10px');
  ui.style('z-index', '100');
  ui.style('width', '240px'); // Slightly wider for buttons
  ui.style('user-select', 'none'); // Prevent text/box selection in UI
  ui.style('border-radius', '8px');
  ui.style('color', '#fff');
  
  // Guard against painting when mouse is over UI
  ui.elt.addEventListener('mouseenter', () => { overUI = true; });
  ui.elt.addEventListener('mouseleave', () => { overUI = false; });
  // Prevent clicks on UI from reaching the canvas
  ui.elt.addEventListener('mousedown', (e) => { e.stopPropagation(); });

  // 3. Brush Fragment Selector
  let label = createSpan('<b>1. Pick Brush Area:</b>');
  label.parent(ui);
  label.style('font-size', '9px');

  let previewContainer = createDiv('');
  previewContainer.parent(ui);
  previewContainer.style('position', 'relative');
  previewContainer.style('width', '100%');

  let previewImg = createImg(`lion${currentImgIndex + 1}.avif`, 'preview');
  previewImg.parent(previewContainer);
  previewImg.style('width', '100%');
  previewImg.style('height', 'auto');
  previewImg.style('display', 'block');
  previewImg.style('object-fit', 'contain');
  previewImg.style('border', '1px solid #000');
  previewImg.style('cursor', 'crosshair');
  previewImg.style('pointer-events', 'none'); // Make image non-selectable/non-clickable
  previewImg.elt.draggable = false;

  // SVG overlay for lines
  pointSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  pointSvg.setAttribute('style', 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:5;');
  previewContainer.elt.appendChild(pointSvg);

  // Handle Point Selection (on container now, since image is non-clickable)
  previewContainer.elt.addEventListener('mousedown', (e) => {
    // Only if it's the container itself being clicked, not a marker
    if (e.target !== previewContainer.elt) return;

    e.stopPropagation(); 
    let rect = previewContainer.elt.getBoundingClientRect();
    let x = (e.clientX - rect.left) / rect.width;
    let y = (e.clientY - rect.top) / rect.height;

    pts.push({ x, y });
    createMarker(x, y, previewContainer);
    updateLines();
    
    if (pts.length >= 3) {
      updatePolygonBrush();
    }
  });

  // Point management buttons
  let pActionRow = createDiv('');
  pActionRow.parent(ui);
  pActionRow.style('display', 'flex');
  pActionRow.style('flex-wrap', 'wrap');
  pActionRow.style('gap', '5px');

  let undoBtn = createButton('Undo');
  undoBtn.parent(pActionRow);
  undoBtn.mousePressed(() => {
    if (pts.length > 0) {
      pts.pop();
      let m = markers.pop();
      if (m) m.remove();
      updateLines();
      updatePolygonBrush();
    }
  });

  let clearPtsBtn = createButton('Clear');
  clearPtsBtn.parent(pActionRow);
  clearPtsBtn.mousePressed(() => {
    pts = [];
    markers.forEach(m => m.remove());
    markers = [];
    updateLines();
    brush素材 = null;
  });

  let rectBtn = createButton('Rect 🟦');
  rectBtn.parent(pActionRow);
  rectBtn.mousePressed(() => setPresetPoints('rect', previewContainer));

  let circleBtn = createButton('Circle ⭕');
  circleBtn.parent(pActionRow);
  circleBtn.mousePressed(() => setPresetPoints('circle', previewContainer));

  // Default to full rectangle brush on load
  setPresetPoints('rect', previewContainer);

  // 4. Source Image Selector
  let gridLabel = createDiv('<b>2. Source Image:</b>');
  gridLabel.parent(ui);
  gridLabel.style('font-size', '9px');

  // Dedicated Drop Zone
  let dropZone = createDiv('Drop Images Here');
  dropZone.parent(ui);
  dropZone.style('border', '2px dashed #ccc');
  dropZone.style('padding', '15px 5px');
  dropZone.style('text-align', 'center');
  dropZone.style('font-size', '10px');
  dropZone.style('color', '#666');
  dropZone.style('background', '#f9f9f9');
  dropZone.style('cursor', 'pointer');
  dropZone.style('transition', 'all 0.2s');

  let fileInput = createFileInput((file) => {
    if (file.type === 'image') {
      loadImage(file.data, (newImg) => {
        imgs.push(newImg);
        addIcon(newImg, imgs.length - 1);
        selectImage(imgs.length - 1);
      });
    }
  });
  fileInput.parent(dropZone);
  fileInput.attribute('accept', 'image/*');
  fileInput.style('display', 'none'); // Hide the default input

  dropZone.elt.addEventListener('click', () => fileInput.elt.click());

  dropZone.elt.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style('border-color', '#000');
    dropZone.style('background', '#eee');
    dropZone.style('color', '#000');
  });

  dropZone.elt.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.style('border-color', '#ccc');
    dropZone.style('background', '#f9f9f9');
    dropZone.style('color', '#666');
  });

  dropZone.elt.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style('border-color', '#ccc');
    dropZone.style('background', '#f9f9f9');
    dropZone.style('color', '#666');

    let files = e.dataTransfer.files;
    if (files.length > 0) {
      for (let file of files) {
        if (file.type.startsWith('image/')) {
          let reader = new FileReader();
          reader.onload = (event) => {
            loadImage(event.target.result, (newImg) => {
              imgs.push(newImg);
              addIcon(newImg, imgs.length - 1);
              selectImage(imgs.length - 1);
            });
          };
          reader.readAsDataURL(file);
        }
      }
    }
  });

  // Image List (Optimized to avoid scroll)
  let grid = createDiv('');
  grid.parent(ui);
  grid.style('display', 'flex');
  grid.style('flex-wrap', 'wrap');
  grid.style('grid-template-columns', 'repeat(6, 1fr)'); // 6 columns to save vertical space
  // No fixed max-height/overflow to allow natural growth, or very large max-height
  grid.style('max-height', 'none'); 

  let icons = [];

  function addIcon(p5Img, index) {
    let container = createDiv('');
    container.parent(grid);
    container.size(40, 40);
    container.style('position', 'relative');
    container.style('cursor', 'pointer');

    let icon = createImg(p5Img.canvas.toDataURL(), `img-${index}`);
    icon.parent(container);
    icon.size(35, 35); // Slightly smaller to fit more in a row
    icon.style('object-fit', 'cover');
    icon.style('border', index === currentImgIndex ? '2px solid #000' : '2px solid transparent');
    icons.push(icon);

    icon.mousePressed((e) => {
      selectImage(index);
    });
  }

  function selectImage(index) {
    currentImgIndex = index;
    img = imgs[currentImgIndex];
    previewImg.attribute('src', imgs[index].canvas.toDataURL());
    for (let j = 0; j < icons.length; j++) {
      icons[j].style('border', j === index ? '2px solid #000' : '2px solid transparent');
    }
    if (pts.length >= 3) updatePolygonBrush();
  }

  for (let i = 0; i < imgs.length; i++) {
    addIcon(imgs[i], i);
  }

  // 5. Controls
  let controls = createDiv('');
  controls.parent(ui);
  controls.style('display', 'flex');
  controls.style('flex-direction', 'column');
  controls.style('gap', '2px');

  function createControl(labelStr, minVal, maxVal, defaultVal, step) {
    let row = createDiv('');
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
      valDisp.html(slider.value());
    });
    return slider;
  }

  sizeSlider = createControl('Size:', 10, 1500, 300, 1);
  opacitySlider = createControl('Opacity:', 0, 100, 100, 1);
  scatterSlider = createControl('Scatter:', 0, 500, 0, 1);
  amountSlider = createControl('Amount:', 0.05, 15, 1, 0.05);

  // 6. Action Buttons
  let btn = createButton('Save Drawing (PNG)');
  btn.parent(ui);
  btn.style('margin-top', '5px');
  btn.style('cursor', 'pointer');
  btn.style('font-family', '"Press Start 2P", sans-serif');
  btn.style('font-size', '9px');
  btn.mousePressed(() => saveCanvas('my_sketch', 'png'));

  let clearBtn = createButton('Clear Canvas');
  clearBtn.parent(ui);
  clearBtn.style('cursor', 'pointer');
  clearBtn.style('font-family', '"Press Start 2P", sans-serif');
  clearBtn.style('font-size', '9px');
  clearBtn.mousePressed(() => clear());
}

function createMarker(x, y, parent) {
  let m = createDiv('');
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
  m.style('left', (x * 100) + '%');
  m.style('top', (y * 100) + '%');
  
  let isDragging = false;

  m.elt.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    isDragging = true;
    overUI = true;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    let rect = parent.elt.getBoundingClientRect();
    let nx = (e.clientX - rect.left) / rect.width;
    let ny = (e.clientY - rect.top) / rect.height;
    
    nx = Math.max(0, Math.min(1, nx));
    ny = Math.max(0, Math.min(1, ny));

    m.style('left', (nx * 100) + '%');
    m.style('top', (ny * 100) + '%');
    
    let idx = markers.indexOf(m);
    if (idx !== -1) {
      pts[idx] = { x: nx, y: ny };
      updateLines();
    }
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      updatePolygonBrush();
    }
  });

  // Remove point with Right Click (Context Menu) or Double Click
  const removeHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    let idx = markers.indexOf(m);
    if (idx !== -1) {
      pts.splice(idx, 1);
      markers.splice(idx, 1);
      m.remove();
      updateLines();
      updatePolygonBrush();
    }
  };

  m.elt.addEventListener('contextmenu', removeHandler);
  m.elt.addEventListener('dblclick', removeHandler);

  markers.push(m);
}

function setPresetPoints(type, parent) {
  // Clear existing
  pts = [];
  markers.forEach(m => m.remove());
  markers = [];

  if (type === 'rect') {
    pts = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 }
    ];
  } else if (type === 'circle') {
    let num = 32; // Smoother circle
    for (let i = 0; i < num; i++) {
        let angle = TWO_PI * i / num;
        pts.push({
            x: 0.5 + 0.5 * cos(angle),
            y: 0.5 + 0.5 * sin(angle)
        });
    }
  }

  pts.forEach(p => createMarker(p.x, p.y, parent));
  updateLines();
  updatePolygonBrush();
}

function updateLines() {
  while (pointSvg.firstChild) {
    pointSvg.removeChild(pointSvg.firstChild);
  }
  if (pts.length < 2) return;

  // Set SVG viewbox to match the coordinate range (0-100)
  pointSvg.setAttribute('viewBox', '0 0 100 100');
  pointSvg.setAttribute('preserveAspectRatio', 'none');

  let poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  let pointsStr = pts.map(p => `${p.x * 100},${p.y * 100}`).join(' ');
  poly.setAttribute('points', pointsStr);
  poly.setAttribute('style', 'fill:rgba(255,0,0,0.2); stroke:#f00; stroke-width:2');
  pointSvg.appendChild(poly);
}

function updatePolygonBrush() {
  if (!img || pts.length < 3) {
    brush素材 = null;
    return;
  }
  
  let w = img.width;
  let h = img.height;
  let realPts = pts.map(p => ({ x: p.x * w, y: p.y * h }));

  let minX = min(realPts.map(p => p.x));
  let minY = min(realPts.map(p => p.y));
  let maxX = max(realPts.map(p => p.x));
  let maxY = max(realPts.map(p => p.y));
  let bw = maxX - minX;
  let bh = maxY - minY;

  if (bw < 1 || bh < 1) return;

  if (brush素材 && brush素材.remove) {
    brush素材.remove();
  }

  let pg = createGraphics(bw, bh);
  pg.canvas.style.setProperty('display', 'none', 'important');
  pg.canvas.style.position = 'fixed';
  pg.canvas.style.top = '-10000px';

  pg.beginShape();
  for (let p of realPts) {
    pg.vertex(p.x - minX, p.y - minY);
  }
  pg.endShape(CLOSE);
  pg.drawingContext.clip();
  pg.image(img, -minX, -minY);
  
  brush素材 = pg;
}

let isDrawingPermitted = false;

function mousePressed() {
  if (!overUI) isDrawingPermitted = true;
}

function mouseReleased() {
  isDrawingPermitted = false;
}

function draw() {
  if (isDrawingPermitted && mouseIsPressed && !overUI && brush素材) {
    if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
      let amt = amountSlider.value();
      if (amt < 1) {
        if (random() < amt) paint();
      } else {
        for (let i = 0; i < floor(amt); i++) paint();
        if (random() < (amt - floor(amt))) paint();
      }
    }
  }

  // Draw HUD brush preview cursor
  if (!overUI && brush素材) {
    drawBrushCursor();
  }
}

function drawBrushCursor() {
  if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height && !overUI) {
    let baseSize = sizeSlider.value();
    // Calculate the size as it appears on screen (accounting for canvas scaling)
    let canvasElt = document.querySelector('canvas');
    let rect = canvasElt.getBoundingClientRect();
    let screenScale = rect.width / width;
    let visualSize = baseSize * screenScale;

    cursorRing.style('display', 'block');
    cursorRing.style('left', mouseX * screenScale + rect.left + 'px');
    cursorRing.style('top', mouseY * screenScale + rect.top + 'px');
    cursorRing.style('width', visualSize + 'px');
    cursorRing.style('height', visualSize + 'px');
  } else {
    cursorRing.style('display', 'none');
  }
}

function paint() {
  let scatter = scatterSlider.value();
  let baseSize = sizeSlider.value();
  let opacity = opacitySlider.value();

  let x = mouseX + random(-scatter, scatter);
  let y = mouseY + random(-scatter, scatter);

  push();
  translate(x, y);
  rotate(random(TWO_PI));
  tint(255, opacity * 2.55); // Map 0-100 to 0-255

  let dynamicScale = random(0.8, 1.2);
  let w = baseSize * dynamicScale;
  let ratio = brush素材.height / brush素材.width;
  image(brush素材, 0, 0, w, w * ratio);
  pop();
}

function windowResized() { }

function keyPressed() {
  if (key === 's' || key === 'S') saveCanvas('my_sketch', 'png');
}
