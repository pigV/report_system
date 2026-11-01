<script setup>
import { computed } from 'vue';
import { DOMSerializer } from '@tiptap/pm/model';
import { nativeSchemaFor, resolveField } from './model.mjs';
const props=defineProps({doc:Object,template:Object,data:Object,showData:Boolean});
const html=computed(()=>{
  const schema=nativeSchemaFor(a=>props.showData?resolveField(a.fieldId,props.template,props.data,true):a.label);
  const container=document.createElement('div');
  container.appendChild(DOMSerializer.fromSchema(schema).serializeFragment(schema.nodeFromJSON(props.doc).content));
  return container.innerHTML;
});
</script>
<template><div class="native-document" v-html="html"></div></template>
