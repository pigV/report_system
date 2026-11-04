import test from 'node:test';
import assert from 'node:assert/strict';
import {EditorState,TextSelection} from '@tiptap/pm/state';
import {deleteSelection,joinBackward} from '@tiptap/pm/commands';
import {bodySchema,bodyExtensions} from '../src/editor/body-schema.mjs';
import {nativeSchema,nativeExtensions} from '../src/free-template/model.mjs';

const p=text=>({type:'paragraph',...(text?{content:[{type:'text',text}]}:{})});
const columns=(image=false)=>({type:'columns',content:['a','b','c'].map((value,i)=>({type:'column',content:[image?{type:'reportImage',attrs:{imageId:`image-${i+1}`,caption:value}}:p(value)]}))});

// Exercise the shared editor shortcut followed by ProseMirror's normal fallback.
function backspace(state,extensions){
  let current=state;
  const editor={isEditable:true,commands:{command:fn=>fn({state:current,dispatch:tr=>{current=current.apply(tr)}})}};
  let handled=false;
  for(const extension of extensions){
    if(extension.name!=='columnDeletion')continue;
    const shortcut=extension.config.addKeyboardShortcuts.call({editor}).Backspace;
    if(shortcut?.()){handled=true;break}
  }
  if(!handled&&!deleteSelection(current,tr=>{current=current.apply(tr)}))joinBackward(current,tr=>{current=current.apply(tr)});
  return current;
}

for(const [name,schema,extensions,image] of [['报告正文',bodySchema,bodyExtensions(),true],['自由模板',nativeSchema,nativeExtensions(),false]]){
  for(const text of ['', '保留文字'])test(`${name}: 分栏后的${text?'文字':'空段落'}按退格不会新增列`,()=>{
    const doc=schema.nodeFromJSON({type:'doc',content:[columns(image),p(text)]});
    const state=EditorState.create({schema,doc,selection:TextSelection.create(doc,doc.firstChild.nodeSize+1)});
    const result=backspace(state,extensions);
    assert.deepEqual(result.doc.toJSON(),doc.toJSON());
    assert.equal(result.doc.firstChild.childCount,3);
    assert.equal(result.selection.from,state.selection.from);
  });
  test(`${name}: 普通段落仍可使用退格合并`,()=>{
    const doc=schema.nodeFromJSON({type:'doc',content:[p('前'),p('后')]});
    const state=EditorState.create({schema,doc,selection:TextSelection.create(doc,doc.firstChild.nodeSize+1)});
    const result=backspace(state,extensions);
    assert.equal(result.doc.childCount,1);
    assert.equal(result.doc.textContent,'前后');
  });
  test(`${name}: 分栏后的选中文字仍可删除`,()=>{
    const doc=schema.nodeFromJSON({type:'doc',content:[columns(image),p('文字')]});
    const start=doc.firstChild.nodeSize+1;
    const state=EditorState.create({schema,doc,selection:TextSelection.create(doc,start,start+1)});
    const result=backspace(state,extensions);
    assert.equal(result.doc.firstChild.childCount,3);
    assert.equal(result.doc.lastChild.textContent,'字');
  });
}
