<script setup>
import { ref,computed,watch,nextTick,onMounted,onBeforeUnmount } from 'vue';
import { PhTextT,PhTextH,PhTable,PhColumns,PhMinus,PhListBullets,PhDatabase,PhCaretRight,PhArrowLeft,PhImage } from '@phosphor-icons/vue';
import KeyImagePicker from './KeyImagePicker.vue';
const props=defineProps({items:Array,onPick:Function});
const selected=ref(0),children=ref(null),root=ref(null),columnOpen=ref(false),columnCount=ref(3),panelStyle=ref({});
const imageOpen=ref(false),imagePicker=ref(null),imagePanel=ref(null),imageStyle=ref({});
let columnAnchor=null;
const icons={text:PhTextT,heading:PhTextH,table:PhTable,columns:PhColumns,rule:PhMinus,list:PhListBullets,field:PhDatabase,image:PhImage};
const visible=computed(()=>children.value??props.items);
watch(()=>props.items,()=>{selected.value=0;children.value=null;columnOpen.value=false;imageOpen.value=false});
function positionPanel(){
 const imageAnchor=root.value?.querySelector('[aria-expanded="true"]');
 if(imageAnchor&&imageOpen.value){
  const rect=imageAnchor.getBoundingClientRect(),width=Math.min(340,window.innerWidth-16),height=imagePanel.value?.offsetHeight??370;
  let left=rect.right+8;
  if(left+width>window.innerWidth-8)left=rect.left-width-8;
  imageStyle.value={left:`${Math.max(8,Math.min(left,window.innerWidth-width-8))}px`,top:`${Math.max(8,Math.min(rect.top,window.innerHeight-height-8))}px`};
 }
 if(!columnAnchor||!columnOpen.value)return;
 const rect=columnAnchor.getBoundingClientRect(),width=188,height=158;
 const left=rect.right+width+8<=window.innerWidth?rect.right-1:Math.max(8,rect.left-width+1);
 panelStyle.value={left:`${left}px`,top:`${Math.max(8,Math.min(rect.top,window.innerHeight-height-8))}px`};
}
function openColumns(anchor){
 if(!anchor)return;
 imageOpen.value=false;
 columnAnchor=anchor;columnOpen.value=true;positionPanel();
}
function openImages(anchor){if(!anchor)return;columnOpen.value=false;imageOpen.value=true;nextTick(positionPanel)}
function insertImages(ids){props.onPick({action:'keyImages',imageIds:ids})}
function selectItem(item,index,event){
 selected.value=index;
 if(item.action==='keyImages'){openImages(event.currentTarget);return}
 imageOpen.value=false;
 if(item.action==='columns'&&!children.value)openColumns(event.currentTarget);
 else columnOpen.value=false;
}
function choose(item){
 if(!item)return;
 if(item.action==='keyImages'){openImages(root.value?.querySelector('[aria-selected=true]'));return}
 imageOpen.value=false;
 if(item.action==='columns'){
  if(!columnOpen.value){openColumns(root.value?.querySelector('[aria-selected=true]'));return}
  props.onPick({...item,columns:columnCount.value});return;
 }
 columnOpen.value=false;
 if(item.children){children.value=item.children;selected.value=0}else props.onPick(item);
}
function back(){children.value=null;selected.value=0;columnOpen.value=false}
// The suggestion host also moves on scroll. Measure after it has been positioned,
// rather than using the anchor's rectangle from the previous layout.
let positionFrame=null,hostObserver=null;
function schedulePanelPosition(){cancelAnimationFrame(positionFrame);positionFrame=requestAnimationFrame(positionPanel)}
onMounted(()=>{
 window.addEventListener('resize',schedulePanelPosition);window.addEventListener('scroll',schedulePanelPosition,true);
 nextTick(()=>{const host=root.value?.closest('.native-slash-host');if(host){hostObserver=new MutationObserver(schedulePanelPosition);hostObserver.observe(host,{attributes:true,attributeFilter:['style']})}});
});
onBeforeUnmount(()=>{cancelAnimationFrame(positionFrame);hostObserver?.disconnect();window.removeEventListener('resize',schedulePanelPosition);window.removeEventListener('scroll',schedulePanelPosition,true)});
function onKeyDown({event}){
 if(imageOpen.value&&imagePicker.value?.onKeyDown(event))return true;
 if(event.key==='ArrowRight'&&visible.value[selected.value]?.action==='keyImages'){choose(visible.value[selected.value]);return true}
 if(columnOpen.value&&(event.key==='ArrowRight'||event.key==='ArrowLeft')){columnCount.value=Math.min(5,Math.max(2,columnCount.value+(event.key==='ArrowRight'?1:-1)));return true}
 if(event.key==='ArrowDown'||event.key==='ArrowUp'){columnOpen.value=false;selected.value=(selected.value+(event.key==='ArrowDown'?1:-1)+visible.value.length)%Math.max(visible.value.length,1);nextTick(()=>root.value?.querySelector('[aria-selected=true]')?.scrollIntoView({block:'nearest'}));return true}
 if(event.key==='Enter'){choose(visible.value[selected.value]);return true}
 if(event.key==='ArrowRight'&&visible.value[selected.value]?.action==='columns'){openColumns(root.value?.querySelector('[aria-selected=true]'));return true}
 if(event.key==='ArrowRight'&&visible.value[selected.value]?.children){choose(visible.value[selected.value]);return true}
 if(event.key==='ArrowLeft'&&children.value){back();return true}
 return false;
}
defineExpose({onKeyDown});
</script>
<template>
<div>
  <div ref="root" class="native-slash-menu" :class="{'report-insert-menu':items.some(item=>item.action==='keyImages')}" role="listbox" aria-label="插入内容">
    <div class="native-slash-title"><button v-if="children" aria-label="返回基础内容" @mousedown.prevent @click="back"><PhArrowLeft :size="15"/></button>{{children?'业务字段':'插入内容'}}</div>
    <div class="native-slash-group">{{children?'复用已有绑定':'基础内容'}}</div>
    <template v-for="(item,i) in visible" :key="item.fieldId??item.action">
      <div v-if="item.group" class="native-slash-group key-image-group">{{item.group}}</div>
      <button role="option" :aria-selected="selected===i" :aria-expanded="item.action==='keyImages'?imageOpen:undefined" @mouseenter="selectItem(item,i,$event)" @mousedown.prevent @click="item.action==='columns'?openColumns($event.currentTarget):choose(item)"><component :is="icons[item.icon]" :size="17"/><span>{{item.label}}</span><PhCaretRight v-if="item.children||['columns','keyImages'].includes(item.action)" :size="14"/></button>
    </template>
    <p v-if="!visible.length">没有匹配内容</p><div class="native-slash-help">↑ ↓ 选择 · Enter 插入 · Esc 关闭</div>
  </div>
  <div v-if="imageOpen" ref="imagePanel" class="key-image-picker-position" :style="imageStyle"><KeyImagePicker ref="imagePicker" @insert="insertImages" @close="imageOpen=false"/></div>
  <div v-if="columnOpen" class="column-picker" :style="panelStyle" role="group" aria-label="选择分栏数">
    <div class="column-picker-heading"><span>选择栏数</span><strong>{{columnCount}}</strong></div>
    <div class="column-picker-preview">
      <button v-for="n in 5" :key="n" type="button" :disabled="n===1" :class="{active:n<=columnCount}" :aria-label="n===1?'至少两栏':`插入${n}栏`" @mouseenter="n>1&&(columnCount=n)" @focus="n>1&&(columnCount=n)" @mousedown.prevent @click="props.onPick({action:'columns',columns:n})"></button>
    </div>
    <div class="column-picker-help">← → 调整 · Enter 插入</div>
  </div>
</div>
</template>
<style>
.key-image-picker-position{position:fixed;z-index:82;max-height:calc(100vh - 16px);overflow:auto}.key-image-group{border-top:1px solid #e8ecec;margin-top:5px}.native-slash-host .report-insert-menu{border-color:#dfe4e5;color:#30383a}.native-slash-host .report-insert-menu .native-slash-title{background:#f5f7f7;color:#7a8387}.native-slash-host .report-insert-menu>button[aria-selected=true]{background:#e9f4f2;color:#176f66}
.column-picker{position:fixed;z-index:81;box-sizing:border-box;width:188px;padding:12px;background:#fff;border:1px solid #e1e4e6;border-radius:6px;box-shadow:0 6px 20px #0000001c;color:#34383c;font:13px/1.5 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif}
.column-picker-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;color:#777e83;font-size:12px}.column-picker-heading strong{font-weight:500;color:#30363b}
.column-picker-preview{display:flex;gap:5px;height:94px;padding:9px;box-sizing:border-box;border:1px solid #e2e5e8;border-radius:2px}
.column-picker-preview button{flex:1;min-width:0;padding:0;border:1px solid #e5e8eb;background:#f1f2f3;cursor:pointer}.column-picker-preview button.active{background:#91aef7;border-color:#91aef7}.column-picker-preview button:disabled{opacity:1;cursor:default}.column-picker-preview button:focus-visible{outline:2px solid #4d77da;outline-offset:2px}
.column-picker-help{padding-top:6px;color:#9aa0a5;font-size:10px}
</style>
