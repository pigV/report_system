import { DatabaseSync } from 'node:sqlite';
import { bodySchema } from '../src/editor/body-schema.mjs';
import { hospitals, seedTemplate, validateTemplate, makeCases, emptyBody, normalizeBindings } from '../src/report-model.mjs';
export function openStore(filename) {
  const db=new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS templates (hospital TEXT PRIMARY KEY, payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS reports (hospital TEXT, case_id TEXT, payload TEXT NOT NULL, PRIMARY KEY (hospital, case_id));');
  for(const h of hospitals) db.prepare('INSERT OR IGNORE INTO templates VALUES (?,?)').run(h.id,JSON.stringify(seedTemplate(h.id)));
  const getTemplate=id=>{const row=db.prepare('SELECT payload FROM templates WHERE hospital=?').get(id); if(!row) throw new Error('医院不存在');return normalizeBindings(JSON.parse(row.payload));};
  // 病例与报告均先按医院校验，避免用其他医院的病例编号读取或保存。
  const getCase=(id,caseId)=>{getTemplate(id);const c=makeCases(id).find(c=>c.id===caseId);if(!c) throw new Error('病例不属于当前医院');return c;};
  const getReport=(id,caseId)=>{getCase(id,caseId);const row=db.prepare('SELECT payload FROM reports WHERE hospital=? AND case_id=?').get(id,caseId);return row?JSON.parse(row.payload):null;};
  return {getTemplate,getCase,getReport,
    saveTemplate(id,payload) {
      const errors=validateTemplate(id,payload);if(errors.length) throw new Error(errors.join('；'));
      const previous=getTemplate(id);
      if(payload.revision!==previous.revision) throw new Error('模板已在其他窗口更新，请重新加载后再保存');
      const saved={...normalizeBindings(payload),revision:previous.revision+1,updatedAt:new Date().toISOString()};
      db.prepare('UPDATE templates SET payload=? WHERE hospital=?').run(JSON.stringify(saved),id);return saved;
    },
    saveReport(id,caseId,body,context) {
      const sample=getCase(id,caseId), old=getReport(id,caseId);
      // 版本不匹配说明其他窗口已保存，拒绝覆盖而不是静默丢失对方修改。
      const currentRevision=old?.revision??(old?1:0);
      if(context && context.reportRevision!==currentRevision) throw new Error('报告已在其他窗口更新，请重新加载后再保存');
      try {const node=bodySchema.nodeFromJSON(body);node.check();if(node.type.name!=='doc') throw new Error();}catch {throw new Error('报告正文格式无效');}
      if(context && (validateTemplate(id,context.template).length || context.caseId!==caseId)) throw new Error('报告模板快照无效');
      // 已有报告始终沿用创建时的模板和数据快照；后续保存只更新正文与版本。
      const report={hospitalId:id,caseId,revision:currentRevision+1,template:old?.template??context?.template??getTemplate(id),data:old?.data??sample.data,body:body??emptyBody(),updatedAt:new Date().toISOString()};
      db.prepare('INSERT INTO reports VALUES (?,?,?) ON CONFLICT(hospital,case_id) DO UPDATE SET payload=excluded.payload').run(id,caseId,JSON.stringify(report));return report;
    }, close:()=>db.close(),
  };
}
