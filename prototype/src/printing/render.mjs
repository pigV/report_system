import {DOMSerializer} from '@tiptap/pm/model';
import {bodySchema} from '../editor/body-schema.mjs';
import {fieldsFor,readPath,reportHospitalName} from '../report-model.mjs';
import {keyImage} from '../key-images.mjs';
import {preparePrintBody,paginate} from './paginate.mjs';

const serializer=DOMSerializer.fromSchema(bodySchema);
function element(doc,tag,className,text){const el=doc.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el}
export function renderFields(doc,template,data,region){
  const grid=template[region].content[0],wrapper=element(doc,'div','print-fields');
  wrapper.style.gridTemplateColumns=grid.attrs.columnWidths.map(w=>`${w}fr`).join(' ');
  if(grid.attrs.borders)wrapper.classList.add('print-fields-bordered');
  for(const field of fieldsFor(template[region])){
    const attrs=field.attrs,cell=element(doc,'div','print-field'),path=template.bindings?.[attrs.fieldId];
    cell.style.gridColumn=`span ${attrs.span}`;cell.style.textAlign=attrs.textAlign;cell.style.fontWeight=attrs.bold?'700':'400';
    cell.append(element(doc,'span','print-field-label',attrs.label),element(doc,'span','print-field-value',path?String(readPath(data,path)):'未绑定'));wrapper.append(cell);
  }
  return wrapper;
}
export function renderHeader(doc,{template,data}){
  const header=element(doc,'header','print-header'),name=reportHospitalName(template);
  if(name)header.append(element(doc,'h1','',name));
  header.append(element(doc,'h2','',template.title),renderFields(doc,template,data,'header'));
  return header;
}
export function renderSignature(doc,{template,data}){
  const footer=element(doc,'footer','print-signature');footer.append(renderFields(doc,template,data,'footer'));return footer;
}
export function renderBlocks(doc,blocks,snapshot){
  const fragment=doc.createDocumentFragment();
  for(const block of blocks){
    if(block.type==='printSignature'){fragment.append(renderSignature(doc,snapshot));continue}
    const node=bodySchema.nodeFromJSON(block);
    fragment.append(serializer.serializeNode(node,{document:doc}));
  }
  // Column styles and image size are defined by print CSS, never by editor UI.
  for(const figure of fragment.querySelectorAll('[data-report-image]')){
    if(!keyImage(figure.getAttribute('data-report-image')))throw Error('报告中有无法加载的影像，请返回编辑器重新选择');
  }
  return fragment;
}
export async function waitForPrintResources(root,signal){
  const aborted=()=>{if(signal?.aborted)throw new DOMException('打印预览已关闭','AbortError')};
  aborted();
  const bounded=async promise=>{
    let timer,onAbort;
    try{return await Promise.race([promise,new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(Error('字体或影像加载超时，请稍后重试')),15000);
      onAbort=()=>reject(new DOMException('打印预览已关闭','AbortError'));signal?.addEventListener('abort',onAbort,{once:true});
    })])}finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort)}
  };
  await bounded(root.ownerDocument.fonts?.ready??Promise.resolve());aborted();
  await bounded(Promise.all([...root.querySelectorAll('img')].map(async image=>{
    try{await image.decode();if(!image.naturalWidth)throw Error()}catch{throw Error('影像加载失败，请返回报告检查图片后重试')}
  })));
  aborted();
}
export async function buildPrintPages(stage,snapshot,signal){
  const doc=stage.ownerDocument,body=preparePrintBody(snapshot.body);
  const sheet=element(doc,'article','report-print-page');
  const header=renderHeader(doc,snapshot),content=element(doc,'main','print-body'),number=element(doc,'div','print-page-number','第 1 页 / 共 1 页');
  sheet.append(header,content,number);stage.replaceChildren(sheet);
  const blocks=[...body,...(fieldsFor(snapshot.template.footer).length?[{type:'printSignature'}]:[])];
  content.append(renderBlocks(doc,blocks,snapshot));
  await waitForPrintResources(stage,signal);
  const top=content.getBoundingClientRect().top,bottom=number.getBoundingClientRect().top-12;
  const capacity=bottom-top;
  if(capacity<60)throw Error('表头过高，A4 页面没有足够的正文空间，请减少表头字段或文字');
  sheet.style.setProperty('--print-image-max-height',`${Math.min(260,capacity-40)}px`);
  const fits=nodes=>{
    if(signal?.aborted)throw new DOMException('打印预览已关闭','AbortError');
    content.replaceChildren(renderBlocks(doc,nodes,snapshot));
    return content.getBoundingClientRect().height<=capacity-2&&content.scrollWidth<=content.clientWidth+1;
  };
  const pages=paginate(blocks,fits);
  return pages.map((page,index)=>{
    const result=element(doc,'article','report-print-page');result.style.setProperty('--print-image-max-height',sheet.style.getPropertyValue('--print-image-max-height'));
    result.setAttribute('aria-label',`第 ${index+1} 页，共 ${pages.length} 页`);
    const main=element(doc,'main','print-body');main.append(renderBlocks(doc,page,snapshot));
    result.append(renderHeader(doc,snapshot),main,element(doc,'div','print-page-number',`第 ${index+1} 页 / 共 ${pages.length} 页`));return result;
  });
}
