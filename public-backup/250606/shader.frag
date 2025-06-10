precision mediump float;

varying vec2 vTexCoord;    // 頂点シェーダーから渡されるUV座標 (0.0-1.0)

uniform sampler2D tex0;    // 元の画像テクスチャ
uniform sampler2D tex1;    // もう一方の画像テクスチャ
uniform float progress;     // 進行度合い (0.0-1.0)
uniform float intensity;    // 歪みの強さ

uniform vec2 u_resolution;
uniform vec2 u_tex0_resolution;
uniform vec2 u_tex1_resolution;
uniform vec2 u_direction;

vec2 getCoverUV(vec2 uv, vec2 canvasRes, vec2 textureRes) {
    float canvasAspect = canvasRes.x / canvasRes.y;
    float textureAspect = textureRes.x / textureRes.y;
    
    vec2 scaledUv = uv;
    
    if (canvasAspect > textureAspect) {
        // Canvas is wider than the texture, so we scale Y.
        scaledUv.y = (uv.y - 0.5) * (textureAspect / canvasAspect) + 0.5;
    } else {
        // Canvas is taller than the texture, so we scale X.
        scaledUv.x = (uv.x - 0.5) * (canvasAspect / textureAspect) + 0.5;
    }
    
    return scaledUv;
}

void main() {
    vec2 uv0_cover = getCoverUV(vTexCoord, u_resolution, u_tex0_resolution);
    vec2 uv1_cover = getCoverUV(vTexCoord, u_resolution, u_tex1_resolution);

    vec4 t0 = texture2D(tex0, uv0_cover);
    vec4 t1 = texture2D(tex1, uv1_cover);

    // 輝度を計算
    float gray0 = dot(t0.rgb, vec3(0.299, 0.587, 0.114));
    float gray1 = dot(t1.rgb, vec3(0.299, 0.587, 0.114));

    // ディスプレイスメントベクターを計算
    vec2 disp = u_direction * (gray1 - gray0) * intensity;
    
    // 片方の画像は正方向、もう一方は逆方向に歪ませる
    vec2 uv0 = uv0_cover + disp * (1.0 - progress);
    vec2 uv1 = uv1_cover - disp * progress;

    // 歪ませたUV座標でテクスチャをサンプリング
    vec4 color0 = texture2D(tex0, uv0);
    vec4 color1 = texture2D(tex1, uv1);

    // 2つの画像をクロスフェードでミックス
    gl_FragColor = mix(color0, color1, progress);
}
