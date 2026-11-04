import test from 'node:test';
import assert from 'node:assert/strict';
import {paginate,splitBlock,preparePrintBody} from '../src/printing/paginate.mjs';
const p=text=>({type:'paragraph',content:[{type:'text',text}]});
const text=n=>Array.isArray(n)?n.map(text).join(''):n.text??(n.content??[]).map(text).join('');
const height=n=>Array.isArray(n)?n.reduce((s,v)=>s+height(v),0):n.type==='columns'||n.type==='tableRow'?Math.max(...n.content.map(height)):n.type==='paragraph'||n.type==='heading'?Math.max(1,Math.ceil(text(n).length/10)):(n.content??[]).reduce((s,v)=>s+height(v),0);
const fit=nodes=>height(nodes)<=10;

test('paginate preserves styled text and source, splitting a paragraph beyond a page',()=>{
  const source=[{...p('长段落'.repeat(110)),content:[{type:'text',text:'长段落'.repeat(110),marks:[{type:'bold'}]}]}];
  const before=JSON.stringify(source),pages=paginate(source,fit);
  assert.ok(pages.length>1);assert.equal(text(pages.flat()),text(source));assert.equal(JSON.stringify(source),before);
  for(const page of pages){assert.ok(fit(page));assert.equal(page[0].content[0].marks[0].type,'bold')}
});
test('headings follow the next paragraph and exact fit yields no blank last page',()=>{
  const heading={type:'heading',attrs:{level:2},content:[{type:'text',text:'诊断'}]};
  const pages=paginate([p('x'.repeat(100)),heading,p('y'.repeat(20))],fit);
  assert.equal(pages.length,2);assert.equal(pages[1][0].type,'heading');assert.ok(pages.every(p=>p.length));
  assert.deepEqual(paginate([],fit),[[]]);
});
test('uneven columns continue without changing column order or dropping content',()=>{
  const block={type:'columns',content:[{type:'column',content:[p('A'.repeat(270))]},{type:'column',content:[p('B'.repeat(145))]}]};
  const pages=paginate([block],fit);
  for(let column=0;column<2;column++)assert.equal(pages.map(page=>text(page[0].content[column])).join(''),text(block.content[column]));
  assert.ok(pages.every(fit));
});
test('tables repeat headers and split an oversized row without losing cell text',()=>{
  const cell=(type,value)=>({type,content:[p(value)]});
  const table={type:'table',content:[{type:'tableRow',content:[cell('tableHeader','项目'),cell('tableHeader','描述')]},{type:'tableRow',content:[cell('tableCell','a'.repeat(220)),cell('tableCell','b'.repeat(130))]}]};
  const pages=paginate([table],fit);assert.ok(pages.length>1);
  for(const page of pages){assert.ok(fit(page));assert.equal(text(page[0].content[0]),'项目描述')}
  for(let i=0;i<2;i++)assert.equal(pages.map(page=>page[0].content.slice(1).map(row=>text(row.content[i])).join('')).join(''),text(table.content[1].content[i]));
});
test('empty image slots are omitted without deleting surrounding text or changing source',()=>{
  const input={type:'doc',content:[p('保留'),{type:'reportImage',attrs:{imageId:null}},{type:'columns',content:[{type:'column',content:[{type:'reportImage',attrs:{imageId:null}}]}]}]};
  assert.equal(preparePrintBody(input).length,1);assert.equal(input.content.length,3);
});
test('an unsplittable object raises a visible error instead of clipping or looping',()=>{
  assert.throws(()=>paginate([{type:'reportImage',attrs:{imageId:'knee'}}],()=>false),/无法|超出/);
});

test('a heading is not left behind when its following short paragraph moves to a new page',()=>{
  const heading={type:'heading',content:[{type:'text',text:'标题'}]};
  const pages=paginate([p('a'.repeat(80)),heading,p('b'.repeat(50))],fit);
  assert.equal(pages[0].at(-1).type,'paragraph');assert.equal(pages[1][0].type,'heading');
});
test('signature appears once at the end and keeps preceding block when space allows',()=>{
  const fits=blocks=>blocks.reduce((s,b)=>s+(b.type==='printSignature'?3:height(b)),0)<=10;
  const pages=paginate([p('a'.repeat(60)),p('b'.repeat(30)),{type:'printSignature'}],fits);
  assert.equal(pages.length,2);assert.equal(pages[1][0].content[0].text,'b'.repeat(30));assert.equal(pages[1][1].type,'printSignature');
});
test('rowspan normalization preserves text and keeps the covered column in continuation rows',()=>{
  const body={type:'doc',content:[{type:'table',content:[{type:'tableRow',content:[{type:'tableCell',attrs:{rowspan:2,colspan:1},content:[p('A')]},{type:'tableCell',content:[p('B')]}]},{type:'tableRow',content:[{type:'tableCell',content:[p('C')]}]}]}]};
  const [table]=preparePrintBody(body);assert.equal(table.content[1].content.length,2);assert.equal(text(table),'ABC');assert.equal(text(table.content[1].content[0]),'');
});

test('resized table widths are normalized on the print copy only',()=>{
  const cell={type:'tableCell',attrs:{colwidth:[900]},content:[p('wide')]};
  const [table]=preparePrintBody({content:[{type:'table',content:[{type:'tableRow',content:[cell]}]}]});
  assert.equal(table.content[0].content[0].attrs.colwidth,null);assert.deepEqual(cell.attrs.colwidth,[900]);
});
test('a normal first row moves intact to a fresh page',()=>{
  const table={type:'table',content:Array.from({length:3},()=>({type:'tableRow',content:[{type:'tableCell',content:[p('a'.repeat(50))]}]}))};
  const pages=paginate([p('b'.repeat(80)),table],fit);
  assert.equal(pages[0].length,1);assert.equal(text(pages[1][0].content[0]).length,50);assert.equal(text(pages.flat()),'b'.repeat(80)+'a'.repeat(150));
});

test('continuation pages use their larger capacity without losing text',()=>{
  const source=[p('a'.repeat(250))];
  const pages=paginate(source,(nodes,pageIndex)=>height(nodes)<=(pageIndex===0?5:10));
  assert.deepEqual(pages.map(page=>text(page).length),[50,100,100]);
  assert.equal(text(pages.flat()),text(source));
});

test('an intact block moves to a continuation page when it fits there',()=>{
  const pages=paginate([p('a'.repeat(40)),p('b'.repeat(60))],(nodes,pageIndex)=>height(nodes)<=(pageIndex===0?5:10));
  assert.deepEqual(pages.map(page=>page.map(text)),[['a'.repeat(40)],['b'.repeat(60)]]);
});
