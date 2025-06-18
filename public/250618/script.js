// p5.js sketch: Wavy lines radiating from the center

let lines = [];
const SPAWN_INTERVAL = 3; // フレーム間隔で新しいラインを追加
const MAX_LINES = 60;      // 最大ライン本数
let loading

// リセット関連
let resetTimer = 0;          // 経過フレーム数
const RESET_DELAY = 240;     // 全線完成後にリセットするまでのフレーム数（約4秒）

let colorRandomNum;

async function setup() {
  loading = document.getElementById('p5_loading');
  loading.style.display = 'none';
  // キャンバスをページ内 #canvas-container に追加
  const container = document.getElementById('canvas-container');
  const c = createCanvas(window.innerWidth, window.innerHeight);
  if (container) {
    c.parent(container);
  }

  colorMode(HSB, 360, 100, 100, 100);
  strokeCap(ROUND);
  background(0);
  colorRandomNum = random(280);
}

function draw() {
  background(0, 0, 0, 6); // 半透明で残像を少し残す
  translate(width / 2, height / 2);

  // 既存ラインの描画／更新
  for (const l of lines) {
    l.update();
    l.show();
  }

  // 一定間隔で新しいラインを追加
  if (frameCount % SPAWN_INTERVAL === 0 && lines.length < MAX_LINES) {
    lines.push(new WavyLine(random(TWO_PI)));
  }

  // --- 完成判定＆リセット処理 ---
  const allFinished =
    lines.length >= MAX_LINES && lines.every((l) => l.isFinished());

  if (allFinished) {
    resetTimer++;
    if (resetTimer > RESET_DELAY) {
      // リセット：線と色を初期化
      lines = [];
      colorRandomNum = random(280);
      background(0);
      resetTimer = 0;
    }
  } else {
    resetTimer = 0; // 未完の間はタイマーを戻す
  }
}

class WavyLine {
  constructor(angle) {
    this.angle = angle;
    this.dir = p5.Vector.fromAngle(angle);           // 進行方向
    this.perp = createVector(-this.dir.y, this.dir.x); // 垂直方向

    this.len = 0;                        // 現在の長さ
    this.maxLen = random(350, 600);      // 伸びる最大長
    this.growthSpeed = random(2, 4);     // 伸びる速度

    // 波パラメータ
    this.amp = random(8, 22);           // 振幅
    this.freq = random(0.001, 0.05);     // 周波数
    this.phase = random(TWO_PI);        // 位相

    // 描画パラメータ
    this.weight = random(40, 80);
    this.hue = random(colorRandomNum, colorRandomNum + 80);
  }

  update() {
    if (this.len < this.maxLen) {
      this.len = min(this.len + this.growthSpeed, this.maxLen);
    }
  }

  show() {
    noFill();
    stroke(this.hue, 80, 90);
    strokeWeight(this.weight);

    beginShape();
    vertex(0, 0);
    const t = millis() / 1000; // 秒単位時間
    for (let d = 4; d <= this.len; d += 4) {
      // 起点付近でいきなり大きく揺れないよう、距離 d に応じて振幅をイージング
      const ease = constrain(d / 60, 0, 1); // 距離 60px まで線形で 0→1
      const offset = this.amp * ease * sin(this.freq * d - this.phase + t * 2);
      const x = this.dir.x * d + this.perp.x * offset;
      const y = this.dir.y * d + this.perp.y * offset;
      vertex(x, y);
    }
    endShape();
  }

  // 伸び切ったか判断するユーティリティ
  isFinished() {
    return this.len >= this.maxLen;
  }
}

function windowResized() {
  resizeCanvas(window.innerWidth, window.innerHeight);
}
