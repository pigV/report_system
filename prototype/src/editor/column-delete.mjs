import {Extension} from '@tiptap/core';
import {NodeSelection,Plugin,TextSelection} from '@tiptap/pm/state';
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
    return {
      Delete:()=>this.editor.isEditable&&this.editor.commands.command(({state,dispatch})=>deleteColumnSelection(state,dispatch)),
      Backspace:()=>this.editor.isEditable&&this.editor.commands.command(({state})=>{
        const cursor=state.selection.$cursor;
        if(!cursor||cursor.parentOffset!==0||cursor.depth<1)return false;
        // The default joinBackward wraps this textblock in a new column.
        return cursor.node(cursor.depth-1).maybeChild(cursor.index(cursor.depth-1)-1)?.type.name==='columns';
      }),
    };
  },
  addProseMirrorPlugins(){
    return [new Plugin({props:{
      handleClickOn(view,pos,node,nodePos,event){
        if(!view.editable||event.button!==0||event.shiftKey||event.metaKey||event.ctrlKey||event.altKey||!isColumn(node))return false;
        // Only the layout's own edge selects it. Clicking text or media
        // keeps the editor's normal cursor and node-selection behavior.
        if(event.target!==view.nodeDOM(nodePos))return false;
        // Empty columns and newly inserted image columns have an editable
        // paragraph. Clicks in their padding enter it; the edge still selects
        // the individual column for deletion.
        const emptyLine=node.type.name==='column'&&node.lastChild?.type.name==='paragraph'&&node.lastChild.content.size===0&&
          (node.childCount===1||(node.childCount===2&&node.firstChild.type.name==='reportImage'));
        if(emptyLine){
          const rect=event.target.getBoundingClientRect();
          const edge=event.clientX-rect.left<=1||rect.right-event.clientX<=1||event.clientY-rect.top<=1||rect.bottom-event.clientY<=1;
          if(!edge){
            const paragraphPos=nodePos+1+(node.childCount===2?node.firstChild.nodeSize:0);
            view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc,paragraphPos+1)).scrollIntoView());
            view.focus();return true;
          }
        }
        view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc,nodePos)));
        view.focus();return true;
      },
    }})];
  },
});
