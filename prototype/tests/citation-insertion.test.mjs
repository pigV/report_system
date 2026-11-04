import test from 'node:test';
import assert from 'node:assert/strict';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {history,undo} from '@tiptap/pm/history';
import {bodySchema} from '../src/editor/body-schema.mjs';
import * as sections from '../src/editor/report-sections.mjs';

const paragraph=text=>({type:'paragraph',content:[{type:'text',text}]});

test('citation inserts both fields at the cursor without replacing surrounding content and undoes in one step',()=>{
  const doc=bodySchema.nodeFromJSON({type:'doc',content:[paragraph('前后'),{type:'reportImage',attrs:{imageId:'knee'}},paragraph('保留') ]});
  let state=EditorState.create({doc,plugins:[history()]});
  state=state.apply(state.tr.setSelection(TextSelection.create(state.doc,2)));
  const before=state.doc.toJSON();
  state=state.apply(sections.insertCitationTransaction(state,{findings:'描述一\n描述二',impression:'诊断一'}));
  assert.equal(state.doc.firstChild.textBetween(0,state.doc.firstChild.content.size,'','\n'),'前描述一\n描述二\n诊断一后');
  assert.deepEqual(state.doc.child(1).toJSON(),doc.child(1).toJSON());
  assert.equal(state.doc.lastChild.textContent,'保留');
  assert.ok(undo(state,tr=>{state=state.apply(tr)}));
  assert.deepEqual(state.doc.toJSON(),before);
});

test('citation preserves selected text and inserts after the selection inside a column',()=>{
  const doc=bodySchema.nodeFromJSON({type:'doc',content:[{type:'columns',content:[{type:'column',content:[paragraph('甲乙丙丁')]},{type:'column',content:[paragraph('其他栏')]}]}]});
  let state=EditorState.create({doc});
  let start;doc.descendants((node,pos)=>{if(node.isText&&node.text==='甲乙丙丁')start=pos});
  state=state.apply(state.tr.setSelection(TextSelection.create(doc,start+1,start+3)));
  state=state.apply(sections.insertCitationTransaction(state,{findings:'所见',impression:'结论'}));
  assert.equal(state.doc.firstChild.firstChild.firstChild.textBetween(0,state.doc.firstChild.firstChild.firstChild.content.size,'','\n'),'甲乙丙所见\n结论丁');
  assert.equal(state.doc.firstChild.child(1).textContent,'其他栏');
  state.doc.check();
});
