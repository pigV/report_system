<script setup>
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3';
import { PhDotsSixVertical } from '@phosphor-icons/vue';
const props=defineProps(nodeViewProps);
function select(){props.editor.commands.setNodeSelection(props.getPos());props.extension.options.onSelect(props.node.attrs.fieldId)}
function start(e){e.dataTransfer.setData('application/report-field',props.node.attrs.fieldId);e.dataTransfer.effectAllowed='move';select()}
function drop(e){const from=e.dataTransfer.getData('application/report-field');if(from){e.preventDefault();e.stopPropagation();props.extension.options.onMove(from,props.node.attrs.fieldId)}}
</script>
<template>
<NodeViewWrapper class="field-card" :class="{chosen:selected}" :style="{gridColumn:`span ${node.attrs.span}`,textAlign:node.attrs.textAlign,fontWeight:node.attrs.bold?700:500}" contenteditable="false" @click="select" @dragover.prevent @drop="drop">
  <button class="field-grip" draggable="true" :aria-label="`拖动${node.attrs.label}`" title="拖动调整字段顺序" @dragstart="start"><PhDotsSixVertical :size="19" /></button>
  <button class="field-label" :aria-label="`选择字段${node.attrs.label}`" @click.stop="select">{{node.attrs.label}}</button>
</NodeViewWrapper>
</template>
