import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const reportLineHighlightKey = new PluginKey('reportLineHighlight');

export const reportLineHighlight = Extension.create({
  name: 'reportLineHighlight',
  addProseMirrorPlugins() {
    return [new Plugin({
      key: reportLineHighlightKey,
      state: {
        init: () => DecorationSet.empty,
        apply(tr, previous) {
          const target = tr.getMeta(reportLineHighlightKey);
          if (target === null) return DecorationSet.empty;
          if (typeof target === 'number') {
            const node = tr.doc.nodeAt(target);
            return node ? DecorationSet.create(tr.doc, [Decoration.node(target, target + node.nodeSize, {class: 'report-insert-current-line'})]) : DecorationSet.empty;
          }
          return previous.map(tr.mapping, tr.doc);
        },
      },
      props: { decorations: state => reportLineHighlightKey.getState(state) },
    })];
  },
});
