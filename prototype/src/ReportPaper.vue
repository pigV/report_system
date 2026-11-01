<script setup>
import {ref} from 'vue';
import { fieldsFor, readPath, reportHospitalName } from './report-model.mjs';
import BodyEditor from './editor/BodyEditor.vue';
const props=defineProps({template:Object,data:Object,showData:{type:Boolean,default:true},doctor:Boolean,readonlyBody:Boolean,body:Object,bodyKey:String,selected:String});
const emit=defineEmits(['updateBody']);
const bodyEditor=ref(null);
defineExpose({insertTemplate:body=>bodyEditor.value?.insertTemplate(body)??false});
const hospitalName=()=>reportHospitalName(props.template);
const gridStyle=region=>({gridTemplateColumns:props.template[region].content[0].attrs.columnWidths.map(w=>`${w}fr`).join(' ')});
function display(field){const path=props.template.bindings?.[field.attrs.fieldId];return !path?'未绑定':props.showData?readPath(props.data,path):`{${field.attrs.label}}`}
</script>
<template>
<article class="report-paper" aria-label="报告整页预览">
  <header class="paper-heading"><h2 v-if="hospitalName()">{{hospitalName()}}</h2><h3>{{template.title}}</h3></header>
  <div class="paper-fields" :class="{bordered:template.header.content[0].attrs.borders}" :style="gridStyle('header')">
    <div v-for="field in fieldsFor(template.header)" :key="field.attrs.fieldId" class="paper-field" :style="{gridColumn:`span ${field.attrs.span}`,textAlign:field.attrs.textAlign,fontWeight:field.attrs.bold?700:400}">
      <span class="paper-label">{{field.attrs.label}}</span><span class="paper-value" :class="{placeholder:!showData,unbound:!template.bindings?.[field.attrs.fieldId]}">{{display(field)}}</span>
    </div>
  </div>
  <div class="paper-body">
    <BodyEditor v-if="doctor||readonlyBody" ref="bodyEditor" :key="bodyKey" :content="body" :readonly="readonlyBody" @update="v=>emit('updateBody',v)" />
    <div v-else class="empty-body"><span>报告正文</span><p>医生自由编辑区域</p></div>
  </div>
  <footer class="paper-fields paper-footer" :class="{bordered:template.footer.content[0].attrs.borders}" :style="gridStyle('footer')">
    <div v-for="field in fieldsFor(template.footer)" :key="field.attrs.fieldId" class="paper-field" :style="{gridColumn:`span ${field.attrs.span}`,textAlign:field.attrs.textAlign,fontWeight:field.attrs.bold?700:400}"><span class="paper-label">{{field.attrs.label}}</span><span class="paper-value" :class="{placeholder:!showData,unbound:!template.bindings?.[field.attrs.fieldId]}">{{display(field)}}</span></div>
  </footer>
</article>
</template>
