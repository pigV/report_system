import { VueRenderer } from '@tiptap/vue-3';
import SlashMenu from './SlashMenu.vue';
import { nativeMenuItems, executeNativeInsert } from './menu.mjs';
// Yiitap's OSlash/OSlashZh remain responsible for trigger/range lifecycle.
// A product renderer is required because the stock renderer treats every
// business label as an internal i18n key and cannot display arbitrary names.
export function businessSuggestion(getFields){
 return {items:({query})=>nativeMenuItems(query,getFields()),render:()=>{
   let component,host,latest,observer;
   const position=()=>{const rect=latest?.clientRect?.();if(!rect||!host)return;const width=270,height=Math.min(host.offsetHeight,390);host.style.left=`${Math.max(8,Math.min(rect.left,window.innerWidth-width-8))}px`;host.style.top=`${rect.bottom+height+8<window.innerHeight?rect.bottom+6:Math.max(8,rect.top-height-6)}px`};
   const destroy=()=>{observer?.disconnect();window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);component?.destroy();host?.remove();component=null;host=null};
   const properties=p=>({...p,onPick:item=>executeNativeInsert(p.editor,p.range,item)});
   return {
    onStart(p){latest=p;component=new VueRenderer(SlashMenu,{props:properties(p),editor:p.editor});host=document.createElement('div');host.className='native-slash-host';host.style.position='fixed';host.style.zIndex='80';host.appendChild(component.element);document.body.appendChild(host);observer=new ResizeObserver(position);observer.observe(host);position();window.addEventListener('resize',position);window.addEventListener('scroll',position,true)},
    onUpdate(p){latest=p;component?.updateProps(properties(p));requestAnimationFrame(position)},
    onKeyDown(p){if(p.event.key==='Escape'){destroy();return true}return component?.ref?.onKeyDown(p)??false},
    onExit:destroy,
   };
 }};
}
