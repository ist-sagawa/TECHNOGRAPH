let myShader;
const images = [];
let currentImageIndex = 0;
let nextImageIndex = 1;
let progress = 0;
const transitionDuration = 6.0; // seconds
const displayDuration = 0.2; // seconds
let timer = 0;
let distortionDirection;

const imageFiles = [
  'animal_01.webp',
  'animal_02.webp',
  'animal_03.webp',
  'animal_04.webp',
  'animal_05.webp',
  'animal_06.webp',
  'animal_07.webp',
  'animal_08.webp',
  'animal_09.webp'
];

function preload() {
  myShader = loadShader(
    '/250606/shader.vert',
    '/250606/shader.frag'
  );
  for (let i = 0; i < imageFiles.length; i++) {
    images.push(loadImage(`/250606/${imageFiles[i]}`));
  }
}

function setup() {
  const container = document.getElementById('canvas-container');
  const canvas = createCanvas(container.offsetWidth, container.offsetHeight, WEBGL);
  canvas.parent(container);
  
  const loadingElement = document.getElementById('p5_loading');
  if (loadingElement) {
    loadingElement.style.display = 'none';
  }

  myShader.setUniform('u_resolution', [width, height]);
  shader(myShader);
  noStroke();

  distortionDirection = createVector(random(-1, 1), random(-1, 1)).normalize();
}

function draw() {
  const deltaTime = window.deltaTime / 1000;
  timer += deltaTime;

  // 状態遷移ロジック
  if (timer > transitionDuration + displayDuration) {
    // 次の画像へ
    currentImageIndex = (currentImageIndex + 1) % images.length;
    nextImageIndex = (currentImageIndex + 1) % images.length;
    timer = 0; // タイマーリセット

    distortionDirection = createVector(random(-1, 1), random(-1, 1)).normalize();
  }
  
  if (timer < transitionDuration) {
    // トランジション中
    progress = timer / transitionDuration;
    // イージング関数を適用
    progress = easeOutExpo(progress);
  } else {
    // 表示中
    progress = 1.0;
  }
  
  const intensity = 0.9 * sin(progress * PI * 3);

  const currentImage = images[currentImageIndex];
  const nextImage = images[nextImageIndex];

  myShader.setUniform('u_resolution', [width, height]);
  myShader.setUniform('u_tex0_resolution', [currentImage.width, currentImage.height]);
  myShader.setUniform('u_tex1_resolution', [nextImage.width, nextImage.height]);
  myShader.setUniform('tex0', currentImage);
  myShader.setUniform('tex1', nextImage);
  myShader.setUniform('progress', progress);
  myShader.setUniform('intensity', intensity);
  myShader.setUniform('u_direction', [distortionDirection.x, distortionDirection.y]);
  
  plane(width, height);
}

function windowResized() {
    const container = document.getElementById('canvas-container');
    if (container) {
        resizeCanvas(container.offsetWidth, container.offsetHeight);
        myShader.setUniform('u_resolution', [width, height]);
    }
}

function easeOutExpo(x) {
  return x === 1 ? 1 : 1 - Math.pow(2, -14 * x);
}
