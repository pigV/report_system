<script setup>
import { ref,computed,watch,nextTick } from 'vue';
import { PhTextT,PhTextH,PhTable,PhColumns,PhMinus,PhListBullets,PhDatabase,PhCaretRight,PhArrowLeft } from '@phosphor-icons/vue';
const props=defineProps({items:Array,onPick:Function});
const selected=ref(0),children=ref(null),root=ref(null);
const icons={text:PhTextT,heading:PhTextH,table:PhTable,columns:PhColumns,rule:PhMinus,list:PhListBullets,field:PhDatabase};
const visible=computed(()=>children.value??props.items);
watch(()=>props.items,()=>{selected.value=0;children.value=null});
function choose(item){if(!item)return;if(item.children){children.value=item.children;selected.value=0}else props.onPick(item)}
function back(){children.value=null;selected.value=0}
function onKeyDown({event}){
 if(event.key==='ArrowDown'||event.key==='ArrowUp'){selected.value=(selected.value+(event.key==='ArrowDown'?1:-1)+visible.value.length)%Math.max(visible.value.length,1);nextTick(()=>root.value?.querySelector('[aria-selected=true]')?.scrollIntoView({block:'nearest'}));return true}
 if(event.key==='Enter'){choose(visible.value[selected.value]);return true}
 if(event.key==='ArrowRight'&&visible.value[selected.value]?.children){choose(visible.value[selected.value]);return true}
 if(event.key==='ArrowLeft'&&children.value){back();return true}
 return false;
}
defineExpose({onKeyDown});
</script>
<template><div ref="root" class="native-slash-menu" role="listbox" aria-label="插入内容"><div class="native-slash-title"><button v-if="children" aria-label="返回基础内容" @mousedown.prevent @click="back"><PhArrowLeft :size="15"/></button>{{children?'业务字段':'插入内容'}}</div><div class="native-slash-group">{{children?'复用已有绑定':'基础内容'}}</div><button v-for="(item,i) in visible" :key="item.fieldId??item.action" role="option" :aria-selected="selected===i" @mouseenter="selected=i" @mousedown.prevent @click="choose(item)"><component :is="icons[item.icon]" :size="17"/><span>{{item.label}}</span><PhCaretRight v-if="item.children" :size="14"/></button><p v-if="!visible.length">没有匹配内容</p><div class="native-slash-help">↑ ↓ 选择 · Enter 插入 · Esc 关闭</div></div></template>
