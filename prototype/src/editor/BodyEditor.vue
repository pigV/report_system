<script setup>
import { shallowRef } from 'vue';
import { YiiEditor } from '@yiitap/vue';
import {closeHistory} from '@tiptap/pm/history';
import {insertTemplateTransaction} from './insert-template.mjs';
import { useBlockDrag } from './use-block-drag.js';
import { bodyExtensions } from './body-schema.mjs';
import { businessSuggestion } from '../free-template/suggestion.js';
import { bodyMenuItems } from '../free-template/menu.mjs';
const props=defineProps({content:Object,readonly:Boolean});
const emit=defineEmits(['update']);
const editor=shallowRef(null);
const {dropLine,startDrag,handleClick}=useBlockDrag(editor,()=>props.readonly);
const suggestion=businessSuggestion(()=>[],bodyMenuItems);
const extensions=[...bodyExtensions({readonly:props.readonly}),{name:'OSlash',configure:{suggestion}},{name:'OSlashZh',configure:{suggestion}}];
function ready(ed){
  editor.value=ed;
  ed.unregisterPlugin('trailingNode');
  ed.view.dom.setAttribute('aria-label',props.readonly?'报告正文预览':'报告正文');
  ed.view.dom.setAttribute('role',props.readonly?'document':'textbox');
  if(!props.readonly)ed.view.dom.setAttribute('aria-multiline','true');
}
function insertTemplate(body){
  if(!editor.value||props.readonly)return false;
  editor.value.view.dispatch(insertTemplateTransaction(editor.value.state,body));
  editor.value.view.dispatch(closeHistory(editor.value.state.tr));
  editor.value.view.focus();
  return true;
}
defineExpose({insertTemplate});
</script>
<template>
<div class="body-editor" :class="{'body-editor-editable':!readonly}" @mousedown.capture="startDrag" @click.capture="handleClick">
  <YiiEditor :content="content" :editable="!readonly" :extensions="extensions" :title="false" locale="zh-CN" page-view="full" :show-main-menu="false" :show-bubble-menu="!readonly" :bubble-menu="['bold','italic','underline','strike']" :show-floating-menu="false" :show-side-node="false" :side-menu="{show:!readonly,add:'empty'}" @create="ready" @update="({editor:e})=>emit('update',e.getJSON())"/>
  <Teleport to="body"><div v-if="dropLine" class="native-drop-line" :style="{left:dropLine.left+'px',top:dropLine.top+'px',width:dropLine.width+'px'}"/></Teleport>
  <div v-if="!readonly" class="body-hint">输入 / 或点击 ＋ 插入内容，拖动块手柄调整顺序。</div>
</div>
</template>
