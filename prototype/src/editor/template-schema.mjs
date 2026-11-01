import { Node, mergeAttributes, getSchema } from '@tiptap/core';
export const ReportGrid=Node.create({
  name:'reportGrid',group:'block',content:'reportField+',marks:'',isolating:true,
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
