// 【学习08】Tiptap Extension 注册快捷键，ProseMirror Selection 决定删文字还是删整个栏。
// 对照指南第 7.8 节；布局删除只接受 NodeSelection，不接管普通文字选区。
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
  // 命令允许只询问“能否执行”：没有 dispatch 时只返回 true；真正执行时才提交事务。
  if(dispatch)dispatch(closeHistory(state.tr).delete(from,to).scrollIntoView());
  return true;
}

export const ColumnDeletion=Extension.create({
  // 较高优先级使自定义处理先于通用删除；返回 false 才交给其余快捷键继续处理。
  name:'columnDeletion',priority:1000,
  addKeyboardShortcuts(){
    return {
      Delete:()=>this.editor.isEditable&&this.editor.commands.command(({state,dispatch})=>deleteColumnSelection(state,dispatch)),
      // 特定边界直接返回 true，消费 Backspace，避免默认 joinBackward 将段落误包成新栏。
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
      // handleClickOn 是 ProseMirror 点击节点的钩子；view.nodeDOM(nodePos) 对应整个节点 DOM。
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
            // 节点边界 + 可选图片 nodeSize 得到空段落位置，再 +1 进入段落文字区域。
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
