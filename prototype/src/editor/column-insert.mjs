import { TextSelection } from '@tiptap/pm/state';

function emptyImageSlot(node) {
  return node?.type.name === 'reportImage' && !node.attrs.imageId;
}

export function columnInsertTarget(view, target, y) {
  const column = target.closest?.('[data-type="column"]');
  if (!column || !view.dom.contains(column)) return null;
  const $inside = view.state.doc.resolve(view.posAtDOM(column, 0));
  let depth = $inside.depth;
  while (depth > 0 && $inside.node(depth).type.name !== 'column') depth--;
  if (!depth) return null;
  const node = $inside.node(depth), start = $inside.start(depth), candidates = [];
  node.forEach((child, offset) => {
    const pos = start + offset, dom = view.nodeDOM(pos);
    if (dom?.getBoundingClientRect) candidates.push({pos, node:child, dom, rect:dom.getBoundingClientRect()});
  });
  const block = candidates.find(item => item.dom === target || item.dom.contains(target))
    ?? candidates.reduce((nearest, item) => {
      const distance = Math.max(item.rect.top - y, 0, y - item.rect.bottom);
      return !nearest || distance < nearest.distance ? {...item, distance} : nearest;
    }, null);
  if (!block?.node.isTextblock && !emptyImageSlot(block?.node)) return null;
  const rect = column.getBoundingClientRect();
  return {pos:block.pos, node:block.node, left:rect.left + 4, top:Math.max(rect.top, Math.min(y - 12, rect.bottom - 24))};
}

export function insertColumnSlash(state, target) {
  if (state.doc.nodeAt(target.pos) !== target.node) return null;
  const $start = state.doc.resolve(target.pos);
  if ($start.parent.type.name !== 'column') return null;
  let cursor, tr;
  if (target.node.isTextblock) {
    cursor = target.pos + 1;
    tr = state.tr.insertText('/', cursor);
  } else if (emptyImageSlot(target.node)) {
    const pos = target.pos + target.node.nodeSize;
    const paragraph = state.schema.nodes.paragraph.create(null, state.schema.text('/'));
    tr = state.tr.insert(pos, paragraph);
    cursor = pos + 1;
  } else return null;
  return tr.setSelection(TextSelection.create(tr.doc, cursor + 1)).scrollIntoView();
}
