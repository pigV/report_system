// 【学习09】纯文档排序函数；输入源 pos 和目标 boundary，返回事务或 null，不操作鼠标 DOM。
// 单次移动在同一事务里先删后插，保持图片/表格/分栏的子树完整；调用者负责 dispatch。
import { Selection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';

// One transaction keeps a block move atomic for undo and leaves nested content intact.
// Live drags skip closing history on every crossing and suppress scrolling until drop.
export function reorderBlock(state, from, boundary, { closeGroup = true, scrollIntoView = true } = {}) {
  const positions = [];
  state.doc.forEach((node, pos) => positions.push({ node, pos }));
  const source = positions.find(item => item.pos === from);
  if (!source || ![...positions.map(item => item.pos), state.doc.content.size].includes(boundary)) return null;
  const end = from + source.node.nodeSize;
  if (boundary === from || boundary === end) return null;
  // 目标在源后面时，源先被删除会缩短文档，因此目标边界要减掉整个源节点的 nodeSize。
  const target = boundary > from ? boundary - source.node.nodeSize : boundary;
  let tr = closeGroup ? closeHistory(state.tr) : state.tr;
  tr = tr.delete(from, end).insert(target, source.node);
  // near 寻找附近合法选区，避免把光标硬塞到表格/图片等不接收文字的位置。
  tr = tr.setSelection(Selection.near(tr.doc.resolve(target)));
  return scrollIntoView ? tr.scrollIntoView() : tr;
}
