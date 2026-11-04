export function effectiveZoom(element) {
  const view = element.ownerDocument.defaultView;
  let zoom = 1;
  for (let node = element; node; node = node.parentElement) {
    const value = Number.parseFloat(view.getComputedStyle(node).zoom);
    if (Number.isFinite(value) && value > 0) zoom *= value;
  }
  return zoom;
}
