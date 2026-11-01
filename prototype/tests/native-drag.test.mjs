import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@tiptap/pm/state';
import { history, undo } from '@tiptap/pm/history';
import { nativeSchema } from '../src/free-template/model.mjs';
import { reorderBlock } from '../src/free-template/block-drag.mjs';

test('block reorder preserves field identity, nested content, and single-step undo', () => {
  const doc = nativeSchema.nodeFromJSON({type:'doc',content:[{type:'heading',attrs:{level:2},content:[{type:'text',text:'标题'}]},{type:'paragraph',content:[{type:'businessField',attrs:{fieldId:'patientName',label:'患者姓名'}}]},{type:'paragraph',content:[{type:'text',text:'末段'}]}]});
  let state = EditorState.create({doc,plugins:[history()]});
  state = state.apply(reorderBlock(state,0,doc.content.size));
  assert.equal(state.doc.lastChild.type.name,'heading');
  assert.equal(state.doc.firstChild.firstChild.attrs.fieldId,'patientName');
  assert.equal(undo(state,tr=>{state=state.apply(tr)}),true);
  assert.deepEqual(state.doc.toJSON(),doc.toJSON());
  const last=doc.content.size-doc.lastChild.nodeSize;
  assert.equal(state.apply(reorderBlock(state,last,0)).doc.firstChild.textContent,'末段');
  assert.equal(reorderBlock(state,0,doc.firstChild.nodeSize),null);
  assert.equal(reorderBlock(state,1,0),null);
});

test('undoing a drag retains text typed immediately before it', () => {
  const doc=nativeSchema.nodeFromJSON({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'第一段'}]},{type:'paragraph',content:[{type:'text',text:'第二段'}]}]});
  let state=EditorState.create({doc,plugins:[history()]});
  state=state.apply(state.tr.insertText('新增',4));
  const typed=state.doc.toJSON();
  state=state.apply(reorderBlock(state,0,state.doc.content.size));
  undo(state,tr=>{state=state.apply(tr)});
  assert.deepEqual(state.doc.toJSON(),typed);
  undo(state,tr=>{state=state.apply(tr)});
  assert.deepEqual(state.doc.toJSON(),doc.toJSON());
});
