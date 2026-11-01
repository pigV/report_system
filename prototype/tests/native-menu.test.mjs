import test from 'node:test';
import assert from 'node:assert/strict';
import { nativeMenuItems } from '../src/free-template/menu.mjs';
test('business labels and Chinese search remain visible without framework translation keys',()=>{
 const fields=[{id:'patientName',label:'患者姓名'}];
 const items=nativeMenuItems('',fields);
 assert.equal(items[0].label,'文本');assert.equal(items.at(-1).label,'业务字段');
 assert.deepEqual(nativeMenuItems('姓名',fields).map(x=>[x.label,x.fieldId]),[['患者姓名','patientName']]);
 assert.equal(nativeMenuItems('column',fields)[0].action,'columns');
 assert.deepEqual(nativeMenuItems('不存在',fields),[]);
});
