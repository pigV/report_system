// 【学习04】文档结构规则的共同入口；编辑、只读、服务端校验和打印都要认识这些节点。
// Schema 是“正文允许哪些节点、如何嵌套”的规则，不是数据库表，也不是 Vue 组件树。
import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { createExtensionList, Column, ColumnContainer } from '@yiitap/vue';
import {ReportSections} from './report-sections.mjs';
import {ReportImage} from './report-images.mjs';
import {ColumnDeletion} from './column-delete.mjs';

// Keep the editable body, read-only history and server validation in agreement.
export function bodyExtensions({readonly=false,getScope=()=>null,getSelected=()=>null}={}) {
  // 函数参数用 getter，图片交互发生时才读取最新病例/选中图，避免初始化时截取旧值。
  return [
    ReportSections,ReportImage.configure({getScope,getSelected}),
    ...createExtensionList(['Table','TextAlign','TextStyle','Color','OHorizontalRule','OBlockquote','OShortcut']),
    // Yiitap's column editing plugin handles mouse events even when editable=false.
    // 只读也必须保留栏节点的 schema，但不加载分栏鼠标编辑插件和自定义删除快捷键。
    ...(readonly?[ColumnContainer,Column]:[...createExtensionList(['OMultiColumn']),ColumnDeletion]),
  ];
}
// Tiptap getSchema 只建立规则，不创建可见编辑器；StarterKit 提供基础文字/段落/列表。
// 关闭会由其他扩展提供的节点，避免重复定义。打印从此 schema 建 DOMSerializer。
export const bodySchema=getSchema([
  StarterKit.configure({codeBlock:false,horizontalRule:false,link:false,blockquote:false,trailingNode:false}),
  ...bodyExtensions(),
]);
