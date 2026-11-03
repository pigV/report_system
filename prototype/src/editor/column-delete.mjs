import {Extension} from '@tiptap/core';
import {NodeSelection,Plugin} from '@tiptap/pm/state';
import {closeHistory} from '@tiptap/pm/history';

const isColumn=node=>['columns','column'].includes(node.type.name);

export function deleteColumnSelection(state,dispatch){
  const selection=state.selection;
  if(!(selection instanceof NodeSelection)||!isColumn(selection.node))return false;
  let {from,to}=selection;
  // Remove the wrapper too when its last column is deleted.
  if(selection.node.type.name==='column'&&selection.$from.parent.type.name==='columns'&&selection.$from.parent.childCount===1){
    from=selection.$from.before();to=selection.$from.after();
  }
  if(dispatch)dispatch(closeHistory(state.tr).delete(from,to).scrollIntoView());
  return true;
}

export const ColumnDeletion=Extension.create({
  name:'columnDeletion',priority:1000,
  addKeyboardShortcuts(){
    return {Delete:()=>this.editor.isEditable&&this.editor.commands.command(({state,dispatch})=>deleteColumnSelection(state,dispatch))};
  },
  addProseMirrorPlugins(){
    return [new Plugin({props:{
      handleClickOn(view,pos,node,nodePos,event){
        if(!view.editable||event.button!==0||event.shiftKey||event.metaKey||event.ctrlKey||event.altKey||!isColumn(node))return false;
        // Only the layout's own edge selects it. Clicking text or media
        // keeps the editor's normal cursor and node-selection behavior.
        if(event.target!==view.nodeDOM(nodePos))return false;
        view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc,nodePos)));
        view.focus();return true;
      },
    }})];
  },
});
