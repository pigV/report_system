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
  return normalizeBindings({hospitalId,hospitalName:hospitals.find(h=>h.id===hospitalId).name,schemaVersion:1,revision:1,title:'医学影像检查报告',header:doc('header'),footer:doc('footer'),bindings:Object.fromEntries([...regions[hospitalId].header,...regions[hospitalId].footer].map(id=>[id,fieldDefinitions[id][1]]))});
}
export const fieldsFor = doc => doc?.content?.flatMap(n=>n.type==='reportGrid' ? n.content ?? []:[]) ?? [];
// Snapshot legacy row metadata once; an existing (even empty) list is authoritative.
export function normalizeBindings(template) {
  const next=clone(template);
  if(next.bindingFields!==undefined)return next;
  next.bindingFields=['header','footer'].flatMap(region=>fieldsFor(next[region]).map(f=>({id:f.attrs.fieldId,label:f.attrs.label,region})));
  const ids=new Set(next.bindingFields.map(f=>f.id));
  for(const id of Object.keys(next.bindings??{})) {
    if(!ids.has(id))next.bindingFields.push({id,label:fieldDefinitions[id]?.[0]??id.slice(0,20),region:['doctor','reviewer','reportDate'].includes(id)?'footer':'header'});
  }
  return next;
}
export function addBindingField(template,field) {
  if(!validFieldId(field.id)||!['header','footer'].includes(field.region)||typeof field.label!=='string'||!field.label.trim()||field.label.length>20)throw new Error('绑定字段无效');
  const next=normalizeBindings(template);
  if(next.bindingFields.some(f=>f.id===field.id))throw new Error('存在重复绑定字段');
  next.bindingFields.push({...field});
  next.bindings[field.id]='';
  return next;
}
export function removeBindingField(template,id) {
  const next=normalizeBindings(template);
  next.bindingFields=next.bindingFields.filter(f=>f.id!==id);
  delete next.bindings[id];
  return next;
}
export function moveBindingField(template,fromId,toId) {
  const next=normalizeBindings(template),list=next.bindingFields;
  const from=list.findIndex(f=>f.id===fromId),to=list.findIndex(f=>f.id===toId);
  if(from<0||to<0||from===to||list[from].region!==list[to].region)return next;
  list.splice(to,0,list.splice(from,1)[0]);
  return next;
}
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
export const reportHospitalName = template => template.hospitalName ?? hospitals.find(h=>h.id===template.hospitalId)?.name ?? '';
export const validFieldId = id => typeof id==='string' && /^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(id) && !['__proto__','constructor','prototype'].includes(id);
export function addTemplateField(template,region,id) {
  if(!['header','footer'].includes(region) || !validFieldId(id)) throw new Error('字段标识无效');
  if(['header','footer'].some(r=>fieldsFor(template[r]).some(f=>f.attrs.fieldId===id))) throw new Error('存在重复字段');
  const next=clone(template), grid=next[region].content[0];
  grid.content??=[];
  grid.content.push({type:'reportField',attrs:{fieldId:id,label:'新字段',bold:false,textAlign:'left',span:1}});
  return next;
}
export function removeTemplateField(template,region,id) {
  if(!['header','footer'].includes(region)) throw new Error('字段区域无效');
  const next=clone(template), grid=next[region].content[0];
  grid.content=(grid.content??[]).filter(f=>f.attrs.fieldId!==id);
  return next;
}
export function validateTemplate(hospitalId,t) {
  const errors=[], seen=new Set();
  if(!regions[hospitalId] || !t || t.hospitalId!==hospitalId || t.schemaVersion!==1) return ['模板与医院不匹配'];
  if(typeof t.title!=='string' || !t.title.trim() || t.title.length>60) errors.push('请填写 60 字以内的报告标题');
  if(t.hospitalName!==undefined && (typeof t.hospitalName!=='string' || t.hospitalName.length>80)) errors.push('医院名称应为 80 字以内的文本');
  if(!t.bindings || typeof t.bindings!=='object' || Array.isArray(t.bindings)) errors.push('字段绑定结构无效');
  else for(const [id,path] of Object.entries(t.bindings)) {
    if(!validFieldId(id)|| (path!==''&&!pathOptions.some(p=>p.path===path)))errors.push(`字段绑定无效：${id}`);
  }
  if(t.bindingFields!==undefined) {
    if(!Array.isArray(t.bindingFields))errors.push('绑定字段列表无效');
    else {
      const bindingIds=new Set();
      for(const field of t.bindingFields) {
        if(!field||!validFieldId(field.id)||!['header','footer'].includes(field.region)||typeof field.label!=='string'||!field.label.trim()||field.label.length>20)errors.push('绑定字段无效');
        if(bindingIds.has(field?.id))errors.push('存在重复绑定字段');
        bindingIds.add(field?.id);
      }
    }
  }
  for(const region of ['header','footer']) {
    const doc=t[region], grid=doc?.content?.[0];
    try {templateSchema.nodeFromJSON(doc).check();}catch {errors.push('文档不符合 Tiptap Schema');}
    if(doc?.type!=='doc' || !Array.isArray(doc.content) || doc.content.length!==1 || grid?.type!=='reportGrid' || (grid.content!==undefined && !Array.isArray(grid.content))) {errors.push('文档结构无效'); continue;}
    const attrs=grid.attrs;
    if(!attrs || ![1,2,3].includes(attrs.columns) || typeof attrs.borders!=='boolean' || !Array.isArray(attrs.columnWidths) || attrs.columnWidths.length!==attrs.columns || attrs.columnWidths.some(w=>!Number.isFinite(w) || w<0.5 || w>2)) {errors.push('列布局无效');continue;}
    for(const f of fieldsFor(doc)) {
      const a=f.attrs;
      if(f.type!=='reportField' || !a || !validFieldId(a.fieldId)) {errors.push('字段标识无效');continue;}
      if(seen.has(a.fieldId)) errors.push('存在重复字段');
      seen.add(a.fieldId);
      if(typeof a.label!=='string' || !a.label.trim() || a.label.length>20) errors.push('字段名称应为 1–20 个字');
      if(!['left','center','right'].includes(a.textAlign) || typeof a.bold!=='boolean' || !Number.isInteger(a.span) || a.span<1 || a.span>attrs.columns) errors.push('字段样式无效');
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
