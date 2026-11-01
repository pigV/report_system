import { DatabaseSync } from 'node:sqlite';
import { hospitals } from '../src/report-model.mjs';
import { fromLegacy, validateNativeTemplate } from '../src/free-template/model.mjs';
export function openNativeStore(filename,legacyTemplate){
  const db=new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS native_templates (hospital TEXT PRIMARY KEY, payload TEXT NOT NULL)');
  function getTemplate(id){
    if(!hospitals.some(h=>h.id===id))throw Error('医院不存在');
    const row=db.prepare('SELECT payload FROM native_templates WHERE hospital=?').get(id);
    return row?JSON.parse(row.payload):fromLegacy(legacyTemplate(id));
  }
  return {getTemplate,saveTemplate(id,payload){
    const errors=validateNativeTemplate(id,payload);if(errors.length)throw Error(errors.join('；'));
    db.exec('BEGIN IMMEDIATE');
    try {
      const previous=getTemplate(id);
      if(payload.revision!==previous.revision)throw Error('模板已在其他窗口更新，请重新加载后再保存');
      const saved={...payload,revision:previous.revision+1,updatedAt:new Date().toISOString()};
      db.prepare('INSERT INTO native_templates VALUES (?,?) ON CONFLICT(hospital) DO UPDATE SET payload=excluded.payload').run(id,JSON.stringify(saved));
      db.exec('COMMIT');return saved;
    }catch(e){db.exec('ROLLBACK');throw e}
  },close:()=>db.close()};
}
