<script setup>
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3';
import { PhDotsSixVertical } from '@phosphor-icons/vue';
import { startPointerSort } from './pointer-sort.js';
const props=defineProps(nodeViewProps);
function select(){props.editor.commands.setNodeSelection(props.getPos());props.extension.options.onSelect(props.node.attrs.fieldId)}
function start(e){
  if(e.button!==0)return;
  const grid=e.currentTarget.closest('.report-grid');
  if(!grid)return;
  const snapshot=props.editor.getJSON();
  select();
  startPointerSort({
    event:e,
    container:grid,
    itemSelector:'.field-card[data-sort-id]',
    sourceId:props.node.attrs.fieldId,
    ghostHost:grid.closest('.template-editor')??document.body,
    onReorder:(from,to)=>props.extension.options.onMove(from,to),
    onCancel:()=>props.extension.options.onRestore(snapshot),
  });
}
</script>
<template>
<NodeViewWrapper class="field-card" :data-sort-id="node.attrs.fieldId" :class="{chosen:selected}" :style="{gridColumn:`span ${node.attrs.span}`,textAlign:node.attrs.textAlign,fontWeight:node.attrs.bold?700:500}" contenteditable="false" @click="select">
  <button class="field-grip" :aria-label="`拖动${node.attrs.label}`" title="拖动调整字段顺序" @pointerdown="start"><PhDotsSixVertical :size="19" /></button>
  <button class="field-label" :aria-label="`选择字段${node.attrs.label}`" @click.stop="select">{{node.attrs.label}}</button>
</NodeViewWrapper>
</template>
