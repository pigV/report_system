// 【学习11】Vite 的本地 API 中间件，不是 Vue 代码，也没有单独启动 Express。
// 读取/保存交给 store；configureServer 和 configurePreviewServer 使开发/预览都能访问 API。
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openStore } from './store.mjs';
import { openNativeStore } from './native-store.mjs';
import { hospitals, makeCases, pathOptions } from '../src/report-model.mjs';
export function reportApi() {
  let store, nativeStore;
  const register=server=>{
    // 相对模块 URL 定位项目 data 目录；懒初始化避免重复注册时反复打开同一数据库。
    if(!store) {const root=fileURLToPath(new URL('../data/',import.meta.url));mkdirSync(root,{recursive:true});store=openStore(`${root}/reports.sqlite`);nativeStore=openNativeStore(`${root}/native-templates.sqlite`,id=>store.getTemplate(id));}
    server.httpServer?.once('close',()=>{nativeStore?.close();nativeStore=null;store?.close();store=null;});
    server.middlewares.use(async(req,res,next)=>{
      // 非 API 请求交还 Vite 处理静态资源/页面；API 则始终返回 JSON。
      if(!req.url?.startsWith('/api/')) return next();
      res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
      const send=(data,status=200)=>{res.statusCode=status;res.end(JSON.stringify(data));};
      try {
        // 当前 HTTP 演示做同源写入检查；这不是用户登录/授权，不能作为完整身份认证。
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
          // HTTP 请求体以流送达，用 for await 收齐并限长；JSON.parse 后才是普通 JS 对象。
          let body='';for await(const chunk of req) {body+=chunk;if(body.length>1000000) return send({error:'内容过大，请缩短报告'},413);}
          const payload=JSON.parse(body);
          if(kind==='template') return send(store.saveTemplate(id,payload));
          if(kind==='native-template') return send(nativeStore.saveTemplate(id,payload));
          if(kind==='reports' && caseId) {
            if(!payload.context) return send({error:'缺少报告上下文，请重新加载'},400);
            // API 能保存不代表当前“提交报告”按钮已经接通；UI 入口仍由 App 决定。
            return send(store.saveReport(id,caseId,payload.body,payload.context));
          }
        }
        send({error:'不支持此操作'},405);
      } catch(err) {send({error:err.message||'保存失败'},400);}
    });
  };
  return {name:'local-report-api',configureServer:register,configurePreviewServer:register};
}
