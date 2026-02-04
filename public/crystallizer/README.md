# CollageLab

このフォルダは Astro の `/collagelab/` ページで使う p5.js スケッチ（UI込み）です。

## エントリポイント

- `main.js` が読み込まれます（`src/pages/collagelab/index.astro` から `type="module"` で参照）。
- p5.js は `SketchLayout.astro` で CDN 読み込み（global mode）です。

## 構成

- `modules/` : ロジック本体（state / tools / core / ui / generators）
- `source/` : 画像ソース
- `style.css` : UI スタイル

## legacy

- legacy は削除しました（ESM 構成のみを使用）。
