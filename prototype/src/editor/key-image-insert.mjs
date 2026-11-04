// 【学习07】影像多选的文档部分：纯函数接收 EditorState，返回待提交的 ProseMirror 事务。
// @tiptap/pm 是 ProseMirror 包入口；这里不是 Vue 状态更新，也不是发起后端请求。
import {TextSelection} from '@tiptap/pm/state';
import {Fragment,Slice} from '@tiptap/pm/model';
import {closeHistory} from '@tiptap/pm/history';
import {keyImage} from '../key-images.mjs';

function selectedImageNodes(ids){
  // Set 去重且保留输入顺序；查不到的 ID 丢弃，正文保存的是 ID/图注而非图片二进制。
  const images=[...new Set(ids)].map(keyImage).filter(Boolean);
  return images.map(image=>({type:'reportImage',attrs:{imageId:image.id,caption:image.name+' · 模拟影像'}}));
}

export function keyImageGrid(count){
  return count===4?{rows:2,columns:2}:count===6?{rows:2,columns:3}:{rows:1,columns:count};
}

function columnsForImages(images){
  // 每张图包在等宽原生 column 中，下面放空段落，使点击图片下方还能继续写文字。
  return {type:'columns',content:images.map(image=>({type:'column',attrs:{flexGrow:1},content:[image,{type:'paragraph'}]}))};
}

export function keyImageColumns(ids){
  const images=selectedImageNodes(ids);
  if(!images.length)return null;
  return columnsForImages(images);
}

export function isKeyImageInsertionInColumn(state,range){
  // resolve 将数字位置展开为带父节点链的位置；沿深度向上找 column，避免创建嵌套栏。
  const $anchor=state.doc.resolve(range.from);
  for(let depth=$anchor.depth;depth>0;depth--)if($anchor.node(depth).type.name==='column')return true;
  return false;
}

// 多选期间保留菜单打开时的插入位置；已有栏内直接插入，栏外才创建新布局。
// 四张和六张影像按两行排列，其余数量保持单行；整次插入可一步撤销。
export function insertKeyImagesTransaction(state,range,ids){
  const images=selectedImageNodes(ids);
  if(!images.length)return null;
  const {columns}=keyImageGrid(images.length);
  // 已有栏内只放图；栏外按网格拆成若干个 columns（四张/六张会有两组行布局）。
  const content=isKeyImageInsertionInColumn(state,range)?images:
    Array.from({length:Math.ceil(images.length/columns)},(_,i)=>columnsForImages(images.slice(i*columns,(i+1)*columns)));
  // 先删 slash 命令范围，再将选区缩到原起点；后续替换的是这个空选区，而非其他正文。
  const tr=closeHistory(state.tr).delete(range.from,range.to);
  tr.setSelection(TextSelection.create(tr.doc,range.from));
  // 普通 JSON → schema 节点 → Fragment 节点集合 → 完整 Slice；0,0 表示片段两端不开放。
  // 调用者 menu.mjs 还会定位布局后光标、dispatch，并为后续编辑切开历史分组。
  const fragment=Fragment.fromArray(content.map(node=>state.schema.nodeFromJSON(node)));
  return tr.replaceSelection(new Slice(fragment,0,0)).scrollIntoView();
}
