import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeMenuItems, bodyMenuItems, executeNativeInsert } from '../src/free-template/menu.mjs';
import { EditorState } from '@tiptap/pm/state';
import { bodyExtensions, bodySchema } from '../src/editor/body-schema.mjs';
import { nativeExtensions, nativeSchema, fromLegacy, validateNativeTemplate } from '../src/free-template/model.mjs';
import { seedTemplate } from '../src/report-model.mjs';
test('business labels and Chinese search remain visible without framework translation keys',()=>{
 const fields=[{id:'patientName',label:'患者姓名'}];
 const items=nativeMenuItems('',fields);
 assert.equal(items[0].label,'文本');assert.equal(items.at(-1).label,'业务字段');
 assert.deepEqual(nativeMenuItems('姓名',fields).map(x=>[x.label,x.fieldId]),[['患者姓名','patientName']]);
 assert.equal(nativeMenuItems('column',fields)[0].action,'columns');
 assert.deepEqual(nativeMenuItems('不存在',fields),[]);
});

test('selected column counts insert native editable columns in both editors',()=>{
 for(const [items,schema,extensions] of [
   [bodyMenuItems('分栏'),bodySchema,bodyExtensions()],
   [nativeMenuItems('分栏',[]),nativeSchema,nativeExtensions()],
 ])for(const count of [2,3,4,5]){
   let state=EditorState.create({schema});
   const command=extensions.find(e=>e.name==='multiColumn').config.addCommands().insertMultiColumn;
   const chain={
     focus(){return this},
     deleteRange(){return this},
     insertMultiColumn(value){this.count=value;return this},
     run(){
       const tr=state.tr;
       const result=command(this.count)({tr,dispatch:true,editor:{schema}});
       if(result)state=state.apply(tr);
       return result;
     },
   };
   assert.equal(executeNativeInsert({chain:()=>chain},{from:1,to:1},{...items[0],columns:count}),true);
   const doc=state.doc.toJSON(),columns=doc.content.find(n=>n.type==='columns');
   assert.equal(columns.content.length,count);
   assert.ok(columns.content.every(n=>n.type==='column'&&n.content[0].type==='paragraph'));
   schema.nodeFromJSON(JSON.parse(JSON.stringify(doc))).check();
   if(schema===nativeSchema){
     const template=fromLegacy(seedTemplate('a'));template.header=doc;
     assert.deepEqual(validateNativeTemplate('a',template),[]);
   }
 }
});
