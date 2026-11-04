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
export function nativeMenuItems(query,fields){
 const q=query.trim().toLowerCase();
 const tokens=fields.map(f=>({label:f.label,fieldId:f.id,action:'field',icon:'field'}));
 if(!q)return [...basics,{label:'业务字段',action:'fields',icon:'field',children:tokens}];
 return [...basics,...tokens].filter(x=>`${x.label} ${x.search??''} ${x.action==='field'?'field 字段':''}`.toLowerCase().includes(q));
}
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
function cursorAfterBoundary(tr,after){
 const next=tr.doc.resolve(after).nodeAfter;
 if(next?.type.name!=='paragraph')tr.insert(after,tr.doc.type.schema.nodes.paragraph.create());
 tr.setSelection(TextSelection.create(tr.doc,after+1)).scrollIntoView();
 return true;
}
function cursorAfterSelectedBlock(tr,type){
 const {$from}=tr.selection;
 let depth=$from.depth;
 while(depth>0&&$from.node(depth).type.name!==type)depth--;
 return depth?cursorAfterBoundary(tr,$from.after(depth)):true;
}
function cursorAfterLastInsertion(tr){
 let after;
 tr.steps.at(-1)?.getMap().forEach((_oldStart,_oldEnd,_newStart,newEnd)=>{after=newEnd});
 return after===undefined?false:cursorAfterBoundary(tr,after);
}
export function executeNativeInsert(editor,range,item,options={}){
 if(item.action==='keyImages'){
  if(!editor.isEditable)return false;
   const tr=insertKeyImagesTransaction(editor.state,range,item.imageIds??[]);
   if(!tr)return false;
   if(options.afterBlock)cursorAfterLastInsertion(tr);
   editor.view.dispatch(tr);
   editor.view.dispatch(closeHistory(editor.state.tr));
   editor.view.focus();
   options.onInserted?.();
   return true;
 }
 if(item.action==='customPictures'){editor.view.dom.dispatchEvent(new CustomEvent('report-custom-pictures',{bubbles:true,detail:{range}}));return true}
 const chain=editor.chain().focus();
 if(options.afterBlock)chain.command(({tr})=>{closeHistory(tr);return true});
 chain.deleteRange(range);
 if(item.action.startsWith('pictures-')){
   const emptyColumns=['pictures-2-2','pictures-2-3'].includes(item.action);
   const layout=imageLayout(item.rows,item.columns,{emptyColumns});
   chain.insertContent(options.afterBlock?layout:[...layout,{type:'paragraph'}]);
   if(options.afterBlock)chain.command(({tr})=>cursorAfterLastInsertion(tr));
   const result=chain.run();
   if(result)options.onInserted?.();
   return result;
 }
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
 case 'field':return chain.insertContent({type:'businessField',attrs:{fieldId:item.fieldId,label:item.label}}).run();
 }
 return false;
}
