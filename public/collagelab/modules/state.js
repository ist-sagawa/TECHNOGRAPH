export const State = {
  // レイヤー
  allLayers: [],
  layers: {
    brush: null,
    composite: null,
    effect: null,
  },

  // フレーム（Frames）
  faces: [],
  activeFace: null,
  selectedFace: null,
  selectedFaces: [],
  hoverFace: null,

  // Crystalize mode
  isCrystalized: false,
  crystalTone: {
    enabled: true,
    brightness: 1.0,
    contrast: 1.0,
    saturation: 1.0,
    hue: 0
  },

  // インタラクション状態
  isPlacing: false,
  showFrames: false,
  isImagePlacing: false,
  placingImg: null,
  placingImgName: '',

  // ポイント操作
  hoverPoint: null,
  draggingPoint: null,
  draggingMoved: false,
  dragStartX: 0,
  dragStartY: 0,
  draggingFace: null,
  connectedPoints: [],

  // Frame: Free Transform (Photoshop風)
  frameFreeTransform: false,
  // Free Transform を「全体（全フレーム）変形」として扱う
  frameTransformAll: false,
  frameTransform: null,

  // ブラシ状態
  isBrushing: false,
  brushSize: 280,
  brushOpacity: 100,
  brushScatter: 18,
  brushAmount: 1.0,
  brushSingleStamp: false,
  brushRandomRotate: true,
  brushPoints: [], // Renamed from brushPts
  brushMarkers: [],
  brushStamp: null,
  brushPreviewImg: null, // Added for panels.js
  isDrawingPermitted: false,

  // エフェクト（ディザリング）
  effectEnabled: false,
  effectParams: {
    type: 'atkinson',
    threshold: 128,
    pixelSize: 2,
    invert: false,
    brightness: 1.0,
    contrast: 1.0,
    saturation: 1.0,
    hue: 0,
    fgColor: '#000000',
    bgColor: '#ffffff',
    useColor: true
  },

  // テキストレイヤー
  draggingTextLayer: null,

  // ソース画像プール
  sourceImages: [],
  bgImages: [],
  currentSourceName: '',
  currentSourcePath: '',
  currentSourceImg: null,

  // キャンバス背景
  canvasBgColor: '#ffffff',
  canvasBgAlpha: 255,
  canvasBgImg: null,
  canvasBgImgName: '',

  // UIフラグ
  overUI: false,
  needsCompositeUpdate: true,
  needsEffectUpdate: true,
  toolTab: 'BRUSH',
  activeTaskCount: 0,

  // UIエレメント参照の格納場所
  ui: {}
};
