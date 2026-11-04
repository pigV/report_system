// 【学习03】报告演示专用的展示适配，不会修改医院模板或已保存的病例快照。
// ReportPaper 与打印 renderHeader/renderSignature 共用它，保证两边显示相同字段。
export const demoReportTitle='瑞派宠物影像诊断中心';
export const demoReportSubtitle='影像诊断报告';
export const demoLogo='/demo-images/hospital-logo.png';
export const demoSignature='/demo-images/report-signature.jpg';

export function demoReportFields(data){
  // Old snapshots retain their original data; correct only this known demo case's display.
  const demoPet=data?.exam?.no==='CT20261101001' && ['A000128','B000082'].includes(data?.patient?.no) && ['林晓','毛豆'].includes(data?.patient?.name);
  return [
    {label:'名字',value:demoPet ? '毛豆' : data?.patient?.name ?? '毛豆'},
    {label:'种类',value:data?.patient?.species ?? '犬'},
    {label:'品种',value:data?.patient?.breed ?? '金毛'},
    {label:'性别',value:demoPet ? '雌' : data?.patient?.gender ?? '雄性'},
    {label:'年龄',value:demoPet && data?.patient?.age==='32岁' ? '2岁' : data?.patient?.age ?? '2岁'},
    {label:'检查时间',value:data?.exam?.date ?? '2026-10-11'},
    {label:'影像号',value:data?.exam?.no ?? 'P-202610110181'},
    {label:'设备类型',value:data?.exam?.deviceType ?? 'CT'},
    {label:'检查部位',value:data?.exam?.part ?? '（头部）颅脑平扫',wide:true},
  ];
}

export function demoReportTime(data){
  return data?.report?.time ?? data?.report?.date ?? '2026-10-27 15:10:58';
}
