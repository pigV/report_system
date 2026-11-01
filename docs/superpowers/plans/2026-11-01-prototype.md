# 医学影像报告高保真原型实施计划

> 用户已选择第 3 张视觉稿并明确同意推进可交互原型。按此授权连续实施，本期不部署公网。

目标：忠实复现左侧配置、右侧整页预览的页面，接入 Yiitap，并演示真实数据库保存和后台字段填充。

设计依据：`../specs/2026-11-01-medical-report-demo-design.md`。
视觉依据：已选第三张 `exec-c9da7a66-2714-43be-9d0d-274638bbac93.png`。

## 文件与步骤

- [x] `prototype/src/report-model.mjs`：字段清单、Tiptap JSON、绑定解析及模板校验。先测试 6/5 字段、空值与 0、错误路径和跨医院校验。
- [x] `prototype/server/store.mjs`、`api.mjs`：SQLite 持久化和本地接口。测试保存后重开、医院隔离及旧报告快照。
- [x] `prototype/src/editor/*`：Yiitap 编辑器与 reportGrid/reportField 扩展，文档流内排序、列数、字段宽度、对齐、加粗；字段身份保留。
- [x] `prototype/src/App.vue`、`ReportPaper.vue`、`style.css`：忠实复现第三张的侧栏、表头/表尾页签、绑定表和实时预览；补齐加载、保存、错误、未保存切换提示。
- [x] 浏览器验收：A/B 切换、字段绑定与样式、布局调整、保存刷新、预览占位符/模拟数据切换、医生正文编辑；对照视觉稿记录 `design-qa.md`。

## 实施决定

- 使用 Product Design 的 web starter，按既定 Vue/Yiitap 方向将其前端适配为 Vue，保留原部署支持文件。
- 当前目录不是 Git 仓库，不建立分支或提交；不涉及 CRM。
- 本地原型的 Node SQLite API 接入 Vite middleware；仅监听 127.0.0.1。远程部署需要另行适配后端，不能将静态打包误称完整部署。
- 使用应用捆绑的 Node 与 pnpm（系统 PATH 无 Node/npm）。
- 所有模拟病例都是虚构数据；医生正文初始为空，不包含自动诊断功能。

## 验证重点

1. 重新排列或重命名字段不丢失绑定。
2. 模板保存只在接口成功后提示成功，且服务重启不会覆盖数据库。
3. 接口错误、空值、数值 0 不误用旧数据。
4. 未保存更改切换前可保存/放弃/取消。
5. 窄屏可以查看配置和预览，控件有标签与可见焦点。
