<script setup>
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { PhArrowsOutSimple, PhX, PhPlus, PhArrowCounterClockwise, PhCircleNotch, PhWarningCircle } from '@phosphor-icons/vue';
import NativeEditor from './NativeEditor.vue';
import NativeDocument from './NativeDocument.vue';
import { pathOptions, hospitals, clone } from '../report-model.mjs';
import { validateNativeTemplate, mergeNativeSave } from './model.mjs';
const props=defineProps({hospital:String,data:Object});
const emit=defineEmits(['dirty','busy','notify','error']);
const model=ref(null),baseline=ref(''),loading=ref(true),saving=ref(false),error=ref(''),region=ref('header'),showData=ref(true),scale=ref('fit'),modal=ref(''),dialog=ref(null),editor=ref(null),generation=ref(0),newName=ref(''),newPath=ref('');
let disposed=false;
const name=computed(()=>hospitals.find(h=>h.id===props.hospital)?.name);
const dirty=computed(()=>!!model.value&&JSON.stringify(model.value)!==baseline.value);
watch(error,value=>emit('error',value),{immediate:true});
watch(dirty,value=>emit('dirty',value),{immediate:true});
watch([loading,saving],()=>emit('busy',loading.value||saving.value),{immediate:true});
watch(modal,async value=>{await nextTick();if(value)dialog.value?.showModal();else dialog.value?.close()});
async function request(method='GET',payload){const res=await fetch(`/api/hospitals/${props.hospital}/native-template`,{method,headers:{'Content-Type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{})});const result=await res.json();if(!res.ok)throw Error(result.error||'读取失败');return result}
async function load(){loading.value=true;error.value='';try{const t=await request();if(disposed)return;model.value=t;baseline.value=JSON.stringify(t);generation.value++}catch(e){error.value=e.message}finally{loading.value=false}}
async function save(){if(!model.value||loading.value||saving.value)return false;saving.value=true;error.value='';try{const errors=validateNativeTemplate(props.hospital,model.value);if(errors.length)throw Error(errors.join('；'));const submitted=clone(model.value),saved=await request('PUT',submitted);if(disposed)return false;model.value=mergeNativeSave(model.value,submitted,saved);baseline.value=JSON.stringify(saved);emit('notify',dirty.value?'已保存提交版本，后续修改仍未保存':'自由模板已保存，原有模板保持不变');return true}catch(e){error.value=e.message;return false}finally{saving.value=false}}
function reset(){model.value=JSON.parse(baseline.value);generation.value++;modal.value='';error.value=''}
function reload(){if(dirty.value){modal.value='reload';return}load()}
function addField(){const label=newName.value.trim();if(!label)return;const id=`custom_${crypto.randomUUID()}`;model.value.fields.push({id,label,region:region.value});model.value.bindings[id]=newPath.value;newName.value='';newPath.value=''}
function insert(f){modal.value='';nextTick(()=>editor.value?.insertField(f))}
function setDoc(doc){model.value[region.value]=doc}
defineExpose({save});
onMounted(load);
onBeforeUnmount(()=>{disposed=true;emit('dirty',false);emit('busy',false)});
</script>
<template>
<div class="native-workspace">
  <div class="native-scope-note"><span class="native-version-tag">独立模板</span><span>首次从原有模板复制，保存仅用于此菜单。</span><span class="native-scope-right">{{name}}独立保存</span></div>
  <div v-if="error" class="error-banner" role="alert"><PhWarningCircle :size="20"/><span>{{error}}</span><button @click="reload">重新加载</button></div>
  <div v-if="loading" class="loading-state"><PhCircleNotch class="spin" :size="28"/>正在载入自由模板…</div>
  <div v-else-if="model" class="native-grid">
    <section class="native-config" aria-label="自由模板编辑">
      <div class="native-tabs" role="tablist" aria-label="自由模板区域">
        <button role="tab" :aria-selected="region==='header'" :disabled="saving" @click="region='header'">表头</button><button role="tab" :aria-selected="region==='footer'" :disabled="saving" @click="region='footer'">表尾</button>
        <span class="toolbar-spacer"></span><button class="native-binding-link" :disabled="saving" @click="modal='bindings'">字段与绑定</button><button title="恢复上次保存" aria-label="恢复自由模板" :disabled="saving||!dirty" @click="modal='reset'"><PhArrowCounterClockwise :size="18"/></button>
      </div>
      <NativeEditor :key="hospital+region+generation" ref="editor" :content="model[region]" :fields="model.fields" :disabled="saving" :region="region" @update="setDoc"/>
    </section>
    <section class="native-preview" aria-label="自由模板整页预览">
      <div class="native-preview-toolbar"><h2>整页预览</h2><div><span>模拟数据</span><button class="toggle" role="switch" aria-label="自由模板模拟数据" :aria-checked="showData" :class="{on:showData}" @click="showData=!showData"><span></span></button><select v-model="scale" aria-label="自由模板预览缩放"><option value="fit">适应宽度</option><option value="small">缩小预览</option></select><button class="icon-button" aria-label="放大自由模板预览" @click="modal='preview'"><PhArrowsOutSimple :size="18"/></button></div></div>
      <div class="native-paper-frame" :class="{small:scale==='small'}"><article class="native-paper">
        <NativeDocument :doc="model.header" :template="model" :data="data" :show-data="showData"/>
        <section class="native-preview-body"><h3>检查所见</h3><p>医生在此编写检查所见。</p><h3>诊断意见</h3><p>医生在此编写诊断意见。</p></section>
        <NativeDocument class="native-paper-footer" :doc="model.footer" :template="model" :data="data" :show-data="showData"/>
      </article></div><div class="native-preview-foot">仅使用模拟数据 · 报告版式预览</div>
    </section>
  </div>
  <dialog ref="dialog" class="app-dialog native-dialog" :class="{'native-preview-dialog':modal==='preview','native-bindings-dialog':modal==='bindings'}" @cancel.prevent="modal=''" @click="e=>{if(e.target===dialog)modal=''}">
    <template v-if="modal==='bindings'&&model"><div class="dialog-heading"><div><h2>字段与绑定</h2><p>已有字段直接插入；这里只需处理特殊字段或调整数据来源。</p></div><button class="icon-button" aria-label="关闭字段与绑定" @click="modal=''"><PhX :size="20"/></button></div>
      <div class="native-binding-table"><div class="native-binding-head"><span>字段名称</span><span>数据来源</span><span></span></div><div v-for="f in model.fields" :key="f.id" class="native-binding-row"><input :aria-label="`${f.id} 自由字段名称`" v-model="f.label" maxlength="40"/><select :aria-label="`${f.label}自由数据来源`" v-model="model.bindings[f.id]"><option value="">未绑定</option><option v-for="p in pathOptions" :key="p.path" :value="p.path">{{p.label}} · {{p.path}}</option></select><button class="secondary-button" :aria-label="`插入字段${f.label}`" @click="insert(f)"><PhPlus :size="14"/>插入</button></div></div>
      <p class="native-binding-help">修改这里的名称不会重命名文档中的文字；删除文档中的占位符也不会删除绑定。选择“未绑定”可解除关联。</p>
      <form class="native-new-field" @submit.prevent="addField"><h3>添加自定义字段</h3><div><input v-model="newName" aria-label="自定义字段名称" placeholder="字段名称" maxlength="40" required/><select v-model="newPath" aria-label="自定义字段数据来源"><option value="">暂不绑定</option><option v-for="p in pathOptions" :key="p.path" :value="p.path">{{p.label}}</option></select><button class="secondary-button" :disabled="!newName.trim()"><PhPlus :size="15"/>添加字段</button></div></form><div class="dialog-actions"><button class="primary-button" @click="modal=''">完成</button></div>
    </template>
    <template v-if="modal==='reset'||modal==='reload'"><div class="dialog-heading"><h2>放弃未保存的更改？</h2><button class="icon-button" aria-label="取消恢复" @click="modal=''"><PhX :size="20"/></button></div><p>{{modal==='reload'?'将从服务器重新加载自由模板。':'将恢复此菜单上次载入或保存的自由模板。'}}</p><div class="dialog-actions"><button class="secondary-button" @click="modal=''">继续编辑</button><button class="primary-button" @click="modal==='reload'?(modal='',load()):reset()">确认恢复</button></div></template>
    <template v-if="modal==='preview'&&model"><div class="dialog-heading"><div><h2>{{name}} · 自由模板预览</h2><p>模拟数据 · 不包含正式打印分页</p></div><button class="icon-button" aria-label="关闭自由模板预览" @click="modal=''"><PhX :size="20"/></button></div><article class="native-paper"><NativeDocument :doc="model.header" :template="model" :data="data" :show-data="showData"/><section class="native-preview-body"><h3>检查所见</h3><p>医生在此编写检查所见。</p><h3>诊断意见</h3><p>医生在此编写诊断意见。</p></section><NativeDocument class="native-paper-footer" :doc="model.footer" :template="model" :data="data" :show-data="showData"/></article></template>
  </dialog>
</div>
</template>
