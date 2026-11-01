<script setup>
import { computed, ref, shallowRef, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import { PhFileText, PhBuildings, PhUserCircle, PhCaretDown, PhCaretRight, PhFloppyDisk, PhTextB, PhTextAlignLeft, PhTextAlignCenter, PhTextAlignRight, PhTable, PhDotsSixVertical, PhCheckCircle, PhArrowsOutSimple, PhX, PhCode, PhArrowCounterClockwise, PhInfo, PhArrowUp, PhArrowDown, PhSlidersHorizontal, PhCircleNotch, PhWarningCircle, PhEye, PhDatabase, PhPencilSimple, PhList } from '@phosphor-icons/vue';
import TemplateEditor from './editor/TemplateEditor.vue';
import ReportPaper from './ReportPaper.vue';
import { hospitals, fieldsFor, readPath, pathOptions, validateTemplate, clone, moveField, emptyBody } from './report-model.mjs';
import { mergeSavedTemplate, fieldColumn } from './editor-state.mjs';
const hospital=ref('a'), section=ref('header'), view=ref('templates'), template=ref(null), baseline=ref(''), selected=ref('patientName');
const data=ref(null), cases=ref([]), caseId=ref(''), report=ref(null), body=ref(emptyBody()), bodyBaseline=ref(''), bodyKey=ref(0);
const loading=ref(true), saving=ref(false), error=ref(''), showData=ref(true), zoom=ref('100'), toast=ref(''), advanced=ref(false), mobileSidebar=ref(false);
const modal=ref(''), dialog=ref(null), pendingAction=shallowRef(null), editorRef=ref(null);
let loadVersion=0,toastTimer;
const hospitalName=computed(()=>hospitals.find(h=>h.id===hospital.value)?.name);
const currentDoc=computed(()=>template.value?.[section.value]);
const fields=computed(()=>fieldsFor(currentDoc.value));
const selectedField=computed(()=>fields.value.find(f=>f.attrs.fieldId===selected.value));
const grid=computed(()=>currentDoc.value?.content?.[0]);
const templateDirty=computed(()=>template.value&&JSON.stringify(template.value)!==baseline.value);
const bodyDirty=computed(()=>JSON.stringify(body.value)!==bodyBaseline.value);
const isDirty=computed(()=>view.value==='templates'?templateDirty.value:bodyDirty.value);
const boundCount=computed(()=>fields.value.filter(f=>pathOptions.some(p=>p.path===template.value.bindings[f.attrs.fieldId])).length);
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
    template.value=t;baseline.value=JSON.stringify(t);cases.value=list;
    if(!list.some(c=>c.id===caseId.value))caseId.value=list[0].id;
    const [sample,saved]=await Promise.all([api(`cases/${caseId.value}`),api(`reports/${caseId.value}`)]);
    if(token!==loadVersion)return;
    data.value=sample.data;report.value=saved;body.value=saved?.body??emptyBody();bodyBaseline.value=JSON.stringify(body.value);bodyKey.value++;
    selected.value=fieldsFor(t[section.value])[0].attrs.fieldId;
  } catch(e){if(token===loadVersion)error.value=e.message} finally {if(token===loadVersion)loading.value=false}
}
function guard(action){if(saving.value)return;if(isDirty.value){pendingAction.value=action;modal.value='unsaved'}else action()}
function chooseHospital(id){if(id===hospital.value)return;guard(()=>{hospital.value=id;caseId.value='';mobileSidebar.value=false;load()})}
function chooseView(id){if(id===view.value)return;guard(()=>{view.value=id;showData.value=true;mobileSidebar.value=false;load()})}
function chooseCase(e){const id=e.target.value;e.target.value=caseId.value;if(id===caseId.value)return;guard(()=>{caseId.value=id;load()})}
function chooseSection(id){section.value=id;selected.value=fieldsFor(template.value[id])[0].attrs.fieldId;advanced.value=false}
function setDoc(doc){template.value={...template.value,[section.value]:doc}}
function updateField(key,value){if(!selectedField.value)return;const doc=clone(currentDoc.value);doc.content[0].content.find(f=>f.attrs.fieldId===selected.value).attrs[key]=value;setDoc(doc)}
function rename(id,label){const doc=clone(currentDoc.value);doc.content[0].content.find(f=>f.attrs.fieldId===id).attrs.label=label;setDoc(doc)}
function setColumns(value){const doc=clone(currentDoc.value),g=doc.content[0],columns=Number(value);g.attrs.columns=columns;g.attrs.columnWidths=Array(columns).fill(1);g.content.forEach(f=>f.attrs.span=Math.min(f.attrs.span,columns));setDoc(doc)}
function toggleBorders(){const doc=clone(currentDoc.value);doc.content[0].attrs.borders=!doc.content[0].attrs.borders;setDoc(doc)}
function setWidth(value){const doc=clone(currentDoc.value);doc.content[0].attrs.columnWidths[fieldColumn(currentDoc.value,selected.value)]=Number(value);setDoc(doc)}
function shift(offset){const target=fields.value[selectedIndex.value+offset];if(target)setDoc(moveField(currentDoc.value,selected.value,target.attrs.fieldId))}
function rowDrag(e,id){e.dataTransfer.setData('application/report-field',id);e.dataTransfer.effectAllowed='move';selected.value=id}
function rowDrop(e,to){const from=e.dataTransfer.getData('application/report-field');if(from)setDoc(moveField(currentDoc.value,from,to))}
async function save(){
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
function closeModal(){modal.value='';pendingAction.value=null}
async function confirmSwitch(saveFirst){if(saveFirst&&!await save())return;const action=pendingAction.value;closeModal();action?.()}
function reset(){template.value=JSON.parse(baseline.value);selected.value=fieldsFor(template.value[section.value])[0].attrs.fieldId;closeModal();notify('已恢复到上次保存的配置')}
watch(modal,async value=>{await nextTick();if(value)dialog.value?.showModal();else dialog.value?.close()});
function beforeUnload(e){if(isDirty.value){e.preventDefault();e.returnValue=''}}
onMounted(()=>{load();window.addEventListener('beforeunload',beforeUnload)});
onBeforeUnmount(()=>{window.removeEventListener('beforeunload',beforeUnload);clearTimeout(toastTimer)});
</script>

<template>
<div class="app-shell">
  <button v-if="mobileSidebar" class="sidebar-backdrop" aria-label="收起导航" @click="mobileSidebar=false"></button>
  <aside class="sidebar" :class="{expanded:mobileSidebar}" aria-label="工作空间导航">
    <div class="brand"><PhFileText :size="30" weight="bold"/><span>影像文书</span></div>
    <nav class="main-nav">
      <button :class="{active:view==='templates'}" :disabled="loading||saving" @click="chooseView('templates')"><PhFileText :size="21"/><span>模板配置</span></button>
      <button :class="{active:view==='reports'}" :disabled="loading||saving" @click="chooseView('reports')"><PhPencilSimple :size="21"/><span>报告演示</span></button>
    </nav>
    <div class="nav-divider"></div>
    <div class="sidebar-label">医院工作空间</div>
    <nav class="hospital-nav">
      <button v-for="h in hospitals" :key="h.id" :class="{active:hospital===h.id}" :disabled="loading||saving" @click="chooseHospital(h.id)"><PhBuildings :size="21"/><span>{{h.name}}</span><span v-if="hospital===h.id" class="hospital-dot"></span></button>
    </nav>
    <div class="sidebar-bottom"><span class="demo-label">交互原型 · 模拟数据</span><div class="profile"><PhUserCircle :size="34" weight="duotone"/><div><strong>{{view==='templates'?'管理员':'报告医生'}}</strong><span>{{view==='templates'?'模板管理工作台':'报告编辑工作台'}}</span></div></div></div>
  </aside>
  <main class="main-workspace">
    <header class="topbar"><button class="icon-button mobile-menu" aria-label="展开导航" :aria-expanded="mobileSidebar" @click="mobileSidebar=!mobileSidebar"><PhList :size="20"/></button><div class="breadcrumb"><span>工作空间</span><PhCaretRight :size="12"/><span>{{hospitalName}}</span><PhCaretRight :size="12"/><strong>{{view==='templates'?'报告模板':'报告编辑'}}</strong></div><div class="top-actions"><span v-if="!loading&&!error" class="save-status"><PhCheckCircle v-if="!isDirty" :size="15"/><span v-else class="unsaved-dot"></span>{{isDirty?'有未保存的更改':'已保存'}}</span><button class="primary-button" :disabled="loading||saving||!data" @click="save"><PhCircleNotch v-if="saving" class="spin" :size="17"/><PhFloppyDisk v-else :size="17"/>{{saving?'正在保存…':view==='templates'?'保存模板':'保存报告'}}</button></div></header>
    <section class="page-content">
      <div class="page-heading"><div><h1>{{view==='templates'?'报告模板配置':'编写影像报告'}}</h1><p>{{view==='templates'?'把医院的要求，变成清晰的报告。':'患者信息已自动填入，专注于你的报告内容。'}}</p></div><span class="workspace-note"><PhBuildings :size="15"/>{{hospitalName}}<span class="dot-separator">/</span>{{view==='templates'?'通用报告模板':'模拟病例'}}</span></div>
      <div v-if="error" class="error-banner" role="alert"><PhWarningCircle :size="20"/><span>{{error}}</span><button @click="guard(load)">重新加载</button><button v-if="data" class="icon-button" aria-label="关闭错误提示" @click="error='' "><PhX :size="16"/></button></div>
      <div v-if="loading" class="loading-state"><PhCircleNotch class="spin" :size="28"/><h2>正在加载{{hospitalName}}的报告模板</h2><p>读取配置与模拟病例数据…</p></div>
      <div v-else-if="template&&data" class="workspace-grid" :class="{'doctor-workspace':view==='reports'}">
        <section v-if="view==='templates'" class="config-panel" aria-label="模板配置">
          <div class="section-tabs" role="tablist" aria-label="报告区域"><button role="tab" :aria-selected="section==='header'" :class="{selected:section==='header'}" @click="chooseSection('header')">表头</button><button role="tab" :aria-selected="section==='footer'" :class="{selected:section==='footer'}" @click="chooseSection('footer')">表尾</button><div class="toolbar-spacer"></div><button class="subtle-icon" title="查看模板 JSON" aria-label="查看模板 JSON" @click="modal='json'"><PhCode :size="18"/></button><button class="subtle-icon" title="恢复上次保存的配置" aria-label="恢复上次保存的配置" :disabled="!templateDirty" @click="modal='reset'"><PhArrowCounterClockwise :size="18"/></button></div>
          <div class="config-inner">
            <div class="format-toolbar" role="toolbar" aria-label="字段样式">
              <button :class="{pressed:selectedField?.attrs.bold}" :aria-pressed="selectedField?.attrs.bold" aria-label="字段加粗" title="选中字段加粗" @click="updateField('bold',!selectedField?.attrs.bold)"><PhTextB :size="20" weight="bold"/></button>
              <div class="align-group"><button v-for="(align,i) in ['left','center','right']" :key="align" :class="{pressed:selectedField?.attrs.textAlign===align}" :aria-label="['左对齐','居中对齐','右对齐'][i]" :aria-pressed="selectedField?.attrs.textAlign===align" @click="updateField('textAlign',align)"><component :is="[PhTextAlignLeft,PhTextAlignCenter,PhTextAlignRight][i]" :size="19"/></button></div>
              <button :class="{pressed:grid.attrs.borders}" :aria-pressed="grid.attrs.borders" aria-label="切换字段边框" title="字段边框" @click="toggleBorders"><PhTable :size="19"/></button>
              <div class="select-wrap layout-select"><select aria-label="布局列数" :value="grid.attrs.columns" @change="setColumns($event.target.value)"><option :value="1">单列布局</option><option :value="2">两列布局</option><option :value="3">三列布局</option></select><PhCaretDown :size="12"/></div>
              <button class="advanced-button" :class="{pressed:advanced}" aria-label="更多字段样式" title="调整字段宽度和顺序" :aria-expanded="advanced" @click="advanced=!advanced"><PhSlidersHorizontal :size="19"/></button>
            </div>
            <div v-if="advanced" class="advanced-controls"><span>{{selectedField?.attrs.label}}</span><label>占用列数<select aria-label="字段占用列数" :value="selectedField?.attrs.span" @change="updateField('span',Number($event.target.value))"><option v-for="n in grid.attrs.columns" :key="n" :value="n">{{n}}</option></select></label><label class="width-label">列宽<input aria-label="选中字段所在列宽度" type="range" min="0.5" max="2" step="0.1" :value="selectedWidth" @input="setWidth($event.target.value)"/></label><button class="icon-button" aria-label="字段前移" :disabled="selectedIndex===0" @click="shift(-1)"><PhArrowUp :size="15"/></button><button class="icon-button" aria-label="字段后移" :disabled="selectedIndex===fields.length-1" @click="shift(1)"><PhArrowDown :size="15"/></button></div>
            <TemplateEditor :key="hospital+section" ref="editorRef" :model-value="currentDoc" :selected="selected" @update:model-value="setDoc" @select="id=>selected=id" />
            <div class="mapping-section"><div class="mapping-heading"><h2>字段与数据绑定</h2><span><PhCheckCircle :size="15" weight="fill"/>{{boundCount}} 个字段均已绑定</span></div>
              <div class="mapping-table" role="table" aria-label="字段映射关系">
                <div class="mapping-table-head" role="row"><span></span><span role="columnheader">字段名称</span><span role="columnheader">数据来源</span></div>
                <div v-for="f in fields" :key="f.attrs.fieldId" class="mapping-row" :class="{active:selected===f.attrs.fieldId}" role="row" @click="selected=f.attrs.fieldId" @dragover.prevent @drop.prevent="rowDrop($event,f.attrs.fieldId)">
                  <button class="row-grip" draggable="true" :aria-label="`调整${f.attrs.label}顺序`" title="拖动调整顺序" @dragstart="rowDrag($event,f.attrs.fieldId)"><PhDotsSixVertical :size="18"/></button>
                  <input class="field-name-input" :aria-label="`${f.attrs.fieldId} 显示名称`" :value="f.attrs.label" maxlength="20" @input="rename(f.attrs.fieldId,$event.target.value)"/>
                  <div class="select-wrap mapping-select"><select :aria-label="`${f.attrs.label}数据来源`" v-model="template.bindings[f.attrs.fieldId]"><option v-for="o in pathOptions" :key="o.path" :value="o.path">{{o.path}}</option></select><PhCaretDown :size="12"/></div>
                </div>
              </div>
              <div class="mapping-hint"><PhInfo :size="15"/><span>字段位置可拖动调整，数据在加载报告时自动填入。</span></div>
            </div>
          </div>
          <div class="config-bottom"><span><PhCheckCircle :size="13"/>{{hospitalName}}独立配置</span><span>Yiitap 编辑器</span></div>
        </section>
        <aside v-else class="case-panel"><div class="case-heading"><span class="eyebrow">当前病例</span><h2>{{paperData?.patient?.name}}</h2><p>{{paperData?.patient?.gender}}<span>·</span>{{paperData?.patient?.age===0?'0岁':paperData?.patient?.age}}<span>·</span>{{paperData?.patient?.no}}</p></div><label for="case-selector">选择模拟病例</label><div class="select-wrap"><select id="case-selector" :disabled="saving" :value="caseId" @change="chooseCase"><option v-for="c in cases" :key="c.id" :value="c.id">{{c.label}}</option></select><PhCaretDown :size="14"/></div><dl><dt>检查项目</dt><dd>{{paperData?.exam?.item}}</dd><dt>检查日期</dt><dd>{{paperData?.exam?.date}}</dd><dt>使用模板</dt><dd>{{hospitalName}} · 版本 {{paperTemplate?.revision}}</dd></dl><div class="doctor-tip"><PhCheckCircle :size="20"/><strong>患者信息已自动填入</strong><p>表头和表尾由后台数据生成，你只需要编辑报告正文。</p></div><div class="snapshot-note"><PhInfo :size="15"/><p>{{report?'已加载保存的报告快照，模板更新不会改变此报告。':'保存时会固定当前模板与病例数据。'}}</p></div></aside>
        <section class="preview-panel" aria-label="实时预览">
          <div class="preview-toolbar"><h2>{{view==='templates'?'整页预览':'报告编辑'}}</h2><div class="preview-options"><template v-if="view==='templates'"><span>模拟数据</span><button class="toggle" role="switch" aria-label="显示模拟数据" :aria-checked="showData" :class="{on:showData}" @click="showData=!showData"><span></span></button><div class="select-wrap zoom-select"><select aria-label="预览缩放" v-model="zoom"><option value="100">100%</option><option value="85">85%</option></select><PhCaretDown :size="12"/></div></template><button class="icon-button expand-button" title="放大预览" aria-label="放大预览" @click="modal='preview'"><PhArrowsOutSimple :size="17"/></button></div></div>
          <div class="paper-container" :class="{reduced:zoom==='85'&&view==='templates'}"><ReportPaper :template="paperTemplate" :data="paperData" :show-data="showData" :doctor="view==='reports'" :body="body" :body-key="`${hospital}-${caseId}-${bodyKey}`" :selected="selected" @update-body="v=>body=v"/></div>
          <div class="preview-footnote"><span><PhDatabase :size="13"/>仅使用模拟数据</span><span>{{view==='templates'?'布局修改实时呈现':'正文支持自由编辑'}}</span></div>
        </section>
      </div>
    </section>
  </main>
  <Transition name="toast"><div v-if="toast" class="toast-message" role="status"><PhCheckCircle :size="20" weight="fill"/>{{toast}}</div></Transition>
  <dialog ref="dialog" :class="['app-dialog',modal==='preview'?'preview-dialog':'',modal==='json'?'json-dialog':'']" @cancel.prevent="closeModal" @click="e=>{if(e.target===dialog)closeModal()}">
    <template v-if="modal==='unsaved'"><div class="dialog-heading"><h2>保存这次更改？</h2><button class="icon-button" aria-label="关闭对话框" @click="closeModal"><PhX :size="20"/></button></div><p>当前{{view==='templates'?'模板配置':'报告正文'}}有未保存的更改。离开前，你可以保存或放弃更改。</p><div v-if="error" class="dialog-error">{{error}}</div><div class="dialog-actions"><button class="secondary-button" :disabled="saving" @click="closeModal">继续编辑</button><button class="secondary-button" :disabled="saving" @click="confirmSwitch(false)">放弃更改</button><button class="primary-button" :disabled="saving" @click="confirmSwitch(true)">{{saving?'保存中…':'保存并切换'}}</button></div></template>
    <template v-if="modal==='reset'"><div class="dialog-heading"><h2>恢复已保存的配置？</h2><button class="icon-button" aria-label="关闭对话框" @click="closeModal"><PhX :size="20"/></button></div><p>将放弃本次未保存的修改，恢复到该医院上次保存的模板。</p><div class="dialog-actions"><button class="secondary-button" @click="closeModal">取消</button><button class="primary-button" @click="reset">恢复配置</button></div></template>
    <template v-if="modal==='json'"><div class="dialog-heading"><div><h2>模板文档</h2><p>Tiptap JSON · 当前编辑内容</p></div><button class="icon-button" aria-label="关闭对话框" @click="closeModal"><PhX :size="20"/></button></div><pre>{{JSON.stringify(template,null,2)}}</pre></template>
    <template v-if="modal==='preview'"><div class="dialog-heading"><div><h2>{{hospitalName}} · 整页预览</h2><p>{{showData?'模拟数据展示':'字段占位符展示'}}</p></div><button class="icon-button" aria-label="关闭预览" @click="closeModal"><PhX :size="20"/></button></div><ReportPaper :template="paperTemplate" :data="paperData" :show-data="showData" :body="body" :readonly-body="view==='reports'"/></template>
  </dialog>
</div>
</template>
