// 【学习06】侧栏引用的核心；对照指南第 7.3 节。
// Extension 来自 Tiptap；@tiptap/pm/* 则是 ProseMirror 的历史、选区和文档模型 API。
import {Extension} from '@tiptap/core';
import {closeHistory} from '@tiptap/pm/history';
import {TextSelection} from '@tiptap/pm/state';
import {Fragment} from '@tiptap/pm/model';

// Metadata lives on native blocks: all standard editing/drag controls still work.
// 扩展给原生段落/标题附加 reportSection 属性，不新建“描述专用编辑器”。
// 语义标记仍供旧文档处理使用；当前光标插入引用不依赖这些标记来替换正文。
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
/**
 * 当前引用入口：输入 EditorState 与 {findings, impression}，返回未提交的事务。
 * 函数本身不改 Vue ref、不调 API、不 dispatch；调用者 BodyEditor 负责提交与聚焦。
 */
export function insertCitationTransaction(state,entry){
  // 描述在前、诊断在后；拆换行后生成行内 text/hardBreak，插到当前文本容器中。
  const lines=[entry.findings,entry.impression].filter(value=>String(value??'').trim()).flatMap(value=>String(value).split(/\r?\n/));
  const nodes=[];
  for(const [index,line] of lines.entries()){
    if(index)nodes.push(state.schema.nodes.hardBreak.create());
    if(line)nodes.push(state.schema.text(line));
  }
  // selection.to 是选区末端；from/to 相同代表纯插入，保留已经选中的原文字。
  // 文档位置有节点边界占位，不能把它当作 HTML 字符下标或屏幕坐标。
  const pos=state.selection.to;
  const tr=closeHistory(state.tr).replaceWith(pos,pos,Fragment.fromArray(nodes));
  // 使用事务修改后的 tr.doc 算新光标位置；旧 state.doc 此时还不包含刚插入的节点。
  tr.setSelection(TextSelection.create(tr.doc,pos+nodes.reduce((total,node)=>total+node.nodeSize,0)));
  return tr;
}
function sectionBlocks(kind,text){
  return [{type:'heading',attrs:{level:2,reportSection:kind},content:[{type:'text',text:names[kind][0]}]},
    ...String(text??'').split('\n').map(line=>({type:'paragraph',attrs:{reportSection:kind},...(line?{content:[{type:'text',text:line}]}:{})}))];
}
// 旧“按描述/诊断分区替换”的路径：保留兼容函数和测试，当前 BodyEditor 不调用它。
// 学习当前引用行为请追 insertCitationTransaction，不能仅凭下面函数名推断页面操作。
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
