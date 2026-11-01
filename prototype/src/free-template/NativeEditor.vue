<script setup>
import { shallowRef, ref, onBeforeUnmount } from 'vue';
import { YiiEditor } from '@yiitap/vue';
import { reorderBlock } from './block-drag.mjs';
import { businessSuggestion } from './suggestion.js';
import { PhArrowCounterClockwise, PhArrowClockwise, PhTextB, PhTextItalic, PhTextUnderline, PhTextAlignLeft, PhTextAlignCenter, PhTextAlignRight, PhTable, PhColumns, PhMinus, PhDatabase, PhDotsSixVertical } from '@phosphor-icons/vue';
import { nativeExtensions } from './model.mjs';
const props=defineProps({content:Object,fields:Array,disabled:Boolean,region:String});
const emit=defineEmits(['update','bindings']);
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
const dropLine=ref(null);
let stopDrag=()=>{}, suppressClick=false;
function blocks(){const ed=editor.value,result=[];ed.state.doc.forEach((node,pos)=>{const dom=ed.view.nodeDOM(pos);if(dom?.getBoundingClientRect)result.push({pos,node,rect:dom.getBoundingClientRect()})});return result}
function startDrag(event){
  const handle=event.target.closest?.('.o-drag-btn');
  if(!handle||event.button!==0||props.disabled)return;
  stopDrag();
  const ed=editor.value,handleRect=handle.getBoundingClientRect(),y=handleRect.top+handleRect.height/2;
  const source=blocks().sort((a,b)=>Math.abs((a.rect.top+a.rect.bottom)/2-y)-Math.abs((b.rect.top+b.rect.bottom)/2-y))[0];
  if(!source)return;
  // Yiitap's floating handle can lose its HTML drag target on pointer-down in WebKit.
  // Keep its handle/menu, and commit the drop through the same ProseMirror document.
  event.preventDefault();
  const start={x:event.clientX,y:event.clientY};let moved=false,boundary=source.pos;
  const doc=event.target.ownerDocument;
  const move=e=>{
    if(!moved&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<5)return;
    moved=true;e.preventDefault();
    const items=blocks(),next=items.find(item=>e.clientY<(item.rect.top+item.rect.bottom)/2);
    boundary=next?.pos??ed.state.doc.content.size;
    const rect=ed.view.dom.getBoundingClientRect();
    dropLine.value={left:rect.left+30,top:next?next.rect.top:items.at(-1).rect.bottom,width:rect.width-60};
  };
  const end=e=>{const rect=ed.view.dom.getBoundingClientRect();stopDrag();if(moved){suppressClick=true;setTimeout(()=>{suppressClick=false},0);if(e.clientX>=rect.left-60&&e.clientX<=rect.right+30&&e.clientY>=rect.top&&e.clientY<=rect.bottom){const tr=reorderBlock(ed.state,source.pos,boundary);if(tr)ed.view.dispatch(tr)}ed.commands.focus()}};
  const cancel=()=>{stopDrag();suppressClick=false};
  const key=e=>{if(e.key==='Escape'){e.preventDefault();cancel()}};
  stopDrag=()=>{doc.removeEventListener('mousemove',move);doc.removeEventListener('mouseup',end);doc.removeEventListener('keydown',key,true);doc.defaultView.removeEventListener('blur',cancel);dropLine.value=null};
  doc.addEventListener('mousemove',move);doc.addEventListener('mouseup',end,{once:true});doc.addEventListener('keydown',key,true);doc.defaultView.addEventListener('blur',cancel);
}
function handleClick(event){if(suppressClick){event.preventDefault();event.stopPropagation();suppressClick=false}}
onBeforeUnmount(()=>{stopDrag();if(editor.value&&!editor.value.isDestroyed)editor.value.commands.blur()});
</script>
<template>
<div @mousedown.capture="startDrag" @click.capture="handleClick" class="native-editor" :class="{disabled}" :aria-busy="disabled">
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
  <Teleport to="body"><div v-if="dropLine" class="native-drop-line" :style="{left:dropLine.left+'px',top:dropLine.top+'px',width:dropLine.width+'px'}"/></Teleport>
  <div class="native-editor-foot"><span><PhDotsSixVertical :size="16"/>拖动块手柄调整顺序</span><button :disabled="disabled" @mousedown.prevent @click="insertMenu">输入 / 插入内容</button><span>100%</span></div>
</div>
</template>
