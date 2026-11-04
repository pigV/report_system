export const IMAGE_DRAG_TYPE='application/x-report-key-image';
const legacyImages=[
  {id:'cervical',name:'颈椎矢状位',detail:'MR · T2 / 序列 04',src:'/demo-images/cervical.svg'},
  {id:'lumbar',name:'腰椎矢状位',detail:'MR · T2 / 序列 06',src:'/demo-images/lumbar.svg'},
  {id:'knee',name:'膝关节冠状位',detail:'MR · PD / 序列 02',src:'/demo-images/knee.svg'},
];
export const keyImages=[
  '113623','113630','113634','113639','113642','113647','113650','113654',
].map((time,index)=>({id:`demo-${time}`,name:`影像 ${String(index+1).padStart(2,'0')}`,detail:`影像${String(index+1).padStart(2,'0')}的描述`,src:`/demo-images/key-images/20261104-${time}.jpg`}));
// 旧影像不再出现在演示列表中，但历史报告仍通过原 ID 解析它们。
export const keyImage=id=>keyImages.find(image=>image.id===id)??legacyImages.find(image=>image.id===id);
export function readImageDrop(raw,scope){
  // 拒绝其他医院或病例的拖放数据，避免把不同患者的影像混入报告。
  try{const value=JSON.parse(raw);return scope&&value.hospital===scope.hospital&&value.caseId===scope.caseId?(keyImage(value.id)??null):null}catch{return null}
}
