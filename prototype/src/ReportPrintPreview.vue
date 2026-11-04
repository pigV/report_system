<script setup>
// 【学习10】打印弹层的 Vue 部分；render.mjs/paginate.mjs 负责内容生成与分页。
// snapshot 是打开时的内存副本；本组件不写报告库，window.print 才打开系统打印/PDF。
import {ref,onMounted,onBeforeUnmount,nextTick} from 'vue';
import {PhPrinter,PhX,PhCircleNotch} from '@phosphor-icons/vue';
import {buildPrintPages,waitForPrintResources} from './printing/render.mjs';
import {demoReportSubtitle} from './demo-report.mjs';
import './printing/print.css';
import './demo-report.css';
const props=defineProps({snapshot:{type:Object,required:true}});
const emit=defineEmits(['close']);
// stage/pagesRoot/closeButton 是模板中的 DOM ref；busy/error/pageCount 是驱动界面显示的状态。
// stage 隐藏但有实际布局尺寸；pagesRoot 接收已经生成好的整批 A4 页面。
const stage=ref(null),pagesRoot=ref(null),closeButton=ref(null),busy=ref(true),printing=ref(false),error=ref(''),pageCount=ref(0);
let controller=null,previousFocus=null,oldOverflow='',restoreTitle=null;
async function prepare(){
  // 重试先取消上一轮准备；signal 检查阻止已关闭/过时的过程继续填充预览页面。
  controller?.abort();controller=new AbortController();const signal=controller.signal;
  busy.value=true;error.value='';pageCount.value=0;
  try{
    // 先等 Vue 挂好测量 DOM；字体/图片是否加载则由 waitForPrintResources 另行等待。
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
  // 只有页面准备完且没有错误才允许打印；临时 title 用于系统打印文档名，结束后恢复。
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
  // 弹层内接管打印快捷键；Tab 在可用按钮间循环，Esc 返回，避免焦点跑到背景页面。
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='p'){e.preventDefault();print()}
  if(e.key==='Escape'&&!printing.value){e.preventDefault();emit('close')}
  if(e.key==='Tab'){
    const buttons=[...document.querySelectorAll('.report-print-overlay button:not(:disabled)')];
    if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1)?.focus()}
    else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0]?.focus()}
  }
}
// 挂载时锁住背景滚动并记住焦点；卸载时取消任务、解绑、恢复样式和原焦点。
onMounted(()=>{previousFocus=document.activeElement;oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';document.addEventListener('keydown',keydown);closeButton.value?.focus();prepare()});
onBeforeUnmount(()=>{controller?.abort();document.removeEventListener('keydown',keydown);document.body.style.overflow=oldOverflow;if(restoreTitle!==null)document.title=restoreTitle;previousFocus?.focus?.()});
</script>
<template>
<!-- Teleport 将整套预览移到 body；页面内容由一次分页结果生成，系统打印复用这批 DOM。 -->
<Teleport to="body"><section class="report-print-overlay" role="dialog" aria-modal="true" aria-labelledby="report-print-title">
  <header class="print-toolbar"><div><h2 id="report-print-title">打印预览 <span v-if="pageCount">· {{pageCount}} 页</span></h2><p>A4 纵向 · 当前编辑内容 · 首页患者信息，末页签署信息</p><p>系统打印请选择 A4、100% 缩放，并关闭浏览器页眉和页脚。</p></div><div class="print-toolbar-actions"><button class="primary-button" :disabled="busy||!!error||printing" @click="print"><PhPrinter :size="17"/>{{printing?'正在打开打印…':'打印 / 保存 PDF'}}</button><button ref="closeButton" class="secondary-button" :disabled="printing" @click="emit('close')"><PhX :size="17"/>返回编辑</button></div></header>
  <div v-if="busy" class="print-status" role="status"><PhCircleNotch :size="25" class="spin"/><p>正在加载影像并计算分页…</p></div>
  <div v-else-if="error" class="print-status" role="alert"><p>{{error}}</p><button class="secondary-button" @click="prepare">重新生成预览</button></div>
  <div class="print-pages-scroll" v-show="!busy&&!error"><div ref="pagesRoot" class="print-pages"></div></div>
  <div ref="stage" class="print-measure" aria-hidden="true"></div>
</section></Teleport>
</template>
