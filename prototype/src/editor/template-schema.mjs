import { Node, mergeAttributes, getSchema } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import { NodeSelection } from '@tiptap/pm/state';
export const ReportGrid=Node.create({
  name:'reportGrid',group:'block',content:'reportField*',marks:'',isolating:true,
  addAttributes(){return {columns:{default:3},borders:{default:false},columnWidths:{default:[1,1,1]}}},
  parseHTML(){return [{tag:'div[data-report-grid]'}]},
  renderHTML({node,HTMLAttributes}) {return ['div',mergeAttributes(HTMLAttributes,{'data-report-grid':'',class:'report-grid',style:`grid-template-columns:${node.attrs.columnWidths.map(w=>`${w}fr`).join(' ')};`}),0]},
});
export const ReportFieldSpec=Node.create({
  name:'reportField',group:'block',marks:'',atom:true,selectable:true,draggable:false,
  addAttributes(){return {fieldId:{default:''},label:{default:''},bold:{default:false},textAlign:{default:'left'},span:{default:1}}},
  parseHTML(){return [{tag:'div[data-report-field]'}]},
  renderHTML({node,HTMLAttributes}) {return ['div',mergeAttributes(HTMLAttributes,{'data-report-field':node.attrs.fieldId}),node.attrs.label]},
});
export const templateSchema=getSchema([Node.create({name:'doc',topNode:true,content:'reportGrid'}),Node.create({name:'text',group:'inline'}),ReportGrid,ReportFieldSpec]);

// Reorder one field inside the grid with a single transaction. Replacing the
// whole document would re-create every node view and interrupt a live drag.
export function moveFieldTransaction(state, fromId, toId, { closeGroup = false } = {}) {
  const grid = state.doc.firstChild;
  if (!grid || grid.type.name !== 'reportGrid') return null;
  const items = [];
  grid.forEach((node, offset) => items.push({ node, pos: 1 + offset }));
  const fromIndex = items.findIndex(item => item.node.attrs.fieldId === fromId);
  const toIndex = items.findIndex(item => item.node.attrs.fieldId === toId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return null;
  const source = items[fromIndex];
  const from = source.pos;
  const end = from + source.node.nodeSize;
  // Matches moveField: move down lands after the target, move up before it.
  const boundary = toIndex > fromIndex ? items[toIndex].pos + items[toIndex].node.nodeSize : items[toIndex].pos;
  const insertAt = boundary > from ? boundary - source.node.nodeSize : boundary;
  let tr = state.tr;
  if (closeGroup) tr = closeHistory(tr);
  tr = tr.delete(from, end).insert(insertAt, source.node);
  return tr.setSelection(NodeSelection.create(tr.doc, insertAt));
}
