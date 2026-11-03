import {TextSelection} from '@tiptap/pm/state';
import {closeHistory} from '@tiptap/pm/history';
import {keyImage} from '../key-images.mjs';

export function keyImageColumns(ids){
  const images=[...new Set(ids)].map(keyImage).filter(Boolean);
  if(!images.length)return null;
  return {type:'columns',content:images.map(image=>({type:'column',attrs:{flexGrow:1},content:[
    {type:'reportImage',attrs:{imageId:image.id,caption:image.name+' · 模拟影像'}},
  ]}))};
}

// The suggestion range is retained while the user checks multiple images.
// A single transaction removes its trigger and inserts the complete native row.
export function insertKeyImagesTransaction(state,range,ids){
  const content=keyImageColumns(ids);
  if(!content)return null;
  const tr=closeHistory(state.tr).delete(range.from,range.to);
  tr.setSelection(TextSelection.create(tr.doc,range.from));
  return tr.replaceSelectionWith(state.schema.nodeFromJSON(content)).scrollIntoView();
}
