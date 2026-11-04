import {Extension} from '@tiptap/core';
import {closeHistory} from '@tiptap/pm/history';
import {TextSelection} from '@tiptap/pm/state';
import {Fragment} from '@tiptap/pm/model';

// Metadata lives on native blocks: all standard editing/drag controls still work.
export const ReportSections=Extension.create({
  name:'reportSections',
  addGlobalAttributes(){return [{types:['heading','paragraph','bulletList','orderedList','blockquote'],attributes:{
    reportSection:{default:null,parseHTML:el=>el.getAttribute('data-report-section'),renderHTML:attrs=>attrs.reportSection?{'data-report-section':attrs.reportSection}:{}},
  }}]},
});
const names={findings:['描述','影像所见','检查所见'],impression:['诊断','诊断意见','诊断结论']};
const textOf=node=>(node.content??[]).map(n=>n.text??textOf(n)).join('');
const headingKind=node=>node.type==='heading'?(Object.hasOwn(names,node.attrs?.reportSection)?node.attrs.reportSection:Object.keys(names).find(k=>names[k].includes(textOf(node).trim().replace(/[：:]$/,'')))):null;
const textContainers=new Set(['bulletList','orderedList','listItem','blockquote']);
export function insertCitationTransaction(state,entry){
  const lines=[entry.findings,entry.impression].filter(value=>String(value??'').trim()).flatMap(value=>String(value).split(/\r?\n/));
  const nodes=[];
  for(const [index,line] of lines.entries()){
    if(index)nodes.push(state.schema.nodes.hardBreak.create());
    if(line)nodes.push(state.schema.text(line));
  }
  const pos=state.selection.to;
  const tr=closeHistory(state.tr).replaceWith(pos,pos,Fragment.fromArray(nodes));
  tr.setSelection(TextSelection.create(tr.doc,pos+nodes.reduce((total,node)=>total+node.nodeSize,0)));
  return tr;
}
function sectionBlocks(kind,text){
  return [{type:'heading',attrs:{level:2,reportSection:kind},content:[{type:'text',text:names[kind][0]}]},
    ...String(text??'').split('\n').map(line=>({type:'paragraph',attrs:{reportSection:kind},...(line?{content:[{type:'text',text:line}]}:{})}))];
}
export function replaceSectionsTransaction(state,entry){
  // 引用只替换描述和诊断；递归保留图片、表格等其他内容，兼容旧标题识别。
  const inserted=new Set();
  function rewrite(nodes,inheritedSection=false){
    const result=[];let legacySection=inheritedSection;
    for(const node of nodes){
      const kind=headingKind(node);
      if(node.type==='heading')legacySection=kind&&!node.attrs?.reportSection?kind:null;
      if(kind){if(!inserted.has(kind)){result.push(...sectionBlocks(kind,entry[kind]));inserted.add(kind)}continue}
      const marked=Object.hasOwn(names,node.attrs?.reportSection);
      if(node.type==='paragraph'&&(legacySection||marked))continue;
      if(!node.content||node.type==='paragraph'||node.type==='heading'){result.push(node);continue}
      // Native list/quote formatting wraps the marked paragraphs. Recurse rather
      // than dropping a whole container which may also contain images or tables.
      const children=rewrite(node.content,textContainers.has(node.type)&&(legacySection||marked));
      if(textContainers.has(node.type)&&!children.length)continue;
      if(['column','tableCell','tableHeader'].includes(node.type)&&!children.length)children.push({type:'paragraph'});
      if(node.type==='listItem'&&children[0]?.type!=='paragraph')children.unshift({type:'paragraph'});
      result.push({...node,content:children});
    }
    return result;
  }
  let content=rewrite(state.doc.toJSON().content??[]);
  if(content.length===1&&content[0].type==='paragraph'&&!content[0].content?.length)content=[];
  for(const kind of Object.keys(names))if(!inserted.has(kind))content.push(...sectionBlocks(kind,entry[kind]));
  const doc=state.schema.nodeFromJSON({type:'doc',content});doc.check();
  // 整次引用作为一个独立的撤销步骤，不与此前输入合并。
  const tr=closeHistory(state.tr).replaceWith(0,state.doc.content.size,doc.content);
  tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(state.selection.from,tr.doc.content.size))));
  return tr;
}
