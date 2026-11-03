import {Node,mergeAttributes} from '@tiptap/core';
import {closeHistory} from '@tiptap/pm/history';
import {keyImage,IMAGE_DRAG_TYPE,readImageDrop} from '../key-images.mjs';

export function imageLayout(rows,columns){
  if(!Number.isInteger(rows)||!Number.isInteger(columns)||rows<1||rows>3||columns<1||columns>4)throw Error('图片布局支持 1–3 行、1–4 列');
  return Array.from({length:rows},()=>({type:'columns',content:Array.from({length:columns},()=>({type:'column',content:[{type:'reportImage',attrs:{imageId:null,caption:''}}]}))}));
}
export const ReportImage=Node.create({
  name:'reportImage',group:'block',atom:true,draggable:true,selectable:true,
  addOptions(){return {getScope:()=>null,getSelected:()=>null}},
  addAttributes(){return {imageId:{default:null},caption:{default:''}}},
  parseHTML(){return [{tag:'figure[data-report-image]',getAttrs:el=>({imageId:el.getAttribute('data-report-image')||null,caption:el.querySelector('figcaption')?.textContent??''})}]},
  renderHTML({node,HTMLAttributes}){
    const image=keyImage(node.attrs.imageId);
    return ['figure',mergeAttributes(HTMLAttributes,{'data-report-image':node.attrs.imageId??'',class:'report-image-slot'}),
      ...(image?[['img',{src:image.src,alt:node.attrs.caption||image.name,draggable:'false'}],['figcaption',{},node.attrs.caption||image.name]]:[['figcaption',{},'图片位置']])];
  },
  addNodeView(){
    const options=this.options;
    return ({node,editor,getPos})=>{
      let current=node;
      const dom=document.createElement('figure');dom.className='report-image-slot';dom.contentEditable='false';
      const change=attrs=>{
        if(!editor.isEditable)return;
        const pos=getPos();if(typeof pos!=='number')return;
        editor.view.dispatch(closeHistory(editor.state.tr).setNodeMarkup(pos,undefined,attrs));
        editor.view.dispatch(closeHistory(editor.state.tr));
      };
      const place=image=>{if(image)change({imageId:image.id,caption:image.name+' · 模拟影像'})};
      const render=()=>{
        dom.replaceChildren();dom.dataset.reportImage=current.attrs.imageId??'';
        const image=keyImage(current.attrs.imageId);
        if(image){const img=document.createElement('img');img.src=image.src;img.alt=current.attrs.caption||image.name;img.draggable=false;dom.append(img)}
        const caption=document.createElement('figcaption');caption.textContent=image?(current.attrs.caption||image.name):'拖入关键影像';dom.append(caption);
        if(editor.isEditable){
          const target=document.createElement('button');target.type='button';target.className='image-slot-target';
          target.textContent=image?'替换影像':'＋ 选择右侧影像后点击此处';target.setAttribute('aria-label',image?'替换此栏影像':'填入此栏影像');
          target.addEventListener('click',()=>{const selected=options.getSelected();if(selected)place(keyImage(selected));else{caption.textContent='请先在右侧选择一张关键影像';}});dom.append(target);
          if(image){const remove=document.createElement('button');remove.type='button';remove.className='image-slot-remove';remove.textContent='×';remove.setAttribute('aria-label','移除此栏影像');remove.addEventListener('click',()=>change({imageId:null,caption:''}));dom.append(remove)}
        }
      };
      dom.addEventListener('dragover',event=>{if(editor.isEditable&&Array.from(event.dataTransfer?.types??[]).includes(IMAGE_DRAG_TYPE)){event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='copy';dom.classList.add('drag-over')}});
      dom.addEventListener('dragleave',()=>dom.classList.remove('drag-over'));
      dom.addEventListener('drop',event=>{
        dom.classList.remove('drag-over');
        if(!Array.from(event.dataTransfer?.types??[]).includes(IMAGE_DRAG_TYPE))return;
        event.preventDefault();event.stopPropagation();if(!editor.isEditable)return;
        place(readImageDrop(event.dataTransfer.getData(IMAGE_DRAG_TYPE),options.getScope()));
      });
      render();
      return {dom,update(next){if(next.type!==current.type)return false;current=next;render();return true},stopEvent:event=>['drop','dragover','dragleave'].includes(event.type)||!!event.target.closest?.('button'),ignoreMutation:()=>true};
    };
  },
});
