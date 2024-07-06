export const qs = (selector: string, scope: HTMLElement | Document = document) => {
  return scope.querySelector(selector);
}

export const qsa = (selector: string, scope: HTMLElement | Document = document) => {
  return scope.querySelectorAll(selector);
}

export const addClass = (target: HTMLElement, className: string | Array<string>) => {
  if(typeof className === 'string') {
    target.classList.add(className);
  } else if (Array.isArray(className)) {
    className.forEach((className) => {
      target.classList.add(className);
    });
  }
}

export const removeClass = (target: HTMLElement, className: string | Array<string>) => {
  if(typeof className === 'string') {
    target.classList.remove(className);
  } else if (Array.isArray(className)) {
    className.forEach((className) => {
      target.classList.remove(className);
    });
  }
}

export const toggleClass = (target: HTMLElement, className: string) => {
  target.classList.toggle(className);
}

export const hasClass = (target: HTMLElement, className: string) => {
  return target.classList.contains(className);
}

export const addEvent = (target: HTMLElement | Document | Window |string , type: string, callback: (e: Event) => void, capture = false) => {
  if (typeof target === 'string') {
    const targetEl = document.querySelectorAll(target);
    targetEl.forEach((el: Element) => {
      (el as HTMLElement).addEventListener(type, callback, capture);
    });
    return;
  } else if (typeof target === 'object') {
    target.addEventListener(type, callback, capture);
    return;
  } else {
    console.log('target is not found');
    return;
  }
}

export const removeEvent = (target: NodeList | HTMLElement | Document | string | object, type: string, callback: () => void, capture = false) => {
  if (target instanceof NodeList) {
    target.forEach((el: Node) => {
      (el as HTMLElement).removeEventListener(type, callback, capture);
    });
    return;
  } else if (typeof target === 'string') {
    document.querySelectorAll(target).forEach((el) => {
      el.removeEventListener(type, callback, capture);
    });
    return;
  } else if (target instanceof HTMLElement || target instanceof Document) {
    target.removeEventListener(type, callback, capture);
    return;
  } else {
    console.log('target is not found');
    return;
  }
}

export const randomInt = (max: number, min: number = 0) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const randomBool = (rate = .5) => {
  return Math.random() < rate;
}

export const shuffleArr = (arr: any[]) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const randomPickArr = (arr: any[], num: number = -1) => {
  const result = [];
  const pickedIndices = new Set();
  const arrayLength = arr.length;
  num = num < 0 ? Math.floor(Math.random() * arrayLength) : num;
  const numSamples = Math.min(num, arrayLength); // 抽出する要素数が配列の長さを超えないようにする

  while (pickedIndices.size < numSamples) {
    const randomIndex = Math.floor(Math.random() * arrayLength);
    if (!pickedIndices.has(randomIndex)) {
      pickedIndices.add(randomIndex);
      result.push(arr[randomIndex]);
    }
  }

  return result;
}
