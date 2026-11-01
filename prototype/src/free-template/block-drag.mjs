import { Selection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';

// One transaction keeps a block move atomic for undo and leaves nested content intact.
export function reorderBlock(state, from, boundary) {
  const positions = [];
  state.doc.forEach((node, pos) => positions.push({ node, pos }));
  const source = positions.find(item => item.pos === from);
  if (!source || ![...positions.map(item => item.pos), state.doc.content.size].includes(boundary)) return null;
  const end = from + source.node.nodeSize;
  if (boundary === from || boundary === end) return null;
  const target = boundary > from ? boundary - source.node.nodeSize : boundary;
  const tr = closeHistory(state.tr).delete(from, end).insert(target, source.node);
  return tr.setSelection(Selection.near(tr.doc.resolve(target))).scrollIntoView();
}
