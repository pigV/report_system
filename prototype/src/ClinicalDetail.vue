<script setup>
import {ref,watch} from 'vue';
import {PhPlus,PhLink,PhFloppyDisk} from '@phosphor-icons/vue';
const props=defineProps({modelValue:Object,label:String,canSave:Boolean,dirty:Boolean,disabled:Boolean});
const emit=defineEmits(['update:modelValue','save','cite']);
const adding=ref(false),extraFindings=ref(''),extraImpression=ref('');
watch(()=>props.modelValue?.id,()=>{adding.value=false;extraFindings.value='';extraImpression.value=''});
function update(key,value){emit('update:modelValue',{...props.modelValue,[key]:value})}
function append(){
  const join=(a,b)=>b.trim()?`${a}${a?'\n':''}${b.trim()}`:a;
  emit('update:modelValue',{...props.modelValue,findings:join(props.modelValue.findings,extraFindings.value),impression:join(props.modelValue.impression,extraImpression.value)});
  extraFindings.value='';extraImpression.value='';adding.value=false;
}
</script>
<template>
<section class="clinical-detail" :aria-label="label">
  <div class="detail-heading"><h3>{{modelValue.name||modelValue.exam}}</h3><span v-if="dirty" class="detail-dirty">未保存</span></div>
  <label class="clinical-text-field"><span>描述</span><textarea :aria-label="`${label}描述`" :value="modelValue.findings" :disabled="disabled" @input="update('findings',$event.target.value)" spellcheck="false"/></label>
  <label class="clinical-text-field"><span>诊断</span><textarea :aria-label="`${label}诊断`" :value="modelValue.impression" :disabled="disabled" @input="update('impression',$event.target.value)" spellcheck="false"/></label>
  <div v-if="adding" class="append-fields"><strong>追加内容</strong><label>补充描述<textarea v-model="extraFindings" :aria-label="`${label}补充描述`" :disabled="disabled"/></label><label>补充诊断<textarea v-model="extraImpression" :aria-label="`${label}补充诊断`" :disabled="disabled"/></label><div class="detail-actions"><button :disabled="disabled" @click="adding=false">取消</button><button class="cite-action" :disabled="disabled||(!extraFindings.trim()&&!extraImpression.trim())" @click="append">确认追加</button></div></div>
  <div class="detail-actions"><button v-if="canSave" :disabled="disabled||!dirty" @click="emit('save')"><PhFloppyDisk :size="15"/>保存</button><button :disabled="disabled" :aria-expanded="adding" @click="adding=!adding"><PhPlus :size="15"/>追加</button><button class="cite-action" :disabled="disabled" @click="emit('cite',modelValue)"><PhLink :size="15"/>引用</button></div>
  <!-- <p class="detail-hint">{{canSave?'保存为个人模板 · 引用将替换报告描述和诊断':'临时编辑供本次引用，不修改历史记录'}}</p> -->
</section>
</template>
