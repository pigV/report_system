import {Node,mergeAttributes} from '@tiptap/core';
import {closeHistory} from '@tiptap/pm/history';
import {Plugin} from '@tiptap/pm/state';
import {keyImage,IMAGE_DRAG_TYPE,readImageDrop} from '../key-images.mjs';

export function removeColumnImage(state,pos){
  const node=state.doc.nodeAt(pos),$pos=state.doc.resolve(pos);
  if(node?.type.name!=='reportImage'||$pos.parent.type.name!=='column')return null;
  const tr=closeHistory(state.tr);
  return $pos.parent.childCount===1
    ?tr.replaceWith(pos,pos+node.nodeSize,state.schema.nodes.paragraph.create())
    :tr.delete(pos,pos+node.nodeSize);
}

function columnDropRange(view,event){
  const target=event.target,dom=target.closest?.('[data-type="column"]');
  if(!dom||!view.dom.contains(dom))return null;
  if(target.closest?.('[data-report-image]'))return null;
  const $inside=view.state.doc.resolve(view.posAtDOM(dom,0));
  let depth=$inside.depth;
  while(depth>0&&$inside.node(depth).type.name!=='column')depth--;
  if(!depth)return null;
  const column=$inside.node(depth),start=$inside.start(depth),child=column.firstChild;
  if(column.childCount===1&&child.type.name==='paragraph'&&child.content.size===0)
    return {from:start,to:start+child.nodeSize};
  let nearest=null;
  column.forEach((node,offset)=>{
    const block=view.nodeDOM(start+offset),rect=block?.getBoundingClientRect?.();
    if(!rect)return;
    const distance=block===target||block.contains(target)?-1:Math.max(rect.top-event.clientY,0,event.clientY-rect.bottom);
    if(!nearest||distance<nearest.distance)nearest={distance,pos:start+offset+node.nodeSize};
  });
  const pos=nearest?.pos??start+column.content.size;
  return {from:pos,to:pos};
}

export function imageColumnDropPlugin(getScope){
  return new Plugin({props:{handleDOMEvents:{
    dragover(view,event){
      if(!view.editable||!Array.from(event.dataTransfer?.types??[]).includes(IMAGE_DRAG_TYPE)||!columnDropRange(view,event))return false;
      event.preventDefault();event.dataTransfer.dropEffect='copy';return true;
    },
    drop(view,event){
      if(!view.editable||!Array.from(event.dataTransfer?.types??[]).includes(IMAGE_DRAG_TYPE))return false;
      const target=columnDropRange(view,event);
      if(!target)return false;
      event.preventDefault();
      const image=readImageDrop(event.dataTransfer.getData(IMAGE_DRAG_TYPE),getScope());
      if(image){
        const node=view.state.schema.nodes.reportImage.create({imageId:image.id,caption:image.name+' · 模拟影像'});
        view.dispatch(closeHistory(view.state.tr).replaceWith(target.from,target.to,node));
        view.dispatch(closeHistory(view.state.tr));
      }
      return true;
    },
  }}});
}

export function imageLayout(rows,columns,{emptyColumns=false}={}){
  if(!Number.isInteger(rows)||!Number.isInteger(columns)||rows<1||rows>3||columns<1||columns>4)throw Error('图片布局支持 1–3 行、1–4 列');
  return Array.from({length:rows},()=>({type:'columns',content:Array.from({length:columns},()=>({type:'column',content:[emptyColumns?{type:'paragraph'}:{type:'reportImage',attrs:{imageId:null,caption:''}}]}))}));
}
export const ReportImage=Node.create({
  name:'reportImage',group:'block',atom:true,draggable:true,selectable:true,
  addOptions(){return {getScope:()=>null,getSelected:()=>null}},
  addProseMirrorPlugins(){return [imageColumnDropPlugin(this.options.getScope)]},
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
      const removeImage=()=>{
        if(!editor.isEditable)return;
        const pos=getPos();if(typeof pos!=='number')return;
        const tr=removeColumnImage(editor.state,pos);
        if(!tr){change({imageId:null,caption:''});return}
        editor.view.dispatch(tr);
        editor.view.dispatch(closeHistory(editor.state.tr));
      };
      const render=()=>{
        dom.replaceChildren();dom.dataset.reportImage=current.attrs.imageId??'';
        const image=keyImage(current.attrs.imageId);
        if(image){const img=document.createElement('img');img.src=image.src;img.alt=current.attrs.caption||image.name;img.draggable=false;dom.append(img)}
        const caption=document.createElement('figcaption');caption.textContent=image?(current.attrs.caption||image.name):'拖入关键影像';dom.append(caption);
        if(editor.isEditable){
          const target=document.createElement('button');target.type='button';target.className='image-slot-target';
          // target.textContent=image?'替换影像':'＋ 选择右侧影像后点击此处';target.setAttribute('aria-label',image?'替换此栏影像':'填入此栏影像');
          target.addEventListener('click',()=>{const selected=options.getSelected();if(selected)place(keyImage(selected));else{caption.textContent='请先在右侧选择一张关键影像';}});dom.append(target);
          if(image){const remove=document.createElement('button');remove.type='button';remove.className='image-slot-remove';remove.textContent='×';remove.setAttribute('aria-label','移除此栏影像');remove.addEventListener('click',removeImage);dom.append(remove)}
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
