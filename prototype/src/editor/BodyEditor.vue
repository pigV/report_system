<script setup>
import { shallowRef,ref } from 'vue';
import { YiiEditor } from '@yiitap/vue';
import {closeHistory} from '@tiptap/pm/history';
import {insertCitationTransaction} from './report-sections.mjs';
import { useBlockDrag } from './use-block-drag.js';
import { bodyExtensions } from './body-schema.mjs';
import ColumnInsertControl from './ColumnInsertControl.vue';
import { businessSuggestion } from '../free-template/suggestion.js';
import { bodyMenuItems,executeNativeInsert } from '../free-template/menu.mjs';
const props=defineProps({content:Object,readonly:Boolean,scope:Object,selectedImage:String});
const emit=defineEmits(['update']);
const editor=shallowRef(null);
let positioned=false;
const {dropLine,startDrag,handleClick,handleHover,handleLeave}=useBlockDrag(editor,()=>props.readonly);
const suggestion=businessSuggestion(()=>[],bodyMenuItems,{afterBlock:true,onInserted:()=>{positioned=true}});
const extensions=[...bodyExtensions({readonly:props.readonly,getScope:()=>props.scope,getSelected:()=>props.selectedImage}),{name:'OSlash',configure:{suggestion}},{name:'OSlashZh',configure:{suggestion}}];
const layoutDialog=ref(null),rows=ref(1),columns=ref(3);let layoutRange=null;
function customPictures(event){if(props.readonly)return;layoutRange=event.detail.range;layoutDialog.value.showModal()}
function addPictures(){const ed=editor.value;if(!ed||props.readonly)return;const inserted=executeNativeInsert(ed,layoutRange,{action:'pictures-custom',rows:Number(rows.value),columns:Number(columns.value)},{afterBlock:true,onInserted:()=>{positioned=true}});layoutDialog.value.close();if(inserted)ed.view.focus()}
function ready(ed){
  editor.value=ed;
  ed.unregisterPlugin('trailingNode');
  ed.view.dom.setAttribute('aria-label',props.readonly?'报告正文预览':'报告正文');
  ed.view.dom.setAttribute('role',props.readonly?'document':'textbox');
  if(!props.readonly)ed.view.dom.setAttribute('aria-multiline','true');
}
function insertTemplate(entry){
  if(!editor.value||props.readonly)return 'unavailable';
  if(!positioned||!editor.value.state.selection.$to.parent.inlineContent)return 'not-positioned';
  if(![entry.findings,entry.impression].some(value=>String(value??'').trim()))return 'empty';
  editor.value.view.dispatch(insertCitationTransaction(editor.value.state,entry));
  editor.value.view.dispatch(closeHistory(editor.value.state.tr));
  editor.value.view.focus();
  return 'inserted';
}
function rememberPosition(event){
  if(props.readonly||!editor.value?.view.dom.contains(event.target))return;
  positioned=editor.value.state.selection.$to.parent.inlineContent;
}
defineExpose({insertTemplate});
</script>
<template>
<div class="body-editor" :class="{'body-editor-editable':!readonly}" @mousedown.capture="startDrag" @mouseup="rememberPosition" @keyup="rememberPosition" @mousemove="handleHover" @mouseleave="handleLeave" @click.capture="handleClick" @report-custom-pictures="customPictures">
  <YiiEditor :content="content" :editable="!readonly" :extensions="extensions" :title="false" locale="zh-CN" page-view="full" :show-main-menu="false" :show-bubble-menu="!readonly" :bubble-menu="['bold','italic','underline','strike']" :show-floating-menu="false" :show-side-node="false" :side-menu="{show:!readonly,add:'empty'}" @create="ready" @update="({editor:e})=>emit('update',e.getJSON())"/>
  <ColumnInsertControl :editor="editor" :disabled="readonly"/>
  <Teleport to="body"><div v-if="dropLine" class="native-drop-line" :style="{left:dropLine.left+'px',top:dropLine.top+'px',width:dropLine.width+'px'}"/></Teleport>
  <dialog ref="layoutDialog" class="app-dialog"><h2>自定义图片栏</h2><p>使用编辑器原生分栏排列图片。</p><div class="picture-layout-fields"><label>行数<select v-model="rows" aria-label="图片行数"><option v-for="n in 3" :value="n">{{n}}</option></select></label><label>列数<select v-model="columns" aria-label="图片列数"><option v-for="n in 4" :value="n">{{n}}</option></select></label></div><div class="dialog-actions"><button class="secondary-button" @click="layoutDialog.close()">取消</button><button class="primary-button" @click="addPictures">插入 {{rows*columns}} 个图片位置</button></div></dialog>
</div>
</template>
