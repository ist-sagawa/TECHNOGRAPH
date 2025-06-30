// 設定
const CONFIG = {
  // SVGファイルのパス
  svgFiles: [
    '/250630/fill_01.svg',
    '/250630/fill_02.svg',
    '/250630/fill_03.svg',
    '/250630/fill_05.svg',
    '/250630/fill_07.svg',
  ],
  
  // グリッド設定
  gridSize: 80,
  gridSizeLarge: 160,  // 画面幅1200px以上の時のグリッドサイズ
  largeScreenBreakpoint: 1200,  // 大画面判定のブレークポイント
  
  // 空白セルの確率（0-1）
  emptyProbability: 0.7,  // 元の設定に戻す
  
  // 背景色
  backgroundColor: '#000000',  // 黒に戻す
  
  // 基本色（最終的に表示される色）
  baseColor: '#0600FF',  // ブルー
  
  // フリッカー時のカラーパレット
  flickerColors: [
    '#FF006E',  // ピンク
    '#FB5607',  // オレンジ
    '#FFBE0B',  // イエロー
    '#8338EC',  // パープル
    '#06FFB4',  // ミント
    '#FF4365',  // コーラル
    '#00F5FF',  // シアン
    '#C77DFF',  // ライトパープル
    '#7209B7',  // ディープパープル
  ],
  
  // アニメーション設定
  animation: {
    enabled: true,
    sequentialDelay: 5,  // 各セルの切り替わり間隔（ミリ秒）
    emptyProbabilityOnChange: 0.4,  // 元の設定に戻す
    flickerCount: 5,  // カチャカチャ切り替わる回数
    flickerDelay: 40, // カチャカチャ切り替わる間隔（ミリ秒）
    cycleResetDelay: 2000,
  },
  
  // デバウンス設定
  resizeDebounceDelay: 300,
  
  // デバッグモード
  debug: false
};

// アプリケーションの状態管理
class AppState {
  constructor() {
    this.svgContents = [];
    this.draw = null;
    this.isLoading = true;
    this.cells = [];
    this.animationStartTime = 0;
    this.currentCycleStartTime = 0;
    this.currentCycleNumber = 0;
    this.cellsChangedInCurrentCycle = 0;
    this.currentCellIndexToAnimate = 0;
    this.isResettingCycle = false;
    this.animationFrameId = null;
  }
  
  reset() {
    this.cells.forEach(cell => cell.destroy());
    this.cells = [];
    this.currentCycleStartTime = Date.now();
    this.currentCycleNumber = 0;
    this.cellsChangedInCurrentCycle = 0;
    this.currentCellIndexToAnimate = 0;
    this.isResettingCycle = false;
  }
  
  stopAnimation() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}

// グリッドセルクラス
class GridCell {
  constructor(x, y, svgIndex, rotation, index) {
    this.x = x;
    this.y = y;
    this.svgIndex = svgIndex;  // -1の場合は空白
    this.rotation = rotation;
    this.group = null;
    this.index = index;  // グリッド内のインデックス（左上から順番）
    this.isAnimating = false;
    this.lastChangeTime = 0;  // 最後に変更された時間
    this.lastChangeCycle = -1;  // 最後に変更されたサイクル番号
  }
  
  getFlickerColor() {
    // フリッカー時のみランダムカラーを返す
    return CONFIG.flickerColors[Math.floor(Math.random() * CONFIG.flickerColors.length)];
  }
  
  // 現在の時刻に基づいてこのセルが変更されるべきかを判定
  shouldChange(currentTime) {
    if (!CONFIG.animation.enabled || this.isAnimating) return false;
    
    // このサイクルで既に変更されている場合はfalse
    if (this.lastChangeCycle === state.currentCycleNumber) return false;
    
    // サイクル開始からの経過時間
    const elapsedInCycle = currentTime - state.currentCycleStartTime;
    
    // このセルが変更されるタイミング
    const changeTime = this.index * CONFIG.animation.sequentialDelay;
    
    // 変更タイミングに達している
    return elapsedInCycle >= changeTime;
  }
  
  async changeSVG() {
    if (this.isAnimating) return;
    this.isAnimating = true;

    try {
      const finalState = this.generateRandomState();
      await this.animateFlicker(finalState);
      
      this.lastChangeTime = Date.now();
      this.lastChangeCycle = state.currentCycleNumber;
      state.cellsChangedInCurrentCycle++;
    } finally {
      this.isAnimating = false;
    }
  }

  async handleMouseOver() {
    if (this.isAnimating) return;
    this.isAnimating = true;

    try {
      const newState = this.generateRandomState();
      await this.animateFlicker(newState);
    } finally {
      this.isAnimating = false;
    }
  }
  
  generateRandomState() {
    const shouldBeEmpty = Math.random() < CONFIG.animation.emptyProbabilityOnChange;
    
    if (shouldBeEmpty) {
      return { svgIndex: -1, rotation: 0, color: null };
    }
    
    let svgIndex = Math.floor(Math.random() * state.svgContents.length);
    if (svgIndex === this.svgIndex && state.svgContents.length > 1) {
      svgIndex = (svgIndex + 1) % state.svgContents.length;
    }
    
    const rotation = Math.floor(Math.random() * 4) * 90;
    // 最終状態では基本色（青）を使用
    const color = CONFIG.baseColor;
    return { svgIndex, rotation, color };
  }
  
  async animateFlicker(finalState) {
    const { flickerCount, flickerDelay } = CONFIG.animation;
    
    // フリッカー時はカラフルに
    for (let i = 0; i < flickerCount; i++) {
      const tempState = this.generateRandomState();
      // フリッカー時のみランダムカラーを使用
      tempState.color = this.getFlickerColor();
      this.applySVGState(tempState.svgIndex, tempState.rotation, tempState.color);
      await Utils.delay(flickerDelay);
    }
    
    // 最終状態では基本色（青）に戻す
    this.applySVGState(finalState.svgIndex, finalState.rotation, finalState.color);
  }

  // ヘルパーメソッド：SVGの状態を適用（グループの作成/更新）
  applySVGState(svgIndex, rotation, color = null) {
    this.destroy();
    
    this.svgIndex = svgIndex;
    this.rotation = rotation;
    
    if (svgIndex !== -1) {
      this.group = SVGManager.createGroup(
        state.svgContents[svgIndex], 
        this.x, 
        this.y, 
        rotation,
        color || CONFIG.baseColor  // デフォルトは基本色
      );
    } else {
      // 空白セルの場合、透明な矩形を作成してマウスイベントを受け取れるようにする
      this.group = SVGManager.createEmptyGroup(this.x, this.y);
    }
    
    if (this.group) {
      this.group.on('mouseover', () => this.handleMouseOver());
    }
  }
  
  destroy() {
    if (this.group) {
      this.group.remove();
      this.group = null;
    }
  }
}

// SVG管理クラス
class SVGManager {
  static async loadSVGFiles() {
    try {
      const promises = CONFIG.svgFiles.map(url => 
        fetch(url)
          .then(response => {
            if (!response.ok) {
              throw new Error(`Failed to load ${url}: ${response.statusText}`);
            }
            return response.text();
          })
          .catch(error => {
            console.error(`Error loading ${url}:`, error);
            return null;
          })
      );
      
      const results = await Promise.all(promises);
      return results.filter(content => content !== null);
    } catch (error) {
      console.error('Failed to load SVG files:', error);
      return [];
    }
  }
  
  static createGroup(svgContent, x, y, rotation, color = null) {
    if (!state.draw || !svgContent) return null;
    
    const currentGridSize = Utils.getCurrentGridSize();
    const group = state.draw.group();
    
    try {
      group.svg(svgContent);
      const svgElement = group.first();
      
      if (svgElement) {
        svgElement.size(currentGridSize, currentGridSize);
        group.move(x, y);
        
        // 色を適用
        if (color) {
          // SVG内のすべてのパス、ポリゴン、サークルなどに色を適用
          svgElement.find('path, polygon, circle, ellipse, rect, line, polyline').forEach(element => {
            element.fill(color);
            element.stroke(color);
          });
        }
        
        if (rotation !== 0) {
          const cx = x + currentGridSize / 2;
          const cy = y + currentGridSize / 2;
          group.rotate(rotation, cx, cy);
        }
      }
      
      return group;
    } catch (error) {
      console.error('Error creating SVG group:', error);
      group.remove();
      return null;
    }
  }
  
  static createEmptyGroup(x, y) {
    if (!state.draw) return null;
    
    const currentGridSize = Utils.getCurrentGridSize();
    const group = state.draw.group();
    
    try {
      // 透明な矩形を作成してマウスイベントを受け取れるようにする
      const rect = group.rect(currentGridSize, currentGridSize)
                       .fill('rgba(0,0,0,0)')  // 完全に透明
                       .stroke('none')
                       .move(x, y);
      
      // ポインターイベントを有効にする
      group.style('pointer-events', 'all');
      
      return group;
    } catch (error) {
      console.error('Error creating empty group:', error);
      group.remove();
      return null;
    }
  }
}

// ユーティリティクラス
class Utils {
  static getCurrentGridSize() {
    return window.innerWidth >= CONFIG.largeScreenBreakpoint 
      ? CONFIG.gridSizeLarge 
      : CONFIG.gridSize;
  }
  
  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}

// グリッド管理クラス
class GridManager {
  static render() {
    this.clearCanvas();
    state.reset();
    this.drawGrid();
  }
  
  static clearCanvas() {
    if (!state.draw) return;
    
    state.draw.clear();
    state.draw
      .rect(window.innerWidth, window.innerHeight)
      .fill(CONFIG.backgroundColor);
  }
  
  static drawGrid() {
    const currentGridSize = Utils.getCurrentGridSize();
    const cols = Math.ceil(window.innerWidth / currentGridSize);
    const rows = Math.ceil(window.innerHeight / currentGridSize);
    
    let cellIndex = 0;
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * currentGridSize;
        const y = row * currentGridSize;
        const cell = this.createCell(x, y, cellIndex);
        state.cells.push(cell);
        cellIndex++;
      }
    }
  }
  
  static createCell(x, y, index) {
    const cell = new GridCell(x, y, -1, 0, index);  // まずは空白で作成
    
    if (Math.random() < CONFIG.emptyProbability) {
      // 空白セルとして残す（透明な矩形が作成される）
      cell.applySVGState(-1, 0, null);
    } else {
      // SVGを表示
      const svgIndex = Math.floor(Math.random() * state.svgContents.length);
      const rotation = Math.floor(Math.random() * 4) * 90;
      cell.applySVGState(svgIndex, rotation, CONFIG.baseColor);
    }
    
    return cell;
  }
}

// アニメーション管理クラス
class AnimationManager {
  static start() {
    if (!CONFIG.animation.enabled) return;
    
    state.animationStartTime = Date.now();
    state.currentCycleStartTime = Date.now();
    state.currentCycleNumber = 0;
    state.cellsChangedInCurrentCycle = 0;
    state.currentCellIndexToAnimate = 0;
    state.isResettingCycle = false;
    
    this.animate();
  }
  
  static animate() {
    if (state.isResettingCycle) {
      state.animationFrameId = requestAnimationFrame(() => this.animate());
      return;
    }

    const currentTime = Date.now();
    
    if (state.currentCellIndexToAnimate < state.cells.length) {
      const cell = state.cells[state.currentCellIndexToAnimate];
      if (cell.shouldChange(currentTime)) {
        cell.changeSVG();
        state.currentCellIndexToAnimate++;
      }
    } else {
      this.resetCycle();
    }
    
    state.animationFrameId = requestAnimationFrame(() => this.animate());
  }
  
  static resetCycle() {
    state.isResettingCycle = true;
    
    setTimeout(() => {
      state.currentCycleStartTime = Date.now();
      state.currentCycleNumber++;
      state.cellsChangedInCurrentCycle = 0;
      state.currentCellIndexToAnimate = 0;
      state.isResettingCycle = false;
      
      if (CONFIG.debug) {
        console.log(`Starting cycle ${state.currentCycleNumber}`);
      }
    }, CONFIG.animation.cycleResetDelay);
  }
}

// アプリケーションクラス
class App {
  static async init() {
    try {
      // SVG.jsキャンバスを作成
      state.draw = SVG()
        .addTo('#canvas-container')
        .size(window.innerWidth, window.innerHeight);
      
      // SVGファイルを読み込む
      state.svgContents = await SVGManager.loadSVGFiles();
      
      if (state.svgContents.length === 0) {
        throw new Error('No SVG files loaded');
      }
      
      // 初回描画
      GridManager.render();
      
      // イベントリスナーを設定
      this.setupEventListeners();
      
      // アニメーションループを開始
      AnimationManager.start();
      
      // ローディング完了
      this.hideLoading();
      
    } catch (error) {
      console.error('Initialization failed:', error);
      this.showError('Failed to initialize application');
    }
  }
  
  static setupEventListeners() {
    // ウィンドウリサイズ
    window.addEventListener('resize', Utils.debounce(() => {
      if (!state.draw) return;
      
      state.draw.size(window.innerWidth, window.innerHeight);
      GridManager.render();
    }, CONFIG.resizeDebounceDelay));
    
    // クリックで再生成
    document.addEventListener('click', (event) => {
      // SVG要素上のクリックは無視
      if (event.target.closest('svg')) return;
      
      GridManager.render();
    });
    
    // ページ離脱時のクリーンアップ
    window.addEventListener('beforeunload', () => {
      state.stopAnimation();
    });
  }
  
  static hideLoading() {
    const loadingElement = document.getElementById('p5_loading');
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
    state.isLoading = false;
  }
  
  static showError(message) {
    const loadingElement = document.getElementById('p5_loading');
    if (loadingElement) {
      loadingElement.textContent = message;
      loadingElement.style.color = '#ff0000';
    }
  }
}

// グローバル状態インスタンス
const state = new AppState();

// DOMが読み込まれたら初期化
document.addEventListener('DOMContentLoaded', () => App.init());
