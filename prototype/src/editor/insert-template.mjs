import {TextSelection} from '@tiptap/pm/state';
import {closeHistory} from '@tiptap/pm/history';

// Insert after the selected top-level block, keeping even a nonempty selection intact.
export function insertTemplateTransaction(state,body){
  const fragment=state.schema.nodeFromJSON(body).content;
  const empty=state.doc.childCount===1 && state.doc.firstChild.type.name==='paragraph' && !state.doc.firstChild.content.size;
  const end=state.selection.$to;
  const position=empty?0:end.depth?end.after(1):end.pos;
  const tr=closeHistory(state.tr);
  if(empty)tr.replaceWith(0,state.doc.content.size,fragment);
  else tr.insert(position,fragment);
  tr.setSelection(TextSelection.near(tr.doc.resolve(position+fragment.size),-1));
  return tr.scrollIntoView();
}
