export const State = {
  // Canvas size / export options
  // Default: 1080 x 1920 (portrait)
  canvasW: 1080,
  canvasH: 1920,
  canvasPresetIndex: 2,
  transparentBg: false,

  // レイヤー
  allLayers: [],
  layers: {
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

  // ソース画像プール
  sourceImages: [],
  bgImages: [],
  currentSourceName: '',
  currentSourcePath: '',
  currentSourceImg: null,

  // キャンバス背景（固定: 白 + BG Pool画像）
  canvasBgImg: null,
  canvasBgImgName: '',


  // UIフラグ
  overUI: false,
  needsCompositeUpdate: true,
  needsEffectUpdate: true,
  toolTab: 'FRAME',
  activeTaskCount: 0,

  // UIエレメント参照の格納場所
  ui: {}
};
