<script setup>
import { shallowRef, watch, nextTick } from 'vue';
import { YiiEditor } from '@yiitap/vue';
import { ReportGrid, ReportField, layoutGuard } from './nodes';
import { moveFieldTransaction } from './template-schema.mjs';
import { fieldsFor } from '../report-model.mjs';
const props=defineProps({modelValue:Object,selected:String});
const emit=defineEmits(['update:modelValue','select']);
const instance=shallowRef(null);
let lastMoveAt=0;
function moveFieldNow(from,to){
  const editor=instance.value;
  if(!editor||editor.isDestroyed)return;
  // Keep a fast drag as one undo step but never merge it with earlier typing.
  const closeGroup=Date.now()-lastMoveAt>500;
  const tr=moveFieldTransaction(editor.state,from,to,{closeGroup});
  if(!tr)return;
  lastMoveAt=Date.now();
  editor.view.dispatch(tr);
}
function restoreLayout(doc){
  const editor=instance.value;
  if(!editor||editor.isDestroyed)return;
  editor.commands.setContent(doc,{emitUpdate:false});
  emit('update:modelValue',editor.getJSON());
}
const extensions=[ReportGrid,ReportField.configure({onSelect:id=>emit('select',id),onMove:moveFieldNow,onRestore:restoreLayout}),layoutGuard()];
async function selectField(id){await nextTick();const ed=instance.value;if(!ed||ed.isDestroyed||id!==props.selected)return;ed.state.doc.descendants((n,pos)=>{if(n.type.name==='reportField'&&n.attrs.fieldId===id)ed.commands.setNodeSelection(pos)});}
function ready(editor){instance.value=editor;editor.unregisterPlugin('trailingNode');selectField(props.selected)}
watch(()=>props.modelValue,v=>{if(instance.value && JSON.stringify(instance.value.getJSON())!==JSON.stringify(v)){instance.value.commands.setContent(v,{emitUpdate:false});selectField(props.selected)}},{deep:true});
watch(()=>props.selected,selectField);
defineExpose({undo:()=>instance.value?.commands.undo(),redo:()=>instance.value?.commands.redo()});
</script>
<template>
<div class="template-editor" aria-label="Yiitap 模板编辑器">
  <p v-if="!fieldsFor(modelValue).length" class="empty-fields">暂无字段，点击“添加字段”开始配置。</p>
  <YiiEditor :content="modelValue" :extensions="extensions" :title="false" locale="zh-CN" page-view="full" :show-main-menu="false" :show-bubble-menu="false" :show-floating-menu="false" :show-side-node="false" :side-menu="{show:false}" @create="ready" @update="({editor})=>emit('update:modelValue',editor.getJSON())" />
</div>
</template>
