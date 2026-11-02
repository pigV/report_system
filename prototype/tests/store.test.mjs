import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { openStore } from '../server/store.mjs';
import { emptyBody } from '../src/report-model.mjs';

test('SQLite saves hospital templates across reopen, preserves other hospitals and report snapshots',()=>{
  mkdirSync('tests/.tmp',{recursive:true});
  const dir=mkdtempSync('tests/.tmp/store-'), file=join(dir,'test.sqlite');
  let store=openStore(file);
  try {
    const original=store.getTemplate('a');
    store.saveReport('a','a-1',emptyBody());
    const changed=structuredClone(original); changed.title='测试报告标题';
    store.saveTemplate('a',changed);
    store.close();store=openStore(file);
    assert.equal(store.getTemplate('a').title,'测试报告标题');
    assert.equal(store.getTemplate('b').title,'医学影像检查报告');
    assert.equal(store.getReport('a','a-1').template.title,original.title);
    assert.throws(()=>store.saveReport('a','b-1',emptyBody()),/病例/);
    assert.throws(()=>store.saveTemplate('b',changed),/医院/);
    assert.throws(()=>store.saveReport('a','a-1',{type:'doc',content:[{type:'evil'}]}),/正文/);
  } finally {store.close();rmSync(dir,{recursive:true,force:true});}
});

test('stale report saves do not overwrite another window',()=>{
  const store=openStore(':memory:');
  try {
    const context={template:store.getTemplate('a'),caseId:'a-1',reportRevision:0};
    const first=store.saveReport('a','a-1',emptyBody(),context);
    assert.equal(first.revision,1);
    assert.throws(()=>store.saveReport('a','a-1',emptyBody(),context),/其他窗口/);
  } finally {store.close();}
});

test('report blocks retain tables, columns, formatting and order across database reopen',()=>{
  mkdirSync('tests/.tmp',{recursive:true});
  const dir=mkdtempSync('tests/.tmp/body-blocks-'),file=join(dir,'test.sqlite');
  let store=openStore(file);
  const paragraph=text=>({type:'paragraph',content:[{type:'text',text}]});
  const body={type:'doc',content:[
    {type:'heading',attrs:{level:2,textAlign:'center'},content:[{type:'text',text:'影像所见'}]},
    {type:'table',content:[{type:'tableRow',content:[{type:'tableCell',content:[paragraph('测量值')]}]}]},
    {type:'columns',content:[{type:'column',content:[paragraph('左侧')]},{type:'column',content:[paragraph('右侧')]}]},
    {type:'horizontalRule'},
    {type:'paragraph',content:[{type:'text',text:'结论',marks:[{type:'underline'},{type:'textStyle',attrs:{color:'#333333'}}]}]},
  ]};
  try {
    const snapshot=store.getTemplate('a');
    store.saveReport('a','a-1',body);
    store.close();store=openStore(file);
    assert.deepEqual(store.getReport('a','a-1').body,body);
    const reordered={...body,content:[body.content.at(-1),...body.content.slice(0,-1)]};
    store.saveReport('a','a-1',reordered);
    assert.deepEqual(store.getReport('a','a-1').body,reordered);
    assert.deepEqual(store.getReport('a','a-1').template,snapshot);
    assert.equal(store.getReport('b','b-1'),null);
    assert.throws(()=>store.saveReport('a','a-1',{type:'doc',content:[{type:'table',content:[paragraph('invalid')]}]}),/正文/);
  } finally {store.close();rmSync(dir,{recursive:true,force:true});}
});

test('dynamic empty and unbound templates persist without altering other hospitals or snapshots',()=>{
  mkdirSync('tests/.tmp',{recursive:true});
  const dir=mkdtempSync('tests/.tmp/dynamic-'), file=join(dir,'test.sqlite');
  let store=openStore(file);
  try {
    const before=store.getTemplate('a'), other=store.getTemplate('b');
    store.saveReport('a','a-1',emptyBody());
    const changed=structuredClone(before);
    changed.hospitalName='自定义医院';
    changed.header.content[0].content=[];
    changed.footer.content[0].content=[{type:'reportField',attrs:{fieldId:'custom_1',label:'备注',bold:false,textAlign:'left',span:1}}];
    changed.bindings={custom_1:''};
    store.saveTemplate('a',changed);
    store.close();store=openStore(file);
    assert.equal(store.getTemplate('a').hospitalName,'自定义医院');
    assert.deepEqual(store.getTemplate('a').header.content[0].content,[]);
    assert.equal(store.getTemplate('a').bindings.custom_1,'');
    assert.deepEqual(store.getTemplate('b'),other);
    assert.deepEqual(store.getReport('a','a-1').template,before);
    store.saveReport('a','a-2',emptyBody(),{template:store.getTemplate('a'),caseId:'a-2',reportRevision:0});
    assert.equal(store.getReport('a','a-2').template.hospitalName,'自定义医院');
  } finally {store.close();rmSync(dir,{recursive:true,force:true});}
});
