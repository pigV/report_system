import test from 'node:test';
import assert from 'node:assert/strict';
import { seedTemplate, clone, fieldsFor } from '../src/report-model.mjs';
import { mergeSavedTemplate, fieldColumn } from '../src/editor-state.mjs';

test('editing after a save request keeps newer changes dirty while advancing server revision',()=>{
  const submitted=seedTemplate('a');
  const saved={...clone(submitted),revision:2,updatedAt:'2026-11-01T00:00:00Z'};
  const current=clone(submitted);current.header.content[0].content[0].attrs.label='姓名';
  const merged=mergeSavedTemplate(current,submitted,saved);
  assert.equal(merged.header.content[0].content[0].attrs.label,'姓名');
  assert.equal(merged.revision,2);
  assert.notDeepEqual(merged,saved);
  assert.deepEqual(mergeSavedTemplate(submitted,submitted,saved),saved);
});

test('column selection accounts for preceding spans and row wrapping',()=>{
  const doc=seedTemplate('a').header;
  doc.content[0].content[0].attrs.span=2;
  assert.equal(fieldColumn(doc,'gender'),2);
  assert.equal(fieldColumn(doc,'age'),0);
  doc.content[0].content[1].attrs.span=2;
  assert.equal(fieldColumn(doc,'gender'),0);
  assert.equal(fieldColumn(doc,'age'),2);
});

test('dynamic layout guard accepts added, deleted and empty grids but rejects duplicates and pasted prose', async()=>{
  const {isValidLayout}=await import('../src/editor-state.mjs');
  const doc=seedTemplate('a').header;
  doc.content[0].content.pop();assert.equal(isValidLayout(doc),true);
  doc.content[0].content.push({...clone(doc.content[0].content[0]),attrs:{...doc.content[0].content[0].attrs,fieldId:'new_field'}});
  assert.equal(isValidLayout(doc),true);
  doc.content[0].content.push(clone(doc.content[0].content[0]));assert.equal(isValidLayout(doc),false);
  doc.content[0].content=[];assert.equal(isValidLayout(doc),true);
  delete doc.content[0].content;assert.equal(isValidLayout(doc),true);
  assert.equal(isValidLayout({type:'doc',content:[{type:'paragraph'}]}),false);
});

test('editor deletion and undo preserve bindings including independent changes made before undo',async()=>{
  const {applyRegionEdit}=await import('../src/editor-state.mjs');
  const {EditorState}=await import('@tiptap/pm/state');
  const {history,undo}=await import('@tiptap/pm/history');
  const {templateSchema}=await import('../src/editor/template-schema.mjs');
  const original=seedTemplate('a');
  let state=EditorState.create({schema:templateSchema,doc:templateSchema.nodeFromJSON(original.header),plugins:[history()]});
  state=state.apply(state.tr.delete(1,2));
  const deleted=applyRegionEdit(original,'header',state.doc.toJSON());
  assert.equal(deleted.bindings.patientName,'patient.name');
  deleted.bindings.patientName='patient.no';
  assert.ok(undo(state,tr=>{state=state.apply(tr)}));
  const restored=applyRegionEdit(deleted,'header',state.doc.toJSON());
  assert.equal(restored.bindings.patientName,'patient.no');
  assert.equal(restored.bindings.doctor,'report.doctor');
  const unbound=clone(restored);unbound.bindings.patientName='';
  const deletedAgain=applyRegionEdit(unbound,'header',deleted.header);
  assert.equal(applyRegionEdit(deletedAgain,'header',restored.header).bindings.patientName,'');
});
