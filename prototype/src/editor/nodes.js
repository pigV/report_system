import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { VueNodeViewRenderer } from '@tiptap/vue-3';
import { isValidLayout } from '../editor-state.mjs';
import { ReportFieldSpec } from './template-schema.mjs';
import FieldView from './FieldView.vue';
export { ReportGrid } from './template-schema.mjs';
export const layoutGuard=()=>Extension.create({name:'reportLayoutGuard',addProseMirrorPlugins(){return [new Plugin({filterTransaction:tr=>!tr.docChanged||isValidLayout(tr.doc.toJSON())})]}});
export const ReportField=ReportFieldSpec.extend({
  addOptions(){return {onSelect:()=>{},onMove:()=>{}}},
  addNodeView(){return VueNodeViewRenderer(FieldView)},
});
