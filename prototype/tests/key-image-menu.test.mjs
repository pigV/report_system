import test from 'node:test';
import assert from 'node:assert/strict';
import {EditorState} from '@tiptap/pm/state';
import {history,undo} from '@tiptap/pm/history';
import {bodySchema} from '../src/editor/body-schema.mjs';
import {keyImageColumns,insertKeyImagesTransaction,isKeyImageInsertionInColumn} from '../src/editor/key-image-insert.mjs';
import {bodyMenuItems,nativeMenuItems} from '../src/free-template/menu.mjs';
import {openStore} from '../server/store.mjs';
import {keyImages} from '../src/key-images.mjs';
import {removeColumnImage} from '../src/editor/report-images.mjs';

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
test('new key-image layouts create an empty editable line below each image',()=>{
  for(const count of [1,2,4,6]){
    const ids=keyImages.slice(0,count).map(image=>image.id);
    const doc=bodySchema.nodeFromJSON({type:'doc',content:[p('/')]}),state=EditorState.create({doc});
    const result=state.apply(insertKeyImagesTransaction(state,{from:1,to:2},ids)).doc;
    const columns=[];
    result.forEach(row=>row.forEach(column=>columns.push(column)));
    assert.deepEqual(columns.map(column=>column.firstChild.attrs.imageId),ids);
    for(const column of columns){
      assert.equal(column.childCount,2);
      assert.equal(column.child(1).type.name,'paragraph');
      assert.equal(column.child(1).textContent,'');
    }
  }
});
test('removing a key image keeps the empty text line in its column',()=>{
  const doc=bodySchema.nodeFromJSON({type:'doc',content:[keyImageColumns(['knee','lumbar'])]});
  const state=EditorState.create({doc});
  const updated=state.apply(removeColumnImage(state,2));
  assert.deepEqual(updated.doc.firstChild.firstChild.content.content.map(node=>node.type.name),['paragraph']);
  assert.equal(updated.doc.firstChild.child(1).firstChild.attrs.imageId,'lumbar');
  updated.doc.check();
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
test('four and six selected images form two ordered rows outside columns and undo together',()=>{
  for(const [count,columns] of [[4,2],[6,3]]){
    const ids=keyImages.slice(0,count).map(image=>image.id);
    const doc=bodySchema.nodeFromJSON({type:'doc',content:[p('前文'),p('/'),p('后文')]});
    let state=EditorState.create({doc,plugins:[history()]});
    const from=doc.firstChild.nodeSize+1;
    state=state.apply(insertKeyImagesTransaction(state,{from,to:from+1},ids));
    const rows=[state.doc.child(1),state.doc.child(2)];
    assert.deepEqual(rows.map(row=>row.type.name),['columns','columns']);
    assert.deepEqual(rows.map(row=>row.childCount),[columns,columns]);
    assert.deepEqual(rows.flatMap(row=>row.content.content.map(column=>column.firstChild.attrs.imageId)),ids);
    assert.equal(state.doc.firstChild.textContent,'前文');
    assert.equal(state.doc.lastChild.textContent,'后文');
    state.doc.check();
    const store=openStore(':memory:');
    try{
      store.saveReport('a','a-1',state.doc.toJSON());
      assert.deepEqual(store.getReport('a','a-1').body,JSON.parse(JSON.stringify(state.doc.toJSON())));
    }finally{store.close()}
    assert.ok(undo(state,tr=>{state=state.apply(tr)}));
    assert.deepEqual(state.doc.toJSON(),doc.toJSON());
  }
});
test('other image counts retain their single-row layout',()=>{
  for(const count of [5,7,8]){
    const ids=keyImages.slice(0,count).map(image=>image.id);
    const doc=bodySchema.nodeFromJSON({type:'doc',content:[p('/')]});
    const state=EditorState.create({doc});
    const updated=state.apply(insertKeyImagesTransaction(state,{from:1,to:2},ids));
    assert.equal(updated.doc.childCount,1);
    assert.equal(updated.doc.firstChild.childCount,count);
    assert.deepEqual(updated.doc.firstChild.content.content.map(column=>column.firstChild.attrs.imageId),ids);
  }
});
test('four and six selected images inside an existing column never create nested rows',()=>{
  for(const count of [4,6]){
    const ids=keyImages.slice(0,count).map(image=>image.id);
    const doc=bodySchema.nodeFromJSON({type:'doc',content:[{type:'columns',content:[
      {type:'column',content:[p('/')]},{type:'column',content:[p('相邻栏')]},
    ]}]});
    const state=EditorState.create({doc});
    const updated=state.apply(insertKeyImagesTransaction(state,{from:3,to:4},ids));
    assert.deepEqual(updated.doc.firstChild.firstChild.content.content.map(node=>node.attrs.imageId),ids);
    assert.equal(updated.doc.firstChild.child(1).textContent,'相邻栏');
    updated.doc.check();
  }
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
  let columnRows=0;state.doc.descendants(node=>{if(node.type.name==='columns')columnRows++});
  assert.equal(columnRows,1,'reuse the existing column instead of nesting another column row');
  assert.equal(state.doc.firstChild.child(1).textContent,'相邻栏');
  assert.equal(insertKeyImagesTransaction(state,{from:3,to:3},[]),null);
});
test('one or multiple images insert directly into the current empty column and undo together',()=>{
  for(const ids of [['knee'],['knee','lumbar'],['knee','lumbar','cervical']]){
    const doc=bodySchema.nodeFromJSON({type:'doc',content:[{type:'columns',content:[
      {type:'column',content:[p('/')]},{type:'column',content:[p('相邻栏保持原样')]},
    ]}]});
    let state=EditorState.create({schema:bodySchema,doc,plugins:[history()]});
    state=state.apply(insertKeyImagesTransaction(state,{from:3,to:4},ids));
    state.doc.check();
    const row=state.doc.firstChild;
    assert.equal(row.childCount,2);
    assert.deepEqual(row.child(0).content.content.map(node=>node.type.name),ids.map(()=>'reportImage'));
    assert.deepEqual(row.child(0).content.content.map(node=>node.attrs.imageId),ids);
    assert.deepEqual(row.child(1).toJSON(),doc.firstChild.child(1).toJSON());
    assert.ok(undo(state,tr=>{state=state.apply(tr)}));
    assert.deepEqual(state.doc.toJSON(),doc.toJSON());
  }
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
test('column detection follows the menu anchor through ancestor blocks, not the current selection',()=>{
  const doc=bodySchema.nodeFromJSON({type:'doc',content:[p('分栏外'),{type:'columns',content:[
    {type:'column',content:[{type:'bulletList',content:[{type:'listItem',content:[p('/列表内容')]}]}]},
    {type:'column',content:[p('相邻栏')]},
  ]}]});
  const state=EditorState.create({schema:bodySchema,doc});
  let from;doc.descendants((node,pos)=>{if(node.isText&&node.text.startsWith('/'))from=pos});
  assert.equal(isKeyImageInsertionInColumn(state,{from:1,to:1}),false);
  assert.equal(isKeyImageInsertionInColumn(state,{from,to:from+1}),true);
  const updated=state.apply(insertKeyImagesTransaction(state,{from,to:from+1},['knee','lumbar']));
  updated.doc.check();
  let rows=0;updated.doc.descendants(node=>{if(node.type.name==='columns')rows++});
  assert.equal(rows,1);
  assert.ok(updated.doc.textContent.includes('列表内容'));
});
