let windowW = window.innerWidth;
let windowH = window.innerHeight;
const MIN_DIV_NUM_X = 10;
let divNum_x = Math.floor(MIN_DIV_NUM_X + 80 * Math.random()); // よこのブロック数
let divPx = windowW / divNum_x; // ブロックの幅
let divNum_y = Math.ceil(windowH / divPx); // たてのブロック数
let divs = [];
let time = 0;

let cakeStartY = Math.floor(divNum_y * (0.3 + Math.random() * 0.2));

const MIN_CANDLE_NUM = 1;
const MAX_CANDLE_NUM = 10; // 最大のろうそくの数
const MIN_CANDLE_LENGTH = 4; // 最小のろうそくの長さ
let maxCandleLength; // ろうそくの最大の長さ

let chocoRatio = 0.5;
let maxColorNum = 8;

function getRandomUniqueRange(count, min, max) {
  const rangeSize = max - min + 1;
  if (count > rangeSize) {
    throw new Error('count は範囲の要素数以下でなければいけません');
  }
  // 0～rangeSize-1 をシャッフルしてから min を足す方法
  const nums = Array.from({ length: rangeSize }, (_, i) => i + min);
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  return nums.slice(0, count);
}

window.addEventListener("DOMContentLoaded", async () => {
  // Create a new application
  const app = new PIXI.Application();
  // Initialize the application
  await app.init({ antialias: true, resizeTo: window, backgroundColor: 0x000000 });
  // Append the application canvas to the document body
  document.body.appendChild(app.canvas);

  let lastResetTime = performance.now();

  function reset(){
    divNum_x = Math.floor(MIN_DIV_NUM_X + 80 * Math.random());
    divPx = windowW / divNum_x;
    divNum_y = Math.ceil(windowH / divPx);
    cakeStartY = Math.floor(divNum_y * (0.4 + Math.random() * 0.3));
    destroyDivs();
    createCakeBase();
    createCandles();
  }

  function destroyDivs(){
    divs.forEach(div => {
      div.destroy();
    });
    divs = [];
  }

  function createDivs(divX, divY, color){
    let div = new PIXI.Graphics();
    div.beginFill(color)
      .drawRect(divX * divPx, divY * divPx, divPx, divPx)
      .endFill();
    divs.push(div);
    app.stage.addChild(div);
  }

  function createCandleDivs(x, length){
    const candle = new PIXI.Graphics();
    for(let i = 0; i < length; i++){
      if(i < length - 2){
        let grayNum = Math.floor(Math.random() * 10 + 245) - 4;
        let color = new PIXI.Color({
          r:grayNum,
          g:grayNum,
          b:grayNum
        }).toArray();
        createDivs(x, cakeStartY - i - 1, color);
      }else{
        createDivs(x, cakeStartY - i - 1, getRandomCandleFireColor());
      }
    }
  }

  function createCakeBase(){
    chocoRatio = Math.random() * 0.5 + 0.2;
    maxColorNum = Math.floor(Math.random() * 8) + 1;
    for(let i = 0; i < divNum_x; i++){
      for(let j = cakeStartY; j < divNum_y; j++){
        createDivs(i, j, getRandomCakeColor(j));
      }
    }
  }

  function createCandles(){
    let candleNum = Math.floor(Math.random() * (MAX_CANDLE_NUM - MIN_CANDLE_NUM) + MIN_CANDLE_NUM);
    let candleXList = getRandomUniqueRange(candleNum, 0, divNum_x - 1);
    maxCandleLength = cakeStartY;
    for(let i = 0; i < candleNum; i++){
      let candleX = candleXList[i];
      let length = Math.floor(MIN_CANDLE_LENGTH + (maxCandleLength - MIN_CANDLE_LENGTH) * Math.random());
      createCandleDivs(candleX, length);
    }
  }

  function getRandomCakeColor(y){
    if(Math.random() + .1 < (y - cakeStartY) / (divNum_y - cakeStartY)){
      return new PIXI.Color("#FFFFFF").toArray();
    }else{
      // ケーキの色を生成
      const colors = [
        { h: 30, s: 100, l: 25 },   // ダークブラウン
        { h: 0, s: 95, l: 50},    // レッド
        { h: 30, s: 95, l: 50},   // オレンジ
        { h: 340, s: 95, l: 50},  // ピンク
        { h: 210, s: 95, l: 50},  // ブルー
        { h: 120, s: 95, l: 40},  // グリーン
        { h: 280, s: 85, l: 60},  // パープル
        { h: 60, s: 95, l: 50}    // イエロー
      ];
      
      // ランダムに色を選択
      const color = colors[Math.floor(Math.random() * maxColorNum)];
      
      // 茶色と赤色の確率を少し高くする
      if (Math.random() < chocoRatio) {
        const darkColors = [
          { h: 30, s: 100, l: 25 },  // 茶色
          { h: 0, s: 100, l: 25 }    // 暗い赤
        ];
        const darkColor = darkColors[Math.floor(Math.random() * darkColors.length)];
        
        // 色に微妙なブレを加える
        const h = darkColor.h + (Math.random() - 0.5) * 10;  // 色相のブレ
        const s = darkColor.s + (Math.random() - 0.5) * 10;  // 彩度のブレ
        const l = darkColor.l + (Math.random() - 0.5) * 5;   // 明度のブレ
        
        return new PIXI.Color({
          h: Math.max(0, Math.min(360, h)),  // 0-360の範囲に制限
          s: Math.max(0, Math.min(100, s)),  // 0-100の範囲に制限
          l: Math.max(0, Math.min(100, l))   // 0-100の範囲に制限
        }).toArray();
      }
      
      // 明るい色にも微妙なブレを加える
      const h = color.h + (Math.random() - 0.5) * 10;  // 色相のブレ
      const s = color.s + (Math.random() - 0.5) * 10;  // 彩度のブレ
      const l = color.l + (Math.random() - 0.5) * 5;   // 明度のブレ
      
      return new PIXI.Color({
        h: Math.max(0, Math.min(360, h)),  // 0-360の範囲に制限
        s: Math.max(0, Math.min(100, s)),  // 0-100の範囲に制限
        l: Math.max(0, Math.min(100, l))   // 0-100の範囲に制限
      }).toArray();
    }
  }

  function getRandomCandleFireColor(){
    // 赤とオレンジの系統の色を生成
    let r = Math.random() * 30 + 225;  // 225-255の範囲（赤をより強く）
    let g = Math.random() * 70 + 30;   // 30-100の範囲（オレンジの要素を弱く）
    let b = Math.random() * 20;        // 0-20の範囲（青をさらに弱く）
    return new PIXI.Color({
      r:r,
      g:g,
      b:b
    }).toArray();
  }

  createCakeBase();
  createCandles();
  
  // アニメーションループ (毎フレーム実行される処理)
  app.ticker.add((delta) => {
    const currentTime = performance.now();
    if (currentTime - lastResetTime >= 1000) {
      reset();
      lastResetTime = currentTime;
    }
  });

  // マウスの位置によって線の数を変更
  // 中心位置に近いほど線の数が多くなる
  window.addEventListener("mousemove", (e) => {
  });

  window.addEventListener("keydown", (e) => {
    if(e.key === " ") {
      reset();
    }
  });

  window.addEventListener("resize", () => {
    windowW = window.innerWidth;
    windowH = window.innerHeight;
  });
});