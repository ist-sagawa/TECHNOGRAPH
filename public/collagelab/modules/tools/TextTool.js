import { State } from '../state.js';

function findTextLayerAt(mx, my) {
  // レイヤーを逆順（上から）チェック
  for (let i = State.allLayers.length - 1; i >= 0; i--) {
    const layer = State.allLayers[i];
    if (layer.type === 'text') {
      const t = layer.data;
      const str = String(t.text || '');
      const size = Number(t.size || 0);
      const halfW = size * str.length * 0.3;
      const halfH = size * 0.5;
      if (
        mx > t.x - halfW &&
        mx < t.x + halfW &&
        my > t.y - halfH &&
        my < t.y + halfH
      ) {
        return t;
      }
    }
  }
  return null;
}

export function handleTextPress() {
  const txt = findTextLayerAt(window.mouseX, window.mouseY);
  if (txt) {
    State.draggingTextLayer = {
      layer: txt,
      offsetX: txt.x - window.mouseX,
      offsetY: txt.y - window.mouseY
    };
    return true;
  }
  return false;
}

export function handleTextDrag() {
  if (State.draggingTextLayer) {
    const l = State.draggingTextLayer.layer;
    l.x = window.constrain(window.mouseX + State.draggingTextLayer.offsetX, 0, window.width);
    l.y = window.constrain(window.mouseY + State.draggingTextLayer.offsetY, 0, window.height);
    State.needsCompositeUpdate = true;
    return true;
  }
  return false;
}
