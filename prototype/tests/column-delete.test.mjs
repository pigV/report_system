import test from 'node:test';
import assert from 'node:assert/strict';
import {EditorState,NodeSelection,TextSelection} from '@tiptap/pm/state';
import {history,undo} from '@tiptap/pm/history';
import {bodySchema,bodyExtensions} from '../src/editor/body-schema.mjs';
import {nativeSchema,nativeExtensions} from '../src/free-template/model.mjs';
import {deleteColumnSelection,ColumnDeletion} from '../src/editor/column-delete.mjs';

const p=text=>({type:'paragraph',...(text?{content:[{type:'text',text}]}:{})});
const row=()=>({type:'columns',content:[{type:'column',content:[p('左栏')]},{type:'column',content:[p('右栏')]}]});
for(const [name,schema] of [['report',bodySchema],['free template',nativeSchema]]){
  test(`${name}: Delete removes the selected column container and undo restores it`,()=>{
    const doc=schema.nodeFromJSON({type:'doc',content:[p('前文'),row(),p('后文')]});
    let state=EditorState.create({schema,doc,plugins:[history()]});
    state=state.apply(state.tr.setSelection(NodeSelection.create(doc,doc.firstChild.nodeSize)));
    assert.ok(deleteColumnSelection(state,tr=>{state=state.apply(tr)}));
    assert.equal(state.doc.childCount,2);
    assert.equal(state.doc.textContent,'前文后文');state.doc.check();
    assert.ok(undo(state,tr=>{state=state.apply(tr)}));
    assert.deepEqual(state.doc.toJSON(),doc.toJSON());
  });
  test(`${name}: deleting a selected single column preserves its neighbour and cleans up the last column`,()=>{
    let state=EditorState.create({schema,doc:schema.nodeFromJSON({type:'doc',content:[row()]})});
    state=state.apply(state.tr.setSelection(NodeSelection.create(state.doc,1)));
    assert.ok(deleteColumnSelection(state,tr=>{state=state.apply(tr)}));
    assert.equal(state.doc.firstChild.type.name,'columns');
    assert.equal(state.doc.firstChild.childCount,1);
    assert.equal(state.doc.textContent,'右栏');state.doc.check();
    state=state.apply(state.tr.setSelection(NodeSelection.create(state.doc,1)));
    assert.ok(deleteColumnSelection(state,tr=>{state=state.apply(tr)}));
    assert.equal(state.doc.firstChild.type.name,'paragraph');state.doc.check();
  });
  test(`${name}: a text cursor or text selection inside a column retains normal Delete behavior`,()=>{
    const doc=schema.nodeFromJSON({type:'doc',content:[row()]});
    for(const selection of [TextSelection.create(doc,3),TextSelection.create(doc,3,4)]){
      const state=EditorState.create({schema,doc,selection});
      assert.equal(deleteColumnSelection(state,()=>assert.fail('text selection must fall through')),false);
    }
  });
}
test('both editors include the shared Delete extension; readonly body excludes it',()=>{
  assert.ok(bodyExtensions().some(e=>e.name===ColumnDeletion.name));
  assert.ok(nativeExtensions().some(e=>e.name===ColumnDeletion.name));
  assert.ok(!bodyExtensions({readonly:true}).some(e=>e.name===ColumnDeletion.name));
});
test('container edge click selects that node without intercepting clicks on its contents or readonly views',()=>{
  const plugin=ColumnDeletion.config.addProseMirrorPlugins.call({})[0];
  const handler=plugin.props.handleClickOn;
  const dom={},content={};
  let state=EditorState.create({schema:bodySchema,doc:bodySchema.nodeFromJSON({type:'doc',content:[row()]})});
  let focused=false;
  const view={state,editable:true,nodeDOM:()=>dom,focus:()=>{focused=true},dispatch:tr=>{state=state.apply(tr);view.state=state}};
  const node=state.doc.firstChild;
  assert.equal(handler(view,0,node,0,{target:content,button:0}),false);
  assert.equal(handler({...view,editable:false},0,node,0,{target:dom,button:0}),false);
  assert.equal(handler(view,0,node,0,{target:dom,button:0}),true);
  assert.ok(state.selection instanceof NodeSelection);
  assert.equal(state.selection.node.type.name,'columns');assert.ok(focused);
});
