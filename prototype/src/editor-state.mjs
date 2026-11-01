import { fieldsFor, clone, validFieldId } from './report-model.mjs';
export function mergeSavedTemplate(current,submitted,saved) {
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

// Editor transactions (including delete and undo) own layout only.
export function applyRegionEdit(template,region,doc) {
  return {...template,[region]:doc};
}
