<script setup>
import {ref,onMounted,onBeforeUnmount,nextTick} from 'vue';
import {PhPrinter,PhX,PhCircleNotch} from '@phosphor-icons/vue';
import {buildPrintPages,waitForPrintResources} from './printing/render.mjs';
import {demoReportSubtitle} from './demo-report.mjs';
import './printing/print.css';
import './demo-report.css';
const props=defineProps({snapshot:{type:Object,required:true}});
const emit=defineEmits(['close']);
const stage=ref(null),pagesRoot=ref(null),closeButton=ref(null),busy=ref(true),printing=ref(false),error=ref(''),pageCount=ref(0);
let controller=null,previousFocus=null,oldOverflow='',restoreTitle=null;
async function prepare(){
  controller?.abort();controller=new AbortController();const signal=controller.signal;
  busy.value=true;error.value='';pageCount.value=0;
  try{
    await nextTick();
    const pages=await buildPrintPages(stage.value,props.snapshot,signal);
    if(signal.aborted)return;
    pagesRoot.value.replaceChildren(...pages);
    await waitForPrintResources(pagesRoot.value,signal);
    if(signal.aborted)return;
    pageCount.value=pages.length;
  }catch(e){if(!signal.aborted)error.value=e.message}
  finally{if(!signal.aborted){busy.value=false;stage.value?.replaceChildren()}}
}
async function print(){
  if(busy.value||error.value||printing.value)return;
  printing.value=true;
  try{
    await waitForPrintResources(pagesRoot.value,controller.signal);
    restoreTitle=document.title;document.title=`${props.snapshot.data?.patient?.name??'患者'}-${props.snapshot.demo?demoReportSubtitle:props.snapshot.template.title}`;
    window.print();
  }catch(e){if(e.name!=='AbortError')error.value=`无法打印：${e.message}`}
  finally{printing.value=false;if(restoreTitle!==null){document.title=restoreTitle;restoreTitle=null}}
}
function keydown(e){
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='p'){e.preventDefault();print()}
  if(e.key==='Escape'&&!printing.value){e.preventDefault();emit('close')}
  if(e.key==='Tab'){
    const buttons=[...document.querySelectorAll('.report-print-overlay button:not(:disabled)')];
    if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1)?.focus()}
    else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0]?.focus()}
  }
}
onMounted(()=>{previousFocus=document.activeElement;oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';document.addEventListener('keydown',keydown);closeButton.value?.focus();prepare()});
onBeforeUnmount(()=>{controller?.abort();document.removeEventListener('keydown',keydown);document.body.style.overflow=oldOverflow;if(restoreTitle!==null)document.title=restoreTitle;previousFocus?.focus?.()});
</script>
<template>
<Teleport to="body"><section class="report-print-overlay" role="dialog" aria-modal="true" aria-labelledby="report-print-title">
  <header class="print-toolbar"><div><h2 id="report-print-title">打印预览 <span v-if="pageCount">· {{pageCount}} 页</span></h2><p>A4 纵向 · 当前编辑内容 · 首页患者信息，末页签署信息</p><p>系统打印请选择 A4、100% 缩放，并关闭浏览器页眉和页脚。</p></div><div class="print-toolbar-actions"><button class="primary-button" :disabled="busy||!!error||printing" @click="print"><PhPrinter :size="17"/>{{printing?'正在打开打印…':'打印 / 保存 PDF'}}</button><button ref="closeButton" class="secondary-button" :disabled="printing" @click="emit('close')"><PhX :size="17"/>返回编辑</button></div></header>
  <div v-if="busy" class="print-status" role="status"><PhCircleNotch :size="25" class="spin"/><p>正在加载影像并计算分页…</p></div>
  <div v-else-if="error" class="print-status" role="alert"><p>{{error}}</p><button class="secondary-button" @click="prepare">重新生成预览</button></div>
  <div class="print-pages-scroll" v-show="!busy&&!error"><div ref="pagesRoot" class="print-pages"></div></div>
  <div ref="stage" class="print-measure" aria-hidden="true"></div>
</section></Teleport>
</template>
