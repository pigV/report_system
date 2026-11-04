import {TextSelection} from '@tiptap/pm/state';
import {Fragment,Slice} from '@tiptap/pm/model';
import {closeHistory} from '@tiptap/pm/history';
import {keyImage} from '../key-images.mjs';

function selectedImageNodes(ids){
  const images=[...new Set(ids)].map(keyImage).filter(Boolean);
  return images.map(image=>({type:'reportImage',attrs:{imageId:image.id,caption:image.name+' · 模拟影像'}}));
}

export function keyImageGrid(count){
  return count===4?{rows:2,columns:2}:count===6?{rows:2,columns:3}:{rows:1,columns:count};
}

function columnsForImages(images){
  return {type:'columns',content:images.map(image=>({type:'column',attrs:{flexGrow:1},content:[image,{type:'paragraph'}]}))};
}

export function keyImageColumns(ids){
  const images=selectedImageNodes(ids);
  if(!images.length)return null;
  return columnsForImages(images);
}

export function isKeyImageInsertionInColumn(state,range){
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
  const content=isKeyImageInsertionInColumn(state,range)?images:
    Array.from({length:Math.ceil(images.length/columns)},(_,i)=>columnsForImages(images.slice(i*columns,(i+1)*columns)));
  const tr=closeHistory(state.tr).delete(range.from,range.to);
  tr.setSelection(TextSelection.create(tr.doc,range.from));
  const fragment=Fragment.fromArray(content.map(node=>state.schema.nodeFromJSON(node)));
  return tr.replaceSelection(new Slice(fragment,0,0)).scrollIntoView();
}
