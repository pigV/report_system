const port = process.env.CDP_PORT || '9339';
const appUrl = process.env.APP_URL || 'http://127.0.0.1:5174/';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function checkEditor(native, zoom) {
  const selector = native ? '.native-editor .tiptap' : '.body-editor .tiptap';
  const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (!pending.has(message.id)) return;
    const [resolve, reject] = pending.get(message.id);
    pending.delete(message.id);
    message.error ? reject(Error(message.error.message)) : resolve(message.result);
  };
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const current = ++id;
    pending.set(current, [resolve, reject]);
    ws.send(JSON.stringify({ id: current, method, params }));
  });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const mouse = (type, x, y, extra = {}) => call('Input.dispatchMouseEvent', { type, x, y, ...extra });
  const rect = async expression => JSON.parse(await evaluate(`JSON.stringify((()=>{
    const r=(${expression}).getBoundingClientRect();
    return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
  })())`));
  const block = index => `document.querySelectorAll(${JSON.stringify(selector + ' > *')})[${index}]`;
  const menu = `Array.from(document.querySelectorAll('.side-menu')).find(e=>
    getComputedStyle(e).visibility==='visible' && e.closest('[data-tippy-root]')?.style.visibility==='visible')`;
  const check = (condition, message) => { if (!condition) throw Error(message); };
  try {
    await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false });
    await call('Page.navigate', { url: `${appUrl.split('#')[0]}${native ? '#native-templates' : ''}` });
    for (let i = 0; i < 80 && !await evaluate(`!!${block(1)}`); i++) await wait(100);
    check(await evaluate(`!!${block(1)}`), '编辑器未加载');
    await evaluate(`document.querySelector('.app-shell').style.zoom=${JSON.stringify(zoom)}`);
    for (let i = 0; i < 80 && !await evaluate(`Array.from(${block(0)}.querySelectorAll('img')).every(e=>e.complete)`); i++) await wait(100);
    let first = await rect(block(0));
    await mouse('mouseMoved', first.left + 60, first.top + 10);
    await wait(300);
    let control = await rect(menu);
    check(control.right <= first.left + 1, '控件遮挡首个内容块');
    const firstTop = control.top;
    const handle = await rect(`${menu}.querySelector('.o-drag-btn')`);
    const x = handle.left + handle.width / 2;
    const y = handle.top + handle.height / 2;
    await mouse('mouseMoved', x, y);
    await mouse('mousePressed', x, y, { button: 'left', clickCount: 1 });
    await mouse('mouseMoved', x, y + 20, { button: 'left', buttons: 1 });
    await wait(100);
    const lifted = await rect(block(0));
    check(Math.abs(lifted.top - first.top - 20) < 4, '拖拽块没有跟随指针');
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await mouse('mouseReleased', x, y + 20, { button: 'left', clickCount: 1 });
    await wait(400);
    first = await rect(block(0));
    await mouse('mouseMoved', first.left + 60, first.top + 10);
    await wait(250);
    if (first.height > 100) {
      await mouse('mouseMoved', first.left + 60, first.top + Math.min(first.height - 15, 150));
      await wait(300);
      control = await rect(menu);
      check(Math.abs(control.top - firstTop) < 3, '同一内容块内移动时控件没有保持位置');
    }
    const second = await rect(block(1));
    await mouse('mouseMoved', second.left + 60, second.top + 10);
    await wait(350);
    control = await rect(menu);
    check(control.right <= second.left + 1, '控件遮挡第二个内容块');
    check(Math.abs(control.top - second.top) < 30, '控件没有随悬停切换到第二个块');
    const add = await rect(`${menu}.querySelector('.o-add-btn')`);
    await mouse('mouseMoved', add.left + add.width / 2, add.top + add.height / 2);
    await mouse('mousePressed', add.left + add.width / 2, add.top + add.height / 2, { button: 'left', clickCount: 1 });
    await mouse('mouseReleased', add.left + add.width / 2, add.top + add.height / 2, { button: 'left', clickCount: 1 });
    await wait(350);
    check(await evaluate("!!document.querySelector('.native-slash-host')"), '添加按钮未打开插入菜单');
    console.log(`${native ? '自由模板' : '报告正文'}，缩放 ${zoom}: 通过`);
  } finally {
    ws.close();
    await fetch(`http://127.0.0.1:${port}/json/close/${tab.id}`);
  }
}

(async () => {
  for (const native of [false, true]) {
    for (const zoom of ['1', '1.25']) await checkEditor(native, zoom);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
