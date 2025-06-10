let myShader;
let animalImage;
let drawProgress = 0;
let startTime = 0;
const drawDuration = 10000; // 10秒で描画完了（少し長めに）
let isAnimating = true;

function preload() {
  myShader = loadShader(
    '/250609/shader.vert',
    '/250609/shader.frag'
  );
  animalImage = loadImage('/250609/man.webp');
}

function setup() {
  const container = document.getElementById('canvas-container');
  const canvas = createCanvas(container.offsetWidth, container.offsetHeight, WEBGL);
  canvas.parent(container);
  
  const loadingElement = document.getElementById('p5_loading');
  if (loadingElement) {
    loadingElement.style.display = 'none';
  }

  shader(myShader);
  noStroke();
  
  startTime = millis();
}

function draw() {
  background(240, 240, 235); // 紙のような背景色
  
  const currentTime = millis();
  const elapsed = currentTime - startTime;
  
  // アニメーションが実行中の場合のみ進行度を更新
  if (isAnimating) {
    drawProgress = constrain(elapsed / drawDuration, 0.0, 1.0);
    
    // 描画が完了したらアニメーションを停止
    if (drawProgress >= 1.0) {
      isAnimating = false;
    }
  }
  
  // シェーダーパラメータを設定
  myShader.setUniform('u_resolution', [width, height]);
  myShader.setUniform('u_tex0_resolution', [animalImage.width, animalImage.height]);
  myShader.setUniform('tex0', animalImage);
  myShader.setUniform('progress', drawProgress);
  myShader.setUniform('u_time', currentTime * 0.001);
  
  // 全画面に描画
  beginShape();
  vertex(-width/2, -height/2, 0, 0, 0);
  vertex(width/2, -height/2, 0, 1, 0);
  vertex(width/2, height/2, 0, 1, 1);
  vertex(-width/2, height/2, 0, 0, 1);
  endShape();
}

function windowResized() {
    const container = document.getElementById('canvas-container');
    if (container) {
        resizeCanvas(container.offsetWidth, container.offsetHeight);
    }
}

// マウスクリックでアニメーションをリスタート
function mousePressed() {
  startTime = millis();
  drawProgress = 0.0;
  isAnimating = true;
}


