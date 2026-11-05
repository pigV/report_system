<script setup>
// 【学习03】正文编辑的连接层：Vue 管组件，Yiitap 管界面，Tiptap 实例执行编辑操作。
// 阅读顺序：ready 拿实例 → 模板 @update 输出 JSON → insertTemplate 插入侧栏引用。
// 对照学习指南第 6 节，以及第 7.3 节的引用调用链。
import { shallowRef,ref,onBeforeUnmount } from 'vue';
import { YiiEditor } from '@yiitap/vue';
import {closeHistory} from '@tiptap/pm/history';
import {TextSelection} from '@tiptap/pm/state';
import {insertCitationTransaction} from './report-sections.mjs';
import { useBlockDrag } from './use-block-drag.js';
import { bodyExtensions } from './body-schema.mjs';
import ColumnInsertControl from './ColumnInsertControl.vue';
import { businessSuggestion } from '../free-template/suggestion.js';
import { bodyMenuItems,executeNativeInsert } from '../free-template/menu.mjs';
import SlashMenu from '../free-template/SlashMenu.vue';
import {isKeyImageInsertionInColumn} from './key-image-insert.mjs';
import {reportLineHighlight,reportLineHighlightKey} from './report-line-highlight.mjs';
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
const extensions=[...bodyExtensions({readonly:props.readonly,getScope:()=>props.scope,getSelected:()=>props.selectedImage}),reportLineHighlight,{name:'OSlash',configure:{suggestion}},{name:'OSlashZh',configure:{suggestion}}];
const addMenu=ref(null),addMenuView=ref(null);
const menuOptions={afterBlock:true,onInserted:()=>{positioned=true}};
function closeAddMenu(){
  addMenu.value=null;
  const ed=editor.value;
  if(ed&&!ed.isDestroyed)ed.view.dispatch(ed.state.tr.setMeta(reportLineHighlightKey,null));
}
function openAtLine(pos,dom){
  const ed=editor.value;
  if(!ed||props.readonly||!dom||ed.isDestroyed)return;
  const node=ed.state.doc.nodeAt(pos);
  if(!node)return;
  const anchor=node.isTextblock?pos+1:Math.min(pos+node.nodeSize,ed.state.doc.content.size);
  const selection=TextSelection.near(ed.state.doc.resolve(anchor),1);
  const range={from:anchor,to:anchor};
  ed.view.dispatch(ed.state.tr.setSelection(selection).setMeta(reportLineHighlightKey,pos));
  positioned=selection.$from.parent.inlineContent;
  ed.view.focus();
  const rect=dom.getBoundingClientRect();
  const width=270,height=390;
  addMenu.value={range,pendingParagraph:!node.isTextblock,insideColumn:isKeyImageInsertionInColumn(ed.state,range),style:{left:`${Math.max(8,Math.min(rect.left,window.innerWidth-width-8))}px`,top:`${rect.bottom+height+8<window.innerHeight?rect.bottom+6:Math.max(8,rect.top-height-6)}px`}};
}
function openSideAdd(event){
  const button=event.target.closest?.('.o-add-btn');
  if(!button||props.readonly)return false;
  event.preventDefault();event.stopPropagation();
  const ed=editor.value,rect=button.getBoundingClientRect(),y=rect.top+rect.height/2;
  if(!ed||ed.isDestroyed)return true;
  let nearest=null;
  ed.state.doc.forEach((node,pos)=>{
    const dom=ed.view.nodeDOM(pos);
    if(!dom?.getBoundingClientRect)return;
    const box=dom.getBoundingClientRect(),distance=Math.max(box.top-y,0,y-box.bottom);
    if(!nearest||distance<nearest.distance)nearest={pos,dom,distance};
  });
  if(nearest)openAtLine(nearest.pos,nearest.dom);
  return true;
}
function openColumnAdd(target){
  const ed=editor.value;
  if(ed&&ed.state.doc.nodeAt(target.pos)===target.node)openAtLine(target.pos,ed.view.nodeDOM(target.pos));
}
function prepareParagraph(ed,range){
  const tr=closeHistory(ed.state.tr).insert(range.from,ed.state.schema.nodes.paragraph.create());
  const next={from:range.from+1,to:range.from+1};
  tr.setSelection(TextSelection.create(tr.doc,next.from));
  ed.view.dispatch(tr);
  return next;
}
function pickAddItem(item){
  const ed=editor.value,menu=addMenu.value;
  let range=menu?.range;
  if(!ed||!range)return;
  closeAddMenu();
  if(item.action==='customPictures'){
    ed.view.dom.dispatchEvent(new CustomEvent('report-custom-pictures',{bubbles:true,detail:{range,pendingParagraph:menu.pendingParagraph}}));
    return;
  }
  if(menu.pendingParagraph)range=prepareParagraph(ed,range);
  executeNativeInsert(ed,range,item,{...menuOptions,joinHistory:menu.pendingParagraph});
}
function documentMouseDown(event){
  if(addMenu.value&&!event.target.closest?.('.native-slash-host, .o-add-btn, .column-insert-control'))closeAddMenu();
}
function documentKeyDown(event){
  if(!addMenu.value)return;
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeAddMenu();editor.value?.view.focus();return}
  if(addMenuView.value?.onKeyDown({event})){event.preventDefault();event.stopPropagation();return}
  if(event.key.length===1||event.key==='Backspace'||event.key==='Delete')closeAddMenu();
}
document.addEventListener('mousedown',documentMouseDown,true);
document.addEventListener('keydown',documentKeyDown,true);
onBeforeUnmount(()=>{document.removeEventListener('mousedown',documentMouseDown,true);document.removeEventListener('keydown',documentKeyDown,true)});
function sideClick(event){if(!openSideAdd(event))handleClick(event)}
// ref(null) 在模板中还可绑定 dialog DOM；rows/columns 则是输入控件的响应式数值。
// 打开自定义布局弹窗时保存菜单范围，确认后仍在原位置插入，不改用弹窗的焦点。
const layoutDialog=ref(null),rows=ref(1),columns=ref(3);let layoutRange=null,layoutPendingParagraph=false;
function customPictures(event){if(props.readonly)return;layoutRange=event.detail.range;layoutPendingParagraph=!!event.detail.pendingParagraph;layoutDialog.value.showModal()}
function addPictures(){const ed=editor.value;if(!ed||props.readonly)return;const range=layoutPendingParagraph?prepareParagraph(ed,layoutRange):layoutRange;const inserted=executeNativeInsert(ed,range,{action:'pictures-custom',rows:Number(rows.value),columns:Number(columns.value)},{...menuOptions,joinHistory:layoutPendingParagraph});layoutDialog.value.close();if(inserted)ed.view.focus()}
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
<div class="body-editor" :class="{'body-editor-editable':!readonly}" @mousedown.capture="startDrag" @mouseup="rememberPosition" @keyup="rememberPosition" @mousemove="handleHover" @mouseleave="handleLeave" @click.capture="sideClick" @report-custom-pictures="customPictures">
  <!-- content 是初始输入，update/getJSON 是输出；这不是 v-model，也没有逐字重建实例。
       page-view="full" 是编辑器外观，不负责 A4 分页；@create 的 ready 保存 Tiptap 实例。 -->
  <YiiEditor :content="content" :editable="!readonly" :extensions="extensions" :title="false" locale="zh-CN" page-view="full" :show-main-menu="false" :show-bubble-menu="!readonly" :bubble-menu="['bold','italic','underline','strike']" :show-floating-menu="false" :show-side-node="false" :side-menu="{show:!readonly,add:'empty'}" @create="ready" @update="({editor:e})=>emit('update',e.getJSON())"/>
  <ColumnInsertControl :editor="editor" :disabled="readonly" open-at-current-line @open-current-line="openColumnAdd"/>
  <!-- Teleport 只改变插入线的 DOM 挂载位置，逻辑状态仍归当前组件管理。 -->
  <Teleport to="body"><div v-if="dropLine" class="native-drop-line" :style="{left:dropLine.left+'px',top:dropLine.top+'px',width:dropLine.width+'px'}"/></Teleport>
  <Teleport to="body"><div v-if="addMenu" class="native-slash-host" style="position:fixed;z-index:80" :style="addMenu.style"><SlashMenu ref="addMenuView" :items="bodyMenuItems('')" :inside-column="addMenu.insideColumn" :on-pick="pickAddItem"/></div></Teleport>
  <dialog ref="layoutDialog" class="app-dialog"><h2>自定义图片栏</h2><p>使用编辑器原生分栏排列图片。</p><div class="picture-layout-fields"><label>行数<select v-model="rows" aria-label="图片行数"><option v-for="n in 3" :value="n">{{n}}</option></select></label><label>列数<select v-model="columns" aria-label="图片列数"><option v-for="n in 4" :value="n">{{n}}</option></select></label></div><div class="dialog-actions"><button class="secondary-button" @click="layoutDialog.close()">取消</button><button class="primary-button" @click="addPictures">插入 {{rows*columns}} 个图片位置</button></div></dialog>
</div>
</template>
