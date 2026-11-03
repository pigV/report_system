<script setup>
import { computed, ref, shallowRef, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import { PhFileText, PhBuildings, PhUserCircle, PhCaretDown, PhCaretRight, PhFloppyDisk, PhTextB, PhTextAlignLeft, PhTextAlignCenter, PhTextAlignRight, PhTable, PhDotsSixVertical, PhCheckCircle, PhArrowsOutSimple, PhX, PhCode, PhArrowCounterClockwise, PhInfo, PhArrowUp, PhArrowDown, PhSlidersHorizontal, PhCircleNotch, PhWarningCircle, PhEye, PhDatabase, PhPencilSimple, PhList, PhPlus, PhTrash, PhPrinter } from '@phosphor-icons/vue';
import TemplateEditor from './editor/TemplateEditor.vue';
import ReportPaper from './ReportPaper.vue';
import ReportPrintPreview from './ReportPrintPreview.vue';
import ClinicalSidebar from './ClinicalSidebar.vue';
import EvidenceSidebar from './EvidenceSidebar.vue';
import NativeTemplateWorkspace from './free-template/NativeTemplateWorkspace.vue';
import { hospitals, fieldsFor, readPath, pathOptions, validateTemplate, clone, moveField, emptyBody, addTemplateField, removeTemplateField, reportHospitalName, normalizeBindings, addBindingField, removeBindingField, moveBindingField } from './report-model.mjs';
import { mergeSavedTemplate, fieldColumn, applyRegionEdit } from './editor-state.mjs';
const hospital=ref('a'), section=ref('header'), view=ref(location.hash==='#native-templates'?'native':'templates'), template=ref(null), baseline=ref(''), selected=ref('patientName');
const data=ref(null), cases=ref([]), caseId=ref(''), report=ref(null), body=ref(emptyBody()), bodyBaseline=ref(''), bodyKey=ref(0);
const loading=ref(true), saving=ref(false), error=ref(''), showData=ref(true), zoom=ref('100'), toast=ref(''), advanced=ref(false), mobileSidebar=ref(false);
const modal=ref(''), dialog=ref(null), pendingAction=shallowRef(null), editorRef=ref(null);
const printSnapshot=ref(null);
function openPrint(){if(loading.value||saving.value||view.value!=='reports'||!paperData.value)return;closeModal();dialog.value?.close();printSnapshot.value=clone({template:paperTemplate.value,data:paperData.value,body:body.value})}
function printShortcut(e){if(view.value==='reports'&&!printSnapshot.value&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='p'){e.preventDefault();openPrint()}}
const reportPaper=ref(null),personalRef=ref(null),personalDirty=ref(false),selectedImage=ref('');
watch([hospital,caseId],()=>selectedImage.value='');
const nativeRef=ref(null),nativeDirty=ref(false),nativeBusy=ref(false),nativeError=ref('');
function insertTemplate(content){
  if(loading.value||saving.value||view.value!=='reports')return;
  if(reportPaper.value?.insertTemplate(content))notify('描述和诊断已替换，可撤销；其他内容保留');
  else error.value='正文编辑器尚未就绪，请稍后重试';
}
let loadVersion=0,toastTimer;
const bindingToAdd=ref('');
const hospitalName=computed(()=>hospitals.find(h=>h.id===hospital.value)?.name);
const currentDoc=computed(()=>template.value?.[section.value]);
const fields=computed(()=>fieldsFor(currentDoc.value));
const selectedField=computed(()=>fields.value.find(f=>f.attrs.fieldId===selected.value));
const grid=computed(()=>currentDoc.value?.content?.[0]);
const templateDirty=computed(()=>template.value&&JSON.stringify(template.value)!==baseline.value);
const bodyDirty=computed(()=>JSON.stringify(body.value)!==bodyBaseline.value);
const isDirty=computed(()=>view.value==='native'?nativeDirty.value:view.value==='templates'?templateDirty.value:bodyDirty.value);
const bindingRows=computed(()=>template.value?.bindingFields.filter(f=>f.region===section.value)??[]);
const boundCount=computed(()=>bindingRows.value.filter(f=>pathOptions.some(p=>p.path===template.value.bindings[f.id])).length);
const availableBindings=computed(()=>{
  const candidates=new Map(pathOptions.filter(p=>(p.path.startsWith('report.')?'footer':'header')===section.value).map(p=>[p.id,{id:p.id,label:p.label,region:section.value}]));
  for(const f of fields.value)if(!candidates.has(f.attrs.fieldId))candidates.set(f.attrs.fieldId,{id:f.attrs.fieldId,label:f.attrs.label,region:section.value});
  const existing=new Set(template.value?.bindingFields.map(f=>f.id));
  return [...candidates.values()].filter(f=>!existing.has(f.id));
});
const bindingCandidate=computed(()=>availableBindings.value.find(f=>f.id===bindingToAdd.value)??availableBindings.value[0]);
function addBinding(){if(bindingCandidate.value)template.value=addBindingField(template.value,bindingCandidate.value)}
function deleteBinding(id){template.value=removeBindingField(template.value,id)}
const paperTemplate=computed(()=>view.value==='reports'&&report.value?report.value.template:template.value);
const paperData=computed(()=>view.value==='reports'&&report.value?report.value.data:data.value);
const selectedIndex=computed(()=>fields.value.findIndex(f=>f.attrs.fieldId===selected.value));
const selectedWidth=computed(()=>grid.value?.attrs.columnWidths[fieldColumn(currentDoc.value,selected.value)]??1);
async function api(path,method='GET',payload){
  const response=await fetch(`/api/hospitals/${hospital.value}/${path}`,{method,headers:{'Content-Type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{})});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'请求失败');return result;
}
function notify(message){toast.value=message;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.value='',3500)}
async function load(){
  const token=++loadVersion;loading.value=true;error.value='';data.value=null;report.value=null;
  try {
    const [t,list]=await Promise.all([api('template'),api('cases')]);
    if(token!==loadVersion)return;
    template.value=normalizeBindings(t);baseline.value=JSON.stringify(template.value);cases.value=list;
    if(!list.some(c=>c.id===caseId.value))caseId.value=list[0].id;
    const [sample,saved]=await Promise.all([api(`cases/${caseId.value}`),api(`reports/${caseId.value}`)]);
    if(token!==loadVersion)return;
    data.value=sample.data;report.value=saved;body.value=saved?.body??emptyBody();bodyBaseline.value=JSON.stringify(body.value);bodyKey.value++;
    selected.value=fieldsFor(t[section.value])[0]?.attrs.fieldId??'';
  } catch(e){if(token===loadVersion)error.value=e.message} finally {if(token===loadVersion)loading.value=false}
}
function guard(action){if(saving.value||nativeBusy.value)return;if(isDirty.value||personalDirty.value){pendingAction.value=action;modal.value='unsaved'}else action()}
function chooseHospital(id){if(id===hospital.value)return;guard(()=>{hospital.value=id;caseId.value='';mobileSidebar.value=false;load()})}
function chooseView(id){if(id===view.value)return;guard(()=>{view.value=id;history.replaceState(null,'',id==='native'?'#native-templates':location.pathname);showData.value=true;mobileSidebar.value=false;load()})}
function chooseCase(e){const id=e.target.value;e.target.value=caseId.value;if(id===caseId.value)return;guard(()=>{caseId.value=id;load()})}
function chooseSection(id){section.value=id;selected.value=fieldsFor(template.value[id])[0]?.attrs.fieldId??'';advanced.value=false}
function setDoc(doc){
  template.value=applyRegionEdit(template.value,section.value,doc);
  if(!fieldsFor(doc).some(f=>f.attrs.fieldId===selected.value))selected.value=fieldsFor(doc)[0]?.attrs.fieldId??'';
}
function addField(){
  const id=`field_${crypto.randomUUID()}`;
  template.value=addTemplateField(template.value,section.value,id);
  selected.value=id;
}
function deleteField(id){
  const index=fields.value.findIndex(f=>f.attrs.fieldId===id);
  const wasSelected=selected.value===id;
  setDoc(removeTemplateField(template.value,section.value,id)[section.value]);
  if(wasSelected)selected.value=fields.value[Math.min(index,fields.value.length-1)]?.attrs.fieldId??'';
}

function updateField(key,value){if(!selectedField.value)return;const doc=clone(currentDoc.value);doc.content[0].content.find(f=>f.attrs.fieldId===selected.value).attrs[key]=value;setDoc(doc)}
function setColumns(value){const doc=clone(currentDoc.value),g=doc.content[0],columns=Number(value);g.attrs.columns=columns;g.attrs.columnWidths=Array(columns).fill(1);(g.content??[]).forEach(f=>f.attrs.span=Math.min(f.attrs.span,columns));setDoc(doc)}
function toggleBorders(){const doc=clone(currentDoc.value);doc.content[0].attrs.borders=!doc.content[0].attrs.borders;setDoc(doc)}
function setWidth(value){const doc=clone(currentDoc.value);doc.content[0].attrs.columnWidths[fieldColumn(currentDoc.value,selected.value)]=Number(value);setDoc(doc)}
function shift(offset){const target=fields.value[selectedIndex.value+offset];if(target)setDoc(moveField(currentDoc.value,selected.value,target.attrs.fieldId))}
function rowDrag(e,id){e.dataTransfer.setData('application/report-binding',id);e.dataTransfer.effectAllowed='move'}
function rowDrop(e,to){const from=e.dataTransfer.getData('application/report-binding');if(from)template.value=moveBindingField(template.value,from,to)}
async function save(){
  if(view.value==='native')return await nativeRef.value?.save()??false;
  saving.value=true;error.value='';
  try {
    if(view.value==='templates'){
      const problems=validateTemplate(hospital.value,template.value);if(problems.length)throw new Error(problems.join('；'));
      const submitted=clone(template.value);
      const saved=await api('template','PUT',submitted);template.value=mergeSavedTemplate(template.value,submitted,saved);baseline.value=JSON.stringify(saved);notify(templateDirty.value?'已保存提交的版本，后续修改尚未保存':'模板已保存，可在报告演示中使用');
    }else{
      const submitted=clone(body.value);
      const saved=await api(`reports/${caseId.value}`,'PUT',{body:submitted,context:{template:clone(paperTemplate.value),caseId:caseId.value,reportRevision:report.value?.revision??(report.value?1:0)}});report.value=saved;bodyBaseline.value=JSON.stringify(submitted);notify(bodyDirty.value?'已保存提交的正文，后续输入尚未保存':'报告正文已保存');
    }
    return true;
  } catch(e){error.value=e.message;return false} finally {saving.value=false}
}
function closeModal(){if(nativeBusy.value||saving.value)return;modal.value='';pendingAction.value=null}
async function confirmSwitch(saveFirst){if(nativeBusy.value||saving.value)return;if(saveFirst){if(personalDirty.value&&!personalRef.value?.save())return;if(isDirty.value&&!await save())return;}const action=pendingAction.value;closeModal();action?.()}
function reset(){template.value=JSON.parse(baseline.value);selected.value=fieldsFor(template.value[section.value])[0]?.attrs.fieldId??'';closeModal();notify('已恢复到上次保存的配置')}
watch(modal,async value=>{await nextTick();if(value)dialog.value?.showModal();else dialog.value?.close()});
function beforeUnload(e){if(isDirty.value||personalDirty.value){e.preventDefault();e.returnValue=''}}
onMounted(()=>{load();window.addEventListener('beforeunload',beforeUnload);document.addEventListener('keydown',printShortcut)});
onBeforeUnmount(()=>{window.removeEventListener('beforeunload',beforeUnload);document.removeEventListener('keydown',printShortcut);clearTimeout(toastTimer)});
</script>

<template>
<div class="app-shell" :inert="!!printSnapshot" :class="{'report-mode':view==='reports'}">
  <button v-if="mobileSidebar" class="sidebar-backdrop" aria-label="收起导航" @click="mobileSidebar=false"></button>
  <aside class="sidebar" :class="{expanded:mobileSidebar}" aria-label="工作空间导航">
    <div class="brand"><PhFileText :size="30" weight="bold"/><span>报告系统</span></div>
    <nav class="main-nav">
      <button aria-label="模板配置" :class="{active:view==='templates'}" :disabled="loading||saving||nativeBusy" @click="chooseView('templates')"><PhFileText :size="21"/><span>模板配置</span></button>
      <button aria-label="自由模板" :class="{active:view==='native'}" :disabled="loading||saving||nativeBusy" @click="chooseView('native')"><PhFileText :size="21"/><span>自由模板</span></button>
      <button aria-label="报告演示" :class="{active:view==='reports'}" :disabled="loading||saving||nativeBusy" @click="chooseView('reports')"><PhPencilSimple :size="21"/><span>报告演示</span></button>
    </nav>
    <div class="nav-divider"></div>
    <div class="sidebar-label">医院工作空间</div>
    <nav class="hospital-nav">
      <button v-for="h in hospitals" :key="h.id" :aria-label="h.name" :class="{active:hospital===h.id}" :disabled="loading||saving||nativeBusy" @click="chooseHospital(h.id)"><PhBuildings :size="21"/><span>{{h.name}}</span><span v-if="hospital===h.id" class="hospital-dot"></span></button>
    </nav>
    <div class="sidebar-bottom"><span class="demo-label">交互原型 · 模拟数据</span><div class="profile"><PhUserCircle :size="34" weight="duotone"/><div><strong>{{view!=='reports'?'管理员':'报告医生'}}</strong><span>{{view!=='reports'?'模板管理工作台':'报告编辑工作台'}}</span></div></div></div>
  </aside>
  <main class="main-workspace">
    <header class="topbar"><button class="icon-button mobile-menu" aria-label="展开导航" :aria-expanded="mobileSidebar" @click="mobileSidebar=!mobileSidebar"><PhList :size="20"/></button><div class="breadcrumb"><span>工作空间</span><PhCaretRight :size="12"/><span>{{hospitalName}}</span><PhCaretRight :size="12"/><strong>{{view==='native'?'自由模板':view==='templates'?'报告模板':'报告编辑'}}</strong></div><div class="top-actions"><button v-if="view==='reports'" class="secondary-button report-print-button" :disabled="loading||saving||!data" @click="openPrint"><PhPrinter :size="17"/>打印</button><span v-if="!loading&&!error" class="save-status"><PhCheckCircle v-if="!isDirty" :size="15"/><span v-else class="unsaved-dot"></span>{{isDirty?'有未保存的更改':'已保存'}}</span><button class="primary-button" :disabled="loading||saving||nativeBusy||!data" @click="save"><PhCircleNotch v-if="saving" class="spin" :size="17"/><PhFloppyDisk v-else :size="17"/>{{saving?'正在保存…':view!=='reports'?'保存模板':'保存报告'}}</button></div></header>
    <section class="page-content">
      <div class="page-heading"><div><h1>{{view!=='reports'?'报告模板配置':'编写影像报告'}}</h1><p>{{view==='native'?'直接编辑模板内容，拖动内容块调整布局。':view==='templates'?'把医院的要求，变成清晰的报告。':'查看既往病历，快速引用常用模板。'}}</p></div><span class="workspace-note"><PhBuildings :size="15"/>{{hospitalName}}<span class="dot-separator">/</span>{{view!=='reports'?'通用报告模板':'模拟病例'}}</span></div>
      <div v-if="error" class="error-banner" role="alert"><PhWarningCircle :size="20"/><span>{{error}}</span><button @click="guard(load)">重新加载</button><button v-if="data" class="icon-button" aria-label="关闭错误提示" @click="error='' "><PhX :size="16"/></button></div>
      <div v-if="loading" class="loading-state"><PhCircleNotch class="spin" :size="28"/><h2>正在加载{{hospitalName}}的报告模板</h2><p>读取配置与模拟病例数据…</p></div>
      <NativeTemplateWorkspace v-else-if="view==='native'&&data" :key="hospital" ref="nativeRef" :hospital="hospital" :data="data" @dirty="v=>nativeDirty=v" @busy="v=>nativeBusy=v" @notify="notify" @error="v=>nativeError=v"/>
      <div v-else-if="template&&data" class="workspace-grid" :class="{'doctor-workspace':view==='reports'}">
        <section v-if="view==='templates'" class="config-panel" aria-label="模板配置">
          <div class="section-tabs" role="tablist" aria-label="报告区域"><button role="tab" :aria-selected="section==='header'" :class="{selected:section==='header'}" @click="chooseSection('header')">表头</button><button role="tab" :aria-selected="section==='footer'" :class="{selected:section==='footer'}" @click="chooseSection('footer')">表尾</button><div class="toolbar-spacer"></div><button class="subtle-icon" title="查看模板 JSON" aria-label="查看模板 JSON" @click="modal='json'"><PhCode :size="18"/></button><button class="subtle-icon" title="恢复上次保存的配置" aria-label="恢复上次保存的配置" :disabled="!templateDirty" @click="modal='reset'"><PhArrowCounterClockwise :size="18"/></button></div>
          <div class="config-inner">
            <div v-if="section==='header'" class="heading-settings">
              <label for="hospital-heading">医院名称</label>
              <input id="hospital-heading" :value="reportHospitalName(template)" maxlength="80" placeholder="输入医院名称" @input="template.hospitalName=$event.target.value" />
              <p>居中显示在报告标题上方，留空可隐藏。</p>
            </div>
            <div class="format-toolbar" role="toolbar" aria-label="字段样式">
              <button :disabled="!selectedField" :class="{pressed:selectedField?.attrs.bold}" :aria-pressed="selectedField?.attrs.bold" aria-label="字段加粗" title="选中字段加粗" @click="updateField('bold',!selectedField?.attrs.bold)"><PhTextB :size="20" weight="bold"/></button>
              <div class="align-group"><button v-for="(align,i) in ['left','center','right']" :key="align" :disabled="!selectedField" :class="{pressed:selectedField?.attrs.textAlign===align}" :aria-label="['左对齐','居中对齐','右对齐'][i]" :aria-pressed="selectedField?.attrs.textAlign===align" @click="updateField('textAlign',align)"><component :is="[PhTextAlignLeft,PhTextAlignCenter,PhTextAlignRight][i]" :size="19"/></button></div>
              <button :class="{pressed:grid.attrs.borders}" :aria-pressed="grid.attrs.borders" aria-label="切换字段边框" title="字段边框" @click="toggleBorders"><PhTable :size="19"/></button>
              <div class="select-wrap layout-select"><select aria-label="布局列数" :value="grid.attrs.columns" @change="setColumns($event.target.value)"><option :value="1">单列布局</option><option :value="2">两列布局</option><option :value="3">三列布局</option></select><PhCaretDown :size="12"/></div>
              <button class="advanced-button" :class="{pressed:advanced}" aria-label="更多字段样式" title="调整字段宽度和顺序" :aria-expanded="advanced" @click="advanced=!advanced"><PhSlidersHorizontal :size="19"/></button>
            </div>
            <div v-if="advanced&&selectedField" class="advanced-controls"><span>{{selectedField?.attrs.label}}</span><label>占用列数<select aria-label="字段占用列数" :value="selectedField?.attrs.span" @change="updateField('span',Number($event.target.value))"><option v-for="n in grid.attrs.columns" :key="n" :value="n">{{n}}</option></select></label><label class="width-label">列宽<input aria-label="选中字段所在列宽度" type="range" min="0.5" max="2" step="0.1" :value="selectedWidth" @input="setWidth($event.target.value)"/></label><button class="icon-button" aria-label="字段前移" :disabled="selectedIndex===0" @click="shift(-1)"><PhArrowUp :size="15"/></button><button class="icon-button" aria-label="字段后移" :disabled="selectedIndex===fields.length-1" @click="shift(1)"><PhArrowDown :size="15"/></button></div>
            <TemplateEditor :key="hospital+section" ref="editorRef" :model-value="currentDoc" :selected="selected" @update:model-value="setDoc" @select="id=>selected=id" />
            <label v-if="selectedField" class="layout-field-name">布局字段名称<input aria-label="布局字段名称" :value="selectedField.attrs.label" maxlength="20" @input="updateField('label',$event.target.value)"/></label>
            <div class="field-actions">
              <button class="secondary-button" @click="addField"><PhPlus :size="16"/>添加字段</button>
              <button class="remove-field-button" :disabled="!selectedField" @click="deleteField(selected)"><PhTrash :size="15"/>删除选中字段</button>
              <span>{{fields.length}} 个字段</span>
            </div>
            <div class="mapping-section"><div class="mapping-heading"><h2>字段与数据绑定</h2><span><PhCheckCircle :size="15" weight="fill"/>{{boundCount}} / {{bindingRows.length}} 个字段已绑定</span></div>
              <div class="mapping-table" role="table" aria-label="字段映射关系">
                <div class="mapping-table-head" role="row"><span></span><span role="columnheader">字段名称</span><span role="columnheader">数据来源</span><span class="sr-only" role="columnheader">操作</span></div>
                <div v-for="f in bindingRows" :key="f.id" class="mapping-row" role="row" @dragover.prevent @drop.prevent="rowDrop($event,f.id)">
                  <button class="row-grip" draggable="true" :aria-label="`调整绑定${f.label}顺序`" title="拖动调整绑定顺序；方向键前移或后移" @dragstart="rowDrag($event,f.id)" @keydown.up.prevent="bindingRows.indexOf(f)>0&&(template=moveBindingField(template,f.id,bindingRows[bindingRows.indexOf(f)-1].id))" @keydown.down.prevent="bindingRows.indexOf(f)<bindingRows.length-1&&(template=moveBindingField(template,f.id,bindingRows[bindingRows.indexOf(f)+1].id))"><PhDotsSixVertical :size="18"/></button>
                  <input class="field-name-input" :aria-label="`${f.id} 绑定名称`" v-model="f.label" maxlength="20"/>
                  <div class="select-wrap mapping-select"><select :aria-label="`${f.label}数据来源`" v-model="template.bindings[f.id]"><option value="">未绑定（解除绑定）</option><option v-for="o in pathOptions" :key="o.path" :value="o.path">{{o.path}}</option></select><PhCaretDown :size="12"/></div>
                  <button class="icon-button delete-field" :aria-label="`删除绑定：${f.label}`" title="仅删除此绑定" @click="deleteBinding(f.id)"><PhTrash :size="16"/></button>
                </div>
                <p v-if="!bindingRows.length" class="empty-mapping">暂无绑定，可在下方选择字段添加。</p>
              </div>
              <div class="binding-actions"><select aria-label="添加绑定的字段" :disabled="!availableBindings.length" :value="bindingCandidate?.id??''" @change="bindingToAdd=$event.target.value"><option v-if="!availableBindings.length" value="">暂无可添加字段</option><option v-for="f in availableBindings" :key="f.id" :value="f.id">{{f.label}}</option></select><button class="secondary-button" :disabled="!bindingCandidate" @click="addBinding"><PhPlus :size="16"/>添加绑定</button></div>
              <div class="mapping-hint"><PhInfo :size="15"/><span>绑定列表独立保存；两处的删除、名称和顺序互不影响。</span></div>
            </div>
          </div>
          <div class="config-bottom"><span><PhCheckCircle :size="13"/>{{hospitalName}}独立配置</span><span>Yiitap 编辑器</span></div>
        </section>
        <ClinicalSidebar v-else ref="personalRef" :hospital="hospital" :disabled="saving" @insert="insertTemplate" @dirty="v=>personalDirty=v" @notify="notify"/>
        <section class="preview-panel" aria-label="实时预览">
          <div class="report-patient-bar" v-if="view==='reports'"><span><strong>{{paperData?.patient?.name}}</strong> {{paperData?.patient?.gender}} · {{paperData?.patient?.age}} · {{paperData?.patient?.no}}</span><select aria-label="选择模拟病例" :value="caseId" :disabled="saving" @change="chooseCase"><option v-for="item in cases" :value="item.id" :key="item.id">{{item.label}}</option></select></div>
          <div class="preview-toolbar"><h2>{{view==='templates'?'整页预览':'报告编辑'}}</h2><div class="preview-options"><template v-if="view==='templates'"><span>模拟数据</span><button class="toggle" role="switch" aria-label="显示模拟数据" :aria-checked="showData" :class="{on:showData}" @click="showData=!showData"><span></span></button><div class="select-wrap zoom-select"><select aria-label="预览缩放" v-model="zoom"><option value="100">100%</option><option value="85">85%</option></select><PhCaretDown :size="12"/></div></template><button class="icon-button expand-button" title="放大预览" aria-label="放大预览" @click="modal='preview'"><PhArrowsOutSimple :size="17"/></button></div></div>
          <div class="paper-container" :class="{reduced:zoom==='85'&&view==='templates'}"><ReportPaper ref="reportPaper" :template="paperTemplate" :data="paperData" :show-data="showData" :doctor="view==='reports'" :scope="{hospital,caseId}" :selected-image="selectedImage" :body="body" :body-key="`${hospital}-${caseId}-${bodyKey}`" :selected="selected" @update-body="v=>body=v"/></div>
          <div class="preview-footnote"><span><PhDatabase :size="13"/>仅使用模拟数据</span><span>{{view==='templates'?'布局修改实时呈现':'正文支持自由编辑'}}</span></div>
        </section>
        <EvidenceSidebar v-if="view==='reports'" :hospital="hospital" :case-id="caseId" :data="paperData" :disabled="saving" :selected-image="selectedImage" @insert="insertTemplate" @select-image="id=>selectedImage=id"/>
      </div>
    </section>
  </main>
  <Transition name="toast"><div v-if="toast" class="toast-message" role="status"><PhCheckCircle :size="20" weight="fill"/>{{toast}}</div></Transition>
  <dialog ref="dialog" :class="['app-dialog',modal==='preview'?'preview-dialog':'',modal==='json'?'json-dialog':'']" @cancel.prevent="closeModal" @click="e=>{if(e.target===dialog)closeModal()}">
    <template v-if="modal==='unsaved'"><div class="dialog-heading"><h2>保存这次更改？</h2><button class="icon-button" aria-label="关闭对话框" @click="closeModal"><PhX :size="20"/></button></div><p>当前{{view!=='reports'?'模板配置':'报告正文或个人模板'}}有未保存的更改。离开前，你可以保存或放弃更改。</p><div v-if="view==='native'?nativeError:error" class="dialog-error" role="alert">{{view==='native'?nativeError:error}}</div><div class="dialog-actions"><button class="secondary-button" :disabled="saving||nativeBusy" @click="closeModal">继续编辑</button><button class="secondary-button" :disabled="saving||nativeBusy" @click="confirmSwitch(false)">放弃更改</button><button class="primary-button" :disabled="saving||nativeBusy" @click="confirmSwitch(true)">{{saving||nativeBusy?'保存中…':'保存并切换'}}</button></div></template>
    <template v-if="modal==='reset'"><div class="dialog-heading"><h2>恢复已保存的配置？</h2><button class="icon-button" aria-label="关闭对话框" @click="closeModal"><PhX :size="20"/></button></div><p>将放弃本次未保存的修改，恢复到该医院上次保存的模板。</p><div class="dialog-actions"><button class="secondary-button" @click="closeModal">取消</button><button class="primary-button" @click="reset">恢复配置</button></div></template>
    <template v-if="modal==='json'"><div class="dialog-heading"><div><h2>模板文档</h2><p>Tiptap JSON · 当前编辑内容</p></div><button class="icon-button" aria-label="关闭对话框" @click="closeModal"><PhX :size="20"/></button></div><pre>{{JSON.stringify(template,null,2)}}</pre></template>
    <template v-if="modal==='preview'"><div class="dialog-heading"><div><h2>{{hospitalName}} · 整页预览</h2><p>{{showData?'模拟数据展示':'字段占位符展示'}}</p></div><button class="icon-button" aria-label="关闭预览" @click="closeModal"><PhX :size="20"/></button></div><ReportPaper :template="paperTemplate" :data="paperData" :show-data="showData" :body="body" :readonly-body="view==='reports'"/></template>
  </dialog>
</div>
<ReportPrintPreview v-if="printSnapshot" :snapshot="printSnapshot" @close="printSnapshot=null"/>
</template>
