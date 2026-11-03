<script setup>
import { shallowRef,ref } from 'vue';
import { YiiEditor } from '@yiitap/vue';
import {closeHistory} from '@tiptap/pm/history';
import {replaceSectionsTransaction} from './report-sections.mjs';
import {imageLayout} from './report-images.mjs';
import { useBlockDrag } from './use-block-drag.js';
import { bodyExtensions } from './body-schema.mjs';
import ColumnInsertControl from './ColumnInsertControl.vue';
import { businessSuggestion } from '../free-template/suggestion.js';
import { bodyMenuItems } from '../free-template/menu.mjs';
const props=defineProps({content:Object,readonly:Boolean,scope:Object,selectedImage:String});
const emit=defineEmits(['update']);
const editor=shallowRef(null);
const {dropLine,startDrag,handleClick}=useBlockDrag(editor,()=>props.readonly);
const suggestion=businessSuggestion(()=>[],bodyMenuItems);
const extensions=[...bodyExtensions({readonly:props.readonly,getScope:()=>props.scope,getSelected:()=>props.selectedImage}),{name:'OSlash',configure:{suggestion}},{name:'OSlashZh',configure:{suggestion}}];
const layoutDialog=ref(null),rows=ref(1),columns=ref(3);let layoutRange=null;
function customPictures(event){if(props.readonly)return;layoutRange=event.detail.range;layoutDialog.value.showModal()}
function addPictures(){const ed=editor.value;if(!ed||props.readonly)return;ed.chain().focus().deleteRange(layoutRange).insertContent([...imageLayout(Number(rows.value),Number(columns.value)),{type:'paragraph'}]).run();layoutDialog.value.close()}
function ready(ed){
  editor.value=ed;
  ed.unregisterPlugin('trailingNode');
  ed.view.dom.setAttribute('aria-label',props.readonly?'报告正文预览':'报告正文');
  ed.view.dom.setAttribute('role',props.readonly?'document':'textbox');
  if(!props.readonly)ed.view.dom.setAttribute('aria-multiline','true');
}
function insertTemplate(entry){
  if(!editor.value||props.readonly)return false;
  editor.value.view.dispatch(replaceSectionsTransaction(editor.value.state,entry));
  editor.value.view.dispatch(closeHistory(editor.value.state.tr));
  editor.value.view.focus();
  return true;
}
defineExpose({insertTemplate});
</script>
<template>
<div class="body-editor" :class="{'body-editor-editable':!readonly}" @mousedown.capture="startDrag" @click.capture="handleClick" @report-custom-pictures="customPictures">
  <YiiEditor :content="content" :editable="!readonly" :extensions="extensions" :title="false" locale="zh-CN" page-view="full" :show-main-menu="false" :show-bubble-menu="!readonly" :bubble-menu="['bold','italic','underline','strike']" :show-floating-menu="false" :show-side-node="false" :side-menu="{show:!readonly,add:'empty'}" @create="ready" @update="({editor:e})=>emit('update',e.getJSON())"/>
  <ColumnInsertControl :editor="editor" :disabled="readonly"/>
  <Teleport to="body"><div v-if="dropLine" class="native-drop-line" :style="{left:dropLine.left+'px',top:dropLine.top+'px',width:dropLine.width+'px'}"/></Teleport>
  <div v-if="!readonly" class="body-hint">输入 / 或点击 ＋ 插入内容，拖动块手柄调整顺序。</div>
  <dialog ref="layoutDialog" class="app-dialog"><h2>自定义图片栏</h2><p>使用编辑器原生分栏排列图片。</p><div class="picture-layout-fields"><label>行数<select v-model="rows" aria-label="图片行数"><option v-for="n in 3" :value="n">{{n}}</option></select></label><label>列数<select v-model="columns" aria-label="图片列数"><option v-for="n in 4" :value="n">{{n}}</option></select></label></div><div class="dialog-actions"><button class="secondary-button" @click="layoutDialog.close()">取消</button><button class="primary-button" @click="addPictures">插入 {{rows*columns}} 个图片位置</button></div></dialog>
</div>
</template>
