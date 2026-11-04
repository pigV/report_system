import { fieldsFor, clone, validFieldId } from './report-model.mjs';
export function mergeSavedTemplate(current,submitted,saved) {
  // 保存请求期间可能继续编辑：只更新服务端版本，不能覆盖较新的本地内容。
  if(JSON.stringify(current)===JSON.stringify(submitted)) return clone(saved);
  return {...clone(current),revision:saved.revision,updatedAt:saved.updatedAt};
}
export function isValidLayout(doc) {
  if(doc?.type!=='doc'||doc.content?.length!==1||doc.content[0].type!=='reportGrid')return false;
  const fields=fieldsFor(doc),found=fields.map(f=>f.attrs?.fieldId);
  return fields.every(f=>f.type==='reportField')&&found.every(validFieldId)&&new Set(found).size===found.length;
}
export function fieldColumn(doc,id) {
  const columns=doc?.content?.[0]?.attrs?.columns??3;
  let column=0;
  for(const field of fieldsFor(doc)) {
    const span=field.attrs.span;
    if(column+span>columns)column=0;
    if(field.attrs.fieldId===id)return column;
    column=(column+span)%columns;
  }
  return 0;
}

// 编辑器事务（包括删除与撤销）只更新布局，不能回滚独立维护的绑定元数据。
export function applyRegionEdit(template,region,doc) {
  return {...template,[region]:doc};
}
