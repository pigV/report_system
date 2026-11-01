import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { seedTemplate, emptyBody } from '../src/report-model.mjs';
import { fromLegacy, validateNativeTemplate, resolveField, nativeSchema, mergeNativeSave } from '../src/free-template/model.mjs';
import { openNativeStore } from '../server/native-store.mjs';
import { openStore } from '../server/store.mjs';

test('native conversion copies existing hospital layout and bindings without changing source',()=>{
  const source=seedTemplate('a');source.hospitalName='示例中心';source.header.content[0].content[0].attrs.label='就诊人';
  const before=structuredClone(source), t=fromLegacy(source);
  assert.equal(t.revision,0);assert.equal(t.hospitalId,'a');assert.match(JSON.stringify(t.header),/示例中心/);
  assert.match(JSON.stringify(t.header),/就诊人/);assert.match(JSON.stringify(t.header),/businessField/);
  assert.equal(t.bindings.patientName,'patient.name');assert.deepEqual(source,before);
  assert.deepEqual(validateNativeTemplate('a',t),[]);
});
test('rich documents accept columns and tables, empty regions and reject unsupported/corrupt JSON',()=>{
  const t=fromLegacy(seedTemplate('a'));
  t.header={type:'doc',content:[{type:'columns',content:[{type:'column',attrs:{flexGrow:1},content:[{type:'paragraph',content:[{type:'text',text:'自由段落'}]}]},{type:'column',attrs:{flexGrow:1},content:[{type:'paragraph'}]}]}]};
  t.footer=emptyBody();assert.deepEqual(validateNativeTemplate('a',t),[]);
  nativeSchema.nodeFromJSON(t.header).check();
  t.header.content=[{type:'script',text:'bad'}];assert.ok(validateNativeTemplate('a',t).length);
  t.header={type:'doc',content:[{type:'table',content:[{type:'paragraph'}]}]};assert.ok(validateNativeTemplate('a',t).length);
  t.header=emptyBody();t.header.content[0].marks=[{type:'unknown'}];assert.ok(validateNativeTemplate('a',t).length);
});
test('binding metadata survives document edits and allows unbound fields and zero data',()=>{
  const t=fromLegacy(seedTemplate('a')), before=structuredClone(t.fields);
  t.header=emptyBody();assert.deepEqual(t.fields,before);assert.deepEqual(validateNativeTemplate('a',t),[]);
  assert.equal(resolveField('age',t,{patient:{age:0}},true),'0');
  t.bindings.age='';assert.equal(resolveField('age',t,{},true),'未绑定');
  t.bindings.age='__proto__.x';assert.ok(validateNativeTemplate('a',t).length);
});
test('unknown token IDs and unsafe style/shape attributes are rejected rather than silently removed',()=>{
  const t=fromLegacy(seedTemplate('a'));
  t.header={type:'doc',content:[{type:'paragraph',content:[{type:'businessField',attrs:{fieldId:'missing',label:'未知'}}]}]};
  assert.ok(validateNativeTemplate('a',t).length);
  t.header={type:'doc',content:[{type:'paragraph',attrs:{textAlign:'url(evil)'},content:[{type:'text',text:'x'}]}]};assert.ok(validateNativeTemplate('a',t).length);
  t.header={type:'doc',content:[{type:'table',content:[{type:'tableRow',content:[{type:'tableCell',attrs:{colspan:999999},content:[{type:'paragraph'}]}]}]}]};assert.ok(validateNativeTemplate('a',t).length);
});
test('save response advances revision but keeps newer local edits dirty',()=>{
  const submitted=fromLegacy(seedTemplate('a')), current=structuredClone(submitted), saved={...submitted,revision:1};
  current.footer.content.push({type:'paragraph',content:[{type:'text',text:'更新文字'}]});
  const merged=mergeNativeSave(current,submitted,saved);
  assert.equal(merged.revision,1);assert.match(JSON.stringify(merged.footer),/更新文字/);assert.notDeepEqual(merged,saved);
});
test('new store persists independently, rejects stale/cross-hospital saves and preserves old report snapshots',()=>{
  mkdirSync('tests/.tmp',{recursive:true});const dir=mkdtempSync('tests/.tmp/native-');
  const legacy=openStore(join(dir,'legacy.sqlite'));let native=openNativeStore(join(dir,'native.sqlite'),id=>legacy.getTemplate(id));
  try {
    const old=legacy.getTemplate('a');const report=legacy.saveReport('a','a-1',emptyBody());const other=native.getTemplate('b');
    const t=native.getTemplate('a');t.header.content.push({type:'paragraph',content:[{type:'text',text:'独立模板'}]});
    const saved=native.saveTemplate('a',t);assert.equal(saved.revision,1);
    assert.throws(()=>native.saveTemplate('a',t),/其他窗口/);
    assert.throws(()=>native.saveTemplate('b',saved),/医院/);
    native.close();native=openNativeStore(join(dir,'native.sqlite'),id=>legacy.getTemplate(id));
    assert.deepEqual(native.getTemplate('a'),saved);assert.deepEqual(native.getTemplate('b'),other);
    assert.deepEqual(legacy.getTemplate('a'),old);assert.deepEqual(legacy.getReport('a','a-1'),report);
    assert.throws(()=>native.getTemplate('invalid'),/医院/);
  } finally {native.close();legacy.close();rmSync(dir,{recursive:true,force:true});}
});
