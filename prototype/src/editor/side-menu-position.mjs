export function sideMenuOffset({ rect, view, anchorLeft, anchorTop, previous, menuScale, editorScale }) {
  const desiredRight = anchorLeft - 10 * editorScale;
  const desiredTop = Math.max(view.top, Math.min(anchorTop, view.bottom - rect.height));
  return {
    x: (desiredRight - (rect.right - previous.x * menuScale)) / menuScale,
    y: (desiredTop - (rect.top - previous.y * menuScale)) / menuScale,
  };
}
