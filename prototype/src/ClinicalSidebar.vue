<script setup>
import {computed,ref,watch} from 'vue';
import {PhUser,PhClockCounterClockwise,PhFileText,PhMagnifyingGlass,PhCaretRight,PhCaretUp,PhArrowsClockwise,PhX} from '@phosphor-icons/vue';
import {historyFor,filterTemplates,templateCategories,templateBody} from './clinical-assistance.mjs';
const props=defineProps({hospital:String,caseId:String,data:Object,cases:Array,disabled:Boolean});
const emit=defineEmits(['chooseCase','insert']);
const query=ref(''),category=ref('全部'),selectedId=ref('chest-ct'),expandedId=ref('ct-aug'),switching=ref(false),historyDialog=ref(null),detail=ref(null);
const records=computed(()=>historyFor(props.hospital,props.caseId,props.data?.patient?.no));
const visibleTemplates=computed(()=>filterTemplates(query.value,category.value));
const selectedTemplate=computed(()=>visibleTemplates.value.find(t=>t.id===selectedId.value));
watch(visibleTemplates,list=>{if(!list.some(t=>t.id===selectedId.value))selectedId.value=list[0]?.id??''});
watch(()=>[props.hospital,props.caseId],()=>{query.value='';category.value='全部';selectedId.value='chest-ct';expandedId.value='ct-aug';switching.value=false;historyDialog.value?.close();detail.value=null});
function openHistory(record){detail.value=record;historyDialog.value?.showModal()}
function closeHistory(){historyDialog.value?.close();detail.value=null}
</script>
<template>
<aside class="clinical-sidebar" aria-label="患者与报告辅助">
  <section class="clinical-card patient-card" aria-label="当前患者">
    <div class="clinical-heading"><PhUser :size="21"/><h2>当前患者</h2><span class="mock-badge">模拟</span><button class="switch-case" :disabled="disabled" :aria-expanded="switching" @click="switching=!switching"><PhArrowsClockwise :size="14"/>切换病例</button></div>
    <div class="patient-summary"><strong>{{data?.patient?.name}}</strong><span>{{data?.patient?.gender}}</span><span>{{data?.patient?.age===0?'0岁':data?.patient?.age}}</span><span>{{data?.patient?.no}}</span></div>
    <p class="patient-exam">{{data?.exam?.item}}</p>
    <div v-if="switching" class="case-switcher"><label for="case-selector">选择模拟病例</label><select id="case-selector" :value="caseId" :disabled="disabled" @change="emit('chooseCase',$event)"><option v-for="item in cases" :key="item.id" :value="item.id">{{item.label}}</option></select></div>
  </section>
  <section class="clinical-card history-card" aria-labelledby="history-heading">
    <div class="clinical-heading"><PhClockCounterClockwise :size="21"/><h2 id="history-heading">既往病历</h2><span class="record-count">{{records.length}}</span></div>
    <div v-if="records.length" class="history-list">
      <div v-for="record in records" :key="record.id" class="history-entry" :class="{active:expandedId===record.id}">
        <button class="history-row" :aria-expanded="expandedId===record.id" @click="expandedId=expandedId===record.id?'':record.id"><span class="timeline-dot"></span><time>{{record.date}}</time><strong>{{record.exam}}</strong><component :is="expandedId===record.id?PhCaretUp:PhCaretRight" :size="14"/></button>
        <div v-if="expandedId===record.id" class="history-summary"><strong>影像所见</strong><p>{{record.findings.split('。')[0]}}。</p><button @click="openHistory(record)">查看完整报告<PhCaretRight :size="13"/></button></div>
      </div>
    </div>
    <div v-else class="clinical-empty"><PhClockCounterClockwise :size="26"/><strong>暂无既往病历</strong><p>当前模拟患者没有历史检查记录。</p></div>
  </section>
  <section class="clinical-card templates-card" aria-labelledby="common-templates-heading">
    <div class="clinical-heading"><PhFileText :size="21"/><h2 id="common-templates-heading">常用模板</h2></div>
    <div class="template-search"><PhMagnifyingGlass :size="17"/><input v-model="query" type="search" aria-label="搜索常用模板" placeholder="搜索模板名称或关键词"/></div>
    <div class="template-filters" aria-label="模板部位分类"><button v-for="item in templateCategories" :key="item" :aria-pressed="category===item" :class="{active:category===item}" @click="category=item">{{item}}</button></div>
    <div class="common-template-list" aria-label="常用模板列表"><button v-for="item in visibleTemplates" :key="item.id" :class="{active:selectedId===item.id}" :aria-pressed="selectedId===item.id" @click="selectedId=item.id"><span>{{item.name}}</span><PhCaretRight :size="14"/></button></div>
    <div v-if="selectedTemplate" class="common-template-preview"><h3>影像所见</h3><p>{{selectedTemplate.findings}}</p><h3>诊断意见</h3><p>{{selectedTemplate.impression}}</p><button class="primary-button insert-template" :disabled="disabled" @click="emit('insert',templateBody(selectedTemplate))">插入正文</button><span class="insertion-hint">插入后可继续编辑、撤销</span></div>
    <div v-else class="clinical-empty"><PhMagnifyingGlass :size="26"/><strong>没有匹配的模板</strong><p>试试其他关键词或部位分类。</p><button @click="query='';category='全部'">清除筛选</button></div>
  </section>
  <dialog ref="historyDialog" class="app-dialog history-dialog" aria-labelledby="history-dialog-title" @cancel.prevent="closeHistory" @click="e=>{if(e.target===historyDialog)closeHistory()}">
    <template v-if="detail"><div class="dialog-heading"><div><h2 id="history-dialog-title">既往检查报告</h2><p>模拟病历 · 只读</p></div><button class="icon-button" aria-label="关闭既往报告" @click="closeHistory"><PhX :size="20"/></button></div><div class="history-patient">{{data?.patient?.name}}<span>{{data?.patient?.no}}</span></div><div class="history-exam"><strong>{{detail.exam}}</strong><time>{{detail.date}}</time></div><h3>影像所见</h3><p>{{detail.findings}}</p><h3>诊断意见</h3><p>{{detail.impression}}</p><div class="history-signature">报告医生：{{detail.doctor}}</div></template>
  </dialog>
</aside>
</template>
