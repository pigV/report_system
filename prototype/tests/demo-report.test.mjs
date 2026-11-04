import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {demoReportFields,demoReportTime} from '../src/demo-report.mjs';
import {makeCases} from '../src/report-model.mjs';
import {keyImages,keyImage} from '../src/key-images.mjs';
import {keyImageColumns} from '../src/editor/key-image-insert.mjs';

test('pet demo case uses 毛豆 and 雌 for both hospitals',()=>{
  for(const hospital of ['a','b']){
    const sample=makeCases(hospital)[0];
    const fields=demoReportFields(sample.data);
    assert.equal(sample.label,'毛豆 · 胸部 CT');
    assert.equal(fields[0].value,'毛豆');
    assert.equal(fields[3].value,'雌');
  }
});

test('legacy pet demo snapshots display corrected values without changing saved data',()=>{
  const data={patient:{name:'林晓',gender:'女',age:'32岁',no:'A000128'},exam:{no:'CT20261101001'}};
  const before=JSON.stringify(data),fields=demoReportFields(data);
  assert.equal(fields[0].value,'毛豆');
  assert.equal(fields[3].value,'雌');
  assert.equal(fields[4].value,'2岁');
  assert.equal(JSON.stringify(data),before);
  const other=demoReportFields({patient:{name:'林晓',gender:'女',age:'32岁'},exam:{no:'OTHER'}});
  assert.equal(other[0].value,'林晓');
  assert.equal(other[3].value,'女');
  assert.equal(other[4].value,'32岁');
  assert.equal(demoReportFields({...data,patient:{...data.patient,age:'5岁'}})[4].value,'5岁');
});

test('demo fields use report data without modifying it and preserve zero values',()=>{
  const data={patient:{name:'小白',age:0},exam:{no:'I-1',part:'胸部'},report:{date:'2026-11-04'}};
  const before=JSON.stringify(data),fields=demoReportFields(data);
  assert.deepEqual(fields.map(field=>field.label),['名字','种类','品种','性别','年龄','检查时间','影像号','设备类型','检查部位']);
  assert.equal(fields[0].value,'小白');
  assert.equal(fields[4].value,0);
  assert.equal(fields[6].value,'I-1');
  assert.equal(fields[8].value,'胸部');
  assert.equal(fields[8].wide,true);
  assert.equal(demoReportTime(data),'2026-11-04');
  assert.equal(JSON.stringify(data),before);
});

test('new demo images remain insertable while legacy report image IDs retain their old assets',()=>{
  assert.equal(keyImages.length,8);
  for(const image of keyImages){
    assert.equal(keyImage(image.id),image);
    assert.equal(readFileSync(new URL(`../public${image.src}`,import.meta.url)).subarray(0,2).toString('hex'),'ffd8');
  }
  assert.deepEqual(keyImageColumns([keyImages[1].id,keyImages[0].id]).content.map(col=>col.content[0].attrs.imageId),[keyImages[1].id,keyImages[0].id]);
  assert.equal(keyImage('cervical').src,'/demo-images/cervical.svg');
  assert.equal(keyImage('lumbar').src,'/demo-images/lumbar.svg');
  assert.equal(keyImage('knee').src,'/demo-images/knee.svg');
});
