const assert = require('node:assert/strict');
const port = process.env.CDP_PORT || '9339';
const appUrl = process.env.APP_URL || 'http://127.0.0.1:5174/';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {method:'PUT'})).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  let id=0;
  const pending=new Map();
  ws.onmessage=event=>{
    const message=JSON.parse(event.data), task=pending.get(message.id);
    if(!task)return;
    pending.delete(message.id);
    message.error?task[1](Error(message.error.message)):task[0](message.result);
  };
  const call=(method,params={})=>new Promise((resolve,reject)=>{
    const request=++id;pending.set(request,[resolve,reject]);ws.send(JSON.stringify({id:request,method,params}));
  });
  const evaluate=async expression=>{
    const result=await call('Runtime.evaluate',{expression,returnByValue:true});
    if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
    return result.result.value;
  };
  try{
    await call('Page.navigate',{url:new URL('/tests/browser/column-backspace.html',appUrl).href});
    for(let i=0;i<100&&!await evaluate('window.ready===true');i++)await wait(100);
    assert.ok(await evaluate('window.ready===true'),'测试页面未加载');
    for(const kind of ['report','native'])for(const text of ['', '文字']){
      const before=await evaluate(`window.prepare(${JSON.stringify(kind)},${JSON.stringify(text)})`);
      await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});
      await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});
      assert.deepEqual(await evaluate('window.result()'),before,`${kind} 退格不能更改分栏或段落`);
    }
    for(const kind of ['report','native']){
      await evaluate(`window.prepare(${JSON.stringify(kind)},'文字',2)`);
      await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});
      await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});
      assert.equal((await evaluate('window.result()')).content[1].content[0].text,'文',`${kind} 文字内正常退格`);
    }
    console.log('报告正文与自由模板：分栏边界和普通文字退格通过');
  }finally{
    ws.close();
    await fetch(`http://127.0.0.1:${port}/json/close/${tab.id}`);
  }
})().catch(error=>{console.error(error);process.exitCode=1});
