import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@tiptap/pm/state';
import { bodyExtensions, bodySchema } from '../src/editor/body-schema.mjs';

for (const readonly of [true,false]) {
  test(`column add controls ${readonly?'cannot change a read-only report':'work in the editable report'}`,()=>{
    const doc=bodySchema.nodeFromJSON({type:'doc',content:[{type:'columns',content:[
      {type:'column',content:[{type:'paragraph'}]},
      {type:'column',content:[{type:'paragraph'}]},
    ]}]});
    const view={editable:!readonly,state:EditorState.create({doc}),dom:{},posAtDOM:()=>2,
      dispatch(tr){this.state=this.state.apply(tr)},focus(){}};
    const columnEditor=bodyExtensions({readonly}).find(extension=>extension.name==='multiColumn');
    const plugins=columnEditor?.config.addProseMirrorPlugins.call(columnEditor)??[];
    // Exercise Yiitap's actual column-add mouse handler, not a replacement implementation.
    for(const plugin of plugins)plugin.props.handleDOMEvents?.mouseup?.(view,{target:{className:'plus',closest:()=>({})}});
    assert.equal(view.state.doc.firstChild.childCount,readonly?2:3);
    if(readonly)assert.deepEqual(view.state.doc.toJSON(),doc.toJSON());
  });
}
