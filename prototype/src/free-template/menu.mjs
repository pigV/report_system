// 【学习05】菜单分两部分：候选数据（显示什么），executeNativeInsert（真正怎么改文档）。
// 普通操作用 Tiptap 命令链；精确定位/多图插入进入 ProseMirror 事务。对照指南第 7 节。
import {imageLayout} from '../editor/report-images.mjs';
import {insertKeyImagesTransaction} from '../editor/key-image-insert.mjs';
import {closeHistory} from '@tiptap/pm/history';
import {TextSelection} from '@tiptap/pm/state';
const basics=[
 {label:'文本',action:'paragraph',icon:'text',search:'text paragraph 文本 段落'},
 {label:'一级标题',action:'h1',icon:'heading',search:'h1 heading 标题'},
 {label:'二级标题',action:'h2',icon:'heading',search:'h2 heading 标题'},
 {label:'表格',action:'table',icon:'table',search:'table 表格'},
 {label:'分栏',action:'columns',icon:'columns',search:'column 分栏 布局'},
 {label:'分割线',action:'rule',icon:'rule',search:'line 分割线'},
 {label:'无序列表',action:'bulletList',icon:'list',search:'list 列表'},
 {label:'有序列表',action:'orderedList',icon:'list',search:'list 列表'},
];
// 独立自由模板可插业务字段；正文使用下方 bodyMenuItems，不复用这份字段候选。
export function nativeMenuItems(query,fields){
 const q=query.trim().toLowerCase();
 const tokens=fields.map(f=>({label:f.label,fieldId:f.id,action:'field',icon:'field'}));
 if(!q)return [...basics,{label:'业务字段',action:'fields',icon:'field',children:tokens}];
 return [...basics,...tokens].filter(x=>`${x.label} ${x.search??''} ${x.action==='field'?'field 字段':''}`.toLowerCase().includes(q));
}
// 这里只返回普通 JS 对象，还没调用编辑器；action 是执行器识别的标识，label 用于展示。
export function bodyMenuItems(query){
 const items=[...basics.slice(0,5),
   {label:'关键影像',action:'keyImages',icon:'image',search:'key image 关键影像 图片',group:'自定义块'},
   ...basics.slice(5).map((item,i)=>({...item,...(i===0?{group:'更多内容'}:{})})),
   {label:'三级标题',action:'h3',icon:'heading'},
   {label:'引用',action:'blockquote',icon:'text'},
   ...[[1,2,'二张图片'],[1,3,'三张图片'],[2,2,'四张图片'],[2,3,'六张图片']].map(([rows,columns,label])=>({label,action:`pictures-${rows}-${columns}`,rows,columns,icon:'columns'})),
   {label:'自定义图片栏',action:'customPictures',icon:'columns'},
 ];
 const q=query.trim().toLowerCase();return items.filter(item=>`${item.label} ${item.search??''} ${item.action}`.toLowerCase().includes(q));
}
// 【学习08】after 是整个块结束后的文档位置；若下一块不是段落，先补一个可输入的段落。
// +1 是从段落边界进入段落内部，而不是“鼠标往下一个像素”。tr.doc 是修改后的文档。
function cursorAfterBoundary(tr,after){
 const next=tr.doc.resolve(after).nodeAfter;
 if(next?.type.name!=='paragraph')tr.insert(after,tr.doc.type.schema.nodes.paragraph.create());
 tr.setSelection(TextSelection.create(tr.doc,after+1)).scrollIntoView();
 return true;
}
// 从解析位置 $from 沿父节点向上找目标块，避免把“栏内段落后面”误当成“整组分栏后面”。
function cursorAfterSelectedBlock(tr,type){
 const {$from}=tr.selection;
 let depth=$from.depth;
 while(depth>0&&$from.node(depth).type.name!==type)depth--;
 return depth?cursorAfterBoundary(tr,$from.after(depth)):true;
}
// 一次插入可能新增两行图片栏；读最后一步的 StepMap，找到最后插入内容的结束位置。
// 不能继续沿用插入前的光标位置，因为文档长度和节点边界已经变化。
function cursorAfterLastInsertion(tr){
 let after;
 tr.steps.at(-1)?.getMap().forEach((_oldStart,_oldEnd,_newStart,newEnd)=>{after=newEnd});
 return after===undefined?false:cursorAfterBoundary(tr,after);
}
/**
 * editor：YiiEditor 暴露的 Tiptap 实例；range：本次 slash 命令的文档范围。
 * item：菜单项；options.afterBlock：是否把光标放到完整新块之后。
 * 返回是否执行成功（自定义弹窗分支表示已发出打开请求），不负责持久化报告。
 */
export function executeNativeInsert(editor,range,item,options={}){
 if(item.action==='keyImages'){
  if(!editor.isEditable)return false;
   // 图片插入需要精确的栏内/栏外结构，因此直接构建 ProseMirror 事务。
    const tr=insertKeyImagesTransaction(editor.state,range,item.imageIds??[],{joinHistory:options.joinHistory});
   if(!tr)return false;
   if(options.afterBlock)cursorAfterLastInsertion(tr);
   editor.view.dispatch(tr);
   editor.view.dispatch(closeHistory(editor.state.tr));
   editor.view.focus();
   options.onInserted?.();
   return true;
 }
 // 原生 CustomEvent 向外冒泡到 BodyEditor；不是 Vue emit，也不是直接插入文档。
 // 用户在弹窗确认行列数后，才带原 range 回到 pictures-custom 分支执行插入。
 if(item.action==='customPictures'){editor.view.dom.dispatchEvent(new CustomEvent('report-custom-pictures',{bubbles:true,detail:{range}}));return true}
 // Tiptap chain 把一组命令加入同一条事务；run 才执行。focus 把输入焦点还给正文。
 const chain=editor.chain().focus();
  if(options.afterBlock&&!options.joinHistory)chain.command(({tr})=>{closeHistory(tr);return true});
 // 去掉 slash 触发文本；这与侧栏引用保留文字选区的插入路径不同。
 chain.deleteRange(range);
 if(item.action.startsWith('pictures-')){
   // 四张/六张预设建空段落栏；其他图片预设保留可填图的位置，勿与多选现有影像混淆。
   const emptyColumns=['pictures-2-2','pictures-2-3'].includes(item.action);
   const layout=imageLayout(item.rows,item.columns,{emptyColumns});
   chain.insertContent(options.afterBlock?layout:[...layout,{type:'paragraph'}]);
   if(options.afterBlock)chain.command(({tr})=>cursorAfterLastInsertion(tr));
   const result=chain.run();
   if(result)options.onInserted?.();
   return result;
 }
 // 多个标准动作共用收尾：可选的光标定位 → 执行命令链 → 通知 BodyEditor 已有插入位置。
 const finish=type=>{
  if(options.afterBlock&&type)chain.command(({tr})=>cursorAfterSelectedBlock(tr,type));
  const result=chain.run();
  if(result)options.onInserted?.();
  return result;
 };
 switch(item.action){
 case 'paragraph':if(options.afterBlock)chain.command(({commands})=>{commands.setParagraph();return true});else chain.setParagraph();return finish('paragraph');
 case 'h1':chain.setHeading({level:1});return finish('heading');
 case 'h2':chain.setHeading({level:2});return finish('heading');
 case 'h3':chain.setHeading({level:3});return finish('heading');
 case 'blockquote':chain.toggleBlockquote();return finish('blockquote');
 case 'table':chain.insertTable({rows:2,cols:3,withHeaderRow:false});return finish('table');
 // insertMultiColumn 是 Yiitap 扩展注册到 Tiptap 命令系统的能力，不是 Tiptap 核心自带。
 // command 回调收到链正在构建的 tr；在同一事务里加段落和定位，避免另开一次文档修改。
 case 'columns':chain.insertMultiColumn(item.columns).command(({tr})=>{
  const {$from}=tr.selection;
  let depth=$from.depth;
  while(depth>0&&$from.node(depth).type.name!=='columns')depth--;
  if(!depth)return false;
  const after=$from.after(depth),next=tr.doc.resolve(after).nodeAfter;
  if(options.afterBlock)return cursorAfterBoundary(tr,after);
  if(!next?.isTextblock)tr.insert(after,tr.doc.type.schema.nodes.paragraph.create());
  tr.setSelection(TextSelection.create(tr.doc,after+1)).scrollIntoView();
  return true;
 });return finish();
 case 'rule':chain.setHorizontalRule();if(options.afterBlock)chain.command(({tr})=>{
  const {$from}=tr.selection;
  const after=$from.parent.isTextblock?$from.before():$from.pos+($from.nodeAfter?.type.name==='horizontalRule'?$from.nodeAfter.nodeSize:0);
  return cursorAfterBoundary(tr,after);
 });return finish();
 case 'bulletList':chain.toggleBulletList();return finish('bulletList');
 case 'orderedList':chain.toggleOrderedList();return finish('orderedList');
 // 共享执行器保留自由模板字段插入；报告正文菜单不会生成 action:'field' 候选项。
 case 'field':return chain.insertContent({type:'businessField',attrs:{fieldId:item.fieldId,label:item.label}}).run();
 }
 return false;
}
