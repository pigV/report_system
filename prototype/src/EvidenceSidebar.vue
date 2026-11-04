<script setup>
import {computed,ref,watch} from 'vue';
import {PhCheck,PhArrowsOutCardinal} from '@phosphor-icons/vue';
import {historyFor} from './clinical-assistance.mjs';
import {keyImages,IMAGE_DRAG_TYPE} from './key-images.mjs';
import ClinicalDetail from './ClinicalDetail.vue';
const props=defineProps({hospital:String,caseId:String,data:Object,disabled:Boolean,selectedImage:String});
const emit=defineEmits(['insert','selectImage']);
const records=computed(()=>historyFor(props.hospital,props.caseId,props.data?.patient?.no));
const draft=ref(null);
watch(()=>[props.hospital,props.caseId,props.data?.patient?.no].join(':'),()=>draft.value=records.value[0]?{...records.value[0]}:null,{immediate:true});
function drag(event,image){if(props.disabled){event.preventDefault();return}event.dataTransfer.setData(IMAGE_DRAG_TYPE,JSON.stringify({id:image.id,hospital:props.hospital,caseId:props.caseId}));event.dataTransfer.effectAllowed='copy';emit('selectImage',image.id)}
</script>
<template>
<aside class="evidence-sidebar" aria-label="影像与既往检查">
  <section class="evidence-images"><div class="assistance-title"><span></span><h2>关键影像</h2><span class="record-count">{{keyImages.length}}</span></div><p class="panel-guide">拖入正文图片栏，或选中后点击图片位置</p><div class="key-image-list"><button v-for="image in keyImages" :key="image.id" class="key-image" :class="{active:selectedImage===image.id}" :aria-label="`选择影像：${image.name}`" :aria-pressed="selectedImage===image.id" :draggable="!disabled" :disabled="disabled" @dragstart="drag($event,image)" @click="emit('selectImage',image.id)"><img :src="image.src" :alt="`${image.name}模拟图`" draggable="false"/><span><strong>{{image.name}}</strong><small>{{image.detail}}</small></span><PhCheck v-if="selectedImage===image.id" :size="16"/><PhArrowsOutCardinal v-else :size="15"/></button></div></section>
  <section class="evidence-history"><div class="assistance-title"><span></span><h2>既往检查</h2><span class="record-count">{{records.length}}</span></div><div class="exam-list"><button v-for="record in records" :key="record.id" :class="{active:draft?.id===record.id}" :disabled="disabled" :aria-pressed="draft?.id===record.id" @click="draft={...record}"><span><time>{{record.date}}</time><strong>{{record.exam}}</strong><small>已审核</small></span><p>诊断：{{record.impression}}</p></button></div><ClinicalDetail v-if="draft" v-model="draft" label="既往检查" :disabled="disabled" @cite="entry=>emit('insert',entry)"/><div v-else class="panel-empty">当前患者暂无既往检查</div></section>
</aside>
</template>
