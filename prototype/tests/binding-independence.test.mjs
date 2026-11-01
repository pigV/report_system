import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import * as model from '../src/report-model.mjs';
import {applyRegionEdit} from '../src/editor-state.mjs';
import {openStore} from '../server/store.mjs';

test('legacy conversion snapshots names and order once, keeps orphan mappings and explicit empty lists',()=>{
  const legacy=model.seedTemplate('a');delete legacy.bindingFields;
  legacy.header.content[0].content[0].attrs.label='旧姓名';
  legacy.bindings.archived='patient.no';
  const t=model.normalizeBindings(legacy);
  assert.deepEqual(t.bindingFields[0],{id:'patientName',label:'旧姓名',region:'header'});
  assert.ok(t.bindingFields.some(f=>f.id==='archived'));
  assert.equal(legacy.bindingFields,undefined);
  t.header=model.moveField(t.header,'patientName','examDate');
  model.fieldsFor(t.header).find(f=>f.attrs.fieldId==='patientName').attrs.label='新姓名';
  assert.deepEqual(model.normalizeBindings(t).bindingFields[0],{id:'patientName',label:'旧姓名',region:'header'});
  t.bindingFields=[];t.bindings={};
  assert.deepEqual(model.normalizeBindings(t).bindingFields,[]);
});

test('binding operations change only the independent list and paths',()=>{
  const before=model.normalizeBindings(model.seedTemplate('a'));
  const renamed=model.clone(before);renamed.bindingFields[0].label='绑定名称';
  const moved=model.moveBindingField(renamed,'patientName','examDate');
  assert.equal(moved.bindingFields.filter(f=>f.region==='header').at(-1).id,'patientName');
  const removed=model.removeBindingField(moved,'patientName');
  assert.equal(removed.bindings.patientName,undefined);
  assert.ok(!removed.bindingFields.some(f=>f.id==='patientName'));
  const added=model.addBindingField(removed,{id:'patientName',label:'重新绑定',region:'header'});
  assert.equal(added.bindings.patientName,'');
  assert.deepEqual(added.header,before.header);
  assert.deepEqual(added.footer,before.footer);
  assert.throws(()=>model.addBindingField(added,{id:'patientName',label:'重复',region:'header'}));
  assert.equal(before.bindings.patientName,'patient.name');
  const undone=applyRegionEdit(removed,'header',before.header);
  assert.equal(undone.bindings.patientName,undefined);
  assert.deepEqual(undone.bindingFields,removed.bindingFields);
});

test('layout rename, reorder, deletion and empty regions never rewrite binding metadata',()=>{
  const before=model.normalizeBindings(model.seedTemplate('a'));
  const doc=model.moveField(before.header,'patientName','examDate');
  doc.content[0].content[0].attrs.label='布局名称';
  let t=applyRegionEdit(before,'header',doc);
  for(const r of ['header','footer'])for(const f of model.fieldsFor(t[r]))t=model.removeTemplateField(t,r,f.attrs.fieldId);
  assert.deepEqual(t.bindingFields,before.bindingFields);
  assert.deepEqual(t.bindings,before.bindings);
  assert.deepEqual(model.validateTemplate('a',t),[]);
});

test('validation checks detached bindings and malformed independent row metadata',()=>{
  const t=model.seedTemplate('a');t.header.content[0].content=[];
  t.bindings.patientName='unknown.path';
  assert.ok(model.validateTemplate('a',t).some(e=>e.includes('绑定')));
  for(const bindingFields of [null,{},[{id:'x',label:'',region:'header'}],[{id:'constructor',label:'字段',region:'header'}],[{id:'x',label:'字段',region:'body'}],[{id:'x',label:'字段',region:'header'},{id:'x',label:'重复',region:'footer'}]]){
    const invalid=model.seedTemplate('a');invalid.bindingFields=bindingFields;
    assert.ok(model.validateTemplate('a',invalid).length);
  }
});

test('legacy SQLite templates migrate and persist independent edits across reopen without changing snapshots or other hospitals',()=>{
  mkdirSync('tests/.tmp',{recursive:true});
  const dir=mkdtempSync('tests/.tmp/bindings-'),file=join(dir,'test.sqlite');
  let store=openStore(file);
  try{
    const legacy=store.getTemplate('a');delete legacy.bindingFields;
    const other=store.getTemplate('b');
    const snapshot=store.saveReport('a','a-1',model.emptyBody());
    store.close();
    const db=new DatabaseSync(file);
    db.prepare('UPDATE templates SET payload=? WHERE hospital=?').run(JSON.stringify(legacy),'a');db.close();
    store=openStore(file);
    let changed=store.getTemplate('a');
    assert.equal(changed.bindingFields[0].label,'患者姓名');
    changed=model.removeTemplateField(changed,'header','patientName');
    changed.bindingFields[0].label='独立绑定名称';
    changed=model.removeBindingField(changed,'gender');
    store.saveTemplate('a',changed);store.close();store=openStore(file);
    const loaded=store.getTemplate('a');
    assert.equal(loaded.bindings.patientName,'patient.name');
    assert.equal(loaded.bindingFields[0].label,'独立绑定名称');
    assert.ok(!model.fieldsFor(loaded.header).some(f=>f.attrs.fieldId==='patientName'));
    assert.ok(model.fieldsFor(loaded.header).some(f=>f.attrs.fieldId==='gender'));
    assert.equal(loaded.bindings.gender,undefined);
    assert.deepEqual(store.getTemplate('b'),other);
    assert.deepEqual(store.getReport('a','a-1'),snapshot);
    loaded.bindingFields=[];loaded.bindings={};store.saveTemplate('a',loaded);
    store.close();store=openStore(file);
    assert.deepEqual(store.getTemplate('a').bindingFields,[]);
    assert.throws(()=>store.saveTemplate('a',loaded),/其他窗口/);
  }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
