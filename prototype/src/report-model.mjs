import { templateSchema } from './editor/template-schema.mjs';
export const hospitals = [{id:'a', name:'A 医院', subtitle:'综合影像中心'}, {id:'b', name:'B 医院', subtitle:'医学影像科'}];
export const fieldDefinitions = {
  patientName:['患者姓名','patient.name'], gender:['性别','patient.gender'], age:['年龄','patient.age'],
  patientNo:['患者编号','patient.no'], examNo:['检查编号','exam.no'], examItem:['检查项目','exam.item'],
  examPart:['检查部位','exam.part'], examDate:['检查日期','exam.date'], doctor:['报告医生','report.doctor'],
  reviewer:['审核医生','report.reviewer'], reportDate:['报告日期','report.date'],
};
export const pathOptions = Object.entries(fieldDefinitions).map(([id,[label,path]])=>({id,label,path}));
const regions = {a:{header:['patientName','gender','age','patientNo','examItem','examDate'],footer:['doctor','reviewer','reportDate']},b:{header:['patientName','age','examNo','examPart','examDate'],footer:['doctor','reportDate']}};
export const clone = value => JSON.parse(JSON.stringify(value));
export const emptyBody = () => ({type:'doc',content:[{type:'paragraph'}]});
export function seedTemplate(hospitalId) {
  if (!regions[hospitalId]) throw new Error('医院不存在');
  const doc = region => ({type:'doc',content:[{type:'reportGrid',attrs:{columns:3,borders:false,columnWidths:[1,1,1]},content:regions[hospitalId][region].map(fieldId=>({type:'reportField',attrs:{fieldId,label:fieldDefinitions[fieldId][0],bold:false,textAlign:'left',span:1}}))}]});
  return {hospitalId,schemaVersion:1,revision:1,title:'医学影像检查报告',header:doc('header'),footer:doc('footer'),bindings:Object.fromEntries([...regions[hospitalId].header,...regions[hospitalId].footer].map(id=>[id,fieldDefinitions[id][1]]))};
}
export const fieldsFor = doc => doc?.content?.flatMap(n=>n.type==='reportGrid' ? n.content ?? []:[]) ?? [];
export function readPath(data,path) {
  if (typeof path !== 'string' || path.split('.').some(x=>['__proto__','constructor','prototype'].includes(x))) return '—';
  let value=data;
  for(const key of path.split('.')) { if(value===null || typeof value!=='object' || !Object.hasOwn(value,key)) return '—'; value=value[key]; }
  return value===null || value===undefined || value==='' || typeof value==='object' ? '—':value;
}
export function moveField(doc,fromId,toId) {
  const next=clone(doc), list=next.content[0].content;
  const from=list.findIndex(x=>x.attrs.fieldId===fromId), to=list.findIndex(x=>x.attrs.fieldId===toId);
  if(from<0 || to<0 || from===to) return next;
  list.splice(to,0,list.splice(from,1)[0]); return next;
}
export function validateTemplate(hospitalId,t) {
  const errors=[];
  if(!regions[hospitalId] || !t || t.hospitalId!==hospitalId || t.schemaVersion!==1) return ['模板与医院不匹配'];
  if(typeof t.title!=='string' || !t.title.trim() || t.title.length>60) errors.push('请填写 60 字以内的报告标题');
  for(const region of ['header','footer']) {
    const doc=t[region], grid=doc?.content?.[0];
    try {templateSchema.nodeFromJSON(doc).check();}catch {errors.push('文档不符合 Tiptap Schema');}
    if(doc?.type!=='doc' || doc.content.length!==1 || grid?.type!=='reportGrid' || !Array.isArray(grid.content)) {errors.push('文档结构无效'); continue;}
    const attrs=grid.attrs;
    if(!attrs || ![1,2,3].includes(attrs.columns) || typeof attrs.borders!=='boolean' || !Array.isArray(attrs.columnWidths) || attrs.columnWidths.length!==attrs.columns || attrs.columnWidths.some(w=>!Number.isFinite(w) || w<0.5 || w>2)) errors.push('列布局无效');
    const ids=fieldsFor(doc).map(f=>f.attrs?.fieldId);
    if(new Set(ids).size!==ids.length) errors.push('存在重复字段');
    for(const id of regions[hospitalId][region]) if(!ids.includes(id)) errors.push(`缺少字段：${fieldDefinitions[id][0]}`);
    for(const f of fieldsFor(doc)) {
      const a=f.attrs;
      if(f.type!=='reportField' || !a || !regions[hospitalId][region].includes(a.fieldId)) {errors.push('含有不属于本医院区域的字段');continue;}
      if(typeof a.label!=='string' || !a.label.trim() || a.label.length>20) errors.push('字段名称应为 1–20 个字');
      if(!['left','center','right'].includes(a.textAlign) || typeof a.bold!=='boolean' || !Number.isInteger(a.span) || a.span<1 || a.span>attrs.columns) errors.push('字段样式无效');
      if(!pathOptions.some(p=>p.path===t.bindings?.[a.fieldId])) errors.push(`字段绑定无效：${a.label}`);
    }
  }
  return [...new Set(errors)];
}
export function makeCases(hospitalId) {
  const a=hospitalId==='a';
  return [
    {id:`${hospitalId}-1`,label:'林晓 · 胸部 CT',data:{patient:{name:'林晓',gender:'女',age:'32岁',no:a?'A000128':'B000082'},exam:{no:'CT20261101001',item:'胸部 CT',part:'胸部',date:'2026-11-01'},report:{doctor:'陈医生',reviewer:'李医生',date:'2026-11-01'}}},
    {id:`${hospitalId}-2`,label:'陈小宇 · 空值示例',data:{patient:{name:'陈小宇',gender:'男',age:0,no:a?'A000129':'B000083'},exam:{no:'US20261101002',item:'超声检查',part:'腹部',date:'2026-11-01'},report:{doctor:'王医生',reviewer:null,date:'2026-11-01'}}},
  ];
}
