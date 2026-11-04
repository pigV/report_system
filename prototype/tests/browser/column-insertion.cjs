const assert=require('node:assert/strict');
const port=process.env.CDP_PORT||'9339', appUrl=process.env.APP_URL||'http://127.0.0.1:5174/';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
  const tab=await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
  const ws=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  let id=0;const pending=new Map();
  ws.onmessage=event=>{const message=JSON.parse(event.data),task=pending.get(message.id);if(!task)return;pending.delete(message.id);message.error?task[1](Error(message.error.message)):task[0](message.result)};
  const call=(method,params={})=>new Promise((resolve,reject)=>{const request=++id;pending.set(request,[resolve,reject]);ws.send(JSON.stringify({id:request,method,params}))});
  const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value};
  const click=async point=>{await call('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1})};
  try{
    await call('Page.navigate',{url:new URL('/tests/browser/column-insertion.html',appUrl).href});
    await call('Page.bringToFront');
    for(let i=0;i<100&&!await evaluate('window.ready===true');i++)await wait(100);
    assert.ok(await evaluate('window.ready===true'));
    for(const kind of ['report','native']){
      assert.equal(await evaluate(`window.prepare(${JSON.stringify(kind)})`),true);
      for(let i=0;i<50&&!await evaluate('window.result().focused');i++)await wait(20);
      const before=await evaluate('window.result()');
      assert.equal(before.doc.content[0].type,'columns');
      assert.equal(before.doc.content[1].type,'paragraph');
      assert.equal(before.position,15);
      assert.equal(before.focused,true);
      await call('Input.insertText',{text:'后续文字'});
      const after=await evaluate('window.result()');
      assert.equal(after.doc.content[1].content[0].text,'后续文字');
      for(let index=0;index<3;index++){
        assert.equal(await evaluate(`window.prepare(${JSON.stringify(kind)})`),true);
        for(let i=0;i<50&&!await evaluate('window.result().focused');i++)await wait(20);
        const point=await evaluate(`window.columnPoint(${index})`);
        assert.equal(point.target,'column','click must hit the column padding');
        await click(point);
        const selection=await evaluate('window.result()');
        assert.equal(selection.textSelection,true,`${kind} column ${index+1} should focus text`);
        assert.equal(selection.parent,'paragraph');
        await call('Input.insertText',{text:'栏内文字'});
        const typed=await evaluate('window.result()');
        assert.equal(typed.doc.content[0].content[index].content[0].content[0].text,'栏内文字');
      }
      for(const type of ['column','columns']){
        assert.equal(await evaluate(`window.prepare(${JSON.stringify(kind)})`),true);
        for(let i=0;i<50&&!await evaluate('window.result().focused');i++)await wait(20);
        const point=await evaluate(`window.edgePoint(${JSON.stringify(type)})`);
        assert.equal(point.target,type==='column'?'column':'column-container');
        await click(point);
        const selected=await evaluate('window.result()');
        assert.equal(selected.selectedNode,type,`${kind} ${type} edge should select the layout: ${JSON.stringify({point,selected})}`);
      }
    }
    for(let index=0;index<4;index++){
      assert.equal(await evaluate('window.prepareImages()'),true);
      for(let i=0;i<50&&!await evaluate('window.result().focused');i++)await wait(20);
      for(let i=0;i<100&&!await evaluate("[...document.querySelectorAll('[data-report-image] img')].every(img=>img.complete&&img.naturalWidth)");i++)await wait(20);
      const before=await evaluate('window.result()');
      assert.equal(before.doc.content.at(-1).type,'paragraph');
      assert.equal(before.rootIndex,2);
      assert.equal(before.parent,'paragraph');
      const point=await evaluate(`window.columnPoint(${index})`);
      assert.equal(point.target,'column');
      await click(point);
      const selection=await evaluate('window.result()');
      assert.equal(selection.textSelection,true,`image column ${index+1} should focus text`);
      assert.equal(selection.parent,'paragraph');
      await call('Input.insertText',{text:'影像说明'});
      const typed=await evaluate('window.result()');
      assert.equal(typed.doc.content[Math.floor(index/2)].content[index%2].content[1].content[0].text,'影像说明');
    }
    assert.equal(await evaluate('window.prepareImages()'),true);
    for(let i=0;i<50&&!await evaluate('window.result().focused');i++)await wait(20);
    for(let i=0;i<100&&!await evaluate("[...document.querySelectorAll('[data-report-image] img')].every(img=>img.complete&&img.naturalWidth)");i++)await wait(20);
    await click(await evaluate(`window.imagePoint('[data-report-image] img')`));
    assert.equal((await evaluate('window.result()')).selectedNode,'reportImage','image clicks keep selecting the image');
    for(const type of ['column','columns']){
      assert.equal(await evaluate('window.prepareImages()'),true);
      for(let i=0;i<50&&!await evaluate('window.result().focused');i++)await wait(20);
      for(let i=0;i<100&&!await evaluate("[...document.querySelectorAll('[data-report-image] img')].every(img=>img.complete&&img.naturalWidth)");i++)await wait(20);
      const point=await evaluate(`window.edgePoint(${JSON.stringify(type)})`);
      assert.equal(point.target,type==='column'?'column':'column-container');
      await click(point);
      assert.equal((await evaluate('window.result()')).selectedNode,type,`image layout ${type} edge should remain selectable`);
    }
    console.log('报告正文与自由模板：分栏后光标及键盘输入通过');
  }finally{ws.close();await fetch(`http://127.0.0.1:${port}/json/close/${tab.id}`)}
})().catch(error=>{console.error(error);process.exitCode=1});
