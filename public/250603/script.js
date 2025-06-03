const STOP = false;

gsap.registerPlugin(MotionPathPlugin); // MotionPathPluginを登録

function splitText(textDom) {
  const text = textDom.textContent;
  const words = text.split("");
  const spans = words.map(word => `<span>${word === ' ' ? '&nbsp;' : word}</span>`);
  textDom.innerHTML = spans.join("");
  return textDom.querySelectorAll('span');
}

document.addEventListener("DOMContentLoaded", () => {
  const textEl = document.querySelector("p");
  const spanNodeList = splitText(textEl);

  if (!spanNodeList || spanNodeList.length === 0) {
    console.error("No characters to animate. splitText might have failed or text is empty.");
    return;
  }

  const segmentLength = 40; // 各セグメント(文字)の理想的な長さ（鎖の一片の長さ）
  const liveChars = Array.from(spanNodeList).map((spanElement, i) => {
    const initialX = window.innerWidth / 2;
    const initialY = window.innerHeight / 2;
    
    // ランダムな暗めの寒色を生成
    const randomHue = gsap.utils.random(180, 260); // 色相: シアン(180)～青紫(260)
    const randomSaturation = gsap.utils.random(50, 80); // 彩度: 50%～80%
    const randomLightness = gsap.utils.random(20, 40); // 明度: 20%～40% (暗め)
    const randomColor = `hsl(${randomHue}, ${randomSaturation}%, ${randomLightness}%)`;

    gsap.set(spanElement, { 
      x: initialX,
      y: initialY,
      rotation: 0,
      transformOrigin: "center center",
      color: randomColor, // 生成したランダムカラーを適用
      scale: 1 // 初期スケール
    });
    return {
      el: spanElement,
      x: initialX,
      y: initialY,
      rotation: 0,
      // prevX, prevY は進行方向の計算には引き続き使用
      prevX: initialX,
      prevY: initialY,
      scale: 1,
      scalePhase: gsap.utils.random(0, Math.PI * 2),
      scaleAmplitude: gsap.utils.random(0.5, 1.0),
      // quickSetters
      setX: gsap.quickSetter(spanElement, "x", "px"),
      setY: gsap.quickSetter(spanElement, "y", "px"),
      setRotation: gsap.quickSetter(spanElement, "rotation", "deg")
    };
  });

  const head = liveChars[0];
  // headTargetX, headTargetY は updateHeadDestination内で設定されるので初期値は不要

  function updateHeadDestination() {
    const padding = -150;
    const currentX = gsap.getProperty(head.el, "x");
    const currentY = gsap.getProperty(head.el, "y");

    const targetX = gsap.utils.random(padding, window.innerWidth - padding);
    const targetY = gsap.utils.random(padding, window.innerHeight - padding);

    // 中間制御点をランダムに生成
    // 現在地と目標地点のX座標の間、Y座標の間のランダムな位置
    const controlX = gsap.utils.random(Math.min(currentX, targetX), Math.max(currentX, targetX));
    const controlY = gsap.utils.random(Math.min(currentY, targetY), Math.max(currentY, targetY));
    
    // 移動距離を計算
    const distance = Math.sqrt(Math.pow(targetX - currentX, 2) + Math.pow(targetY - currentY, 2));
    
    // 距離に基づいてdurationを計算 (速度をある程度一定に保つため)
    const speed = 60; // ピクセル/秒 (この値を調整して基本速度を変える)
    let calculatedDuration = distance / Math.random(speed, speed * 1.5);
    const minDuration = 2.0; // 最短duration
    const maxDuration = 4.0; // 最長duration
    const traveltime = gsap.utils.clamp(minDuration, maxDuration, calculatedDuration); // clampで範囲内に収める
    
    gsap.to(head.el, {
      motionPath: {
        path: [
          { x: currentX, y: currentY },      // 開始点 (現在の位置)
          { x: controlX, y: controlY },      // 制御点
          { x: targetX, y: targetY }         // 終了点 (新しい目標地点)
        ],
        curviness: 1.55, // 曲線の度合い (0で直線、1以上でより曲がる)
        autoRotate: false // 独自の回転ロジックを使用するためfalse
      },
      duration: traveltime, // 計算されたdurationを使用
      ease: "none", // 速度を一定にするため、easeは"none"または"linear"が良い
      onComplete: updateHeadDestination // アニメーション完了時に次の目標を設定
    });
  }

  updateHeadDestination();

  // 追従の強さ。1に近いほど硬く、0に近いほど柔らかい鎖のようになる
  const dragStrength = 0.05; // 少し追従を強くしてみる
  const rotationStrength = 0.2;
  // const scaleSpeed = 0.02; // timeの係数として使うので、直接speedとしては使わない

  gsap.ticker.add((time) => { // tickerからtimeを受け取る
    if(STOP) return
    // 先頭の文字の状態を更新
    head.prevX = head.x;
    head.prevY = head.y;
    head.x = gsap.getProperty(head.el, "x");
    head.y = gsap.getProperty(head.el, "y");
    const dxHead = head.x - head.prevX;
    const dyHead = head.y - head.prevY;
    if (Math.abs(dxHead) > 0.01 || Math.abs(dyHead) > 0.01) {
        let targetRotation = Math.atan2(dyHead, dxHead) * (180 / Math.PI);
        head.rotation = gsap.utils.interpolate(head.rotation, targetRotation, rotationStrength * 1.5); 
    }
    head.scale = 1 + Math.sin(time * 0.4 + head.scalePhase) * head.scaleAmplitude;
    head.setRotation(head.rotation);
    gsap.set(head.el, { scale: head.scale });

    // 後続の文字の処理 (i=1から開始)
    for (let i = 1; i < liveChars.length; i++) {
      const segment = liveChars[i];
      const leader = liveChars[i-1];

      let targetXSeg, targetYSeg; // 変数名を変更 (targetX, targetY との衝突を避ける)

      const leaderDx = leader.x - leader.prevX;
      const leaderDy = leader.y - leader.prevY;
      const leaderDistanceMoved = Math.sqrt(leaderDx * leaderDx + leaderDy * leaderDy);

      if (leaderDistanceMoved > 0.1) { // リーダーが十分動いている場合
        // リーダーの移動方向の逆ベクトルを正規化
        const normLeaderDx = -leaderDx / leaderDistanceMoved;
        const normLeaderDy = -leaderDy / leaderDistanceMoved;
        targetXSeg = leader.x + normLeaderDx * segmentLength;
        targetYSeg = leader.y + normLeaderDy * segmentLength;
      } else { // リーダーの動きが小さい場合は、リーダーの現在の向きの後方
        targetXSeg = leader.x - Math.cos(leader.rotation * Math.PI / 180) * segmentLength;
        targetYSeg = leader.y - Math.sin(leader.rotation * Math.PI / 180) * segmentLength;
      }

      segment.prevX = segment.x;
      segment.prevY = segment.y;

      segment.x = gsap.utils.interpolate(segment.x, targetXSeg, dragStrength);
      segment.y = gsap.utils.interpolate(segment.y, targetYSeg, dragStrength);

      // スケールの追従 (リーダーのスケールにゆっくり追従)
      segment.scale = gsap.utils.interpolate(segment.scale, leader.scale, dragStrength * 0.5); // 位置より少し遅めに追従

      const dx = segment.x - segment.prevX;
      const dy = segment.y - segment.prevY;
      let angle = segment.rotation;
      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
          angle = Math.atan2(dy, dx) * (180 / Math.PI);
      } else {
          angle = leader.rotation;
      }
      segment.rotation = gsap.utils.interpolate(segment.rotation, angle, rotationStrength);
      
      segment.setX(segment.x);
      segment.setY(segment.y);
      segment.setRotation(segment.rotation);
      gsap.set(segment.el, { scale: segment.scale });
    }
  });
});