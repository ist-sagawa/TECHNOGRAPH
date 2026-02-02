export function styleButton(btn) {
  btn.style('width', '100%');
  btn.style('padding', '10px');
  btn.style('border', 'none');
  btn.style('font-family', '"Space Mono", monospace');
  btn.style('font-size', '11px');
  btn.style('font-weight', 'bold');
  btn.style('cursor', 'pointer');
  btn.style('background', '#fff');
  btn.style('color', '#0000ff');
  btn.style('text-transform', 'uppercase');
}

export function styleSmallButton(btn) {
  btn.style('padding', '8px');
  btn.style('border', 'none');
  btn.style('font-family', '"Space Mono", monospace');
  btn.style('font-size', '10px');
  btn.style('font-weight', 'bold');
  btn.style('cursor', 'pointer');
  btn.style('background', '#fff');
  btn.style('color', '#0000ff');
}

export function createLabeledSlider(parent, labelStr, minVal, maxVal, defaultVal, step, onChange) {
  const row = window.createDiv('');
  row.parent(parent);
  row.style('display', 'flex');
  row.style('justify-content', 'space-between');
  row.style('align-items', 'center');
  row.style('margin-top', '1px');

  const label = window.createSpan(labelStr + ':');
  label.parent(row);
  label.style('font-size', '9px');
  // label.style('color', '#fff'); // パネル背景によるが、基本黒文字？ script.jsではwhiteだった

  const valDisp = window.createSpan(defaultVal);
  valDisp.parent(row);
  valDisp.style('font-size', '9px');

  const slider = window.createSlider(minVal, maxVal, defaultVal, step);
  slider.parent(parent);
  slider.style('width', '100%');
  slider.style('margin-bottom', '4px');
  slider.input(() => {
    const v = slider.value();
    valDisp.html(v);
    if (onChange) onChange(v);
  });

  return slider;
}

export function createLabeledSliderRef(parent, labelStr, minVal, maxVal, defaultVal, step, onChange) {
  const row = window.createDiv('');
  row.parent(parent);
  row.style('display', 'flex');
  row.style('justify-content', 'space-between');
  row.style('align-items', 'center');
  row.style('margin-top', '1px');

  const label = window.createSpan(labelStr + ':');
  label.parent(row);
  label.style('font-size', '9px');

  const valDisp = window.createSpan(defaultVal);
  valDisp.parent(row);
  valDisp.style('font-size', '9px');
  valDisp.style('font-family', 'monospace');

  const slider = window.createSlider(minVal, maxVal, defaultVal, step);
  slider.parent(parent);
  slider.style('width', '100%');
  slider.style('margin-bottom', '4px');

  slider.input(() => {
    const v = slider.value();
    valDisp.html(v);
    if (onChange) onChange(v);
  });

  return {
    slider,
    setValueSilently: (v) => {
      slider.value(v);
      valDisp.html(v);
    },
    value: () => slider.value()
  };
}
