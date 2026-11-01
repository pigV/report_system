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

test('save validation rejects missing, duplicate, foreign and unbound fields', () => {
  const t = seedTemplate('a');
  t.header.content[0].content.pop();
  assert.ok(validateTemplate('a', t).length);
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
