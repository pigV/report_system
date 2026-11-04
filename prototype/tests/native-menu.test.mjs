import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeMenuItems, bodyMenuItems, executeNativeInsert } from '../src/free-template/menu.mjs';
import { EditorState } from '@tiptap/pm/state';
import { bodyExtensions, bodySchema } from '../src/editor/body-schema.mjs';
import { nativeExtensions, nativeSchema, fromLegacy, validateNativeTemplate } from '../src/free-template/model.mjs';
import { seedTemplate } from '../src/report-model.mjs';
import { imageColumnDropPlugin } from '../src/editor/report-images.mjs';
import { columnInsertTarget, insertColumnSlash } from '../src/editor/column-insert.mjs';
import { IMAGE_DRAG_TYPE } from '../src/key-images.mjs';
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
      command(callback){this.afterInsert=callback;return this},
     run(){
       const tr=state.tr;
        const result=command(this.count)({tr,dispatch:true,editor:{schema}});
        if(result)this.afterInsert({tr});
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

test('four and six image presets create empty columns that accept image drops and the add control',()=>{
 for(const [label,columns] of [['四张图片',2],['六张图片',3]]){
  const item=bodyMenuItems(label)[0];
  let inserted;
  const chain={focus(){return this},deleteRange(){return this},insertContent(content){inserted=content;return this},run(){return true}};
  assert.equal(executeNativeInsert({chain:()=>chain},{from:1,to:2},item),true);
  assert.equal(inserted.length,3);
  for(const row of inserted.slice(0,2)){
   assert.equal(row.type,'columns');
   assert.equal(row.content.length,columns);
   assert.ok(row.content.every(column=>column.content.length===1&&column.content[0].type==='paragraph'));
  }
  const doc=bodySchema.nodeFromJSON({type:'doc',content:inserted});
  let state=EditorState.create({doc});
  const columnDom={getBoundingClientRect:()=>({left:300,top:100,bottom:200})};
  const target={closest:selector=>selector==='[data-type="column"]'?columnDom:null};
  const block={contains:x=>x===target,getBoundingClientRect:()=>({top:100,bottom:120})};
  const view={editable:true,get state(){return state},dom:{contains:x=>x===columnDom},posAtDOM:()=>2,nodeDOM:()=>block,dispatch:tr=>{state=state.apply(tr)}};
  const add=columnInsertTarget(view,target,110);
  assert.equal(insertColumnSlash(state,add).doc.firstChild.firstChild.firstChild.textContent,'/');
  const scope={hospital:'a',caseId:'a-1'};
  const event={target,preventDefault(){},dataTransfer:{types:[IMAGE_DRAG_TYPE],getData:()=>JSON.stringify({...scope,id:'knee'})}};
  assert.equal(imageColumnDropPlugin(()=>scope).props.handleDOMEvents.drop(view,event),true);
  assert.equal(state.doc.firstChild.firstChild.firstChild.attrs.imageId,'knee');
  state.doc.check();
 }
});

test('two and three image presets keep their existing image slots',()=>{
 for(const label of ['二张图片','三张图片']){
  let inserted;
  const chain={focus(){return this},deleteRange(){return this},insertContent(content){inserted=content;return this},run(){return true}};
  assert.equal(executeNativeInsert({chain:()=>chain},{from:1,to:2},bodyMenuItems(label)[0]),true);
  assert.ok(inserted[0].content.every(column=>column.content[0].type==='reportImage'));
 }
});
