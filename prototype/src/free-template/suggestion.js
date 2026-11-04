// 【学习05】连接“Yiitap 触发 slash”与“Vue 显示业务菜单”的适配层。
// VueRenderer 是 Tiptap 的 Vue 集成，不是另一个富文本编辑器；它只挂载 SlashMenu 组件。
import { VueRenderer } from '@tiptap/vue-3';
import SlashMenu from './SlashMenu.vue';
import { nativeMenuItems, executeNativeInsert } from './menu.mjs';
import {isKeyImageInsertionInColumn} from '../editor/key-image-insert.mjs';
// Yiitap's OSlash/OSlashZh remain responsible for trigger/range lifecycle.
// A product renderer is required because the stock renderer treats every
// business label as an internal i18n key and cannot display arbitrary names.
// 返回 suggestion 配置供 OSlash/OSlashZh 使用；每轮菜单有独立的 host/component 生命周期。
// getItems 根据搜索词产候选；真正插入由 onPick → executeNativeInsert 完成。
export function businessSuggestion(getFields, getItems=query=>nativeMenuItems(query,getFields()),options={}){
 return {items:({query})=>getItems(query),render:()=>{
   let component,host,latest,observer;
   // clientRect 是菜单锚点的屏幕矩形；range 则是文档范围，两种坐标不可互换。
   const position=()=>{const rect=latest?.clientRect?.();if(!rect||!host)return;const width=270,height=Math.min(host.offsetHeight,390);host.style.left=`${Math.max(8,Math.min(rect.left,window.innerWidth-width-8))}px`;host.style.top=`${rect.bottom+height+8<window.innerHeight?rect.bottom+6:Math.max(8,rect.top-height-6)}px`};
   const destroy=()=>{observer?.disconnect();window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);component?.destroy();host?.remove();component=null;host=null};
   // onPick 闭包继续使用这次 suggestion 的 range，多选影像时不会改用侧栏按钮的焦点。
   const properties=p=>({...p,insideColumn:isKeyImageInsertionInColumn(p.editor.state,p.range),onPick:item=>executeNativeInsert(p.editor,p.range,item,options)});
   return {
    // 开始时创建 Vue 菜单 + 固定定位宿主；后续更新复用组件，退出时统一清理 DOM 和监听。
    onStart(p){latest=p;component=new VueRenderer(SlashMenu,{props:properties(p),editor:p.editor});host=document.createElement('div');host.className='native-slash-host';host.style.position='fixed';host.style.zIndex='80';host.appendChild(component.element);document.body.appendChild(host);observer=new ResizeObserver(position);observer.observe(host);position();window.addEventListener('resize',position);window.addEventListener('scroll',position,true)},
    onUpdate(p){latest=p;component?.updateProps(properties(p));requestAnimationFrame(position)},
    onKeyDown(p){if(p.event.key==='Escape'){destroy();return true}return component?.ref?.onKeyDown(p)??false},
    onExit:destroy,
   };
 }};
}
