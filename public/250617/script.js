let canvas;
let currentFontSize = 100;
let textContent = 'TECHNOGRAPH';
let textContentArray = textContent.split('');
let font = 'fit-variable';
let speed = 1;
let x = 0;
let spacing = 2;
let textWidthValue = 0;
let time = 0;
let duplicatedText = '';

let motionTextGroup;

let debug = false;

class MotionTextGroup {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.items = [];
  }
  addItem(item) {
    this.items.push(item);
  }
  getWidth() {
    let width = 0;
    for(let item of this.items) {
      width += item.getWidth() + (item !== this.items[this.items.length - 1] ? spacing : 0);
    }
    return width;
  }
  getHeight() {
    return this.items[0].getHeight();
  }
  draw() {
    // まず全体の幅を計算
    let totalWidth = this.getWidth();
    // 開始位置を計算（中央から左端までの距離）
    let startX = this.x - totalWidth / 2;
    
    let currentX = startX;
    for(let i = 0; i < this.items.length; i++) {
      let item = this.items[i];
      item.x = currentX;
      item.y = this.y - item.getHeight()/2;
      item.draw();
      currentX += item.getWidth() + spacing;
    }
  }
  update(time) {
    for(let item of this.items) {
      item.update(time);
    }
  }
}

class MotionText {
  constructor(text, x, y, w, speed, size, index) {
    this.text = text;
    this.x = x;
    this.y = y;
    this.w = w;
    this.speed = speed;
    this.size = size;
    this.index = index;
  }
  getWidth() {
    textSize(this.size);
    textFont(font, {
      fontVariationSettings: `"wdth" ${this.w}`
    });
    return textWidth(this.text);
  }
  getHeight() {
    return textAscent(this.text) + textDescent(this.text);
  }
  draw() {
    noStroke();
    colorMode(HSB);
    fill(random(360), 100, 100);
    textAlign(LEFT, TOP);
    textSize(this.size);
    textFont(font,{
      fontVariationSettings: `"wdth" ${this.w}`
    })
    text(this.text, this.x, this.y);
    if(debug) {
      stroke(255,0,0)
      noFill();
      strokeWeight(1);
      rect(this.x, this.y, this.getWidth(this.text), this.getHeight());
    }
  }
  animateWidth(time) {
    let offset = this.index * 0.5;
    this.w = abs(sin(time + offset*2) * 1000) + 100;
  }
  animateHeight(time) {
    let offset = this.index * 0.5;
    this.size = abs(sin(time/2 + offset) * 300) + 100;
    this.w = abs(cos(time + offset*2) * 1000) + 100;
  }
  update(time) {
    this.animateHeight(time);
    this.animateWidth(time);
  }
}

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  background(255, 255, 255);
  motionTextGroup = new MotionTextGroup(0, height/2);
  for(let i = 0; i < textContentArray.length; i++) {
    motionTextGroup.addItem(new MotionText(textContentArray[i], 0, height/2, 500, speed, currentFontSize, i));
  }
  motionTextGroup.draw();
  motionTextGroup.x = (width - motionTextGroup.getWidth())/2;
  
}

function draw() {
  time += 0.01;
  colorMode(RGB);
  background(0, 0, 0);
  
  // グループの位置を画面中央に設定
  motionTextGroup.x = width/2;
  motionTextGroup.y = height/2;
  
  motionTextGroup.update(time);
  motionTextGroup.draw();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // リサイズ時も中央に配置
  motionTextGroup.x = width/2;
  motionTextGroup.y = height/2;
  // テキストを再複製
  let repeatCount = Math.ceil((width + 1000) / (textWidthValue + spacing));
  duplicatedText = textContent.repeat(repeatCount);
}


