import test from 'node:test';
import assert from 'node:assert/strict';
import { seedTemplate, clone, fieldsFor } from '../src/report-model.mjs';
import { mergeSavedTemplate, isCompleteLayout, fieldColumn } from '../src/editor-state.mjs';

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

test('predefined field layout rejects deletion and arbitrary pasted document, permits movement',()=>{
  const doc=seedTemplate('a').header, ids=fieldsFor(doc).map(f=>f.attrs.fieldId);
  assert.equal(isCompleteLayout(doc,ids),true);
  const deleted=clone(doc);deleted.content[0].content.pop();assert.equal(isCompleteLayout(deleted,ids),false);
  assert.equal(isCompleteLayout({type:'doc',content:[{type:'paragraph'}]},ids),false);
  const reordered=clone(doc);reordered.content[0].content.reverse();assert.equal(isCompleteLayout(reordered,ids),true);
});
