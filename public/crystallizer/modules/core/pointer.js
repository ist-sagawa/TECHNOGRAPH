export function isCoarsePointer() {
  try {
    return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  } catch {
    return false;
  }
}

export function scaleForPointer(base, { coarseMult = 1.0 } = {}) {
  const b = Math.max(1, Number(base || 1));
  return b * (isCoarsePointer() ? coarseMult : 1.0);
}
