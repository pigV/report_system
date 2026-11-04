const port=process.env.CDP_PORT||'9339';
const url=process.env.APP_URL||'http://127.0.0.1:5180/';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

(async()=>{
  const tab=await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`,{method:'PUT'})).json();
  const ws=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
  let id=0;const pending=new Map();
  ws.onmessage=event=>{const message=JSON.parse(event.data),entry=pending.get(message.id);if(!entry)return;pending.delete(message.id);message.error?entry[1](Error(message.error.message)):entry[0](message.result)};
  const call=(method,params={})=>new Promise((resolve,reject)=>{const current=++id;pending.set(current,[resolve,reject]);ws.send(JSON.stringify({id:current,method,params}))});
  const evaluate=async expression=>{const result=await call('Runtime.evaluate',{expression,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.text);return result.result.value};
  const click=async selector=>{
    const rect=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing ${selector}');e.scrollIntoView({block:'center',inline:'center'});const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
    await call('Input.dispatchMouseEvent',{type:'mouseMoved',...rect});
    await call('Input.dispatchMouseEvent',{type:'mousePressed',...rect,button:'left',clickCount:1});
    await call('Input.dispatchMouseEvent',{type:'mouseReleased',...rect,button:'left',clickCount:1});
    await wait(200);
  };
  const check=(condition,message)=>{if(!condition)throw Error(message)};
  const key=async(key,code=key,modifiers=0)=>{
    await call('Input.dispatchKeyEvent',{type:'keyDown',key,code,modifiers});
    await call('Input.dispatchKeyEvent',{type:'keyUp',key,code,modifiers});
  };
  try{
    await call('Emulation.setDeviceMetricsOverride',{width:1800,height:1200,deviceScaleFactor:1,mobile:false});
    for(let i=0;i<120&&!await evaluate("!!document.querySelector('.body-editor .tiptap p') && !!document.querySelector('.personal-sidebar .cite-action')");i++)await wait(100);
    const before=await evaluate("document.querySelector('.body-editor .tiptap').textContent");
    await click('.personal-sidebar .cite-action');
    check(!await evaluate("!!document.querySelector('.toast-message')"),'未定位时出现提示');
    check(await evaluate("document.querySelector('.body-editor .tiptap').textContent")===before,'未定位时修改了正文');
    for(const sidebar of ['.personal-sidebar','.evidence-sidebar']){
      await click('.body-editor .tiptap p');
      const state=await evaluate(`(()=>{const root=document.querySelector('.body-editor .tiptap'),s=window.getSelection(),range=document.createRange();range.selectNodeContents(root);range.setEnd(s.focusNode,s.focusOffset);return {text:root.textContent,offset:range.toString().length,findings:document.querySelector('${sidebar} .clinical-text-field textarea').value,impression:document.querySelectorAll('${sidebar} .clinical-text-field textarea')[1].value}})()`);
      await click(`${sidebar} .cite-action`);
      check(!await evaluate("!!document.querySelector('.toast-message')"),`${sidebar} 引用时出现提示`);
      const after=await evaluate("document.querySelector('.body-editor .tiptap').textContent");
      const inserted=state.findings.replace(/\r?\n/g,'')+state.impression.replace(/\r?\n/g,'');
      check(after===state.text.slice(0,state.offset)+inserted+state.text.slice(state.offset),`${sidebar} 没有在定位处插入两项内容`);
      await call('Input.dispatchKeyEvent',{type:'keyDown',key:'z',code:'KeyZ',windowsVirtualKeyCode:90,modifiers:2});
      await call('Input.dispatchKeyEvent',{type:'keyUp',key:'z',code:'KeyZ',windowsVirtualKeyCode:90,modifiers:2});
      await wait(200);
      check(await evaluate("document.querySelector('.body-editor .tiptap').textContent")===state.text,`${sidebar} 无法单步撤销`);
      console.log(`${sidebar}: 光标插入及单步撤销通过`);
    }
    for(const label of ['文本','一级标题','二级标题','三级标题','无序列表','有序列表','引用','分割线','表格','分栏','二张图片','三张图片','四张图片','六张图片','关键影像','自定义图片栏']){
      await click('.body-editor .tiptap p');
      await key('End');await key('Enter');
      await call('Input.insertText',{text:'/'});
      for(let i=0;i<30&&!await evaluate("!!document.querySelector('.native-slash-menu')");i++)await wait(100);
      const beforeInsertion=await evaluate("document.querySelector('.body-editor .tiptap').innerHTML");
      const found=await evaluate(`(()=>{const e=[...document.querySelectorAll('.native-slash-menu [role=option]')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!e)return false;e.dataset.citationTest='target';return true})()`);
      check(found,`${label} 插入菜单未打开`);
      await click('[data-citation-test=target]');
      if(label==='分栏')await click('[aria-label="插入2栏"]');
      if(label==='关键影像'){
        await click('.key-image-picker [role=checkbox]');
        await click('.key-image-insert');
      }
      if(label==='自定义图片栏')await click('.picture-layout-fields + .dialog-actions .primary-button');
      const selected=await evaluate("(()=>{const s=window.getSelection(),e=s.focusNode?.nodeType===1?s.focusNode:s.focusNode?.parentElement;return {inBody:!!e?.closest('.body-editor .tiptap'),tag:e?.closest('p')?.tagName,previous:e?.closest('p')?.previousElementSibling?.outerHTML.slice(0,200)}})()");
      check(selected.inBody&&selected.tag==='P'&&selected.previous,`${label} 创建后光标不在块后面的正文行：${JSON.stringify(selected)}`);
      const beforeCitation=await evaluate("document.querySelector('.body-editor .tiptap').innerHTML");
      await click('.personal-sidebar .cite-action');
      const afterCitation=await evaluate("document.querySelector('.body-editor .tiptap').innerHTML");
      check(afterCitation!==beforeCitation,`${label} 创建后不能直接引用`);
      check(!await evaluate("!!document.querySelector('.toast-message')"),`${label} 引用出现提示`);
      await key('z','KeyZ',2);await wait(150);
      check(await evaluate("document.querySelector('.body-editor .tiptap').innerHTML")===beforeCitation,`${label} 引用无法单步撤销`);
      await key('z','KeyZ',2);await wait(150);
      const afterUndo=await evaluate("document.querySelector('.body-editor .tiptap').innerHTML");
      const clean=html=>html.replace(/data-decoration-id="[^"]+"/g,'');
      check(clean(afterUndo)===clean(beforeInsertion),`${label} 创建无法单步撤销`);
      console.log(`${label}: 创建后直接引用通过`);
    }
    await click('.body-editor .tiptap p');await key('End');await key('Enter');
    await call('Input.insertText',{text:'/'});await wait(250);
    await evaluate("[...document.querySelectorAll('.native-slash-menu [role=option]')].find(e=>e.textContent.trim()==='分栏').dataset.citationTest='column'");
    await click('[data-citation-test=column]');await click('[aria-label="插入2栏"]');
    await click('.body-editor .tiptap [data-type=column] p');
    await call('Input.insertText',{text:'/'});await wait(250);
    await evaluate("[...document.querySelectorAll('.native-slash-menu [role=option]')].find(e=>e.textContent.trim()==='关键影像').dataset.citationTest='images'");
    await click('[data-citation-test=images]');
    await click('.key-image-picker [role=checkbox]:nth-child(1)');
    await click('.key-image-picker [role=checkbox]:nth-child(2)');
    await click('.key-image-insert');
    const columnResult=await evaluate("(()=>{const s=window.getSelection(),e=s.focusNode?.nodeType===1?s.focusNode:s.focusNode?.parentElement,p=e?.closest('p'),column=p?.closest('[data-type=column]');return {inColumn:!!column,previous:p?.previousElementSibling?.outerHTML,images:column?.querySelectorAll('[data-report-image]').length}})()");
    check(columnResult.inColumn&&columnResult.images===2&&columnResult.previous?.includes('data-report-image'),`栏内插入影像后光标不在当前栏的影像后面：${JSON.stringify(columnResult)}`);
    const beforeColumnCitation=await evaluate("document.querySelector('.body-editor .tiptap').innerHTML");
    await click('.evidence-sidebar .cite-action');
    check(await evaluate("document.querySelector('.body-editor .tiptap').innerHTML")!==beforeColumnCitation,'栏内影像后不能直接引用');
    await key('z','KeyZ',2);await wait(150);
    check(await evaluate("document.querySelector('.body-editor .tiptap').innerHTML")===beforeColumnCitation,'栏内引用无法单步撤销');
    console.log('栏内关键影像: 创建后直接引用通过');
  }finally{ws.close();await fetch(`http://127.0.0.1:${port}/json/close/${tab.id}`)}
})().catch(error=>{console.error(error);process.exitCode=1});
