// 【学习07】自定义图片块：Tiptap Node 定义结构，NodeView 提供编辑按钮，PM Plugin 接拖放。
// 对照指南第 7.6～7.7 节；编辑器内交互 DOM 与打印输出 DOM 分开定义。
import {Node,mergeAttributes} from '@tiptap/core';
import {closeHistory} from '@tiptap/pm/history';
import {Plugin} from '@tiptap/pm/state';
import {keyImage,IMAGE_DRAG_TYPE,readImageDrop} from '../key-images.mjs';

export function removeColumnImage(state,pos){
  // 只处理栏内图片。删最后一个子节点时补空 paragraph，保证 column 仍能合法编辑。
  // 返回 null 时交给调用者使用栏外/兼容处理；返回事务时仍需调用者 dispatch。
  const node=state.doc.nodeAt(pos),$pos=state.doc.resolve(pos);
  if(node?.type.name!=='reportImage'||$pos.parent.type.name!=='column')return null;
  const tr=closeHistory(state.tr);
  return $pos.parent.childCount===1
    ?tr.replaceWith(pos,pos+node.nodeSize,state.schema.nodes.paragraph.create())
    :tr.delete(pos,pos+node.nodeSize);
}

function columnDropRange(view,event){
  // DOM 告诉我们鼠标落在哪一栏；posAtDOM + resolve 再转为文档位置，才能改正文。
  const target=event.target,dom=target.closest?.('[data-type="column"]');
  if(!dom||!view.dom.contains(dom))return null;
  // 落在图片本身时交给其 NodeView 处理“替换”，不让栏插件重复插一张图。
  if(target.closest?.('[data-report-image]'))return null;
  const $inside=view.state.doc.resolve(view.posAtDOM(dom,0));
  let depth=$inside.depth;
  while(depth>0&&$inside.node(depth).type.name!=='column')depth--;
  if(!depth)return null;
  const column=$inside.node(depth),start=$inside.start(depth),child=column.firstChild;
  // 全空栏用图替换占位段落；已有文字则在最近块之后追加，保留现有内容。
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
  // ProseMirror Plugin.props.handleDOMEvents 拦截编辑视图原生事件。
  // 只认我们的自定义 MIME 类型，并校验是否可编辑及当前医院/病例，不接收任意文件上传。
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
      // getScope 在落下时读取最新上下文；解析或范围校验失败就不写入图节点。
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
  // 仅构造可插入的 JSON，不创建编辑器。每一行对应独立 columns，栏内必须有合法子块。
  if(!Number.isInteger(rows)||!Number.isInteger(columns)||rows<1||rows>3||columns<1||columns>4)throw Error('图片布局支持 1–3 行、1–4 列');
  return Array.from({length:rows},()=>({type:'columns',content:Array.from({length:columns},()=>({type:'column',content:[emptyColumns?{type:'paragraph'}:{type:'reportImage',attrs:{imageId:null,caption:''}}]}))}));
}
export const ReportImage=Node.create({
  // block：占一个内容块；atom：整体选择/移动，内部不是用户可输入的文本区域。
  name:'reportImage',group:'block',atom:true,draggable:true,selectable:true,
  // options 是运行时依赖（函数），不会存进 JSON；attrs 是节点数据，会随正文持久化。
  addOptions(){return {getScope:()=>null,getSelected:()=>null}},
  addProseMirrorPlugins(){return [imageColumnDropPlugin(this.options.getScope)]},
  addAttributes(){return {imageId:{default:null},caption:{default:''}}},
  // parseHTML：从标准 HTML 识别节点；renderHTML：给序列化/打印定义不带编辑按钮的输出。
  parseHTML(){return [{tag:'figure[data-report-image]',getAttrs:el=>({imageId:el.getAttribute('data-report-image')||null,caption:el.querySelector('figcaption')?.textContent??''})}]},
  renderHTML({node,HTMLAttributes}){
    const image=keyImage(node.attrs.imageId);
    return ['figure',mergeAttributes(HTMLAttributes,{'data-report-image':node.attrs.imageId??'',class:'report-image-slot'}),
      ...(image?[['img',{src:image.src,alt:node.attrs.caption||image.name,draggable:'false'}],['figcaption',{},node.attrs.caption||image.name]]:[['figcaption',{},'图片位置']])];
  },
  // NodeView 负责编辑器内部的交互视图；这里使用原生 DOM，没有 VueNodeViewRenderer。
  // 不要只改 img.src 来替图：JSON/撤销/打印依靠下方 setNodeMarkup 改真正的文档节点。
  addNodeView(){
    const options=this.options;
    return ({node,editor,getPos})=>{
      let current=node;
      const dom=document.createElement('figure');dom.className='report-image-slot';dom.contentEditable='false';
      // getPos() 现场取得当前节点位置；其他块插入/移动后，初始化时的位置可能早已过期。
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
      // DOM 是 current 文档节点的投影；只有可编辑模式才创建填图/移除按钮。
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
      // update 接收新节点后刷新；stopEvent 防止按钮/拖放同时触发编辑器默认行为。
      // ignoreMutation 表示此原子 NodeView 自己维护内部 DOM，不从其变化反推正文。
      return {dom,update(next){if(next.type!==current.type)return false;current=next;render();return true},stopEvent:event=>['drop','dragover','dragleave'].includes(event.type)||!!event.target.closest?.('button'),ignoreMutation:()=>true};
    };
  },
});
