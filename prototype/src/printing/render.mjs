// 【学习10】打印的浏览器渲染/测量层；Vue 弹层负责调用，paginate.mjs 只做拆分决策。
// DOMSerializer 是 ProseMirror 模型 API；不是给编辑器截图，也不复制 NodeView 中的按钮。
import {DOMSerializer} from '@tiptap/pm/model';
import {bodySchema} from '../editor/body-schema.mjs';
import {fieldsFor,readPath,reportHospitalName} from '../report-model.mjs';
import {keyImage} from '../key-images.mjs';
import {demoReportTitle,demoReportSubtitle,demoLogo,demoSignature,demoReportFields,demoReportTime} from '../demo-report.mjs';
import {preparePrintBody,paginate} from './paginate.mjs';

// 由共享 schema 知道每种节点怎样输出 DOM（例如 ReportImage.renderHTML）。
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
export function renderHeader(doc,{template,data,demo}){
  // demo 使用演示专用字段/抬头；非 demo 才根据模板绑定生成字段，保持与屏幕展示一致。
  const header=element(doc,'header','print-header'),name=reportHospitalName(template);
  if(demo){
    header.classList.add('demo-print-header');
    const heading=element(doc,'div','demo-print-heading'),logo=element(doc,'span','demo-logo'),image=element(doc,'img');
    image.src=demoLogo;image.alt='沈阳壹家宠物医院标志';logo.append(image);
    heading.append(logo,element(doc,'h1','',demoReportTitle),element(doc,'h2','',demoReportSubtitle));
    const fields=element(doc,'div','print-fields demo-print-fields');
    for(const field of demoReportFields(data)){
      const cell=element(doc,'div','print-field'+(field.wide?' demo-field-wide':''));
      cell.append(element(doc,'span','print-field-label',field.label+'：'),element(doc,'span','print-field-value',String(field.value)));
      fields.append(cell);
    }
    header.append(heading,fields);return header;
  }
  if(name)header.append(element(doc,'h1','',name));
  header.append(element(doc,'h2','',template.title),renderFields(doc,template,data,'header'));
  return header;
}
export function renderSignature(doc,{template,data,demo}){
  const footer=element(doc,'footer','print-signature');
  if(demo){
    footer.classList.add('demo-print-footer');
    const signature=element(doc,'div','demo-signature'),image=element(doc,'img');
    image.src=demoSignature;image.alt='模拟报告医生签名';
    signature.append(element(doc,'span','','报告医生：'),image);
    const meta=element(doc,'div','demo-footer-meta');
    meta.append(element(doc,'span','','注：本报告仅供临床医生参考。'),element(doc,'span','',`报告时间：${demoReportTime(data)}`));
    footer.append(signature,meta);
  }else footer.append(renderFields(doc,template,data,'footer'));
  return footer;
}
export function renderBlocks(doc,blocks,snapshot){
  // printSignature 是分页阶段附加的输出占位块，不是正文 schema 内可编辑的节点。
  // 其他块先从 JSON 还原为节点，再按 schema 序列化，图片编辑按钮自然不会被输出。
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
  // 字体和影像加载完成后才能测量分页；失败或取消时不能提供不完整的打印稿。
  const aborted=()=>{if(signal?.aborted)throw new DOMException('打印预览已关闭','AbortError')};
  aborted();
  // Promise.race 在资源完成、超时、取消之间取最早结果；finally 无论成败都移除定时器/监听。
  const bounded=async promise=>{
    let timer,onAbort;
    try{return await Promise.race([promise,new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(Error('字体或影像加载超时，请稍后重试')),15000);
      onAbort=()=>reject(new DOMException('打印预览已关闭','AbortError'));signal?.addEventListener('abort',onAbort,{once:true});
    })])}finally{clearTimeout(timer);signal?.removeEventListener('abort',onAbort)}
  };
  // 字体未就绪时换字体会改变行高；图片 decode 完才有可靠尺寸，否则测量出的页数不可信。
  await bounded(root.ownerDocument.fonts?.ready??Promise.resolve());aborted();
  await bounded(Promise.all([...root.querySelectorAll('img')].map(async image=>{
    try{await image.decode();if(!image.naturalWidth)throw Error()}catch{throw Error('影像加载失败，请返回报告检查图片后重试')}
  })));
  aborted();
}
export async function buildPrintPages(stage,snapshot,signal){
  // 先创建一张离屏 A4 测量纸，放入正文和签名；只处理打印副本，不回写编辑器。
  const doc=stage.ownerDocument,body=preparePrintBody(snapshot.body);
  const sheet=element(doc,'article','report-print-page');
  const header=renderHeader(doc,snapshot),content=element(doc,'main','print-body'),number=element(doc,'div','print-page-number','第 1 页 / 共 1 页');
  sheet.append(header,content,number);stage.replaceChildren(sheet);
  // 签名先作为最后一块参与高度预算，输出时再移到末页底部，避免与正文重叠。
  const blocks=[...body,...(snapshot.demo||fieldsFor(snapshot.template.footer).length?[{type:'printSignature'}]:[])];
  content.append(renderBlocks(doc,blocks,snapshot));
  await waitForPrintResources(stage,signal);
  // The flow footer reserves exactly the space used by the anchored output footer.
  const top=content.getBoundingClientRect().top;
  const bottom=sheet.getBoundingClientRect().bottom-parseFloat(doc.defaultView.getComputedStyle(sheet).paddingBottom);
  const firstCapacity=bottom-top;
  if(firstCapacity<60)throw Error('表头过高，A4 页面没有足够的正文空间，请减少表头字段或文字');
  // 表头只出现在首页，移除测量用表头后可算出续页能使用的额外空间。
  header.remove();
  const continuationCapacity=bottom-content.getBoundingClientRect().top;
  sheet.style.setProperty('--print-image-max-height',`${Math.min(260,firstCapacity-40)}px`);
  // fits 是给纯分页算法的“测量回调”：把候选节点真实排出来，同时检查高度和横向溢出。
  // pageIndex=0 有表头，其余页容量更大；小余量用于容忍浏览器小数像素误差。
  const fits=(nodes,pageIndex)=>{
    if(signal?.aborted)throw new DOMException('打印预览已关闭','AbortError');
    content.replaceChildren(renderBlocks(doc,nodes,snapshot));
    return content.getBoundingClientRect().height<=(pageIndex===0?firstCapacity:continuationCapacity)-2&&content.scrollWidth<=content.clientWidth+1;
  };
  // pages 是每页的节点数组；下面生成最终 DOM，预览和系统打印共用它，而非各算一次。
  const pages=paginate(blocks,fits);
  return pages.map((page,index)=>{
    const result=element(doc,'article','report-print-page');result.style.setProperty('--print-image-max-height',sheet.style.getPropertyValue('--print-image-max-height'));
    result.setAttribute('aria-label',`第 ${index+1} 页，共 ${pages.length} 页`);
    const main=element(doc,'main','print-body');main.append(renderBlocks(doc,page,snapshot));
    const footer=main.querySelector(':scope > .print-signature');
    // 表头只在首页；签名已经被分页到末页，移出正文流后由 print.css 贴底放置。
    if(index===0)result.append(renderHeader(doc,snapshot));
    result.append(main);
    if(footer)result.append(footer);
    result.append(element(doc,'div','print-page-number',`第 ${index+1} 页 / 共 ${pages.length} 页`));return result;
  });
}
