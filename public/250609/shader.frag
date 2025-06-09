precision mediump float;

varying vec2 vTexCoord;    // 頂点シェーダーから渡されるUV座標 (0.0-1.0)

uniform sampler2D tex0;    // 元の画像テクスチャ
uniform float progress;     // 描画進行度合い (0.0-1.0)
uniform float u_time;       // 時間

uniform vec2 u_resolution;
uniform vec2 u_tex0_resolution;

vec2 getCoverUV(vec2 uv, vec2 canvasRes, vec2 textureRes) {
    float canvasAspect = canvasRes.x / canvasRes.y;
    float textureAspect = textureRes.x / textureRes.y;
    
    vec2 scaledUv = uv;
    
    if (canvasAspect > textureAspect) {
        scaledUv.y = (uv.y - 0.5) * (textureAspect / canvasAspect) + 0.5;
    } else {
        scaledUv.x = (uv.x - 0.5) * (canvasAspect / textureAspect) + 0.5;
    }
    
    return scaledUv;
}

// ノイズ関数
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    
    vec2 u = f * f * (3.0 - 2.0 * f);
    
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// エッジ検出（Sobel filter）- 進行度に応じてtexelSizeが増加
float getEdge(vec2 uv, float progressDetail) {
    // 最初は細かく(0.1)から徐々に粗く(0.8)へ、何往復かで書き切る
    float adaptiveTexelSize = mix(0.04, 0.6, progressDetail);
    vec2 texelSize = adaptiveTexelSize / u_tex0_resolution;
    
    // Sobel X kernel
    float sobelX = 
        -1.0 * texture2D(tex0, uv + vec2(-texelSize.x, -texelSize.y)).r +
        -2.0 * texture2D(tex0, uv + vec2(-texelSize.x, 0.0)).r +
        -1.0 * texture2D(tex0, uv + vec2(-texelSize.x, texelSize.y)).r +
         1.0 * texture2D(tex0, uv + vec2(texelSize.x, -texelSize.y)).r +
         2.0 * texture2D(tex0, uv + vec2(texelSize.x, 0.0)).r +
         1.0 * texture2D(tex0, uv + vec2(texelSize.x, texelSize.y)).r;
    
    // Sobel Y kernel
    float sobelY = 
        -1.0 * texture2D(tex0, uv + vec2(-texelSize.x, -texelSize.y)).r +
        -2.0 * texture2D(tex0, uv + vec2(0.0, -texelSize.y)).r +
        -1.0 * texture2D(tex0, uv + vec2(texelSize.x, -texelSize.y)).r +
         1.0 * texture2D(tex0, uv + vec2(-texelSize.x, texelSize.y)).r +
         2.0 * texture2D(tex0, uv + vec2(0.0, texelSize.y)).r +
         1.0 * texture2D(tex0, uv + vec2(texelSize.x, texelSize.y)).r;
    
    return sqrt(sobelX * sobelX + sobelY * sobelY);
}

void main() {
    vec2 uv = getCoverUV(vTexCoord, u_resolution, u_tex0_resolution);
    
    // 段階的な描画：5段階で重複させて連続的に描画
    float stage1Progress = smoothstep(0.0, 0.3, progress);   // 0-30%で0.1texel
    float stage2Progress = smoothstep(0.15, 0.45, progress); // 15-45%で0.2texel
    float stage3Progress = smoothstep(0.3, 0.6, progress);   // 30-60%で0.4texel
    float stage4Progress = smoothstep(0.45, 0.75, progress); // 45-75%で0.6texel
    float stage5Progress = smoothstep(0.6, 1.0, progress);   // 60-100%で0.8texel
    
    // 各段階のエッジを計算
    float edge1 = getEdge(uv, 0.04 / 0.6); // texelSize 0.04相当
    float edge2 = getEdge(uv, 0.08 / 0.6); // texelSize 0.08相当
    float edge3 = getEdge(uv, 0.16 / 0.6); // texelSize 0.16相当
    float edge4 = getEdge(uv, 0.32 / 0.6); // texelSize 0.32相当
    float edge5 = getEdge(uv, 0.48 / 0.6); // texelSize 0.48相当
    
    edge1 = smoothstep(0.06, 0.2, edge1);
    edge2 = smoothstep(0.06, 0.2, edge2);
    edge3 = smoothstep(0.06, 0.2, edge3);
    edge4 = smoothstep(0.06, 0.2, edge4);
    edge5 = smoothstep(0.06, 0.2, edge5);
    
    // 描画方向を組み合わせ
    float drawDir1 = uv.x * 0.6 + uv.y * 0.4; // 斜め方向
    float drawDir2 = uv.y * 0.7 + uv.x * 0.3; // 縦方向重視
    
    float combinedDir = mix(drawDir1, drawDir2, 0.3);
    
    // 手描き風のゆらぎを複数レイヤーで追加
    float wobble1 = noise(uv * 40.0 + u_time * 1.5) * 0.03;
    float wobble2 = noise(uv * 80.0 + u_time * 0.8) * 0.015;
    float wobble3 = noise(uv * 120.0 + u_time * 2.2) * 0.028;
    float timeWobble = noise(vec2(u_time * 2.5)) * 0.24;
    
    float totalWobble = wobble1 + wobble2 + wobble3 + timeWobble;
    
    // 各段階の進行度にゆらぎを適用
    float adjustedStage1Progress = stage1Progress + totalWobble;
    float adjustedStage2Progress = stage2Progress + totalWobble;
    float adjustedStage3Progress = stage3Progress + totalWobble;
    float adjustedStage4Progress = stage4Progress + totalWobble;
    float adjustedStage5Progress = stage5Progress + totalWobble;
    
    // 各段階のdrawMaskを計算
    float drawMask1 = 1.0 - smoothstep(adjustedStage1Progress - 0.08, adjustedStage1Progress + 0.04, combinedDir);
    float drawMask2 = 1.0 - smoothstep(adjustedStage2Progress - 0.08, adjustedStage2Progress + 0.04, combinedDir);
    float drawMask3 = 1.0 - smoothstep(adjustedStage3Progress - 0.08, adjustedStage3Progress + 0.04, combinedDir);
    float drawMask4 = 1.0 - smoothstep(adjustedStage4Progress - 0.08, adjustedStage4Progress + 0.04, combinedDir);
    float drawMask5 = 1.0 - smoothstep(adjustedStage5Progress - 0.08, adjustedStage5Progress + 0.04, combinedDir);
    
    // 各段階の描画強度を計算
    float finalEdge1 = edge1 * drawMask1 * step(0.0, progress);
    float finalEdge2 = edge2 * drawMask2 * step(0.15, progress);
    float finalEdge3 = edge3 * drawMask3 * step(0.3, progress);
    float finalEdge4 = edge4 * drawMask4 * step(0.45, progress);
    float finalEdge5 = edge5 * drawMask5 * step(0.6, progress);
    
    // 全ての段階を合成
    float finalEdge = max(max(max(max(finalEdge1, finalEdge2), finalEdge3), finalEdge4), finalEdge5);
    
    // 白い背景色
    vec3 paperColor = vec3(1.0, 1.0, 1.0);
    
    // インクの色（青いインク）
    vec3 inkColor = vec3(0.1, 0.2, 0.6);
    
    // 最終的な色を計算
    vec3 finalColor = mix(paperColor, inkColor, finalEdge);
    
    gl_FragColor = vec4(finalColor, 1.0);
}
