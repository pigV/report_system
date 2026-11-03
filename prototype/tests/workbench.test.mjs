import test from 'node:test';
import assert from 'node:assert/strict';
import {EditorState} from '@tiptap/pm/state';
import {history, undo} from '@tiptap/pm/history';
import {bodySchema} from '../src/editor/body-schema.mjs';
import {replaceSectionsTransaction} from '../src/editor/report-sections.mjs';
import {imageLayout} from '../src/editor/report-images.mjs';
import {loadPersonalTemplates, savePersonalTemplate, historyFor} from '../src/clinical-assistance.mjs';
import {openStore} from '../server/store.mjs';
import {readImageDrop} from '../src/key-images.mjs';

const p=text=>({type:'paragraph',content:[{type:'text',text}]});
const h=text=>({type:'heading',attrs:{level:2},content:[{type:'text',text}]});
const entry={findings:'新描述\n补充描述',impression:'新诊断'};
test('citation replaces legacy sections, preserves unrelated blocks and undoes atomically',()=>{
  const content=[p('开头备注'),h('影像所见'),p('旧描述'),...imageLayout(1,3),h('诊断意见'),p('旧诊断'),h('随访建议'),p('保留建议')];
  let state=EditorState.create({schema:bodySchema,doc:bodySchema.nodeFromJSON({type:'doc',content}),plugins:[history()]});
  const before=state.doc.toJSON();
  state=state.apply(replaceSectionsTransaction(state,entry));
  assert.ok(!state.doc.textContent.includes('旧描述'));
  assert.ok(!state.doc.textContent.includes('旧诊断'));
  assert.ok(state.doc.textContent.includes('保留建议'));
  assert.ok(state.doc.textContent.includes('开头备注'));
  const columns=[];state.doc.descendants(n=>{if(n.type.name==='columns')columns.push(n.toJSON())});
  assert.deepEqual(columns,[bodySchema.nodeFromJSON(imageLayout(1,3)[0]).toJSON()]);
  state.doc.check();
  assert.ok(undo(state,tr=>{state=state.apply(tr)}));
  assert.deepEqual(state.doc.toJSON(),before);
});
test('repeat citation replaces marked text even after its heading is renamed',()=>{
  let state=EditorState.create({schema:bodySchema,plugins:[history()]});
  state=state.apply(replaceSectionsTransaction(state,entry));
  state=state.apply(state.tr.insertText('检查描述',1,3));
  state=state.apply(replaceSectionsTransaction(state,{findings:'第二次所见',impression:''}));
  assert.ok(!state.doc.textContent.includes('新描述'));
  assert.ok(!state.doc.textContent.includes('新诊断'));
  assert.equal(state.doc.textContent.split('第二次所见').length,2);
  state.doc.check();
});
test('new unrelated paragraphs after identified sections are retained',()=>{
  let state=EditorState.create({schema:bodySchema});
  state=state.apply(replaceSectionsTransaction(state,entry));
  state=state.apply(state.tr.insert(state.doc.content.size,bodySchema.nodeFromJSON(p('独立备注需保留'))));
  state=state.apply(replaceSectionsTransaction(state,{findings:'复查描述',impression:'复查诊断'}));
  assert.ok(state.doc.textContent.includes('独立备注需保留'));
  assert.ok(!state.doc.textContent.includes('新描述'));
});
test('drag payload rejects another patient/hospital and malformed images',()=>{
  const scope={hospital:'a',caseId:'a-1'};
  assert.equal(readImageDrop(JSON.stringify({...scope,id:'knee'}),scope).id,'knee');
  for(const raw of ['not-json',JSON.stringify({...scope,id:'unknown'}),JSON.stringify({hospital:'b',caseId:'a-1',id:'knee'}),JSON.stringify({hospital:'a',caseId:'a-2',id:'knee'})])assert.equal(readImageDrop(raw,scope),null);
});
test('personal template saves are scoped and do not overwrite historical data',()=>{
  const values=new Map();const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  const original=loadPersonalTemplates(storage,'a','doctor-demo');
  assert.equal(original[0].name,'颈椎病');
  savePersonalTemplate(storage,'a','doctor-demo',{...original[0],findings:'已保存的补充描述'});
  assert.equal(loadPersonalTemplates(storage,'a','doctor-demo')[0].findings,'已保存的补充描述');
  assert.notEqual(loadPersonalTemplates(storage,'b','doctor-demo')[0].findings,'已保存的补充描述');
  assert.notEqual(loadPersonalTemplates(storage,'a','other-doctor')[0].findings,'已保存的补充描述');
  const records=historyFor('a','a-1','A000128');records[0].findings='临时编辑';
  assert.notEqual(historyFor('a','a-1','A000128')[0].findings,'临时编辑');
  assert.throws(()=>savePersonalTemplate({getItem:()=>null,setItem:()=>{throw Error('Quota exceeded')}},'a','doctor-demo',original[0]),/Quota/);
});
test('native picture columns and slots survive report persistence and replacement',()=>{
  const layout=imageLayout(2,3);
  assert.equal(layout.length,2);
  layout[0].content[1].content[0].attrs={imageId:'cervical',caption:'颈椎 · 模拟影像'};
  const store=openStore(':memory:');
  try{
    let state=EditorState.create({schema:bodySchema,doc:bodySchema.nodeFromJSON({type:'doc',content:layout})});
    state=state.apply(replaceSectionsTransaction(state,entry));
    store.saveReport('a','a-1',state.doc.toJSON());
    assert.deepEqual(store.getReport('a','a-1').body,JSON.parse(JSON.stringify(state.doc.toJSON())));
  }finally{store.close()}
  assert.throws(()=>imageLayout(0,3));assert.throws(()=>imageLayout(1,9));
});

test('citation traverses native lists, preserves nested media and keeps emptied columns valid',()=>{
  const marked={...p('列表里的旧描述'),attrs:{reportSection:'findings'}};
  const photo={type:'reportImage',attrs:{imageId:'knee',caption:'保留图片'}};
  const content=[h('影像所见'),{type:'blockquote',content:[p('旧引用文字'),photo]},h('其他内容'),
    {type:'bulletList',content:[{type:'listItem',content:[marked]}]},
    {type:'columns',content:[{type:'column',content:[marked]},{type:'column',content:[p('其他栏内容')]}]}];
  let state=EditorState.create({schema:bodySchema,doc:bodySchema.nodeFromJSON({type:'doc',content})});
  state=state.apply(replaceSectionsTransaction(state,entry));
  state.doc.check();
  assert.ok(!state.doc.textContent.includes('列表里的旧描述'));
  assert.ok(!state.doc.textContent.includes('旧引用文字'));
  assert.ok(state.doc.textContent.includes('其他栏内容'));
  let images=0,columns=0;state.doc.descendants(node=>{if(node.type.name==='reportImage')images++;if(node.type.name==='column')columns++});
  assert.equal(images,1);assert.equal(columns,2);
});
