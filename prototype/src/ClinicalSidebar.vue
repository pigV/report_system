<script setup>
import {computed,ref,watch,onBeforeUnmount} from 'vue';
import {PhMagnifyingGlass,PhCaretRight,PhUserCircle} from '@phosphor-icons/vue';
import {loadPersonalTemplates,savePersonalTemplate,filterTemplates} from './clinical-assistance.mjs';
import ClinicalDetail from './ClinicalDetail.vue';
const props=defineProps({hospital:String,disabled:Boolean});
const emit=defineEmits(['insert','notify','dirty']);
const doctor='doctor-demo',query=ref(''),templates=ref([]),draft=ref(null),error=ref('');
const saved=computed(()=>templates.value.find(t=>t.id===draft.value?.id));
const dirty=computed(()=>!!draft.value&&JSON.stringify(draft.value)!==JSON.stringify(saved.value));
const visible=computed(()=>templates.value.filter(t=>`${t.name} ${t.keywords}`.toLowerCase().includes(query.value.trim().toLowerCase())));
watch(dirty,value=>emit('dirty',value));
watch(()=>props.hospital,()=>{
  error.value='';query.value='';
  try{templates.value=loadPersonalTemplates(window.localStorage,props.hospital,doctor)}
  catch(e){templates.value=filterTemplates();error.value=`读取个人模板失败：${e.message}`}
  draft.value={...templates.value[0]};
},{immediate:true});
function select(item){if(item.id===draft.value.id)return;if(dirty.value&&!window.confirm('当前个人模板尚未保存，是否放弃修改并切换？'))return;draft.value={...item}}
function save(){
  if(props.disabled)return false;
  try{const result=savePersonalTemplate(window.localStorage,props.hospital,doctor,draft.value);templates.value=templates.value.map(t=>t.id===result.id?result:t);error.value='';emit('notify','个人模板已保存到本机');return true}
  catch(e){error.value=`保存失败：${e.message}`;return false}
}
defineExpose({save});onBeforeUnmount(()=>emit('dirty',false));
</script>
<template>
<aside class="personal-sidebar" aria-label="个人报告模板">
  <div class="assistance-title"><span></span><h2>报告模板</h2><span class="mock-badge">模拟</span></div>
  <div class="template-search"><PhMagnifyingGlass :size="16"/><input v-model="query" aria-label="搜索个人模板" placeholder="请输入模板名称" type="search"/></div>
  <section class="personal-template-list"><div class="list-heading"><strong>私有模板</strong><span>{{visible.length}}</span></div><button v-for="item in visible" :key="item.id" :disabled="disabled" :aria-pressed="draft?.id===item.id" :class="{active:draft?.id===item.id}" @click="select(item)"><span>{{item.name}}</span><PhCaretRight :size="14"/></button><p v-if="!visible.length" class="panel-empty">没有匹配的模板</p><div class="personal-owner"><PhUserCircle :size="15"/>模拟医生 · 本机个人模板</div></section>
  <p v-if="error" class="panel-error" role="alert">{{error}}</p>
  <ClinicalDetail v-if="draft" v-model="draft" label="个人模板" can-save :dirty="dirty" :disabled="disabled" @save="save" @cite="entry=>emit('insert',entry)"/>
</aside>
</template>
