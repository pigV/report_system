import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@tiptap/pm/state';
import { history, undo } from '@tiptap/pm/history';
import { nativeSchema } from '../src/free-template/model.mjs';
import { reorderBlock } from '../src/free-template/block-drag.mjs';
import { columnInsertTarget, insertColumnSlash } from '../src/editor/column-insert.mjs';
import { bodySchema } from '../src/editor/body-schema.mjs';

test('block reorder preserves field identity, nested content, and single-step undo', () => {
  const doc = nativeSchema.nodeFromJSON({type:'doc',content:[{type:'heading',attrs:{level:2},content:[{type:'text',text:'标题'}]},{type:'paragraph',content:[{type:'businessField',attrs:{fieldId:'patientName',label:'患者姓名'}}]},{type:'paragraph',content:[{type:'text',text:'末段'}]}]});
  let state = EditorState.create({doc,plugins:[history()]});
  state = state.apply(reorderBlock(state,0,doc.content.size));
  assert.equal(state.doc.lastChild.type.name,'heading');
  assert.equal(state.doc.firstChild.firstChild.attrs.fieldId,'patientName');
  assert.equal(undo(state,tr=>{state=state.apply(tr)}),true);
  assert.deepEqual(state.doc.toJSON(),doc.toJSON());
  const last=doc.content.size-doc.lastChild.nodeSize;
  assert.equal(state.apply(reorderBlock(state,last,0)).doc.firstChild.textContent,'末段');
  assert.equal(reorderBlock(state,0,doc.firstChild.nodeSize),null);
  assert.equal(reorderBlock(state,1,0),null);
});

test('live block moves group their undo steps and skip scrolling', () => {
  const paragraph = text => ({type:'paragraph',content:[{type:'text',text}]});
  const doc = nativeSchema.nodeFromJSON({type:'doc',content:[paragraph('第一段'),paragraph('第二段'),paragraph('第三段')]});
  let state = EditorState.create({doc,plugins:[history()]});
  const normal = reorderBlock(state,0,state.doc.content.size);
  assert.equal(normal.scrolledIntoView,true);

  state = state.apply(reorderBlock(state,0,state.doc.content.size,{scrollIntoView:false}));
  const first = state.doc.toJSON();
  const movedPos = state.doc.content.size-state.doc.lastChild.nodeSize;
  state = state.apply(reorderBlock(state,movedPos,0,{closeGroup:false,scrollIntoView:false}));
  assert.deepEqual(state.doc.toJSON(),doc.toJSON());
  assert.equal(undo(state,tr=>{state=state.apply(tr)}),true);
  assert.deepEqual(state.doc.toJSON(),doc.toJSON(),'one undo reverts both moves in the live group');
  assert.notDeepEqual(first,doc.toJSON());
});

test('undoing a drag retains text typed immediately before it', () => {
  const doc=nativeSchema.nodeFromJSON({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'第一段'}]},{type:'paragraph',content:[{type:'text',text:'第二段'}]}]});
  let state=EditorState.create({doc,plugins:[history()]});
  state=state.apply(state.tr.insertText('新增',4));
  const typed=state.doc.toJSON();
  state=state.apply(reorderBlock(state,0,state.doc.content.size));
  undo(state,tr=>{state=state.apply(tr)});
  assert.deepEqual(state.doc.toJSON(),typed);
  undo(state,tr=>{state=state.apply(tr)});
  assert.deepEqual(state.doc.toJSON(),doc.toJSON());
});

test('column add control opens on the hovered text block without creating a new row', () => {
  for(const schema of [nativeSchema,bodySchema]){
    const doc=schema.nodeFromJSON({type:'doc',content:[{type:'columns',content:[
      {type:'column',content:[{type:'paragraph',content:[{type:'text',text:'第一栏'}]}]},
      {type:'column',content:[{type:'paragraph',content:[{type:'text',text:'第二栏第一段'}]},{type:'paragraph',content:[{type:'text',text:'第二栏第二段'}]}]},
    ]},{type:'paragraph'}]});
    let state=EditorState.create({doc,plugins:[history()]});
    const positions=[];doc.descendants((node,pos)=>{if(node.type.name==='column')positions.push(pos)});
    const columnPos=positions[1],second=doc.nodeAt(columnPos),start=columnPos+1;
    const firstDom={getBoundingClientRect:()=>({top:100,bottom:120}),contains:()=>false};
    const hoveredDom={getBoundingClientRect:()=>({top:125,bottom:145}),contains:target=>target===child};
    const column={getBoundingClientRect:()=>({left:300,top:100,bottom:150})};
    const child={closest:()=>column};
    const view={state,dom:{contains:x=>x===column},posAtDOM:()=>start,nodeDOM:pos=>pos===start?firstDom:hoveredDom};
    const target=columnInsertTarget(view,child,135);
    assert.equal(target.pos,start+second.firstChild.nodeSize);
    assert.equal(target.left,304);assert.equal(target.top,123);
    state=state.apply(insertColumnSlash(state,target));
    const columns=state.doc.firstChild;
    assert.equal(columns.child(0).childCount,1);
    assert.equal(columns.child(1).childCount,2);
    assert.equal(columns.child(1).lastChild.textContent,'/第二栏第二段');
    assert.equal(state.selection.$from.parent,columns.child(1).lastChild);
    assert.equal(state.selection.$from.parentOffset,1);
    const changed=state.apply(state.tr.insertText('修改',target.pos+1));
    assert.equal(insertColumnSlash(changed,target),null);
    assert.equal(undo(state,tr=>{state=state.apply(tr)}),true);
    assert.deepEqual(state.doc.toJSON(),doc.toJSON());
  }
});

test('column add control uses an existing empty row and ignores non-text blocks', () => {
  for(const schema of [nativeSchema,bodySchema]){
    const doc=schema.nodeFromJSON({type:'doc',content:[{type:'columns',content:[
      {type:'column',content:[{type:'paragraph'}]},
      {type:'column',content:[{type:'horizontalRule'},{type:'paragraph'}]},
    ]}]});
    let state=EditorState.create({doc,plugins:[history()]});
    const column=state.doc.firstChild.child(1),start=state.doc.firstChild.child(0).nodeSize+2;
    const nonText={pos:start,node:column.child(0)};
    const columnDom={getBoundingClientRect:()=>({left:300,top:100,bottom:150})};
    const blockDom={getBoundingClientRect:()=>({top:100,bottom:120}),contains:target=>target===child};
    const child={closest:()=>columnDom};
    const view={state,dom:{contains:x=>x===columnDom},posAtDOM:()=>start,nodeDOM:()=>blockDom};
    assert.equal(!!columnInsertTarget(view,child,110),false);
    assert.equal(!!insertColumnSlash(state,nonText),false);
    const empty={pos:start+nonText.node.nodeSize,node:column.child(1)};
    state=state.apply(insertColumnSlash(state,empty));
    assert.equal(state.doc.firstChild.child(1).childCount,2);
    assert.equal(state.doc.firstChild.child(1).lastChild.textContent,'/');
    assert.equal(state.selection.$from.parentOffset,1);
  }
});
