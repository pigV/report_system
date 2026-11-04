# 工程清理与业务注释实施计划

> **执行方式：**确认方案后使用 `executing-plans` 在当前会话实施；保留工作区中既有的未提交工作，不自动提交。

**目标：**在不改变现有业务行为的前提下，清理能够确认无用的代码和文件，为关键业务规则添加易于维护的中文注释。

**范围与依据：**用户当前的两项要求，以及 `AGENTS.md` 中已批准的功能、持久化、打印和部署约束；现有测试和工作区内容均为兼容性依据。

**技术栈：**Vue 3、Yiitap/Tiptap、Vite、Node.js、SQLite、Node 内置测试运行器。

## 全局约束

- 不改变界面、对外接口、数据格式、业务规则和副作用；不删除或覆盖用户既有的未提交改动或新增文件。
- 布局字段与绑定列表相互独立；保留空列表、历史报告快照和医院隔离。
- 报告引用保留其他块并支持撤销；打印内容与分页、末页签名及首页表头规则不变。
- 原样保留 `.openai/hosting.json`、`worker/index.js`、`scripts/prepare-sites-build.mjs`、`tests/sites-worker.test.mjs`。
- 不以未被静态 import 为唯一理由删除文件：检查 Vue 模板、动态节点、静态资源 URL、浏览器测试页、脚本、部署和文档入口；疑似对外导出或仅供测试使用的代码先确认用途。
- 注释说明业务约束、兼容性、事务和边界情况，不逐行翻译代码，不借注释改写逻辑。
- 使用 Node 24+ 验证；当前默认 `node --version` 为 22.22.0，先定位符合要求的运行时，不能满足时如实记录限制。

## 核心回归覆盖

- 旧模板与显式空绑定列表：`tests/binding-independence.test.mjs`。
- 医院隔离、报告快照与版本冲突：`tests/store.test.mjs`、`tests/native-template.test.mjs`。
- 引用模板时保留图片、表格等块：`tests/workbench.test.mjs`。
- 长文、跨页表格、栏布局与页尾：`tests/print.test.mjs` 和 `tests/browser/print-first-header.html`。
- 关键影像插入、拖动及浏览器缩放：`tests/key-image-menu.test.mjs`、`tests/native-drag.test.mjs`、`tests/browser/side-menu-zoom.cjs`。

## 任务 1：建立基线并审计清理候选

**涉及：**`src/`、`server/`、`tests/`、`public/`、`deploy/`、`scripts/`、`vite.config.mjs`、`package.json`，仅检查不修改。

- [ ] 记录 `git status --short`，定位 Node 24+；使用该运行时运行 `npm test`、`npm run build`、`npm run test:sites` 并记录既有失败。
- [ ] 从 `index.html`、`src/main.js`、`vite.config.mjs`、测试与部署入口建立引用清单，搜索模块、导出、Vue 模板事件及资源路径，逐项检查动态引用。
- [ ] 区分生产调用、测试调用、历史兼容和真正无调用代码；例如 `keyImageColumns` 虽无生产调用，但被多项测试使用，不能直接删除。
- [ ] 将可确认无用的候选及其引用证据列入执行记录；未确认用途、用户修改或用户新增的文件保留，不为追求数量删除。

## 任务 2：清理已证实无用的代码和文件

**涉及：**任务 1 中证实无用且不覆盖用户工作的文件；验证关联的 `tests/*.test.mjs`。

- [ ] 每项删除前检查完整调用链、导出用途、运行入口和文件的 Git 状态；有疑问则保留并报告。
- [ ] 以最小改动删除无引用局部函数、变量、导入及确定无用的受版本控制文件；不删除测试来掩盖生产行为变化。
- [ ] 对每组清理运行对应现有测试及构建；若发现原有测试未覆盖的保留行为，先补充有具体断言的回归测试再修改。
- [ ] 比较 `git diff` 与基线，确认没有覆盖已有变更或删除受保护文件。

## 任务 3：补充关键业务注释

**涉及：**按需修改 `src/report-model.mjs`、`src/editor/report-sections.mjs`、`src/editor/key-image-insert.mjs`、`src/printing/paginate.mjs`、`src/clinical-assistance.mjs`、`server/store.mjs`、`server/native-store.mjs` 及调用链中其他实际缺乏说明的业务文件。

- [ ] 说明布局与绑定独立、旧数据迁移及显式空列表的意义；运行 `node --test tests/binding-independence.test.mjs tests/report.test.mjs`。
- [ ] 说明报告快照、医院隔离、乐观并发和自由模板首次迁移的规则；运行 `node --test tests/store.test.mjs tests/native-template.test.mjs`。
- [ ] 说明模板引用、关键影像插入及个人模板的作用范围；运行 `node --test tests/workbench.test.mjs tests/key-image-menu.test.mjs tests/clinical-assistance.test.mjs`。
- [ ] 说明打印分页中保留文字、重复表头、首末页约束等不显然的决策；运行 `node --test tests/print.test.mjs`。
- [ ] 检查新增注释与实际实现一致，不改写已有业务语句或无意义地为每个函数添加注释。

## 任务 4：完整验证与交付

- [ ] 运行 `npm test`、`npm run build`、`npm run test:sites`，确认 `dist/client/index.html`、`dist/server/index.js` 和 `dist/.openai/hosting.json` 存在；与基线对比并报告任何失败。
- [ ] 自行启动本地服务并在可用浏览器中检查报告演示、模板配置、自由模板和打印预览；按 `tests/browser/README.md` 运行适用的浏览器回归，无法运行时说明原因。
- [ ] 最终检查 `git diff --check`、改动清单及用户原有工作，报告实际清理内容、保留的存疑项和验证结果。

## 执行记录（2026-11-04）

- 用户确认在当前 `main` 工作区执行，保留原有未提交内容，不自动提交。
- 审计了应用、服务端、测试、资源、部署入口以及 Vue 模板和局部声明；未发现可以在不影响现有调用和用户改动的前提下确认删除的源码文件或函数，因此没有强行删除。
- `src/editor/key-image-insert.mjs` 的 `keyImageColumns` 虽未在生产路径中调用，但多项测试仍使用；`src/editor/report-images.mjs` 中的注释掉的代码属于此前未提交修改，均予以保留。
- 运行时通过临时 PATH 使用已安装的 Node 24.12.0，没有更改全局 Node 版本。
- 5174 端口被既有 Vite 进程占用，本次预览使用 5189。现有报告仅有一个正文块，缩放回归在临时标签引用示例模板后执行，未保存报告。
