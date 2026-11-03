import {TextSelection} from '@tiptap/pm/state';
import {Fragment,Slice} from '@tiptap/pm/model';
import {closeHistory} from '@tiptap/pm/history';
import {keyImage} from '../key-images.mjs';

function selectedImageNodes(ids){
  const images=[...new Set(ids)].map(keyImage).filter(Boolean);
  return images.map(image=>({type:'reportImage',attrs:{imageId:image.id,caption:image.name+' · 模拟影像'}}));
}

export function keyImageColumns(ids){
  const images=selectedImageNodes(ids);
  if(!images.length)return null;
  return {type:'columns',content:images.map(image=>({type:'column',attrs:{flexGrow:1},content:[image]}))};
}

export function isKeyImageInsertionInColumn(state,range){
  const $anchor=state.doc.resolve(range.from);
  for(let depth=$anchor.depth;depth>0;depth--)if($anchor.node(depth).type.name==='column')return true;
  return false;
}

// The suggestion range is retained while the user checks multiple images.
// Reuse an existing column; only insertions outside columns create a new row.
export function insertKeyImagesTransaction(state,range,ids){
  const images=selectedImageNodes(ids);
  if(!images.length)return null;
  const content=isKeyImageInsertionInColumn(state,range)?images:[keyImageColumns(ids)];
  const tr=closeHistory(state.tr).delete(range.from,range.to);
  tr.setSelection(TextSelection.create(tr.doc,range.from));
  const fragment=Fragment.fromArray(content.map(node=>state.schema.nodeFromJSON(node)));
  return tr.replaceSelection(new Slice(fragment,0,0)).scrollIntoView();
}
