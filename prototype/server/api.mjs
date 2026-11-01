import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openStore } from './store.mjs';
import { openNativeStore } from './native-store.mjs';
import { hospitals, makeCases, pathOptions } from '../src/report-model.mjs';
export function reportApi() {
  let store, nativeStore;
  const register=server=>{
    if(!store) {const root=fileURLToPath(new URL('../data/',import.meta.url));mkdirSync(root,{recursive:true});store=openStore(`${root}/reports.sqlite`);nativeStore=openNativeStore(`${root}/native-templates.sqlite`,id=>store.getTemplate(id));}
    server.httpServer?.once('close',()=>{nativeStore?.close();nativeStore=null;store?.close();store=null;});
    server.middlewares.use(async(req,res,next)=>{
      if(!req.url?.startsWith('/api/')) return next();
      res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
      const send=(data,status=200)=>{res.statusCode=status;res.end(JSON.stringify(data));};
      try {
        if(req.method==='PUT' && req.headers.origin && req.headers.origin!==`http://${req.headers.host}`) return send({error:'不允许跨站保存'},403);
        const path=req.url.split('?')[0];
        if(path==='/api/hospitals' && req.method==='GET') return send({hospitals,pathOptions});
        const m=path.match(/^\/api\/hospitals\/([ab])\/(template|native-template|cases|reports)(?:\/([ab]-[12]))?$/);
        if(!m) return send({error:'接口不存在'},404);
        const [,id,kind,caseId]=m;
        if(req.method==='GET') {
          if(kind==='template') return send(store.getTemplate(id));
          if(kind==='native-template') return send(nativeStore.getTemplate(id));
          if(kind==='cases') return send(caseId?store.getCase(id,caseId):makeCases(id).map(({id,label})=>({id,label})));
          if(kind==='reports' && caseId) return send(store.getReport(id,caseId));
        }
        if(req.method==='PUT') {
          let body='';for await(const chunk of req) {body+=chunk;if(body.length>1000000) return send({error:'内容过大，请缩短报告'},413);}
          const payload=JSON.parse(body);
          if(kind==='template') return send(store.saveTemplate(id,payload));
          if(kind==='native-template') return send(nativeStore.saveTemplate(id,payload));
          if(kind==='reports' && caseId) {
            if(!payload.context) return send({error:'缺少报告上下文，请重新加载'},400);
            return send(store.saveReport(id,caseId,payload.body,payload.context));
          }
        }
        send({error:'不支持此操作'},405);
      } catch(err) {send({error:err.message||'保存失败'},400);}
    });
  };
  return {name:'local-report-api',configureServer:register,configurePreviewServer:register};
}
