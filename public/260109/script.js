let faces = [];
let activeFace = null;
let selectedFace = null;
let isPlacing = false;
let overUI = false;

let isImagePlacing = false;
let placingImg = null;
let placingImgName = '';
let hoverFace = null;
let hoverPoint = null; // { face, index }

let showFrames = true;

let draggingPoint = null; // { face, index }
let draggingMoved = false;
let dragStartX = 0;
let dragStartY = 0;

let newFaceBtn;
let framesToggleBtn;
let downloadBtn;

let selectedImg = null;
let currentImgPath = '';
let sourceImages = [];

const IMAGE_DIR = '/260109/';
const IMAGE_FILES = [
  'out_two_stage_00235_.avif',
  'out_two_stage_00242_.avif',
  'out_two_stage_00247_.avif',
  'out_two_stage_00248_.avif',
  'out_two_stage_00254_.avif',
  'out_two_stage_00260_.avif',
  'out_two_stage_00266_.avif',
  'out_two_stage_00268_.avif',
  'out_two_stage_xl_00015_.avif'
];

function preload() {
  const randomIndex = floor(random(IMAGE_FILES.length));
  const randomFilename = IMAGE_FILES[randomIndex];
  selectedImg = loadImage(IMAGE_DIR + randomFilename);
  currentImgPath = randomFilename;
}

function setup() {
  const loading = select('#p5_loading');
  if (loading) loading.remove();

  sourceImages = IMAGE_FILES.map((filename) => ({
    name: filename,
    path: IMAGE_DIR + filename,
    isLocal: false
  }));

  pixelDensity(1);
  createCanvas(1920, 1920);
  noSmooth();

  createUI();
}

function createUI() {
  const ui = createDiv();
  ui.addClass('ui-container');

  ui.elt.addEventListener('mouseenter', () => {
    overUI = true;
  });
  ui.elt.addEventListener('mouseleave', () => {
    overUI = false;
  });
  ui.elt.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });

  const titleFrames = createElement('h2', '1. MAKE NEW FRAME!');
  titleFrames.parent(ui);

  const controls = createDiv();
  controls.parent(ui);
  controls.style('display', 'flex');
  controls.style('flex-direction', 'column');
  controls.style('gap', '8px');

  newFaceBtn = createButton('MAKE NEW FRAME!');

  newFaceBtn.parent(controls);
  newFaceBtn.style('width', '100%');
  newFaceBtn.style('padding', '8px');
  newFaceBtn.style('border', 'none');
  newFaceBtn.style('font-family', '"Space Mono", monospace');
  newFaceBtn.style('font-size', '10px');
  newFaceBtn.style('font-weight', 'bold');
  newFaceBtn.style('cursor', 'pointer');

  updateNewFaceButton();

  newFaceBtn.mousePressed(() => {
    // Ensure frames are visible when making a frame
    showFrames = true;
    updateFramesToggleButton();

    // Leaving image placement mode
    isImagePlacing = false;
    placingImg = null;
    placingImgName = '';

    // If currently placing and we already have a face, store it and start a new one
    if (activeFace) {
      faces.push(activeFace);
      selectedFace = activeFace;
    }

    activeFace = { points: [], image: null, imageName: '' };
    isPlacing = true;
    updateNewFaceButton();

  });

  framesToggleBtn = createButton('FRAMES: ON');
  framesToggleBtn.parent(controls);
  framesToggleBtn.style('width', '100%');
  framesToggleBtn.style('padding', '8px');
  framesToggleBtn.style('border', 'none');
  framesToggleBtn.style('font-family', '"Space Mono", monospace');
  framesToggleBtn.style('font-size', '10px');
  framesToggleBtn.style('font-weight', 'bold');
  framesToggleBtn.style('cursor', 'pointer');
  updateFramesToggleButton();

  framesToggleBtn.mousePressed(() => {
    showFrames = !showFrames;
    hoverPoint = null;
    draggingPoint = null;
    draggingMoved = false;
    updateFramesToggleButton();
  });

  const titleImages = createElement('h2', '2. PUT IMAGE!');
  titleImages.parent(ui);
  titleImages.style('margin-top', '16px');

  // Image list
  const grid = createDiv();
  grid.addClass('image-grid');
  grid.parent(ui);
  grid.id('image-grid-container');
  updateImageGrid();

  // Drop zone
  let dropZone = createDiv('Drop Images Here');
  dropZone.parent(ui);
  dropZone.addClass('drop-zone');
  dropZone.style('border', '2px dashed #444');
  dropZone.style('margin-top', '16px');
  dropZone.style('text-align', 'center');

  const handleDroppedFile = (file) => {
    if (file.type !== 'image') return;

    loadImage(file.data, (img) => {
      selectedImg = img;
      currentImgPath = file.name;

      if (!sourceImages.find((si) => si.name === file.name)) {
        sourceImages.unshift({
          name: file.name,
          path: file.data,
          isLocal: true
        });
      }

      // Enter image placing mode (do not auto-apply)
      startPlacingImage(img, file.name);
      updateImageGrid();
    });
  };

  dropZone.drop(handleDroppedFile);

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

  downloadBtn = createButton('DOWNLOAD PNG');
  downloadBtn.parent(ui);
  downloadBtn.style('width', '100%');
  downloadBtn.style('padding', '8px');
  downloadBtn.style('border', 'none');
  downloadBtn.style('margin-top', '12px');
  downloadBtn.style('font-family', '"Space Mono", monospace');
  downloadBtn.style('font-size', '10px');
  downloadBtn.style('font-weight', 'bold');
  downloadBtn.style('cursor', 'pointer');
  downloadBtn.style('background', '#fff');
  downloadBtn.style('color', '#000');

  downloadBtn.mousePressed(() => {
    downloadTransparentPng();
  });
}

function updateNewFaceButton() {
  if (!newFaceBtn) return;
  // Keep button label stable (requested)
  newFaceBtn.html('MAKE NEW FRAME!');
  newFaceBtn.style('background', '#fff');
  newFaceBtn.style('color', '#000');
  newFaceBtn.style('border', 'none');
}

function updateFramesToggleButton() {
  if (!framesToggleBtn) return;
  framesToggleBtn.html(showFrames ? 'FRAMES: ON' : 'FRAMES: OFF');

  // Invert button when frames are ON
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

function startPlacingImage(img, name) {
  // If currently creating a face and it is already a polygon, finalize it first.
  if (isPlacing && activeFace && activeFace.points.length >= 3) {
    faces.push(activeFace);
    selectedFace = activeFace;
    activeFace = null;
  }

  isPlacing = false;
  updateNewFaceButton();

  isImagePlacing = true;
  placingImg = img;
  placingImgName = name || '';
}

function updateImageGrid() {
  const grid = select('#image-grid-container');
  if (!grid) return;

  grid.html('');

  sourceImages.forEach((imgData) => {
    const thumb = createDiv();
    thumb.addClass('image-thumb');
    thumb.style('background-image', `url(${imgData.path})`);
    thumb.parent(grid);

    thumb.mousePressed(() => {
      enterImagePlacingMode(imgData.path, imgData.name);
      selectAll('.image-thumb').forEach((el) => el.removeClass('selected'));
      thumb.addClass('selected');
    });

    if (imgData.name === currentImgPath) thumb.addClass('selected');
  });
}

function loadSelectedImage(fullPath, filename) {
  loadImage(fullPath, (img) => {
    selectedImg = img;
    currentImgPath = filename;

    updateImageGrid();
  });
}

function enterImagePlacingMode(fullPath, filename) {
  loadImage(fullPath, (img) => {
    selectedImg = img;
    currentImgPath = filename;
    startPlacingImage(img, filename);
    updateImageGrid();
  });
}

function applyImageToFace(face, img, name) {
  if (!face) return;
  face.image = img;
  face.imageName = name || '';
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
  // Ray-casting algorithm
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

function findNearbyPoint(x, y, radius = 10) {
  const r2 = radius * radius;

  // Active face is visually on top
  if (activeFace && activeFace.points && activeFace.points.length > 0) {
    for (let i = 0; i < activeFace.points.length; i++) {
      const p = activeFace.points[i];
      const dx = x - p.x;
      const dy = y - p.y;
      if (dx * dx + dy * dy <= r2) return { face: activeFace, index: i };
    }
  }

  // Completed faces: topmost first (end of array)
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

function ensureFaceClockwise(face) {
  if (!face || !face.points || face.points.length < 3) return;
  // In screen coordinates (y down), positive area corresponds to clockwise ordering.
  if (polygonSignedArea(face.points) < 0) face.points.reverse();
}

function mousePressed() {
  if (overUI) return;
  const isOutsideCanvas = mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height;
  if (isOutsideCanvas) {
    // Quit frame creation mode when clicking outside canvas
    if (isPlacing) {
      if (activeFace && activeFace.points && activeFace.points.length >= 3) {
        faces.push(activeFace);
        selectedFace = activeFace;
      }
      activeFace = null;
      isPlacing = false;
      updateNewFaceButton();
    }
    return;
  }

  // Vertex edit has priority: drag to move, click to delete
  if (showFrames) {
    const hit = findNearbyPoint(mouseX, mouseY, 14);
    if (hit) {
      draggingPoint = hit;
      draggingMoved = false;
      dragStartX = mouseX;
      dragStartY = mouseY;
      selectedFace = hit.face;
      return;
    }
  }

  // Image placing mode: click a face to apply
  if (isImagePlacing && placingImg) {
    const target = findTopmostFaceAt(mouseX, mouseY);
    if (target) {
      applyImageToFace(target, placingImg, placingImgName);
      selectedFace = target;
    }
    return;
  }

  // While placing: add vertex to active face
  if (isPlacing && activeFace) {
    activeFace.points.push({ x: mouseX, y: mouseY });
    if (activeFace.points.length >= 3) {
      activeFace.points = sortPointsClockwise(activeFace.points);
    }
    return;
  }

  // Otherwise: select face under cursor (topmost first)
  selectedFace = null;
  for (let idx = faces.length - 1; idx >= 0; idx--) {
    const f = faces[idx];
    if (f.points && f.points.length >= 3 && pointInPolygon(mouseX, mouseY, f.points)) {
      selectedFace = f;
      break;
    }
  }

  // (No auto-apply here; applying happens in image placing mode)
}

function mouseDragged() {
  if (!showFrames) return;
  if (!draggingPoint) return;
  if (overUI) return;

  const face = draggingPoint.face;
  const idx = draggingPoint.index;
  if (!face || !face.points || idx < 0 || idx >= face.points.length) return;

  const movedDist2 = (mouseX - dragStartX) * (mouseX - dragStartX) + (mouseY - dragStartY) * (mouseY - dragStartY);
  if (movedDist2 > 9) draggingMoved = true; // ~3px threshold

  face.points[idx].x = constrain(mouseX, 0, width);
  face.points[idx].y = constrain(mouseY, 0, height);
}

function mouseReleased() {
  if (!showFrames) return;
  if (!draggingPoint) return;

  const face = draggingPoint.face;
  const idx = draggingPoint.index;

  if (face && face.points && idx >= 0 && idx < face.points.length) {
    if (!draggingMoved) {
      // Click: delete vertex
      face.points.splice(idx, 1);
      // If a face becomes invalid, clear its image to avoid confusing state
      if (face.points.length < 3) {
        face.image = null;
        face.imageName = '';
      }
    } else {
      // Drag: keep polygon orientation consistent (does not reorder vertices)
      ensureFaceClockwise(face);
    }
  }

  draggingPoint = null;
  draggingMoved = false;
}

function findTopmostFaceAt(x, y) {
  // Active face is drawn on top
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

function drawFaceImageClipped(face) {
  const img = face.image;
  const pts = face.points;
  if (!img || !pts || pts.length < 3) return;

  const ctx = drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.clip();

  // Fit image to the minimal size that fully covers the face's bounding box
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
  const boxW = Math.max(1, maxX - minX);
  const boxH = Math.max(1, maxY - minY);

  const scale = max(boxW / img.width, boxH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const x = cx - w / 2;
  const y = cy - h / 2;
  image(img, x, y, w, h);

  ctx.restore();
}

function drawFaceImageClippedTo(pg, face) {
  const img = face.image;
  const pts = face.points;
  if (!img || !pts || pts.length < 3) return;

  const ctx = pg.drawingContext;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.clip();

  // Fit image to the minimal size that fully covers the face's bounding box
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
  const boxW = Math.max(1, maxX - minX);
  const boxH = Math.max(1, maxY - minY);

  const scale = Math.max(boxW / img.width, boxH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const x = cx - w / 2;
  const y = cy - h / 2;
  pg.image(img, x, y, w, h);

  ctx.restore();
}

function downloadTransparentPng() {
  const pg = createGraphics(width, height);
  pg.pixelDensity(1);
  pg.noSmooth();
  pg.clear(); // transparent background

  for (const face of faces) {
    if (face && face.points && face.points.length >= 3 && face.image) {
      drawFaceImageClippedTo(pg, face);
    }
  }

  if (activeFace && activeFace.points && activeFace.points.length >= 3 && activeFace.image) {
    drawFaceImageClippedTo(pg, activeFace);
  }

  const out = pg.get();
  out.save('260109', 'png');
}

function drawFace(face, isActive, isHover, isCompleted) {
  const pts = face.points;
  if (!pts || pts.length === 0) return;

  // Image fill (clipped)
  if (pts.length >= 3 && face.image) {
    drawFaceImageClipped(face);
  }

  // Hide frame guides (fill/outline/dots) when toggled off
  if (!showFrames) return;

  const lightRed = color(255, 0, 0);
  const frameStroke = isCompleted ? lightRed : color(0);
  const dotFill = isCompleted ? lightRed : color(0);

  // Fill polygon if possible (only when no image)
  if (pts.length >= 3 && !face.image) {
    noStroke();
    if (isCompleted) {
      // Light red tint for completed frames
      fill(255, 210, 210, isActive ? 80 : 55);
    } else {
      fill(0, isActive ? 35 : 20);
    }
    beginShape();
    for (const p of pts) vertex(p.x, p.y);
    endShape(CLOSE);
  }

  // Outline / edges
  stroke(frameStroke);
  strokeWeight(isHover ? 4 : (isActive ? 2 : 1));
  noFill();
  beginShape();
  for (const p of pts) vertex(p.x, p.y);
  endShape(pts.length >= 3 ? CLOSE : undefined);

  // Dots
  noStroke();
  fill(dotFill);
  const baseDotSize = 10;
  const hoverDotSize = 18;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const isDotHover = !!(hoverPoint && hoverPoint.face === face && hoverPoint.index === i);
    const size = isDotHover ? hoverDotSize : baseDotSize;
    circle(p.x, p.y, size);
  }
}

function draw() {
  background(255);

  // Placement hint
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
  }

  // Dot hover (independent of face hover)
  hoverPoint = null;
  if (showFrames) {
    if (!overUI && mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) {
      hoverPoint = findNearbyPoint(mouseX, mouseY, 14);
    }
  }

  // Update hover face only during image placing mode
  hoverFace = null;
  if (isImagePlacing && placingImg) {
    hoverFace = findTopmostFaceAt(mouseX, mouseY);
  }

  // Draw completed faces
  for (const face of faces) {
    drawFace(face, face === selectedFace, face === hoverFace, true);
  }

  // Draw active face on top
  if (activeFace) {
    drawFace(activeFace, true, activeFace === hoverFace, false);
  }

  // Cursor-following image preview during image placing mode
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