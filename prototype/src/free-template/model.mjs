import { Node, getSchema, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { createExtensionList } from '@yiitap/vue';
import { fieldsFor, reportHospitalName, pathOptions, readPath, validFieldId, hospitals } from '../report-model.mjs';
import {ColumnDeletion} from '../editor/column-delete.mjs';

export const BusinessField=Node.create({
  name:'businessField',group:'inline',inline:true,atom:true,selectable:true,draggable:true,
  addOptions(){return {resolve:null}},
  addAttributes(){return {fieldId:{default:''},label:{default:''}}},
  parseHTML(){return [{tag:'span[data-business-field]',getAttrs:el=>({fieldId:el.getAttribute('data-business-field'),label:el.getAttribute('data-label')||el.textContent})}]},
  renderHTML({node,HTMLAttributes}){
    return ['span',mergeAttributes(HTMLAttributes,{'data-business-field':node.attrs.fieldId,'data-label':node.attrs.label,class:this.options.resolve?'native-field-value':'native-field-token',contenteditable:'false',draggable:this.options.resolve?'false':'true'}),this.options.resolve?String(this.options.resolve(node.attrs)):node.attrs.label];
  },
});
export function nativeExtensions(resolve=null){
  return [...createExtensionList(['Table','OMultiColumn','TextAlign','TextStyle','Color','OHorizontalRule','OBlockquote','OShortcut']),ColumnDeletion,BusinessField.configure({resolve})];
}
export function nativeSchemaFor(resolve=null){return getSchema([StarterKit.configure({codeBlock:false,horizontalRule:false,link:false,blockquote:false,trailingNode:false}),...nativeExtensions(resolve)])}
export const nativeSchema=nativeSchemaFor();
const text=value=>({type:'text',text:value});
const paragraph=(content=[],attrs={})=>({type:'paragraph',attrs,content});
const token=(id,label)=>({type:'businessField',attrs:{fieldId:id,label}});
export function fromLegacy(source){
  const fields=(source.bindingFields??[]).map(f=>({...f}));
  for(const region of ['header','footer'])for(const f of fieldsFor(source[region]))if(!fields.some(x=>x.id===f.attrs.fieldId))fields.push({id:f.attrs.fieldId,label:f.attrs.label,region});
  function grid(region){
    const old=source[region].content[0], count=old.attrs.columns, rows=[];let cells=[],used=0;
    const empty=span=>({type:'tableCell',attrs:{colspan:span,rowspan:1,colwidth:null},content:[paragraph()]});
    for(const field of fieldsFor(source[region])){
      const a=field.attrs,span=Math.min(a.span,count);
      if(used+span>count){cells.push(empty(count-used));rows.push({type:'tableRow',content:cells});cells=[];used=0;}
      const label=text(`${a.label}：`);if(a.bold)label.marks=[{type:'bold'}];
      cells.push({type:'tableCell',attrs:{colspan:span,rowspan:1,colwidth:null},content:[paragraph([label,token(a.fieldId,a.label)],{textAlign:a.textAlign})]});used+=span;
      if(used===count){rows.push({type:'tableRow',content:cells});cells=[];used=0;}
    }
    if(cells.length){if(used<count)cells.push(empty(count-used));rows.push({type:'tableRow',content:cells});}
    return rows.length?[{type:'table',content:rows}]:[];
  }
  const name=reportHospitalName(source);
  return {schemaVersion:2,hospitalId:source.hospitalId,revision:0,fields,bindings:{...source.bindings},header:{type:'doc',content:[...(name?[{type:'heading',attrs:{level:1,textAlign:'center'},content:[text(name)]}]:[]),{type:'heading',attrs:{level:2,textAlign:'center'},content:[text(source.title)]},{type:'horizontalRule'},...grid('header'),paragraph()]},footer:{type:'doc',content:[{type:'horizontalRule'},...grid('footer'),paragraph([text('本报告仅供临床参考')],{textAlign:'center'})]}};
}
export function resolveField(id,template,data,showData){
  const field=template.fields.find(f=>f.id===id);
  if(!showData)return field?.label??'未知字段';
  const path=template.bindings[id];return path?String(readPath(data,path)):'未绑定';
}
export function validateNativeTemplate(id,t){
  if(!hospitals.some(h=>h.id===id)||!t||t.hospitalId!==id)return ['模板与医院不匹配'];
  if(t.schemaVersion!==2||!Number.isInteger(t.revision)||t.revision<0||!Array.isArray(t.fields)||t.fields.length>100||!t.bindings||typeof t.bindings!=='object'||Array.isArray(t.bindings))return ['模板结构无效'];
  const errors=[], ids=new Set();
  for(const f of t.fields){
    if(!f||!validFieldId(f.id)||ids.has(f.id)||typeof f.label!=='string'||!f.label.trim()||f.label.length>40||!['header','footer'].includes(f.region))errors.push('字段定义无效');
    ids.add(f?.id);
  }
  for(const [key,value] of Object.entries(t.bindings))if(!validFieldId(key)||!ids.has(key)||(value!==''&&!pathOptions.some(x=>x.path===value)))errors.push('字段绑定无效');
  let count=0;
  function walk(n,depth=0){
    if(!n||typeof n!=='object'||++count>4000||depth>20)throw Error('文档过大或嵌套过深');
    const a=n.attrs??{};
    if(n.type==='businessField'&&(!ids.has(a.fieldId)||typeof a.label!=='string'||!a.label.trim()||a.label.length>40))throw Error('业务字段无效');
    if(a.textAlign!=null&&!['left','center','right','justify'].includes(a.textAlign))throw Error('对齐方式无效');
    for(const key of ['colspan','rowspan'])if(a[key]!=null&&(!Number.isInteger(a[key])||a[key]<1||a[key]>20))throw Error('表格跨度无效');
    if(a.colwidth!=null&&(!Array.isArray(a.colwidth)||a.colwidth.length>20||a.colwidth.some(v=>!Number.isFinite(v)||v<0||v>3000)))throw Error('列宽无效');
    if(a.flexGrow!=null&&(!Number.isFinite(a.flexGrow)||a.flexGrow<=0||a.flexGrow>100))throw Error('分栏宽度无效');
    if(n.type==='columns'&&(!n.content?.length||n.content.length>6))throw Error('分栏数量无效');
    for(const m of n.marks??[])if(m.attrs?.color&&!/^(#[0-9a-f]{3,8}|rgba?\([\d.,%\s]+\)|[a-z]{1,20})$/i.test(m.attrs.color))throw Error('颜色无效');
    for(const c of n.content??[])walk(c,depth+1);
  }
  for(const region of ['header','footer'])try{
    const doc=t[region];if(doc?.type!=='doc')throw Error('区域必须为文档');walk(doc);nativeSchema.nodeFromJSON(doc).check();
  }catch(e){errors.push(`${region==='header'?'表头':'表尾'}文档无效：${e.message}`)}
  return [...new Set(errors)];
}
export function mergeNativeSave(current,submitted,saved){return JSON.stringify(current)===JSON.stringify(submitted)?saved:{...current,revision:saved.revision,updatedAt:saved.updatedAt}}
