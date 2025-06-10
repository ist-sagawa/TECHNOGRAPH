// riso_test.js
let testLayer;

function setup() {
  createCanvas(400, 400);
  background(255); // 白背景

  // Risoレイヤーを1つだけ初期化
  testLayer = new Riso('BLUE'); // 例えば青
  testLayer.fill(255); // 不透明
  testLayer.rect(50, 50, 100, 100); // 簡単な四角形を描画

  drawRiso(); // Riso描画を実行

}

function draw() {
  // drawループは空にするか、あるいは何もしない
  // console.log("draw() called"); // 毎フレーム呼ばれるか確認用
}