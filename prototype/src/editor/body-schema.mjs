import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { createExtensionList, Column, ColumnContainer } from '@yiitap/vue';
import {ReportSections} from './report-sections.mjs';
import {ReportImage} from './report-images.mjs';

// Keep the editable body, read-only history and server validation in agreement.
export function bodyExtensions({readonly=false,getScope=()=>null,getSelected=()=>null}={}) {
  return [
    ReportSections,ReportImage.configure({getScope,getSelected}),
    ...createExtensionList(['Table','TextAlign','TextStyle','Color','OHorizontalRule','OBlockquote','OShortcut']),
    // Yiitap's column editing plugin handles mouse events even when editable=false.
    ...(readonly?[ColumnContainer,Column]:createExtensionList(['OMultiColumn'])),
  ];
}
export const bodySchema=getSchema([
  StarterKit.configure({codeBlock:false,horizontalRule:false,link:false,blockquote:false,trailingNode:false}),
  ...bodyExtensions(),
]);
