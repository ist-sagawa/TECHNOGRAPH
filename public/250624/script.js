// 設定
const CONFIG = {
  // 表示設定
  text: 'TECHNOGRAPH',
  fontFamily: 'PressStart2P',
  fontUrl: '/fonts/prstart.ttf',
  fontSizeRatio: 0.6, // 画面幅の何倍か
  maxFontSize: 150,
  backgroundColor: 0x0600ff,
  
  // パーティクル設定
  particleColor: 0xffffff,
  particleGridSize: 2,
  particleMinSize: 0.7,
  particleMaxSize: 1.0,
  particleAlpha: 1,
  particleTextureSize: 1,
  maxParticles: 15000,
  brightnessThreshold: 128,
  
  // 物理演算設定
  physics: {
    maxSpeed: 20,
    maxForce: 0.8,
    mouseFleeDistance: 300,
    mouseFleeForce: 20,
    arrivalDistance: 90,
    damping: 1.4
  },
  
  // アニメーション設定
  animation: {
    brightnessSpeed: 0.001,
    brightnessAmplitude: 0.2,
    baseColorBrightness: 0.8
  },
  
  // デバッグ設定
  debug: {
    enabled: true,
    logInterval: 3, // 秒
    maxDebugParticles: 3
  }
};

// グローバル変数
let app;
let particleContainer;
let particles = [];
let mousePosition = { x: 0, y: 0 };
let particleTexture;

// パーティクルクラス
class CustomParticle {
  constructor(x, y, targetX, targetY) {
    // PIXI.Particleを作成
    this.particle = new PIXI.Particle(particleTexture);
    
    // 初期位置
    this.x = x;
    this.y = y;
    this.particle.x = x;
    this.particle.y = y;
    
    // ターゲット位置
    this.targetX = targetX;
    this.targetY = targetY;
    
    // 速度と加速度
    this.vx = 0;
    this.vy = 0;
    this.ax = 0;
    this.ay = 0;
    
    // パラメータ
    this.maxSpeed = CONFIG.physics.maxSpeed;
    this.maxForce = CONFIG.physics.maxForce;
    this.size = Math.random() * (CONFIG.particleMaxSize - CONFIG.particleMinSize) + CONFIG.particleMinSize;
    
    // パーティクルの設定
    this.particle.scaleX = this.size;
    this.particle.scaleY = this.size;
    this.particle.tint = CONFIG.particleColor;
    this.particle.anchorX = 0.5;
    this.particle.anchorY = 0.5;
    
    particleContainer.addParticle(this.particle);
  }
  
  update() {
    // マウスとの距離を計算
    const dx = mousePosition.x - this.x;
    const dy = mousePosition.y - this.y;
    const distToMouse = Math.sqrt(dx * dx + dy * dy);
    
    // マウスから逃げる力
    if (distToMouse < CONFIG.physics.mouseFleeDistance && distToMouse > 0) {
      const fleeForce = CONFIG.physics.mouseFleeForce;
      const fx = -dx / distToMouse * fleeForce;
      const fy = -dy / distToMouse * fleeForce;
      this.ax += fx;
      this.ay += fy;
    }
    
    // ターゲット位置に戻る力
    const tdx = this.targetX - this.x;
    const tdy = this.targetY - this.y;
    const distToTarget = Math.sqrt(tdx * tdx + tdy * tdy);
    
    if (distToTarget > 0.1) {
      let speed = this.maxSpeed;
      
      // 到着の減速
      if (distToTarget < CONFIG.physics.arrivalDistance) {
        speed = (distToTarget / CONFIG.physics.arrivalDistance) * this.maxSpeed;
      }
      
      const tvx = (tdx / distToTarget) * speed;
      const tvy = (tdy / distToTarget) * speed;
      
      this.ax += (tvx - this.vx) * this.maxForce;
      this.ay += (tvy - this.vy) * this.maxForce;
    }
    
    // 物理演算を更新
    this.vx += this.ax;
    this.vy += this.ay;
    this.vx *= CONFIG.physics.damping;
    this.vy *= CONFIG.physics.damping;
    
    // 速度制限
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > this.maxSpeed) {
      this.vx = (this.vx / speed) * this.maxSpeed;
      this.vy = (this.vy / speed) * this.maxSpeed;
    }
    
    // 位置を更新
    this.x += this.vx;
    this.y += this.vy;
    
    // パーティクルの位置を更新
    this.particle.x = this.x;
    this.particle.y = this.y;
    
    // 加速度をリセット
    this.ax = 0;
    this.ay = 0;
    
    // 明るさ変化
    const time = Date.now() * CONFIG.animation.brightnessSpeed;
    const brightness = CONFIG.animation.baseColorBrightness + 
                      Math.sin(time + this.x * 0.01 + this.y * 0.01) * CONFIG.animation.brightnessAmplitude;
    const color = Math.floor(brightness * 255);
    this.particle.tint = (color << 16) | (color << 8) | color;
  }
}

// パーティクルテクスチャを作成
function createParticleTexture() {
  const graphics = new PIXI.Graphics();
  graphics.circle(0, 0, CONFIG.particleTextureSize);
  graphics.fill(CONFIG.particleColor);
  
  particleTexture = app.renderer.generateTexture(graphics);
  graphics.destroy();
}

// Canvas2Dを使用してピクセル抽出
function getTextPixels(text, fontSize, width, height) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = width;
  canvas.height = height;
  
  ctx.font = `${fontSize}px ${CONFIG.fontFamily}, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, width / 2, height / 2);
  
  return ctx.getImageData(0, 0, width, height).data;
}

// フォントを読み込んでテキストをレンダリング
async function loadFontAndCreateParticles() {
  try {
    // フォントスタイルを追加
    const style = document.createElement('style');
    style.innerHTML = `
      @font-face {
        font-family: '${CONFIG.fontFamily}';
        src: url('${CONFIG.fontUrl}') format('truetype');
      }
    `;
    document.head.appendChild(style);
    
    // フォントの読み込みを待つ
    await document.fonts.load(`10px ${CONFIG.fontFamily}`);
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Canvas2Dを使用してピクセルデータを取得
    const fontSize = Math.min(window.innerWidth / 8, CONFIG.maxFontSize) * CONFIG.fontSizeRatio;
    const pixels = getTextPixels(CONFIG.text, fontSize, app.screen.width, app.screen.height);
    
    // パーティクルを作成
    const gridSize = CONFIG.particleGridSize;
    let particleCount = 0;
    
    if (CONFIG.debug.enabled) {
      console.log('Screen size:', app.screen.width, app.screen.height);
      console.log('Font size:', fontSize);
    }
    
    for (let x = 0; x < app.screen.width; x += gridSize) {
      for (let y = 0; y < app.screen.height; y += gridSize) {
        const index = (Math.floor(x) + Math.floor(y) * app.screen.width) * 4;
        const brightness = pixels[index];
        
        if (brightness > CONFIG.brightnessThreshold) {
          const particle = new CustomParticle(
            Math.random() * app.screen.width,
            Math.random() * app.screen.height,
            x,
            y
          );
          particles.push(particle);
          particleCount++;
          
          // デバッグ情報
          if (CONFIG.debug.enabled && particleCount <= CONFIG.debug.maxDebugParticles) {
            console.log(`Particle ${particleCount}:`, { x, y, brightness });
          }
        }
      }
    }
    
    if (CONFIG.debug.enabled) {
      console.log('Total particles created:', particleCount);
      logCharacterDistribution();
    }
    
  } catch (error) {
    console.error('Error creating particles:', error);
  }
  
  // ローディング表示を非表示
  const loadingElement = document.getElementById('p5_loading');
  if (loadingElement) {
    loadingElement.style.display = 'none';
  }
}

// 文字ごとの分布を表示（デバッグ用）
function logCharacterDistribution() {
  const textWidth = app.screen.width;
  const charWidth = textWidth / CONFIG.text.length;
  const charCounts = new Array(CONFIG.text.length).fill(0);
  
  particles.forEach(particle => {
    const charIndex = Math.floor(particle.targetX / charWidth);
    if (charIndex >= 0 && charIndex < CONFIG.text.length) {
      charCounts[charIndex]++;
    }
  });
  
  const chars = CONFIG.text.split('');
  chars.forEach((char, index) => {
    console.log(`文字 "${char}": ${charCounts[index]}個のパーティクル`);
  });
  
  console.log(`平均: ${Math.round(particles.length / CONFIG.text.length)}個/文字`);
}

// 初期化
async function init() {
  try {
    // PIXIアプリケーションを作成
    app = new PIXI.Application();
    
    await app.init({
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: CONFIG.backgroundColor,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    });
    
    document.getElementById('canvas-container').appendChild(app.canvas);
    
    // ParticleContainerを作成
    particleContainer = new PIXI.ParticleContainer(CONFIG.maxParticles, {
      position: true,
      scale: true,
      tint: true,
      alpha: false,
      rotation: false
    });
    app.stage.addChild(particleContainer);
    
    // 初期化処理
    createParticleTexture();
    await loadFontAndCreateParticles();
    setupEventListeners();
    startAnimation();
    
    console.log('Initialization complete');
    
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

// イベントリスナーの設定
function setupEventListeners() {
  // マウス位置の追跡
  const updateMousePosition = (e) => {
    const rect = app.canvas.getBoundingClientRect();
    mousePosition.x = (e.clientX - rect.left) * (app.screen.width / rect.width);
    mousePosition.y = (e.clientY - rect.top) * (app.screen.height / rect.height);
  };
  
  // 複数のイベントリスナーを設定（確実にマウス位置を取得）
  app.canvas.addEventListener('mousemove', updateMousePosition);
  window.addEventListener('mousemove', updateMousePosition);
  document.addEventListener('mousemove', updateMousePosition);
  
  // 初期マウス位置を画面中央に設定
  mousePosition.x = app.screen.width / 2;
  mousePosition.y = app.screen.height / 2;
  
  // ウィンドウリサイズ対応
  window.addEventListener('resize', handleResize);
  
  if (CONFIG.debug.enabled) {
    console.log('Event listeners initialized. Initial mouse position:', mousePosition);
  }
}

// アニメーション開始
function startAnimation() {
  app.ticker.add(() => {
    // パーティクルを更新
    particles.forEach(particle => particle.update());
    
    // ParticleContainerの更新（位置変更を反映）
    particleContainer.update();
    
    // デバッグ情報
    if (CONFIG.debug.enabled && shouldLogDebug()) {
      logDebugInfo();
    }
  });
}

// デバッグログを出力するかチェック
function shouldLogDebug() {
  return Math.floor(Date.now() / 1000) % CONFIG.debug.logInterval === 0 && 
         Date.now() % 1000 < 16;
}

// デバッグ情報をログ出力
function logDebugInfo() {
  let nearMouseCount = 0;
  particles.forEach(particle => {
    const dx = mousePosition.x - particle.x;
    const dy = mousePosition.y - particle.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < CONFIG.physics.mouseFleeDistance) nearMouseCount++;
  });
  
  console.log(
    `マウス近くのパーティクル: ${nearMouseCount}個, ` +
    `マウス位置: (${Math.round(mousePosition.x)}, ${Math.round(mousePosition.y)}), ` +
    `総パーティクル: ${particles.length}個`
  );
}

// リサイズハンドラー
function handleResize() {
  app.renderer.resize(window.innerWidth, window.innerHeight);
  particleContainer.removeParticles();
  particles = [];
  loadFontAndCreateParticles();
}

// DOMContentLoadedで初期化
window.addEventListener('DOMContentLoaded', init);
