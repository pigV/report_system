import test from 'node:test';
import assert from 'node:assert/strict';
import {getSchema} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {EditorState, TextSelection} from '@tiptap/pm/state';
import {history, undo} from '@tiptap/pm/history';
import {historyFor, filterTemplates, templateBody} from '../src/clinical-assistance.mjs';
import {insertTemplateTransaction} from '../src/editor/insert-template.mjs';

const schema=getSchema([StarterKit]);
test('history is restricted to hospital, case and patient identity, with an empty case',()=>{
  const entries=historyFor('a','a-1','A000128');
  assert.equal(entries.length,3);
  assert.ok(entries[0].date>entries[1].date);
  assert.deepEqual(historyFor('a','a-1','B000082'),[]);
  assert.deepEqual(historyFor('b','a-1','A000128'),[]);
  assert.deepEqual(historyFor('a','a-2','A000129'),[]);
  assert.equal(historyFor('b','b-1','B000082').length,3);
});
test('template search combines category and trimmed case-insensitive keywords',()=>{
  assert.equal(filterTemplates('  ct  ','胸部').length,2);
  assert.equal(filterTemplates('CT','腹部').length,0);
  assert.equal(filterTemplates('不存在').length,0);
  assert.equal(filterTemplates('随访')[0].id,'chest-followup');
});
test('template content is schema-valid and does not mutate catalog entries',()=>{
  const entry=filterTemplates()[0], doc=templateBody(entry);
  schema.nodeFromJSON(doc).check();
  doc.content[1].content[0].text='修改';
  assert.notEqual(templateBody(entry).content[1].content[0].text,'修改');
});
test('insertion preserves selected text and undoes independently of prior typing',()=>{
  let state=EditorState.create({schema,doc:schema.nodeFromJSON({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'已有报告内容'}]}]}),plugins:[history()]});
  state=state.apply(state.tr.insertText('继续输入',7));
  const prior=state.doc.toJSON();
  state=state.apply(state.tr.setSelection(TextSelection.create(state.doc,2,5)));
  state=state.apply(insertTemplateTransaction(state,templateBody(filterTemplates()[0])));
  assert.ok(state.doc.textContent.includes('已有报告内容继续输入'));
  assert.ok(state.doc.textContent.includes('影像所见'));
  state.doc.check();
  assert.ok(undo(state,tr=>{state=state.apply(tr)}));
  assert.deepEqual(state.doc.toJSON(),prior);
});
test('insertion into an empty body and at a document boundary stays valid',()=>{
  for(const content of [[{type:'paragraph'}],[{type:'heading',attrs:{level:2},content:[{type:'text',text:'标题'}]}]]){
    let state=EditorState.create({schema,doc:schema.nodeFromJSON({type:'doc',content}),plugins:[history()]});
    state=state.apply(insertTemplateTransaction(state,templateBody(filterTemplates()[0])));
    state.doc.check();assert.ok(state.doc.textContent.includes('诊断意见'));
  }
});
