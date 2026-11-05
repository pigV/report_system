<script setup>
// 【学习08】Vue 负责浮动加号显示，column-insert.mjs 负责文档位置计算和事务。
// target 同时携带节点引用和屏幕坐标，使用 shallowRef 保留节点身份，只跟踪整体替换。
import { shallowRef, watch, onBeforeUnmount } from 'vue';
import { columnInsertTarget, insertColumnSlash } from './column-insert.mjs';

const props=defineProps({editor:Object,disabled:Boolean,openAtCurrentLine:Boolean});
const emit=defineEmits(['open-current-line']);
const target=shallowRef(null);
let doc=null;
function move(event){
  if(props.disabled||!props.editor?.isEditable||props.editor.isDestroyed){target.value=null;return}
  if(event.target.closest?.('.column-insert-control'))return;
  target.value=columnInsertTarget(props.editor.view,event.target,event.clientY);
}
function clear(){target.value=null}
// 编辑器实例更换时先解绑旧 document；组件卸载时 attach(null) 也走同一清理路径。
function attach(editor){
  if(doc){doc.removeEventListener('mousemove',move);doc.removeEventListener('scroll',clear,true);doc.defaultView.removeEventListener('resize',clear)}
  clear();doc=editor?.view.dom.ownerDocument??null;
  if(doc){doc.addEventListener('mousemove',move);doc.addEventListener('scroll',clear,true);doc.defaultView.addEventListener('resize',clear)}
}
function insert(){
  // 此处才提交事务并还原焦点；点击菜单/按钮不直接把编辑器 content prop 替换成新 JSON。
  const ed=props.editor,selected=target.value;
  if(!ed||!selected||props.disabled||!ed.isEditable||ed.isDestroyed)return;
  if(props.openAtCurrentLine){emit('open-current-line',selected);return}
  const tr=insertColumnSlash(ed.state,selected);
  clear();
  if(tr){ed.view.dispatch(tr);ed.view.focus()}
}
watch(()=>props.editor,attach,{immediate:true});
watch(()=>props.disabled,disabled=>{if(disabled)clear()});
onBeforeUnmount(()=>attach(null));
</script>
<template>
  <!-- Teleport 避免浮动按钮被报告纸张/栏的 overflow 裁掉；mousedown.prevent 尽量保留选区。 -->
  <Teleport to="body">
    <button v-if="target" type="button" class="column-insert-control" :style="{left:target.left+'px',top:target.top+'px'}" aria-label="在此栏插入内容" title="在此栏插入内容" @mousedown.prevent @click="insert">＋</button>
  </Teleport>
</template>
<style>
.column-insert-control{position:fixed;z-index:10001;width:24px;height:24px;padding:0;border:1px solid #dfe3e6;border-radius:4px;background:#fff;color:#5a626b;font:18px/22px sans-serif;text-align:center;cursor:pointer;box-shadow:0 1px 3px #00000012}
.column-insert-control:hover,.column-insert-control:focus-visible{background:#edf4f4;color:#426f70;outline-color:#528b8d}
body:has(.column-insert-control) .side-menu{visibility:hidden!important;pointer-events:none}
</style>
