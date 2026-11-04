// 【学习10】纯分页算法：接收节点数组与 fits 测量函数，返回每页节点数组，不依赖 Vue/DOM。
// 浏览器传实际排版测量；单元测试传可预测的高度规则。这里处理的是打印副本，不改原报告。
// Pagination works on a copy of the native document. `fits` measures actual
// printed geometry in the browser; tests inject deterministic measurements.
const clone=value=>JSON.parse(JSON.stringify(value));
const empty=()=>({type:'paragraph'});
const withContent=(node,content)=>({...node,content});
const hasContent=node=>node.type==='reportImage'?!!node.attrs?.imageId:node.type==='text'?!!node.text:node.type==='hardBreak'||node.type==='horizontalRule'||(node.content??[]).some(hasContent);
const length=node=>node.type==='text'?Array.from(node.text).length:node.type==='hardBreak'?1:(node.content??[]).reduce((n,c)=>n+length(c),0);
// 这里 from/to 是本函数按文字码点计算的切片范围，不是 ProseMirror 文档 pos。
// 保留节点上的 marks 等信息，因此分页拆字不会丢掉加粗等格式；hardBreak 也占一个单位。
function sliceInline(content,from,to){
  const result=[];let pos=0;
  for(const node of content??[]){const size=length(node),start=Math.max(0,from-pos),end=Math.min(size,to-pos);if(end>start)result.push(node.type==='text'?{...node,text:Array.from(node.text).slice(start,end).join('')}:clone(node));pos+=size}
  return result;
}
// 取“最少后续内容”供标题跟随判断；不是浏览器真实第一行的文本测量器。
function firstLine(node){
  if(['paragraph','heading'].includes(node.type))return withContent(node,sliceInline(node.content,0,1));
  if(!node.content?.length)return node;
  if(['columns','tableRow'].includes(node.type))return withContent(node,node.content.map(firstLine));
  return withContent(node,[firstLine(node.content[0])]);
}
// Turn vertical spans into explicit continuation cells before splitting tables.
// Original text occurs only in the starting cell, never copied into continuations.
function normalizeRows(table){
  const pending=[];
  return withContent(table,table.content.map(row=>{
    const cells=[];let col=0;
    const carry=()=>{while(pending[col]){const entry=pending[col];cells.push({...clone(entry.cell),content:[empty()],attrs:{...entry.cell.attrs,rowspan:1}});entry.left--;const width=entry.cell.attrs?.colspan??1;if(!entry.left)pending[col]=null;col+=width}};
    for(const cell of row.content){carry();const span=cell.attrs?.colspan??1,rows=cell.attrs?.rowspan??1;if(rows>1)pending[col]={left:rows-1,cell};cells.push({...cell,attrs:{...cell.attrs,rowspan:1}});col+=span}
    carry();return withContent(row,cells);
  }));
}
export function preparePrintBody(body){
  // 预处理会清空打印副本的表格固定列宽，去掉空图提示；保留编辑文档和保存数据不变。
  // 只清理打印副本：空影像位置不打印，空栏和单元格仍需合法的占位段落。
  function clean(node){
    if(node.type==='reportImage'&&!node.attrs?.imageId)return null;
    if(['tableCell','tableHeader'].includes(node.type))node={...node,attrs:{...node.attrs,colwidth:null}};
    if(!node.content)return clone(node);
    let result=withContent(node,node.content.map(clean).filter(Boolean));
    if(node.type==='columns'&&!result.content.some(hasContent))return null;
    if(['column','tableCell','tableHeader'].includes(node.type)&&!result.content.length)result.content=[empty()];
    if(node.type==='table')result=normalizeRows(result);
    return result;
  }
  return (body?.content??[]).map(clean).filter(Boolean);
}
// 从一串子块里拿尽可能多的头部；第一个放不下的块再递归尝试拆分，返回 [本页, 剩余]。
function splitFlow(nodes,fits){
  const head=[];
  for(let i=0;i<nodes.length;i++){
    const node=nodes[i];
    if(fits([...head,node])){head.push(node);continue}
    const [a,b]=splitBlock(node,pieces=>fits([...head,...pieces]));
    if(a)head.push(a);
    return [head,[...(b?[b]:[]),...nodes.slice(i+1)]];
  }
  return [head,[]];
}
export function splitBlock(node,fits){
  // 统一约定：[head, tail]；null head 表示本页连可安全拆出的一段都放不下。
  if(fits([node]))return [node,null];
  if(['paragraph','heading'].includes(node.type)){
    // 二分查找最大可容纳文字量，每次候选由调用方 fits 实际验证，不按固定字数武断分页。
    const size=length(node);let low=1,high=size-1,best=0;
    while(low<=high){const mid=Math.floor((low+high)/2);if(fits([withContent(node,sliceInline(node.content,0,mid))])){best=mid;low=mid+1}else high=mid-1}
    return best?[withContent(node,sliceInline(node.content,0,best)),withContent(node,sliceInline(node.content,best,size))]:[null,node];
  }
  if(node.type==='columns'){
    // 每栏独立续页，但保留栏顺序和空栏，避免长短不一时丢失内容。
    // 同时保留每栏 head/tail，短栏续页用空段落占位，不能把后面栏挪到前面栏的位置。
    const heads=node.content.map(col=>withContent(col,[empty()])),tails=heads.map(clone);let progress=false,remaining=false;
    node.content.forEach((col,index)=>{
      const [head,tail]=splitFlow(col.content??[],content=>{const candidate=heads.map(clone);candidate[index]=withContent(col,content.length?content:[empty()]);return fits([withContent(node,candidate)])});
      heads[index]=withContent(col,head.length?head:[empty()]);tails[index]=withContent(col,tail.length?tail:[empty()]);progress ||= head.some(hasContent);remaining ||= tail.some(hasContent);
    });
    return progress?[withContent(node,heads),remaining?withContent(node,tails):null]:[null,node];
  }
  if(node.type==='table'){
    // 跨页时重复表头；普通行优先整体移至下一页，过高的行再按单元格拆分。
    const rows=node.content??[];let headerCount=0;
    while(headerCount<rows.length&&rows[headerCount].content.every(c=>c.type==='tableHeader'))headerCount++;
    const headers=rows.slice(0,headerCount),head=[...headers];
    if(!fits([withContent(node,headers)])||headerCount===rows.length)return [null,node];
    for(let i=headerCount;i<rows.length;i++){
      if(fits([withContent(node,[...head,rows[i]])])){head.push(rows[i]);continue}
      // Prefer a normal row break; split cells only when even a fresh page cannot
      // accommodate this row (the caller first tries a fresh page).
      if(head.length>headerCount)return [withContent(node,head),withContent(node,[...headers,...rows.slice(i)])];
      const row=rows[i],heads=row.content.map(c=>withContent(c,[empty()])),tails=heads.map(clone);let progress=false,remaining=false;
      row.content.forEach((cell,index)=>{
        const [a,b]=splitFlow(cell.content??[],content=>{const cells=heads.map(clone);cells[index]=withContent(cell,content.length?content:[empty()]);return fits([withContent(node,[...headers,withContent(row,cells)])])});
        heads[index]=withContent(cell,a.length?a:[empty()]);tails[index]=withContent(cell,b.length?b:[empty()]);progress ||= a.some(hasContent);remaining ||= b.some(hasContent);
      });
      if(!progress)return [null,node];
      return [withContent(node,[...headers,withContent(row,heads)]),remaining||i+1<rows.length?withContent(node,[...headers,...(remaining?[withContent(row,tails)]:[]),...rows.slice(i+1)]):null];
    }
    return [node,null];
  }
  if(['bulletList','orderedList','listItem','blockquote','column','tableCell','tableHeader'].includes(node.type)){
    const [a,b]=splitFlow(node.content??[],content=>fits([withContent(node,content)]));
    if(!a.length)return [null,node];
    const head=withContent(node,a),tail=b.length?withContent(node,b):null;
    // 有序列表跨页延续编号；若本页只截了同一列表项的一部分，续页不能提前加一号。
    if(tail&&node.type==='orderedList')tail.attrs={...node.attrs,start:(node.attrs?.start??1)+a.length-(a.at(-1)===node.content[a.length-1]?0:1)};
    if(tail&&node.type==='listItem'&&tail.content[0]?.type!=='paragraph')tail.content.unshift(empty());
    return [head,tail];
  }
  return [null,node];
}
export function paginate(blocks,fits){
  // 首页表头占用空间，续页的可用高度可能不同；签名作为最后一个内容块参与测量。
  // queue 是尚未排完的队列；page 是当前页，pages 是已完成页。拆出的 tail 会重新入队。
  const queue=clone(blocks),pages=[];let page=[],steps=0;
  const fitsHere=nodes=>fits(nodes,pages.length),fitsNext=nodes=>fits(nodes,pages.length+1);
  while(queue.length){
    // 次数上限和下方无法安全分页的错误，是防止异常内容让预览无止境重试。
    if(++steps>20000)throw Error('报告过长，无法完成分页，请减少内容后重试');
    const block=queue.shift();
    if(block.type==='heading'&&queue.length&&page.length&&!fitsHere([...page,block,firstLine(queue[0])])){pages.push(page);page=[]}
    if(fitsHere([...page,block])){page.push(block);continue}
    let headingStart=page.length;
    while(headingStart>0&&page[headingStart-1].type==='heading')headingStart--;
    if(headingStart>0&&headingStart<page.length){const headings=page.splice(headingStart);pages.push(page);page=[];queue.unshift(...headings,block);continue}
    // 整块在下一页能放下时优先换页；特别处理签名，尽量带一点正文一起去末页。
    if(page.length&&headingStart>0&&fitsNext([block])){
      if(block.type==='printSignature'&&page.length>1&&fitsNext([page.at(-1),block])){const last=page.pop();pages.push(page);page=[last,block]}
      else{pages.push(page);page=[block]}
      continue;
    }
    if(block.type==='table'&&page.length&&headingStart>0){
      const rows=block.content??[];let count=0;
      while(count<rows.length&&rows[count].content.every(cell=>cell.type==='tableHeader'))count++;
      const firstRow=withContent(block,rows.slice(0,count+1));
      if(!fitsHere([...page,firstRow])&&fitsNext([firstRow])){pages.push(page);page=[];queue.unshift(block);continue}
    }
    const [head,tail]=splitBlock(block,pieces=>fitsHere([...page,...pieces]));
    if(head){page.push(head);pages.push(page);page=[];if(tail)queue.unshift(tail)}
    else if(page.length){pages.push(page);page=[];queue.unshift(block)}
    else throw Error(`内容块（${block.type}）超出单页可用区域，无法安全分页；请调整字号、表头或布局`);
  }
  if(page.length||!pages.length)pages.push(page);
  return pages;
}
