<script setup>
// 【学习02】最适合先读的 Vue 小组件：左侧个人模板和右侧历史共用同一套输入 UI。
// 本组件只改草稿/发事件；是否可保存、保存到哪里，由父组件和 canSave 决定。
import {ref,watch} from 'vue';
import {PhPlus,PhLink,PhFloppyDisk} from '@phosphor-icons/vue';
const props=defineProps({modelValue:Object,label:String,canSave:Boolean,dirty:Boolean,disabled:Boolean});
const emit=defineEmits(['update:modelValue','save','cite']);
const adding=ref(false),extraFindings=ref(''),extraImpression=ref('');
// 切换条目时清空补充输入，避免把上一条未确认的追加内容带给下一条。
watch(()=>props.modelValue?.id,()=>{adding.value=false;extraFindings.value='';extraImpression.value=''});
// 自定义组件 v-model = modelValue 输入 + update:modelValue 事件输出。
// 展开运算符复制对象，不直接改 props；[key] 使一个函数可更新描述或诊断。
function update(key,value){emit('update:modelValue',{...props.modelValue,[key]:value})}
function append(){
  // “追加”只把补充文字拼入本条草稿，并不立刻引用进正文，也不自动保存。
  const join=(a,b)=>b.trim()?`${a}${a?'\n':''}${b.trim()}`:a;
  emit('update:modelValue',{...props.modelValue,findings:join(props.modelValue.findings,extraFindings.value),impression:join(props.modelValue.impression,extraImpression.value)});
  extraFindings.value='';extraImpression.value='';adding.value=false;
}
</script>
<template>
<!-- :value 与 @input 把输入框变化传回父组件；v-if="canSave" 决定是否提供保存按钮。 -->
<section class="clinical-detail" :aria-label="label">
  <div class="detail-heading"><h3>{{modelValue.name||modelValue.exam}}</h3><span v-if="dirty" class="detail-dirty">未保存</span></div>
  <label class="clinical-text-field"><span>描述</span><textarea :aria-label="`${label}描述`" :value="modelValue.findings" :disabled="disabled" @input="update('findings',$event.target.value)" spellcheck="false"/></label>
  <label class="clinical-text-field"><span>诊断</span><textarea :aria-label="`${label}诊断`" :value="modelValue.impression" :disabled="disabled" @input="update('impression',$event.target.value)" spellcheck="false"/></label>
  <div v-if="adding" class="append-fields"><strong>追加内容</strong><label>补充描述<textarea v-model="extraFindings" :aria-label="`${label}补充描述`" :disabled="disabled"/></label><label>补充诊断<textarea v-model="extraImpression" :aria-label="`${label}补充诊断`" :disabled="disabled"/></label><div class="detail-actions"><button :disabled="disabled" @click="adding=false">取消</button><button class="cite-action" :disabled="disabled||(!extraFindings.trim()&&!extraImpression.trim())" @click="append">确认追加</button></div></div>
  <div class="detail-actions"><button v-if="canSave" :disabled="disabled||!dirty" @click="emit('save')"><PhFloppyDisk :size="15"/>保存</button><button :disabled="disabled" :aria-expanded="adding" @click="adding=!adding"><PhPlus :size="15"/>追加</button><button class="cite-action" :disabled="disabled" @click="emit('cite',modelValue)"><PhLink :size="15"/>引用</button></div>
  <!-- <p class="detail-hint">{{canSave?'保存为个人模板 · 引用将替换报告描述和诊断':'临时编辑供本次引用，不修改历史记录'}}</p> -->
</section>
</template>
