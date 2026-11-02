import { ref, onBeforeUnmount } from 'vue';
import { reorderBlock } from '../free-template/block-drag.mjs';

// Both document editors use Yiitap's handle and the same atomic drop transaction.
export function useBlockDrag(editor, isDisabled) {
const dropLine=ref(null);
let stopDrag=()=>{}, suppressClick=false;
function blocks(){const ed=editor.value,result=[];ed.state.doc.forEach((node,pos)=>{const dom=ed.view.nodeDOM(pos);if(dom?.getBoundingClientRect)result.push({pos,node,rect:dom.getBoundingClientRect()})});return result}
function startDrag(event){
  const handle=event.target.closest?.('.o-drag-btn');
  if(!handle||event.button!==0||isDisabled()||!editor.value||editor.value.isDestroyed||!editor.value.isEditable)return;
  stopDrag();
  const ed=editor.value,handleRect=handle.getBoundingClientRect(),y=handleRect.top+handleRect.height/2;
  const items=blocks();
  const source=items.find(item=>y>=item.rect.top&&y<=item.rect.bottom)??items.sort((a,b)=>Math.abs((a.rect.top+a.rect.bottom)/2-y)-Math.abs((b.rect.top+b.rect.bottom)/2-y))[0];
  if(!source)return;
  // Yiitap's floating handle can lose its HTML drag target on pointer-down in WebKit.
  // Keep its handle/menu, and commit the drop through the same ProseMirror document.
  event.preventDefault();
  const start={x:event.clientX,y:event.clientY};let moved=false,boundary=source.pos;
  const doc=event.target.ownerDocument;
  const move=e=>{
    if(!moved&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<5)return;
    moved=true;e.preventDefault();
    const items=blocks(),next=items.find(item=>e.clientY<(item.rect.top+item.rect.bottom)/2);
    boundary=next?.pos??ed.state.doc.content.size;
    const rect=ed.view.dom.getBoundingClientRect();
    dropLine.value={left:rect.left+30,top:next?next.rect.top:items.at(-1).rect.bottom,width:rect.width-60};
  };
  const end=e=>{const rect=ed.view.dom.getBoundingClientRect();stopDrag();if(moved){suppressClick=true;setTimeout(()=>{suppressClick=false},0);if(!isDisabled()&&!ed.isDestroyed&&ed.isEditable&&e.clientX>=rect.left-60&&e.clientX<=rect.right+30&&e.clientY>=rect.top&&e.clientY<=rect.bottom){const tr=reorderBlock(ed.state,source.pos,boundary);if(tr)ed.view.dispatch(tr)}ed.commands.focus()}};
  const cancel=()=>{stopDrag();suppressClick=false};
  const key=e=>{if(e.key==='Escape'){e.preventDefault();cancel()}};
  stopDrag=()=>{doc.removeEventListener('mousemove',move);doc.removeEventListener('mouseup',end);doc.removeEventListener('keydown',key,true);doc.defaultView.removeEventListener('blur',cancel);dropLine.value=null};
  doc.addEventListener('mousemove',move);doc.addEventListener('mouseup',end,{once:true});doc.addEventListener('keydown',key,true);doc.defaultView.addEventListener('blur',cancel);
}
function handleClick(event){if(suppressClick){event.preventDefault();event.stopPropagation();suppressClick=false}}
onBeforeUnmount(()=>stopDrag());
return {dropLine,startDrag,handleClick};
}
