precision mediump float;

varying vec2 vTexCoord;    // 頂点シェーダーから渡されるUV座標 (0.0-1.0)

uniform sampler2D tex0;    // 元の画像テクスチャ
uniform vec2 gridSize;     // グリッドの分割数 (cols, rows)
uniform float u_time_seed;  // 時間ベースのシード値

// 2Dベクトルから疑似乱数的な値 (0.0-1.0) を生成する簡易的な関数
float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void main() {
    float col = floor(vTexCoord.x * gridSize.x);
    float row = floor(vTexCoord.y * gridSize.y);

    vec4 finalColor;
    
    float resolutionLevelRand = random(vec2(col, row) + vec2(0.1, -0.1) + u_time_seed * 0.01);
    
    float probabilityForMaxResolution = 0.5; 
    // float maxSubGrid = 40.0; // 「全くモザイクなし」の場合は直接サンプリングするので不要になる

    if (resolutionLevelRand >= (1.0 - probabilityForMaxResolution)) {
        // 「全くモザイクなし」の状態：元のテクスチャ座標でそのままサンプリング
        finalColor = texture2D(tex0, vTexCoord);
    } else {
        // モザイク処理を行う場合
        vec2 cellSize = 1.0 / gridSize; 
        float maxMosaicSubGrid = 8.0; // モザイク時の最大subGrid (1から39段階)

        // resolutionLevelRand を 0.0 ~ (1.0 - probabilityForMaxResolution) の範囲から
        // 0.0 ~ 1.0 の範囲に正規化
        float normalizedRand = resolutionLevelRand / (1.0 - probabilityForMaxResolution);
        
        // maxMosaicSubGrid段階に分割
        float subGridSize = floor(normalizedRand * maxMosaicSubGrid * 8.0) + 1.0;
        subGridSize = clamp(subGridSize, 1.0, maxMosaicSubGrid * 8.0);


        vec2 uvInCell = fract(vTexCoord * gridSize); 
        float subCol = floor(uvInCell.x * subGridSize);
        float subRow = floor(uvInCell.y * subGridSize);
        vec2 cellOriginUV = vec2(col, row) * cellSize;
        vec2 subGridPixelSize = cellSize / subGridSize;
        vec2 subGridPixelUVOriented = vec2(subCol, subRow) * subGridPixelSize;
        vec2 sampleUV = cellOriginUV + subGridPixelUVOriented + (subGridPixelSize * 0.5);
        finalColor = texture2D(tex0, sampleUV);
    }

    gl_FragColor = finalColor;
}
