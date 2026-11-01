import test from 'node:test';
import assert from 'node:assert/strict';
import { seedTemplate, fieldsFor, readPath, validateTemplate, moveField } from '../src/report-model.mjs';

test('hospital-specific fields and reordered identity survive JSON serialization', () => {
  const a = seedTemplate('a'), b = seedTemplate('b');
  assert.equal(fieldsFor(a.header).length, 6);
  assert.equal(fieldsFor(b.header).length, 5);
  const changed = moveField(a.header, 'patientName', 'examDate');
  assert.equal(fieldsFor(changed).at(-1).attrs.fieldId, 'patientName');
  assert.equal(a.bindings.patientName, 'patient.name');
  assert.deepEqual(validateTemplate('a', JSON.parse(JSON.stringify({...a, header:changed}))), []);
});

test('bindings preserve zero, represent null as a dash and reject unsafe paths', () => {
  assert.equal(readPath({patient:{age:0}}, 'patient.age'), 0);
  assert.equal(readPath({patient:{age:null}}, 'patient.age'), '—');
  assert.equal(readPath({}, 'patient.name'), '—');
  assert.equal(readPath({}, '__proto__.constructor'), '—');
});

test('save validation permits removal but rejects duplicates, wrong hospitals and unknown data paths', () => {
  const t = seedTemplate('a');
  t.header.content[0].content.pop();
  assert.deepEqual(validateTemplate('a', t),[]);
  t.header.content[0].content.push(t.header.content[0].content[0]);
  assert.ok(validateTemplate('a', t).some(x=>x.includes('重复')));
  assert.ok(validateTemplate('b', seedTemplate('a')).length);
  const invalid = seedTemplate('a'); invalid.bindings.patientName = 'unknown.path';
  assert.ok(validateTemplate('a', invalid).some(x=>x.includes('绑定')));
});

test('invalid content inside a leaf field is rejected as non-Tiptap document',()=>{
  const t=seedTemplate('a');
  t.header.content[0].content[0].content=[{type:'unsupportedNode'}];
  assert.ok(validateTemplate('a',t).length);
});

test('custom fields and unbound fields validate, including entirely empty regions', () => {
  const t=seedTemplate('a');
  t.header.content[0].content=[{type:'reportField',attrs:{fieldId:'custom_1',label:'自定义字段',bold:false,textAlign:'left',span:1}}];
  t.footer.content[0].content=[];
  t.bindings={custom_1:''};
  assert.deepEqual(validateTemplate('a',t),[]);
  delete t.bindings.custom_1;
  assert.deepEqual(validateTemplate('a',t),[]);
  t.header.content[0].content=[];
  assert.deepEqual(validateTemplate('a',t),[]);
});

test('field IDs must be safe and unique across regions', () => {
  const t=seedTemplate('a');
  t.footer.content[0].content[0].attrs.fieldId='patientName';
  assert.ok(validateTemplate('a',t).some(x=>x.includes('重复')));
  for(const id of ['__proto__','constructor','prototype','',42]) {
    const invalid=seedTemplate('a');invalid.header.content[0].content[0].attrs.fieldId=id;
    assert.ok(validateTemplate('a',invalid).some(x=>x.includes('标识')));
  }
});

test('hospital heading permits customized and explicitly hidden names but rejects invalid values', () => {
  const t=seedTemplate('a');
  t.hospitalName='示范医院';assert.deepEqual(validateTemplate('a',t),[]);
  t.hospitalName='';assert.deepEqual(validateTemplate('a',t),[]);
  t.hospitalName={name:'错误'};assert.ok(validateTemplate('a',t).length);
});

test('adding and deleting layout fields preserves the independent bindings without mutating the source', async () => {
  const model=await import('../src/report-model.mjs');
  const original=seedTemplate('a');
  const added=model.addTemplateField(original,'header','custom_1');
  assert.equal(fieldsFor(added.header).at(-1).attrs.fieldId,'custom_1');
  assert.deepEqual(added.bindings,original.bindings);
  assert.equal(fieldsFor(original.header).length,6);
  const removed=model.removeTemplateField(added,'header','custom_1');
  assert.equal(Object.hasOwn(removed.bindings,'custom_1'),false);
  assert.deepEqual(removed,original);
  assert.throws(()=>model.addTemplateField(added,'footer','custom_1'));
  let empty=original;
  for(const field of fieldsFor(original.header)) empty=model.removeTemplateField(empty,'header',field.attrs.fieldId);
  assert.deepEqual(empty.bindings,original.bindings);
  assert.deepEqual(validateTemplate('a',empty),[]);
  const restored=model.addTemplateField(empty,'header','new_field');
  assert.equal(fieldsFor(restored.header).length,1);
  assert.deepEqual(validateTemplate('a',restored),[]);
});

test('legacy hospital headings fall back while explicit custom or hidden headings survive', async () => {
  const {reportHospitalName}=await import('../src/report-model.mjs');
  const t=seedTemplate('b'); delete t.hospitalName;
  assert.equal(reportHospitalName(t),'B 医院');
  t.hospitalName='新名称';assert.equal(reportHospitalName(t),'新名称');
  t.hospitalName='';assert.equal(reportHospitalName(t),'');
});
