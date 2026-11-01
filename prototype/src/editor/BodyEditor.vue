<script setup>
import { shallowRef } from 'vue';
import { YiiEditor } from '@yiitap/vue';
import {closeHistory} from '@tiptap/pm/history';
import {insertTemplateTransaction} from './insert-template.mjs';
import { PhTextB, PhTextItalic, PhListBullets, PhArrowCounterClockwise } from '@phosphor-icons/vue';
const props=defineProps({content:Object,readonly:Boolean});
const emit=defineEmits(['update']);
const editor=shallowRef(null);
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
<div class="body-editor">
  <div v-if="!readonly" class="body-toolbar" role="toolbar" aria-label="报告正文格式">
    <span>报告正文</span><div class="toolbar-spacer"></div>
    <button title="加粗" aria-label="正文加粗" @mousedown.prevent="editor?.chain().focus().toggleBold().run()"><PhTextB :size="18"/></button>
    <button title="斜体" aria-label="正文斜体" @mousedown.prevent="editor?.chain().focus().toggleItalic().run()"><PhTextItalic :size="18"/></button>
    <button title="项目列表" aria-label="正文列表" @mousedown.prevent="editor?.chain().focus().toggleBulletList().run()"><PhListBullets :size="18"/></button>
    <button title="撤销" aria-label="撤销正文编辑" @mousedown.prevent="editor?.commands.undo()"><PhArrowCounterClockwise :size="17"/></button>
  </div>
  <YiiEditor :content="content" :editable="!readonly" :extensions="[]" :title="false" locale="zh-CN" page-view="full" :show-main-menu="false" :show-bubble-menu="false" :show-floating-menu="false" :show-side-node="false" :side-menu="{show:false}" @create="e=>{editor=e;e.view.dom.setAttribute('aria-label',readonly?'报告正文预览':'报告正文');e.view.dom.setAttribute('role',readonly?'document':'textbox')}" @update="({editor:e})=>emit('update',e.getJSON())"/>
  <div v-if="!readonly" class="body-hint">自由编写报告内容，支持文字格式与列表。</div>
</div>
</template>
