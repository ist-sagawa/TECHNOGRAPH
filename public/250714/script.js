// public/250714/script.js

// ===== 設定パラメーター =====
const CONFIG = {
  // 画像設定
  IMAGE_COUNT: 4,
  ANIMATIONS_PER_IMAGE: 20,
  
  // アニメーション設定
  MAX_MOVE_DISTANCE: 0.3,
  MOVE_SPEED: 0.02,
  
  // ライン設定
  LINE_SIZE_MIN: 0.05,
  LINE_SIZE_MAX: 0.15,
  
  // ファイルパス
  IMAGE_PATH: '/250714/',
  SHADER_VERT_PATH: '/250714/shader.vert',
  SHADER_FRAG_PATH: '/250714/shader.frag'
};

// ===== グローバル変数 =====
let gameState = {
  imgs: [],
  imgIndex: 0,
  animationCount: 0,
  detectedAreas: []
};

let graphics = {
  shaderVert: null,
  shaderFrag: null,
  theShader: null,
  shaderGraphics: null,
  processedImage: null
};

let animation = {
  currentLine: null,
  isMoving: false
};

// ===== 初期化関数 =====
function preload() {
  loadImages();
  loadShaders();
}

function loadImages() {
  for (let i = 1; i <= CONFIG.IMAGE_COUNT; i++) {
    gameState.imgs.push(loadImage(`${CONFIG.IMAGE_PATH}${i}.webp`));
  }
}

function loadShaders() {
  graphics.shaderVert = loadStrings(CONFIG.SHADER_VERT_PATH);
  graphics.shaderFrag = loadStrings(CONFIG.SHADER_FRAG_PATH);
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  initializeGraphics();
  startMovement('horizontal');
}

function initializeGraphics() {
  const currentImg = getCurrentImage();
  
  graphics.shaderGraphics = createGraphics(currentImg.width, currentImg.height, WEBGL);
  graphics.shaderGraphics.pixelDensity(1);
  graphics.shaderGraphics.noStroke();

  graphics.theShader = graphics.shaderGraphics.createShader(
    graphics.shaderVert.join('\n'), 
    graphics.shaderFrag.join('\n')
  );

  graphics.processedImage = createGraphics(currentImg.width, currentImg.height);
  graphics.processedImage.pixelDensity(1);
  graphics.processedImage.image(currentImg, 0, 0);
}

// ===== アニメーション制御関数 =====
function startMovement(type) {
  animation.isMoving = true;
  animation.currentLine = createLine(type);
  logMovementStart(type);
}

function createLine(type) {
  const line = {
    type,
    totalMoved: 0,
    direction: random() > 0.5 ? 1 : -1,
    offset: 0,
    size: random(CONFIG.LINE_SIZE_MIN, CONFIG.LINE_SIZE_MAX)
  };

  if (type === 'horizontal') {
    line.y = random(0, 1 - line.size);
  } else {
    line.x = random(0, 1 - line.size);
  }

  return line;
}

function updateMovement() {
  if (!animation.isMoving || !animation.currentLine) return;
  
  const movement = CONFIG.MOVE_SPEED * animation.currentLine.direction;
  animation.currentLine.offset += movement;
  animation.currentLine.totalMoved += abs(movement);
  animation.currentLine.offset = constrain(animation.currentLine.offset, -1, 1);
  
  if (animation.currentLine.totalMoved >= CONFIG.MAX_MOVE_DISTANCE) {
    finalizeStep();
  }
}

function finalizeStep() {
  detectArea();
  updateProcessedImage();
  animation.isMoving = false;
  
  gameState.animationCount++;
  
  if (gameState.animationCount >= CONFIG.ANIMATIONS_PER_IMAGE) {
    switchToNextImage();
    gameState.animationCount = 0;
  }
  
  const nextType = animation.currentLine.type === 'horizontal' ? 'vertical' : 'horizontal';
  startMovement(nextType);
}

function switchToNextImage() {
  gameState.imgIndex = (gameState.imgIndex + 1) % gameState.imgs.length;
  console.log(`Image switched to: ${gameState.imgIndex + 1}.webp`);
  
  initializeGraphics();
  gameState.detectedAreas = [];
}

// ===== 描画関数 =====
function draw() {
  background(0);
  updateMovement();
  renderWithShader();
  drawToScreen();
}

function renderWithShader() {
  graphics.shaderGraphics.shader(graphics.theShader);
  setShaderUniforms();
  drawShaderQuad();
}

function setShaderUniforms() {
  graphics.theShader.setUniform('tex0', graphics.processedImage);
  graphics.theShader.setUniform('u_time', millis() * 0.001);
  
  const { horizontal, vertical } = getLineArrays();
  
  graphics.theShader.setUniform('horizontalYPositions', horizontal.y);
  graphics.theShader.setUniform('horizontalXOffsets', horizontal.x);
  graphics.theShader.setUniform('horizontalHeights', horizontal.size);
  graphics.theShader.setUniform('numHorizontalLines', horizontal.y.length);
  
  graphics.theShader.setUniform('verticalXPositions', vertical.x);
  graphics.theShader.setUniform('verticalYOffsets', vertical.y);
  graphics.theShader.setUniform('verticalWidths', vertical.size);
  graphics.theShader.setUniform('numVerticalLines', vertical.x.length);
}

function getLineArrays() {
  const horizontal = { y: [], x: [], size: [] };
  const vertical = { x: [], y: [], size: [] };
  
  if (animation.currentLine) {
    if (animation.currentLine.type === 'horizontal') {
      horizontal.y.push(animation.currentLine.y);
      horizontal.x.push(animation.currentLine.offset);
      horizontal.size.push(animation.currentLine.size);
    } else {
      vertical.x.push(animation.currentLine.x);
      vertical.y.push(animation.currentLine.offset);
      vertical.size.push(animation.currentLine.size);
    }
  }
  
  return { horizontal, vertical };
}

function drawShaderQuad() {
  const { width: w, height: h } = graphics.shaderGraphics;
  
  graphics.shaderGraphics.beginShape();
  graphics.shaderGraphics.vertex(-w/2, -h/2, 0, 0, 0);
  graphics.shaderGraphics.vertex(w/2, -h/2, 0, 1, 0);
  graphics.shaderGraphics.vertex(w/2, h/2, 0, 1, 1);
  graphics.shaderGraphics.vertex(-w/2, h/2, 0, 0, 1);
  graphics.shaderGraphics.endShape(CLOSE);
}

function drawToScreen() {
  const scale = calculateCoverScale();
  const { dx, dy, sw, sh } = scale;
  image(graphics.shaderGraphics, dx, dy, sw, sh);
}

function calculateCoverScale() {
  const iw = graphics.shaderGraphics.width;
  const ih = graphics.shaderGraphics.height;
  const scale = max(width / iw, height / ih);
  const sw = iw * scale;
  const sh = ih * scale;
  const dx = (width - sw) / 2;
  const dy = (height - sh) / 2;
  
  return { dx, dy, sw, sh };
}

// ===== ユーティリティ関数 =====
function updateProcessedImage() {
  const img2d = graphics.shaderGraphics.get();
  graphics.processedImage.clear();
  graphics.processedImage.image(img2d, 0, 0);
}

function detectArea() {
  if (!animation.currentLine) return;
  
  const area = createAreaData();
  gameState.detectedAreas.push(area);
  logAreaDetection(area);
}

function createAreaData() {
  const line = animation.currentLine;
  return {
    type: line.type,
    centerX: line.type === 'horizontal' ? 0.5 : line.x,
    centerY: line.type === 'vertical' ? 0.5 : line.y,
    size: line.size,
    offset: line.offset,
    imageIndex: gameState.imgIndex
  };
}

function getCurrentImage() {
  return gameState.imgs[gameState.imgIndex];
}

// ===== ログ関数 =====
function logMovementStart(type) {
  console.log(`${type} start (count: ${gameState.animationCount + 1})`);
}

function logAreaDetection(area) {
  console.log(`Area: ${area.type}, center(${nf(area.centerX,1,2)},${nf(area.centerY,1,2)}), off:${nf(area.offset,1,3)}, img:${gameState.imgIndex + 1}`);
}

// ===== イベントハンドラー =====
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

