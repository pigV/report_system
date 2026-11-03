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
  {id:'cervical',category:'骨骼',name:'颈椎病',keywords:'颈椎 脊柱 骨骼',findings:'颈椎生理曲度变直，部分椎体序列欠稳。\nC4–C5、C5–C6 椎间隙变窄，相应节段椎间盘信号减低。\n椎体边缘可见骨质增生，颈髓形态尚可。',impression:'1. 颈椎退行性改变伴生理曲度变直。\n2. C4–C5、C5–C6 椎间盘膨出。\n3. 请结合临床症状。'},
  {id:'fracture',category:'骨骼',name:'骨折',keywords:'骨折 外伤',findings:'检查部位骨皮质连续性中断，可见线状低密度影，局部软组织肿胀。',impression:'骨折影像表现，建议结合临床检查。'},
  {id:'arthritis',category:'骨骼',name:'关节炎',keywords:'关节炎 关节',findings:'关节间隙变窄，关节面欠光整，边缘可见骨质增生。',impression:'关节退行性改变。'},
  {id:'chest-ct',category:'胸部',name:'胸部 CT 常规描述',keywords:'CT 平扫 正常',findings:'双肺透亮，气管通畅。',impression:'未见明显异常。'},
  {id:'chest-followup',category:'胸部',name:'肺结节随访',keywords:'CT 对比 复查',findings:'与前次检查对比：\n结节位置：\n结节大小及形态：',impression:'请结合本次影像与既往检查填写随访意见。'},
  {id:'chest-xray',category:'胸部',name:'胸部 X 线常规',keywords:'胸片 DR',findings:'胸廓对称，双肺纹理清晰，心影大小在正常范围。',impression:'心肺未见明显异常。'},
  {id:'abdomen-us',category:'腹部',name:'腹部超声常规',keywords:'超声 肝胆胰脾',findings:'肝脏：\n胆囊：\n胰腺：\n脾脏：',impression:'请根据本次检查填写超声提示。'},
  {id:'bone-xray',category:'骨骼',name:'骨关节 X 线描述',keywords:'骨折 关节 DR',findings:'检查部位：\n骨质及关节间隙：\n周围软组织：',impression:'请根据本次影像填写诊断意见。'},
];
export function filterTemplates(query='',category='全部'){
  const term=query.trim().toLocaleLowerCase();
  return templates.filter(t=>(category==='全部'||t.category===category) && `${t.name} ${t.keywords}`.toLocaleLowerCase().includes(term)).map(t=>({...t}));
}
const personalKey=(hospital,doctor)=>`report-demo:personal-templates:v1:${hospital}:${doctor}`;
export function loadPersonalTemplates(storage,hospital,doctor){
  const raw=storage.getItem(personalKey(hospital,doctor));
  const overrides=raw?JSON.parse(raw):{};
  if(!overrides||typeof overrides!=='object'||Array.isArray(overrides))throw Error('个人模板数据格式异常');
  return templates.map(t=>{
    const saved=overrides[t.id];
    return saved&&typeof saved.findings==='string'&&typeof saved.impression==='string'?{...t,findings:saved.findings,impression:saved.impression}:{...t};
  });
}
export function savePersonalTemplate(storage,hospital,doctor,entry){
  const list=loadPersonalTemplates(storage,hospital,doctor);
  const target=list.find(t=>t.id===entry.id);
  if(!target||typeof entry.findings!=='string'||typeof entry.impression!=='string')throw Error('个人模板内容无效');
  target.findings=entry.findings;target.impression=entry.impression;
  storage.setItem(personalKey(hospital,doctor),JSON.stringify(Object.fromEntries(list.map(t=>[t.id,{findings:t.findings,impression:t.impression}]))));
  return {...target};
}
