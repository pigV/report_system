<script setup>
// 【学习03】正文编辑的连接层：Vue 管组件，Yiitap 管界面，Tiptap 实例执行编辑操作。
// 阅读顺序：ready 拿实例 → 模板 @update 输出 JSON → insertTemplate 插入侧栏引用。
// 对照学习指南第 6 节，以及第 7.3 节的引用调用链。
import { shallowRef,ref } from 'vue';
import { YiiEditor } from '@yiitap/vue';
import {closeHistory} from '@tiptap/pm/history';
import {insertCitationTransaction} from './report-sections.mjs';
import { useBlockDrag } from './use-block-drag.js';
import { bodyExtensions } from './body-schema.mjs';
import ColumnInsertControl from './ColumnInsertControl.vue';
import { businessSuggestion } from '../free-template/suggestion.js';
import { bodyMenuItems,executeNativeInsert } from '../free-template/menu.mjs';
// props 是父组件传入的数据。content 用于初始化；scope/selectedImage 供图片节点取上下文。
// emit('update', json) 只把内存正文交给父组件，不会调用后端保存接口。
const props=defineProps({content:Object,readonly:Boolean,scope:Object,selectedImage:String});
const emit=defineEmits(['update']);
// 编辑器是复杂的外部实例，shallowRef 只跟踪实例引用，不递归代理其内部状态。
const editor=shallowRef(null);
// 这只是“用户是否选定过可插入的位置”的标记；真正位置读取 editor.state.selection。
// 普通 let 不驱动界面，因此不需要像 rows 一样用 ref。
let positioned=false;
const {dropLine,startDrag,handleClick,handleHover,handleLeave}=useBlockDrag(editor,()=>props.readonly);
// 【学习05】复用自由模板的菜单适配器，但候选项改为 bodyMenuItems（没有业务字段菜单）。
// afterBlock 要求插入后定位到块后方；成功回调让用户可以紧接着点侧栏“引用”。
const suggestion=businessSuggestion(()=>[],bodyMenuItems,{afterBlock:true,onInserted:()=>{positioned=true}});
const extensions=[...bodyExtensions({readonly:props.readonly,getScope:()=>props.scope,getSelected:()=>props.selectedImage}),{name:'OSlash',configure:{suggestion}},{name:'OSlashZh',configure:{suggestion}}];
// ref(null) 在模板中还可绑定 dialog DOM；rows/columns 则是输入控件的响应式数值。
// 打开自定义布局弹窗时保存菜单范围，确认后仍在原位置插入，不改用弹窗的焦点。
const layoutDialog=ref(null),rows=ref(1),columns=ref(3);let layoutRange=null;
function customPictures(event){if(props.readonly)return;layoutRange=event.detail.range;layoutDialog.value.showModal()}
function addPictures(){const ed=editor.value;if(!ed||props.readonly)return;const inserted=executeNativeInsert(ed,layoutRange,{action:'pictures-custom',rows:Number(rows.value),columns:Number(columns.value)},{afterBlock:true,onInserted:()=>{positioned=true}});layoutDialog.value.close();if(inserted)ed.view.focus()}
function ready(ed){
  // YiiEditor 的 create 事件给出 Tiptap 编辑器；不是 DOM 元素，也不是 Vue 组件引用。
  editor.value=ed;
  // 禁用自动尾段落插件；插入后的段落与光标由 menu.mjs 中的规则明确处理。
  ed.unregisterPlugin('trailingNode');
  // view.dom 是底层 ProseMirror 编辑视图的 DOM；这里只补无障碍属性，不改正文结构。
  ed.view.dom.setAttribute('aria-label',props.readonly?'报告正文预览':'报告正文');
  ed.view.dom.setAttribute('role',props.readonly?'document':'textbox');
  if(!props.readonly)ed.view.dom.setAttribute('aria-multiline','true');
}
function insertTemplate(entry){
  // 不可编辑、没有正文位置、引用内容为空时静默返回；由调用方决定是否处理返回值。
  if(!editor.value||props.readonly)return 'unavailable';
  if(!positioned||!editor.value.state.selection.$to.parent.inlineContent)return 'not-positioned';
  if(![entry.findings,entry.impression].some(value=>String(value??'').trim()))return 'empty';
  // 【学习06】state 是当前文档状态；辅助函数只构建事务，dispatch 才让编辑器应用修改。
  editor.value.view.dispatch(insertCitationTransaction(editor.value.state,entry));
  // 引用后再切开历史组，避免后续输入与本次引用合并；closeHistory 不是删除历史。
  editor.value.view.dispatch(closeHistory(editor.value.state.tr));
  editor.value.view.focus();
  return 'inserted';
}
function rememberPosition(event){
  // 只认编辑器内部交互；点击侧栏按钮本身不会把“引用目标”换成侧栏输入框。
  if(props.readonly||!editor.value?.view.dom.contains(event.target))return;
  positioned=editor.value.state.selection.$to.parent.inlineContent;
}
// <script setup> 默认不把内部方法全暴露给父组件；这里只开放引用这一项能力。
defineExpose({insertTemplate});
</script>
<template>
<div class="body-editor" :class="{'body-editor-editable':!readonly}" @mousedown.capture="startDrag" @mouseup="rememberPosition" @keyup="rememberPosition" @mousemove="handleHover" @mouseleave="handleLeave" @click.capture="handleClick" @report-custom-pictures="customPictures">
  <!-- content 是初始输入，update/getJSON 是输出；这不是 v-model，也没有逐字重建实例。
       page-view="full" 是编辑器外观，不负责 A4 分页；@create 的 ready 保存 Tiptap 实例。 -->
  <YiiEditor :content="content" :editable="!readonly" :extensions="extensions" :title="false" locale="zh-CN" page-view="full" :show-main-menu="false" :show-bubble-menu="!readonly" :bubble-menu="['bold','italic','underline','strike']" :show-floating-menu="false" :show-side-node="false" :side-menu="{show:!readonly,add:'empty'}" @create="ready" @update="({editor:e})=>emit('update',e.getJSON())"/>
  <ColumnInsertControl :editor="editor" :disabled="readonly"/>
  <!-- Teleport 只改变插入线的 DOM 挂载位置，逻辑状态仍归当前组件管理。 -->
  <Teleport to="body"><div v-if="dropLine" class="native-drop-line" :style="{left:dropLine.left+'px',top:dropLine.top+'px',width:dropLine.width+'px'}"/></Teleport>
  <dialog ref="layoutDialog" class="app-dialog"><h2>自定义图片栏</h2><p>使用编辑器原生分栏排列图片。</p><div class="picture-layout-fields"><label>行数<select v-model="rows" aria-label="图片行数"><option v-for="n in 3" :value="n">{{n}}</option></select></label><label>列数<select v-model="columns" aria-label="图片列数"><option v-for="n in 4" :value="n">{{n}}</option></select></label></div><div class="dialog-actions"><button class="secondary-button" @click="layoutDialog.close()">取消</button><button class="primary-button" @click="addPictures">插入 {{rows*columns}} 个图片位置</button></div></dialog>
</div>
</template>
