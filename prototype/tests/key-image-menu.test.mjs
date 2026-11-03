import test from 'node:test';
import assert from 'node:assert/strict';
import {EditorState} from '@tiptap/pm/state';
import {history,undo} from '@tiptap/pm/history';
import {bodySchema} from '../src/editor/body-schema.mjs';
import {keyImageColumns,insertKeyImagesTransaction} from '../src/editor/key-image-insert.mjs';
import {bodyMenuItems,nativeMenuItems} from '../src/free-template/menu.mjs';
import {openStore} from '../server/store.mjs';

const p=text=>({type:'paragraph',...(text?{content:[{type:'text',text}]}:{})});
test('key image action is searchable and available only in report body menu',()=>{
  assert.equal(bodyMenuItems('关键影像')[0].action,'keyImages');
  assert.equal(bodyMenuItems('key image')[0].action,'keyImages');
  assert.ok(!nativeMenuItems('',[]).some(item=>item.action==='keyImages'));
});
test('selected images produce exact column count in selection order without duplicates or placeholders',()=>{
  for(const ids of [['knee'],['lumbar','cervical'],['knee','cervical','lumbar']]){
    const node=keyImageColumns(ids);
    assert.deepEqual(node.content.map(col=>col.content[0].attrs.imageId),ids);
    bodySchema.nodeFromJSON(node).check();
    assert.deepEqual(JSON.parse(JSON.stringify(node)),node);
  }
  assert.equal(keyImageColumns([]),null);
  assert.equal(keyImageColumns(['unknown']),null);
  assert.equal(keyImageColumns(['knee','unknown','knee']).content.length,1);
});
test('insertion uses the original slash range, keeps surrounding text and undoes as one group',()=>{
  const doc=bodySchema.nodeFromJSON({type:'doc',content:[p('前文'),p('/'),p('后文')]});
  let state=EditorState.create({schema:bodySchema,doc,plugins:[history()]});
  const original=state.doc.toJSON();
  const from=doc.firstChild.nodeSize+1;
  state=state.apply(insertKeyImagesTransaction(state,{from,to:from+1},['knee','cervical','lumbar']));
  assert.equal(state.doc.child(0).textContent,'前文');
  assert.equal(state.doc.child(1).type.name,'columns');
  assert.equal(state.doc.child(1).childCount,3);
  assert.equal(state.doc.lastChild.textContent,'后文');
  state.doc.check();
  assert.ok(undo(state,tr=>{state=state.apply(tr)}));
  assert.deepEqual(state.doc.toJSON(),original);
});
test('inserting at the start of a nonempty column paragraph preserves its content and neighbour',()=>{
  const doc=bodySchema.nodeFromJSON({type:'doc',content:[{type:'columns',content:[
    {type:'column',content:[p('/保留原文')]},{type:'column',content:[p('相邻栏')]},
  ]}]});
  let state=EditorState.create({schema:bodySchema,doc});
  state=state.apply(insertKeyImagesTransaction(state,{from:3,to:4},['lumbar','knee']));
  state.doc.check();
  assert.ok(state.doc.textContent.includes('保留原文'));
  assert.ok(state.doc.textContent.includes('相邻栏'));
  const images=[];state.doc.descendants(node=>{if(node.type.name==='reportImage')images.push(node.attrs.imageId)});
  assert.deepEqual(images,['lumbar','knee']);
  assert.equal(insertKeyImagesTransaction(state,{from:3,to:3},[]),null);
});
test('selected-image columns pass report validation and retain IDs and order in storage',()=>{
  const store=openStore(':memory:');
  try{
    const body={type:'doc',content:[p('描述'),keyImageColumns(['knee','cervical','lumbar'])]};
    store.saveReport('a','a-1',body);
    const saved=store.getReport('a','a-1').body;
    assert.deepEqual(saved,body);
    bodySchema.nodeFromJSON(saved).check();
  }finally{store.close()}
});
