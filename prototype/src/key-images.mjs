export const IMAGE_DRAG_TYPE='application/x-report-key-image';
export const keyImages=[
  {id:'cervical',name:'颈椎矢状位',detail:'MR · T2 / 序列 04',src:'/demo-images/cervical.svg'},
  {id:'lumbar',name:'腰椎矢状位',detail:'MR · T2 / 序列 06',src:'/demo-images/lumbar.svg'},
  {id:'knee',name:'膝关节冠状位',detail:'MR · PD / 序列 02',src:'/demo-images/knee.svg'},
];
export const keyImage=id=>keyImages.find(image=>image.id===id);
export function readImageDrop(raw,scope){
  try{const value=JSON.parse(raw);return scope&&value.hospital===scope.hospital&&value.caseId===scope.caseId?(keyImage(value.id)??null):null}catch{return null}
}
