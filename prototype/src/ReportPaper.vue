<script setup>
// 【学习03】纸张组件只组合表头、正文和表尾；正文文档的修改交给 BodyEditor。
// App 持有 body；此处向下传 props，接到 update 后向上转发 updateBody，不另存一份正文。
import {ref} from 'vue';
import { fieldsFor, readPath, reportHospitalName } from './report-model.mjs';
import { demoReportTitle, demoReportSubtitle, demoLogo, demoSignature, demoReportFields, demoReportTime } from './demo-report.mjs';
import BodyEditor from './editor/BodyEditor.vue';
const props=defineProps({template:Object,data:Object,showData:{type:Boolean,default:true},doctor:Boolean,readonlyBody:Boolean,demo:Boolean,body:Object,bodyKey:String,scope:Object,selectedImage:String});
const emit=defineEmits(['updateBody']);
const bodyEditor=ref(null);
// 组件 ref 与 editor 实例不同：这里拿到的是 BodyEditor 经 defineExpose 开放的方法。
// App → ReportPaper → BodyEditor 是侧栏引用的向下调用链。
defineExpose({insertTemplate:body=>bodyEditor.value?.insertTemplate(body)??false});
const hospitalName=()=>reportHospitalName(props.template);
const gridStyle=region=>({gridTemplateColumns:props.template[region].content[0].attrs.columnWidths.map(w=>`${w}fr`).join(' ')});
function display(field){const path=props.template.bindings?.[field.attrs.fieldId];return !path?'未绑定':props.showData?readPath(props.data,path):`{${field.attrs.label}}`}
</script>
<template>
<article class="report-paper" :class="{'demo-report':demo}" aria-label="报告整页预览">
  <!-- demo 分支使用演示专用抬头/字段；非 demo 分支才读取模板配置的字段布局。 -->
  <header v-if="demo" class="paper-heading demo-heading"><span class="demo-logo"><img :src="demoLogo" alt="沈阳壹家宠物医院标志"/></span><h2>{{demoReportTitle}}</h2><h3>{{demoReportSubtitle}}</h3></header>
  <header v-else class="paper-heading"><h2 v-if="hospitalName()">{{hospitalName()}}</h2><h3>{{template.title}}</h3></header>
  <div v-if="demo" class="paper-fields demo-fields">
    <div v-for="field in demoReportFields(data)" :key="field.label" class="paper-field" :class="{'demo-field-wide':field.wide}"><span class="paper-label">{{field.label}}</span><span class="paper-value">{{field.value}}</span></div>
  </div>
  <div v-else class="paper-fields" :class="{bordered:template.header.content[0].attrs.borders}" :style="gridStyle('header')">
    <div v-for="field in fieldsFor(template.header)" :key="field.attrs.fieldId" class="paper-field" :style="{gridColumn:`span ${field.attrs.span}`,textAlign:field.attrs.textAlign,fontWeight:field.attrs.bold?700:400}">
      <span class="paper-label">{{field.attrs.label}}</span><span class="paper-value" :class="{placeholder:!showData,unbound:!template.bindings?.[field.attrs.fieldId]}">{{display(field)}}</span>
    </div>
  </div>
  <div class="paper-body">
    <!-- key 改变才重建编辑器（例如加载另一个病例）；不是每次 body 更新都重建。
         @update 只是转发 JSON；只读模式仍显示内容，但不允许正文编辑交互。 -->
    <BodyEditor v-if="doctor||readonlyBody" ref="bodyEditor" :key="bodyKey" :content="body" :readonly="readonlyBody" :scope="scope" :selected-image="selectedImage" @update="v=>emit('updateBody',v)" />
    <div v-else class="empty-body"><span>报告正文</span><p>医生自由编辑区域</p></div>
  </div>
  <footer v-if="demo" class="demo-footer">
    <div class="demo-signature"><span>报告医生：</span><img :src="demoSignature" alt="模拟报告医生签名"/></div>
    <div class="demo-footer-meta"><span>注：本报告仅供临床医生参考。</span><span>报告时间：{{demoReportTime(data)}}</span></div>
  </footer>
  <footer v-else class="paper-fields paper-footer" :class="{bordered:template.footer.content[0].attrs.borders}" :style="gridStyle('footer')">
    <div v-for="field in fieldsFor(template.footer)" :key="field.attrs.fieldId" class="paper-field" :style="{gridColumn:`span ${field.attrs.span}`,textAlign:field.attrs.textAlign,fontWeight:field.attrs.bold?700:400}"><span class="paper-label">{{field.attrs.label}}</span><span class="paper-value" :class="{placeholder:!showData,unbound:!template.bindings?.[field.attrs.fieldId]}">{{display(field)}}</span></div>
  </footer>
</article>
</template>
