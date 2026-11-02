import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { createExtensionList, Column, ColumnContainer } from '@yiitap/vue';

// Keep the editable body, read-only history and server validation in agreement.
export function bodyExtensions({readonly=false}={}) {
  return [
    ...createExtensionList(['Table','TextAlign','TextStyle','Color','OHorizontalRule','OBlockquote','OShortcut']),
    // Yiitap's column editing plugin handles mouse events even when editable=false.
    ...(readonly?[ColumnContainer,Column]:createExtensionList(['OMultiColumn'])),
  ];
}
export const bodySchema=getSchema([
  StarterKit.configure({codeBlock:false,horizontalRule:false,link:false,blockquote:false,trailingNode:false}),
  ...bodyExtensions(),
]);
