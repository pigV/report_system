import test from 'node:test';
import assert from 'node:assert/strict';
import {Editor,Extension} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {history} from '@tiptap/pm/history';
import {bodyExtensions} from '../src/editor/body-schema.mjs';
import {executeNativeInsert} from '../src/free-template/menu.mjs';

const p=text=>({type:'paragraph',...(text?{content:[{type:'text',text}]}:{})});
for(const [action,type] of [['paragraph','paragraph'],['h1','heading'],['h2','heading'],['h3','heading'],['blockquote','blockquote'],['bulletList','bulletList'],['orderedList','orderedList'],['table','table'],['columns','columns'],['rule','horizontalRule']]){
  test(`report ${action} insertion places the cursor after the block without replacing subsequent text`,()=>{
    const editor=new Editor({extensions:[Extension.create({name:'headlessFocus',addCommands(){return {focus:()=>()=>true}}}),StarterKit.configure({codeBlock:false,horizontalRule:false,link:false,blockquote:false,trailingNode:false}),...bodyExtensions()],content:{type:'doc',content:[p('/'),p('已有正文')]}});
    editor.view.updateState(editor.state.reconfigure({plugins:[history()]}));
    assert.equal(executeNativeInsert(editor,{from:1,to:2},{action,columns:2},{afterBlock:true}),true);
    const doc=editor.state.doc;
    assert.equal(doc.firstChild.type.name,type);
    assert.equal(doc.child(1).type.name,'paragraph');
    assert.equal(doc.child(1).textContent,'已有正文');
    assert.equal(editor.state.selection.from,doc.firstChild.nodeSize+1);
    assert.equal(editor.commands.undo(),true);
    assert.deepEqual(editor.state.doc.toJSON().content.map(node=>node.type),['paragraph','paragraph']);
    assert.equal(editor.state.doc.firstChild.textContent,'/');
    editor.destroy();
  });
}

for(const [action,rows,columns] of [['pictures-1-2',1,2],['pictures-2-2',2,2],['pictures-2-3',2,3],['pictures-custom',2,3]]){
  test(`report ${action} reuses the existing paragraph after the full image layout`,()=>{
    const editor=new Editor({extensions:[Extension.create({name:'headlessFocus',addCommands(){return {focus:()=>()=>true}}}),StarterKit.configure({codeBlock:false,horizontalRule:false,link:false,blockquote:false,trailingNode:false}),...bodyExtensions()],content:{type:'doc',content:[p('/'),p('已有正文')]}});
    editor.view.updateState(editor.state.reconfigure({plugins:[history()]}));
    assert.equal(executeNativeInsert(editor,{from:1,to:2},{action,rows,columns},{afterBlock:true}),true);
    const doc=editor.state.doc;
    assert.equal(doc.childCount,rows+1);
    assert.equal(doc.lastChild.textContent,'已有正文');
    assert.equal(editor.state.selection.from,doc.content.size-doc.lastChild.nodeSize+1);
    assert.equal(editor.commands.undo(),true);
    assert.equal(editor.state.doc.firstChild.textContent,'/');
    editor.destroy();
  });
}

for(const [action,type] of [['h1','heading'],['bulletList','bulletList'],['table','table'],['columns','columns'],['rule','horizontalRule'],['pictures-2-2','columns']])for(const following of [false,true]){
  test(`report ${action} creates a body paragraph when ${following?'the next block is a heading':'at document end'}`,()=>{
    const heading={type:'heading',attrs:{level:2},content:[{type:'text',text:'保留标题'}]};
    const editor=new Editor({extensions:[Extension.create({name:'headlessFocus',addCommands(){return {focus:()=>()=>true}}}),StarterKit.configure({codeBlock:false,horizontalRule:false,link:false,blockquote:false,trailingNode:false}),...bodyExtensions()],content:{type:'doc',content:[p('/'),...(following?[heading]:[])]}});
    assert.equal(executeNativeInsert(editor,{from:1,to:2},{action,rows:2,columns:2},{afterBlock:true}),true);
    const doc=editor.state.doc,index=action==='pictures-2-2'?2:1;
    assert.equal(doc.firstChild.type.name,type);
    assert.equal(doc.child(index).type.name,'paragraph');
    assert.equal(editor.state.selection.from,doc.content.content.slice(0,index).reduce((sum,node)=>sum+node.nodeSize,0)+1);
    if(following)assert.equal(doc.lastChild.textContent,'保留标题');
    editor.destroy();
  });
}
