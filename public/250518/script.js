let time = 0;   // アニメーションの進行度 (0から1までの値)
const animationSpeed = 8; // 線が伸びる速度 (値が大きいほど速い) 秒速px
const lines = []; // すべての線を格納
let app;
const MAX_LENGTH = window.innerHeight/3;
const MAX_LINES_NUM = 600;
const ZERO_LINE_RATIO = 0.1;
const LINE_WEIGHT = 30;

function createLine(x1,y1,x2,y2,angleNum,speed,color){
  lines.push(new animLine(x1,y1,x2,y2,angleNum,speed,color));
  app.stage.addChild(lines[lines.length - 1].getLine());
}

function createBranch(x,y,length,angleNum,color){
  // angleは0：上、1：右、2：下、3：左
  if(angleNum === 0){
    createLine(x,y,x,y-length,angleNum,animationSpeed,color);
  }else if(angleNum === 1){
    createLine(x,y,x+length,y,angleNum,animationSpeed,color);
  }else if(angleNum === 2){
    createLine(x,y,x,y+length,angleNum,animationSpeed,color);
  }else if(angleNum === 3){
    createLine(x,y,x-length,y,angleNum,animationSpeed,color);
  }
}

function removeLine(line){
  lines.splice(lines.indexOf(line), 1);
  app.stage.removeChild(line.getLine());
}

function reset(){
  // すべての線をdestroy
  [...lines].forEach(line => {
    if (line && line.getLine()) {
      line.destroy();
    }
  });
  
  // 配列を空にする
  lines.length = 0;
  
  // PIXIのステージを完全にクリア
  while(app.stage.children.length > 0) {
    const child = app.stage.children[0];
    app.stage.removeChild(child);
    if (child.destroy) child.destroy();
  }

  // 初回の線を作成
  createBranch(
    app.screen.width/2,
    app.screen.height,
    MAX_LENGTH*Math.random(),
    0,
    getRandomVividColor()
  );
}

function getRandomVividColor(){
  let h = Math.random() * 360;
  let s = 100;
  let l = 50;
  return new PIXI.Color({
    h:h,
    s:s,
    l:l
  }).toArray();
}

function getRandomIntsBetweenExclude(x, y, n, m) {
  const min = Math.min(x, y);
  const max = Math.max(x, y);
  
  // n を除外した配列を作成
  const nums = [];
  for (let i = min; i <= max; i++) {
    if (i !== n) nums.push(i);
  }

  // m が取得可能な数を超えないように調整
  if (m > nums.length) {
    throw new Error("要求された数が範囲内の除外後の数字の数より多いです");
  }

  // ランダムに m 個を選ぶ (Fisher–Yates shuffleを利用)
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }

  return nums.slice(0, m);
}

window.addEventListener("DOMContentLoaded", async () => {
  // Create a new application
  app = new PIXI.Application();
  // Initialize the application
  await app.init({ antialias: true, resizeTo: window, backgroundColor: 0xfefefe });
  // Append the application canvas to the document body
  document.body.appendChild(app.canvas);


  // 初回の線を作成
  createBranch(
    app.screen.width/2,
    app.screen.height,
    MAX_LENGTH*Math.random(),
    0,
    getRandomVividColor()
  );
  
  // アニメーションループ (毎フレーム実行される処理)
  app.ticker.add((delta) => {
    time += delta.deltaTime;

    if(lines.length > MAX_LINES_NUM || lines.length === 0){
      reset();
    }

    // まず全ての線を更新
    lines.forEach(line => {
      line.update(delta.deltaTime);
    });

    // 停止した線をまとめて処理
    const stoppedLines = lines.filter(line => line.stopped);
    stoppedLines.forEach(line => {
      let lineNum;
      if(Math.random() < ZERO_LINE_RATIO){
        lineNum = 0;
      }else{
        lineNum = Math.floor(Math.random() * 2) + 1;
      }
      const angles = getRandomIntsBetweenExclude(0, 3, (line.angleNum + 2) % 4, lineNum);
      const currentX = line.currentX;
      const currentY = line.currentY;
      // app.stage.removeChild(line.getLine()); // 必要なら有効化
      for(let i = 0; i < angles.length; i++){
        createBranch(
          currentX,
          currentY,
          MAX_LENGTH*Math.random(),
          angles[i],
          getRandomVividColor()
        );
      }
    });

    // 停止した線をlines配列からまとめて削除
    for (const line of stoppedLines) {
      const idx = lines.indexOf(line);
      if (idx !== -1) lines.splice(idx, 1);
    }
  });

  // マウスの位置によって線の数を変更
  // 中心位置に近いほど線の数が多くなる
  window.addEventListener("click", (e) => {
    reset()
  });
});

class animLine {
  constructor(startX, startY, endX, endY, angle, speed, color) {
    this.angleNum = angle;
    this.startX = startX;
    this.startY = startY;
    this.currentX = startX;
    this.currentY = startY;
    this.endX = endX;
    this.endY = endY;
    this.length = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
    this.speed = speed;
    this.color = color;
    this.progress = 0;
    this.progressRatio = 0;
    this.started = false;
    this.stopped = false;
    this.line = new PIXI.Graphics();
  }

  draw(x,y) {
    this.line.clear(); // グラフィックをクリア
    this.line.moveTo(this.startX, this.startY).lineTo(x,y).stroke({ 
      width: LINE_WEIGHT, 
      color: this.color,
      cap: 'round' // 先端を丸くする
    });
  }

  update(delta) {
    if(!this.started) {
      this.started = true;
    }
    if (this.stopped) {
      return;
    }
    this.progress += this.speed * delta;
    this.progressRatio = this.progress / this.length
    if (this.progress > this.length) {
      this.progress = this.length;
      this.progressRatio = 1;
      this.currentX = this.endX;
      this.currentY = this.endY;
      this.draw(this.currentX,this.currentY)
      this.speed = 0;
      // this.line.destroy();
      this.stopped = true;
      return;
    }
    this.line.clear();
    this.currentX = this.startX + (this.endX - this.startX) * this.progressRatio;
    this.currentY = this.startY + (this.endY - this.startY) * this.progressRatio;
    this.draw(this.currentX,this.currentY)
  }

  getLine() {
    return this.line;
  }

  destroy() {
    if (this.line) {
      this.line.clear();  // グラフィックをクリア
      this.line.destroy({ children: true, texture: true, baseTexture: true });
      this.line = null;   // 参照を解除
    }
    this.stopped = true;  // 停止状態にする
  }
}