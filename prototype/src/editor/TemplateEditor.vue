<script setup>
import { shallowRef, watch } from 'vue';
import { YiiEditor } from '@yiitap/vue';
import { ReportGrid, ReportField, layoutGuard } from './nodes';
import { fieldsFor, moveField } from '../report-model.mjs';
const props=defineProps({modelValue:Object,selected:String});
const emit=defineEmits(['update:modelValue','select']);
const instance=shallowRef(null);
const extensions=[ReportGrid,ReportField.configure({onSelect:id=>emit('select',id),onMove:(from,to)=>emit('update:modelValue',moveField(instance.value.getJSON(),from,to))}),layoutGuard(fieldsFor(props.modelValue).map(f=>f.attrs.fieldId))];
function selectField(id){const ed=instance.value;if(!ed)return;ed.state.doc.descendants((n,pos)=>{if(n.type.name==='reportField'&&n.attrs.fieldId===id)ed.commands.setNodeSelection(pos)});}
function ready(editor){instance.value=editor;editor.unregisterPlugin('trailingNode');selectField(props.selected)}
watch(()=>props.modelValue,v=>{if(instance.value && JSON.stringify(instance.value.getJSON())!==JSON.stringify(v)){instance.value.commands.setContent(v,{emitUpdate:false});selectField(props.selected)}},{deep:true});
watch(()=>props.selected,selectField);
defineExpose({undo:()=>instance.value?.commands.undo(),redo:()=>instance.value?.commands.redo()});
</script>
<template>
<div class="template-editor" aria-label="Yiitap 模板编辑器">
  <YiiEditor :content="modelValue" :extensions="extensions" :title="false" locale="zh-CN" page-view="full" :show-main-menu="false" :show-bubble-menu="false" :show-floating-menu="false" :show-side-node="false" :side-menu="{show:false}" @create="ready" @update="({editor})=>emit('update:modelValue',editor.getJSON())" />
</div>
</template>
