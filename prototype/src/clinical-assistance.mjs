// Explicitly fictional reference material, scoped to the demo patient identities.
const histories=[
  {id:'ct-aug',date:'2026-08-12',exam:'胸部 CT 平扫',findings:'双肺纹理清晰，气管及主要支气管通畅。纵隔未见明显肿大淋巴结。',impression:'胸部 CT 平扫未见明显异常。',doctor:'陈医生'},
  {id:'ct-mar',date:'2026-03-06',exam:'胸部 CT 平扫',findings:'双肺透亮，肺纹理分布自然。双侧胸腔未见积液。',impression:'双肺未见明显异常。',doctor:'李医生'},
  {id:'xray-nov',date:'2025-11-20',exam:'胸部 X 线',findings:'胸廓对称，双肺纹理清晰，心影大小在正常范围。',impression:'心肺未见明显异常。',doctor:'王医生'},
];
export function historyFor(hospitalId,caseId,patientNo){
  const patient={a:'A000128',b:'B000082'}[hospitalId];
  return patient && caseId===`${hospitalId}-1` && patientNo===patient ? structuredClone(histories) : [];
}
const templates=[
  {id:'chest-ct',category:'胸部',name:'胸部 CT 常规描述',keywords:'CT 平扫 正常',findings:'双肺透亮，气管通畅。',impression:'未见明显异常。'},
  {id:'chest-followup',category:'胸部',name:'肺结节随访',keywords:'CT 对比 复查',findings:'与前次检查对比：\n结节位置：\n结节大小及形态：',impression:'请结合本次影像与既往检查填写随访意见。'},
  {id:'chest-xray',category:'胸部',name:'胸部 X 线常规',keywords:'胸片 DR',findings:'胸廓对称，双肺纹理清晰，心影大小在正常范围。',impression:'心肺未见明显异常。'},
  {id:'abdomen-us',category:'腹部',name:'腹部超声常规',keywords:'超声 肝胆胰脾',findings:'肝脏：\n胆囊：\n胰腺：\n脾脏：',impression:'请根据本次检查填写超声提示。'},
  {id:'bone-xray',category:'骨骼',name:'骨关节 X 线描述',keywords:'骨折 关节 DR',findings:'检查部位：\n骨质及关节间隙：\n周围软组织：',impression:'请根据本次影像填写诊断意见。'},
];
export const templateCategories=['全部','胸部','腹部','骨骼'];
export function filterTemplates(query='',category='全部'){
  const term=query.trim().toLocaleLowerCase();
  return templates.filter(t=>(category==='全部'||t.category===category) && `${t.name} ${t.keywords}`.toLocaleLowerCase().includes(term)).map(t=>({...t}));
}
export function templateBody(entry){
  const section=(title,text)=>[{type:'heading',attrs:{level:2},content:[{type:'text',text:title}]},...text.split('\n').map(text=>({type:'paragraph',...(text?{content:[{type:'text',text}]}:{})}))];
  return {type:'doc',content:[...section('影像所见',entry.findings),...section('诊断意见',entry.impression)]};
}
