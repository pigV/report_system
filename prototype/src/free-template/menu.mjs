import {imageLayout} from '../editor/report-images.mjs';
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
 const items=[...nativeMenuItems('',[]).filter(item=>item.action!=='fields'),
   {label:'三级标题',action:'h3',icon:'heading'},
   {label:'引用',action:'blockquote',icon:'text'},
   ...[[1,2,'二张图片'],[1,3,'三张图片'],[2,2,'四张图片'],[2,3,'六张图片']].map(([rows,columns,label])=>({label,action:`pictures-${rows}-${columns}`,rows,columns,icon:'columns'})),
   {label:'自定义图片栏',action:'customPictures',icon:'columns'},
 ];
 const q=query.trim().toLowerCase();return items.filter(item=>`${item.label} ${item.search??''} ${item.action}`.toLowerCase().includes(q));
}
export function executeNativeInsert(editor,range,item){
 if(item.action==='customPictures'){editor.view.dom.dispatchEvent(new CustomEvent('report-custom-pictures',{bubbles:true,detail:{range}}));return true}
 const chain=editor.chain().focus().deleteRange(range);
 if(item.action.startsWith('pictures-'))return chain.insertContent([...imageLayout(item.rows,item.columns),{type:'paragraph'}]).run();
 switch(item.action){
 case 'paragraph':return chain.setParagraph().run();
 case 'h1':return chain.setHeading({level:1}).run();
 case 'h2':return chain.setHeading({level:2}).run();
 case 'h3':return chain.setHeading({level:3}).run();
 case 'blockquote':return chain.toggleBlockquote().run();
 case 'table':return chain.insertTable({rows:2,cols:3,withHeaderRow:false}).run();
 case 'columns':return chain.insertMultiColumn(item.columns).run();
 case 'rule':return chain.setHorizontalRule().run();
 case 'bulletList':return chain.toggleBulletList().run();
 case 'orderedList':return chain.toggleOrderedList().run();
 case 'field':return chain.insertContent({type:'businessField',attrs:{fieldId:item.fieldId,label:item.label}}).run();
 }
 return false;
}
