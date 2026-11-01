import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { VueNodeViewRenderer } from '@tiptap/vue-3';
import { isCompleteLayout } from '../editor-state.mjs';
import { ReportFieldSpec } from './template-schema.mjs';
import FieldView from './FieldView.vue';
export { ReportGrid } from './template-schema.mjs';
export const layoutGuard=ids=>Extension.create({name:'reportLayoutGuard',addProseMirrorPlugins(){return [new Plugin({filterTransaction:tr=>!tr.docChanged||isCompleteLayout(tr.doc.toJSON(),ids)})]}});
export const ReportField=ReportFieldSpec.extend({
  addOptions(){return {onSelect:()=>{},onMove:()=>{}}},
  addNodeView(){return VueNodeViewRenderer(FieldView)},
});
