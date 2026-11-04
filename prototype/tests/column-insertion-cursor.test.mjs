import test from 'node:test';
import assert from 'node:assert/strict';
import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { history } from '@tiptap/pm/history';
import { bodyExtensions } from '../src/editor/body-schema.mjs';
import { nativeExtensions } from '../src/free-template/model.mjs';
import { executeNativeInsert } from '../src/free-template/menu.mjs';

for (const [name, extensions] of [['report', bodyExtensions], ['free template', nativeExtensions]]) {
  for (const following of [false, true]) {
    test(`${name}: column insertion places the cursor on the next line ${following ? 'without changing existing content' : 'at the end'}`, () => {
      const editor = new Editor({
        extensions: [Extension.create({name:'headlessFocus',addCommands(){return {focus:()=>()=>true}}}), StarterKit.configure({codeBlock:false,horizontalRule:false,link:false,blockquote:false,trailingNode:false}), ...extensions()],
        content: {type:'doc', content:[{type:'paragraph',content:[{type:'text',text:'/'}]}, ...(following ? [{type:'paragraph',content:[{type:'text',text:'existing'}]}] : [])]},
      });
      editor.view.updateState(editor.state.reconfigure({plugins:[history()]}));
      assert.equal(executeNativeInsert(editor,{from:1,to:2},{action:'columns',columns:3}),true);
      const doc=editor.state.doc;
      assert.equal(doc.firstChild.type.name,'columns');
      assert.equal(doc.firstChild.childCount,3);
      doc.firstChild.forEach(column=>{
        assert.equal(column.childCount,1);
        assert.equal(column.firstChild.type.name,'paragraph');
        assert.equal(column.firstChild.textContent,'');
      });
      assert.equal(doc.child(1).type.name,'paragraph');
      assert.equal(doc.child(1).textContent,following ? 'existing' : '');
      assert.equal(editor.state.selection.from,doc.firstChild.nodeSize+1);
      assert.equal(editor.commands.undo(),true);
      assert.deepEqual(editor.state.doc.toJSON().content.map(node=>node.type),following ? ['paragraph','paragraph'] : ['paragraph']);
      assert.equal(editor.state.doc.firstChild.textContent,'/');
      editor.destroy();
    });
  }
  for (const count of [2,4,5]) {
    test(`${name}: inserting ${count} columns creates an editable empty line in each`, () => {
      const editor = new Editor({
        extensions: [Extension.create({name:'headlessFocus',addCommands(){return {focus:()=>()=>true}}}), StarterKit.configure({codeBlock:false,horizontalRule:false,link:false,blockquote:false,trailingNode:false}), ...extensions()],
        content: {type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'/'}]}]},
      });
      assert.equal(executeNativeInsert(editor,{from:1,to:2},{action:'columns',columns:count}),true);
      const columns=editor.state.doc.firstChild;
      assert.equal(columns.childCount,count);
      columns.forEach(column=>assert.equal(column.firstChild.type.name,'paragraph'));
      editor.destroy();
    });
  }
}
