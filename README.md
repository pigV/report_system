# 影像文书 · 医学影像报告系统原型

Notion 风格的医院报告模板配置与报告编辑 Demo。采用 Vue 3、Yiitap / Tiptap、Node.js 和 SQLite。

## 功能

- 按医院独立配置表头、表尾，内置 A 医院 6 个、B 医院 5 个表头字段。
- 在 Yiitap 中调整字段顺序、列数、跨列、列宽、对齐、加粗及边框。
- 配置字段名称和后台数据绑定，实时查看整页报告。
- 布局字段与绑定列表独立保存；删除、改名、排序互不联动，新增绑定需明确添加。
- 模板以符合 Tiptap Schema 的 JSON 保存到 SQLite。
- 加载模拟病例自动填入信息，医生在独立 Yiitap 正文区域编辑报告。
- 支持保存恢复、报告快照、未保存提示及版本冲突检查。
- 报告演示左侧提供既往病历、常用模板搜索与分类，支持查看历史报告以及插入、撤销常用描述。

## 本地运行

需要 Node.js 24+ 和 pnpm。

```sh
git clone https://github.com/pigV/report_system.git
cd report_system/prototype
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1 --port 4173 --strictPort
```

访问 [本地原型](http://127.0.0.1:4173/)。首次运行会自动生成虚构病例和数据库 `prototype/data/reports.sqlite`；再次启动不会覆盖保存的数据。

```sh
# 在 prototype 目录执行
pnpm test
pnpm build
```

## 项目结构

- [`prototype/`](prototype/)：可运行应用、后端和测试。
- [`prototype/README.md`](prototype/README.md)：功能、运行和边界说明。
- [`docs/superpowers/specs/`](docs/superpowers/specs/)：需求与设计说明。
- [`prototype/assets/design-reference.png`](prototype/assets/design-reference.png)：选定视觉稿。

## 范围

这是本机交互原型，所有病例均为模拟数据。数据库、依赖目录、构建产物、测试截图及日志不提交到仓库。

当前 SQLite API 运行在本地 Vite 中间件中；云端部署需要另行适配 API 与数据库。历史病历和常用描述为内置模拟示例，未实现真实医院接口、登录权限、影像查看、AI 诊断、正式模板库管理或 PDF 打印导出。
