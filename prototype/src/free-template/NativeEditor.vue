<script setup>
import { shallowRef, ref, onBeforeUnmount } from 'vue';
import { YiiEditor } from '@yiitap/vue';
import { useBlockDrag } from '../editor/use-block-drag.js';
import ColumnInsertControl from '../editor/ColumnInsertControl.vue';
import { businessSuggestion } from './suggestion.js';
import { PhArrowCounterClockwise, PhArrowClockwise, PhTextB, PhTextItalic, PhTextUnderline, PhTextAlignLeft, PhTextAlignCenter, PhTextAlignRight, PhTable, PhColumns, PhMinus, PhDatabase, PhDotsSixVertical } from '@phosphor-icons/vue';
import { nativeExtensions } from './model.mjs';
const props=defineProps({content:Object,fields:Array,disabled:Boolean,region:String});
const emit=defineEmits(['update']);
const editor=shallowRef(null),format=ref('paragraph'), revision=ref(0);
const suggestion=businessSuggestion(()=>props.fields);
const extensions=[...nativeExtensions(),{name:'OSlash',configure:{suggestion}},{name:'OSlashZh',configure:{suggestion}}];
function ready(ed){editor.value=ed;ed.unregisterPlugin('trailingNode');ed.view.dom.setAttribute('aria-label',props.region==='header'?'自由表头编辑器':'自由表尾编辑器');ed.view.dom.setAttribute('role','textbox');ed.view.dom.setAttribute('aria-multiline','true');}
function transact(){revision.value++;format.value=editor.value?.isActive('heading',{level:1})?'h1':editor.value?.isActive('heading',{level:2})?'h2':'paragraph'}
function active(mark){void revision.value;return editor.value?.isActive(mark)??false}
function run(command,...args){editor.value?.chain().focus()[command](...args).run()}
function setFormat(value){value==='paragraph'?run('setParagraph'):run('setHeading',{level:Number(value.slice(1))})}
function insertMenu(){if(!editor.value)return;editor.value.chain().focus().insertContent('/').run()}
function insertField(f){run('insertContent',{type:'businessField',attrs:{fieldId:f.id,label:f.label}})}
defineExpose({insertField});
const {dropLine,startDrag,handleClick,handleHover,handleLeave}=useBlockDrag(editor,()=>props.disabled);
onBeforeUnmount(()=>{if(editor.value&&!editor.value.isDestroyed)editor.value.commands.blur()});
</script>
<template>
<div @mousedown.capture="startDrag" @mousemove="handleHover" @mouseleave="handleLeave" @click.capture="handleClick" class="native-editor" :class="{disabled}" :aria-busy="disabled">
  <div class="native-toolbar" role="toolbar" aria-label="自由文档格式">
    <button title="撤销" aria-label="自由编辑撤销" :disabled="disabled" @mousedown.prevent @click="run('undo')"><PhArrowCounterClockwise/></button>
    <button title="重做" aria-label="自由编辑重做" :disabled="disabled" @mousedown.prevent @click="run('redo')"><PhArrowClockwise/></button><span class="native-tool-separator"></span>
    <select aria-label="段落样式" :value="format" :disabled="disabled" @change="setFormat($event.target.value)"><option value="paragraph">正文</option><option value="h1">一级标题</option><option value="h2">二级标题</option></select>
    <button title="加粗" aria-label="自由文本加粗" :aria-pressed="active('bold')" :disabled="disabled" @mousedown.prevent @click="run('toggleBold')"><PhTextB/></button>
    <button title="斜体" aria-label="自由文本斜体" :aria-pressed="active('italic')" :disabled="disabled" @mousedown.prevent @click="run('toggleItalic')"><PhTextItalic/></button>
    <button title="下划线" aria-label="自由文本下划线" :aria-pressed="active('underline')" :disabled="disabled" @mousedown.prevent @click="run('toggleUnderline')"><PhTextUnderline/></button>
    <label class="native-color" title="文字颜色"><span>A</span><input aria-label="文字颜色" type="color" value="#b48a47" :disabled="disabled" @input="run('setColor',$event.target.value)"/></label><span class="native-tool-separator"></span>
    <button v-for="(align,i) in ['left','center','right']" :key="align" :title="['左对齐','居中','右对齐'][i]" :aria-label="`自由文本${['左对齐','居中','右对齐'][i]}`" :disabled="disabled" @mousedown.prevent @click="run('setTextAlign',align)"><component :is="[PhTextAlignLeft,PhTextAlignCenter,PhTextAlignRight][i]"/></button>
    <span class="native-tool-separator"></span>
    <button title="插入表格" aria-label="插入表格" :disabled="disabled" @mousedown.prevent @click="run('insertTable',{rows:2,cols:3,withHeaderRow:false})"><PhTable/></button>
    <button title="插入两栏" aria-label="插入两栏" :disabled="disabled" @mousedown.prevent @click="run('insertMultiColumn',2)"><PhColumns/></button>
    <button title="插入分割线" aria-label="插入分割线" :disabled="disabled" @mousedown.prevent @click="run('setHorizontalRule')"><PhMinus/></button>
    <button title="插入业务字段" aria-label="插入业务字段" :disabled="disabled" @mousedown.prevent @click="insertMenu"><PhDatabase/></button>
  </div>
  <div class="native-editor-hint"><span>直接编辑{{region==='header'?'表头':'表尾'}}内容</span><span>文字、字段与布局均可调整</span></div>
  <YiiEditor :content="content" :editable="!disabled" :title="false" locale="zh-CN" page-view="full" :extensions="extensions" :show-main-menu="false" :show-bubble-menu="true" :bubble-menu="['bold','italic','underline','strike']" :side-menu="{show:true,add:'empty'}" @create="ready" @transaction="transact" @update="({editor:ed})=>emit('update',ed.getJSON())"/>
  <ColumnInsertControl :editor="editor" :disabled="disabled"/>
  <Teleport to="body"><div v-if="dropLine" class="native-drop-line" :style="{left:dropLine.left+'px',top:dropLine.top+'px',width:dropLine.width+'px'}"/></Teleport>
  <div class="native-editor-foot"><span><PhDotsSixVertical :size="16"/>拖动块手柄调整顺序</span><button :disabled="disabled" @mousedown.prevent @click="insertMenu">输入 / 插入内容</button><span>100%</span></div>
</div>
</template>
