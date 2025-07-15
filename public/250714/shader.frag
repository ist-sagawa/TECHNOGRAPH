precision highp float;

// 頂点シェーダーから受け取るテクスチャ座標
varying vec2 vTexCoord;

// テクスチャ
uniform sampler2D tex0;
uniform float u_time;

// 横ラインのパラメータ
uniform float horizontalYPositions[5];
uniform float horizontalXOffsets[5];
uniform float horizontalHeights[5];
uniform int numHorizontalLines;

// 縦ラインのパラメータ
uniform float verticalXPositions[5];
uniform float verticalYOffsets[5];
uniform float verticalWidths[5];
uniform int numVerticalLines;

void main() {
  vec2 uv = vTexCoord;
  
  // 横ラインの処理（横方向にシフト）
  for (int i = 0; i < 5; i++) {
    if (i >= numHorizontalLines) break;
    
    float lineY = horizontalYPositions[i];
    float lineHeight = horizontalHeights[i];
    float xOffset = horizontalXOffsets[i];
    
    // 現在のピクセルがラインの範囲内かチェック
    if (uv.y >= lineY && uv.y <= lineY + lineHeight) {
      // ラインの中にいる場合、横方向にシフト
      float newX = uv.x - xOffset;
      // 安全な境界処理: 0-1の範囲に制限
      if (newX < 0.0) {
        newX += 1.0;
      } else if (newX > 1.0) {
        newX -= 1.0;
      }
      uv.x = newX;
    }
  }
  
  // 縦ラインの処理（縦方向にシフト）
  for (int i = 0; i < 5; i++) {
    if (i >= numVerticalLines) break;
    
    float lineX = verticalXPositions[i];
    float lineWidth = verticalWidths[i];
    float yOffset = verticalYOffsets[i];
    
    // 現在のピクセルがラインの範囲内かチェック
    if (uv.x >= lineX && uv.x <= lineX + lineWidth) {
      // ラインの中にいる場合、縦方向にシフト
      float newY = uv.y - yOffset;
      // 安全な境界処理: 0-1の範囲に制限
      if (newY < 0.0) {
        newY += 1.0;
      } else if (newY > 1.0) {
        newY -= 1.0;
      }
      uv.y = newY;
    }
  }
  
  // 変形されたUV座標でテクスチャをサンプリング
  vec4 color = texture2D(tex0, uv);
  
  gl_FragColor = color;
}
