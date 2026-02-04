export function styleButton(btn) {
  btn.addClass('action-btn');
}

export function createLabeledSliderRef(parent, labelStr, minVal, maxVal, defaultVal, step, onChange) {
  const row = window.createDiv('').addClass('control-row');
  row.parent(parent);

  const label = window.createSpan(labelStr).addClass('control-label');
  label.parent(row);

  const slider = window.createSlider(minVal, maxVal, defaultVal, step);
  slider.parent(row);
  // CSS handles styling via input[type=range]

  slider.input(() => {
    const v = slider.value();
    if (onChange) onChange(v);
  });

  return {
    slider,
    setValueSilently: (v) => {
      slider.value(v);
    },
    value: () => slider.value()
  };
}

// Legacy shim if referenced elsewhere, though we should migrate all
export function createLabeledSlider(parent, labelStr, minVal, maxVal, defaultVal, step, onChange) {
  return createLabeledSliderRef(parent, labelStr, minVal, maxVal, defaultVal, step, onChange).slider;
}
