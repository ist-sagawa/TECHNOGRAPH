precision mediump float;

// p5.jsから渡される標準的な頂点属性
attribute vec3 aPosition;
attribute vec2 aTexCoord;

// p5.jsが自動的に設定する標準ユニフォーム
uniform mat4 uProjectionMatrix;
uniform mat4 uModelViewMatrix;

// フラグメントシェーダーに渡すテクスチャ座標
varying vec2 vTexCoord;

void main() {
  // p5.jsの標準的な座標変換を適用
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);

  // テクスチャ座標をそのままフラグメントシェーダーへ
  vTexCoord = aTexCoord;
}
