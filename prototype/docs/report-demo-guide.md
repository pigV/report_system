# 报告演示页面：功能、实现思路与 Vue 3 / Yiitap / Tiptap 入门

本文面向“能看懂一些 JavaScript，但不熟悉 Vue 3 和富文本编辑器”的读者。先从页面能做什么讲起，再沿着一次操作往下看代码，不要求先学完框架。

核对日期：2026-11-05。代码基线：`914793d`。依赖版本来自 [package.json](../package.json)：Vue `3.5.22`、Yiitap `0.19.3`、Tiptap `3.32.2`。本文只说明这一版的实际行为；项目历史说明中有些规则后来变过，不能只看旧注释判断当前功能。

**现在可以结合代码学习：** 报告演示相关源码增加了 `【学习01】`～`【学习11】` 中文注释，解释输入、输出、调用关系和 API 归属。初次阅读建议先看下方第 11 节的路线，再按需要返回前面的概念章节。本轮只加注释和学习说明，沿用上述功能基线。

阅读路线：

1. [页面功能和边界](#1-页面功能和边界)
2. [组件怎么分工](#2-组件怎么分工)
3. [先掌握这里用到的 Vue 3 知识](#3-先掌握这里用到的-vue-3-知识)
4. [数据如何加载、更新和保存](#4-数据如何加载更新和保存)
5. [Yiitap、Tiptap、ProseMirror 分别是什么](#5-yiitaptiptapprosemirror-分别是什么)
6. [正文编辑器如何接进页面](#6-正文编辑器如何接进页面)
7. [逐项拆解编辑操作](#7-逐项拆解编辑操作)
8. [打印为什么要单独实现](#8-打印为什么要单独实现)
9. [查代码和继续学习的路线](#9-查代码和继续学习的路线)
10. [核对方式与常见误解](#10-核对方式与常见误解)
11. [结合注释代码逐步学习](#11-结合注释代码逐步学习)

## 1. 页面功能和边界

### 1.1 页面布局

打开 `/` 默认进入报告演示；`/#templates` 是模板配置，`/#native-templates` 是独立的自由模板页面。这里用地址的 hash 判断初始视图，没有使用 Vue Router。

桌面上的报告演示是三个区域：

```text
左：报告模板                 中：报告纸张                  右：参考资料
搜索、选择个人模板           顶部操作按钮                  八张关键影像
编辑描述和诊断               医院抬头、病例字段            选择或拖入影像
追加、保存、引用             可编辑正文                    既往检查
                            签名、报告时间                临时编辑、追加、引用
```

报告演示隐藏了其他页面使用的全局导航。主体布局用 CSS Grid，较窄屏幕再通过媒体查询调整；与编辑器文档里的“分栏”不是同一个层次。

### 1.2 功能清单：哪些真的可用

| 区域 | 当前能做什么 | 实现入口 / 边界 |
| --- | --- | --- |
| 左侧报告模板 | 按名称和关键词搜索，选择内置模板，编辑描述和诊断 | `ClinicalSidebar.vue`；当前没有部位筛选控件，也没有新建/删除模板入口 |
| 个人模板追加、保存 | 将补充文字加到描述/诊断末尾，单独保存个人模板修改 | `ClinicalDetail.vue`；保存到当前浏览器 `localStorage`，不是医院服务器模板库 |
| 引用模板 | 把描述和诊断插入正文最后选定的位置 | 保留已有内容和选中文字；未选过有效正文位置、内容为空时静默不插入 |
| 正文写作 | 输入文字、选中文字后格式化、快捷键、列表、标题、引用块、表格、分割线 | `BodyEditor.vue`；没有固定的顶部正文格式栏 |
| 插入菜单 | `/`、全角 `／`、块旁加号打开菜单，搜索并插入内容 | `OSlash` / `OSlashZh` 加项目自己的菜单组件 |
| 普通分栏 | 插入 2–5 栏，栏内编辑，使用原有栏间调整控件 | 栏是正文文档节点，保存后仍是栏；插入后光标移到整个布局下面 |
| 图片布局 | 二张、三张、四张、六张图片布局；自定义 1–3 行、1–4 列 | 四张/六张预设先建空的可编辑栏；部分其他预设保留空图片位置 |
| 关键影像多选 | 菜单中选图、清空、一次插入多张，支持键盘选择 | 四张为 2×2，六张为 2×3；其他数量单行；已有栏内直接插图，不再套栏 |
| 右侧关键影像 | 选择一张后填入已有图片位置，或拖到图片位置/栏内 | 自定义 `reportImage` 节点；拖放校验医院和病例 |
| 删除影像/栏 | 移除图片；选中整个分栏或单栏后按 Delete 删除 | 图片在栏内删除时保留合法的可编辑空栏；正文选中文字仍按文字删除 |
| 块排序 | 使用块旁六点手柄上下拖动，显示插入线和过渡动画 | 项目接管鼠标拖动和文档重排；可取消拖动 |
| 既往检查 | 显示匹配当前模拟患者的历史，可临时改写、追加、引用 | 编辑的是副本，没有保存回历史的按钮或接口 |
| 打印 | 当前正文生成 A4 分页预览，再调用浏览器打印/保存 PDF | 使用当前内存内容，包含未保存编辑；打印不保存报告 |
| 未保存提醒 | 页面关闭/刷新时提示存在修改；代码中的受保护视图切换也会检查 | 是丢失修改提醒，不是自动保存 |

顶部按钮现在依次是“选择模板、阅片、检查单、病历资料、收藏、相似病例、危急值、编辑检查、打印、提交报告”。**只有打印有操作处理。**“提交报告”目前是展示按钮，也没有独立的“导出报告”按钮；PDF 要从打印预览进入系统打印后保存。

另有两点要单独记住：

- 后端报告保存、读取和版本冲突检查已经实现，但当前报告演示隐藏了报告保存控件，“提交报告”也没接保存。编辑正文后不会自动写 SQLite；普通页面使用中不要把“能编辑/能打印”理解为“已经保存”。
- 整页放大预览的组件分支还存在，但报告模式的放大按钮在 `App.vue` 里被注释了。当前可见的预览入口是打印预览。模板配置页面仍有自己的放大按钮。

这些结论来自 [App.vue](../src/App.vue) 的实际模板和点击处理，不是根据按钮名称推断的。

### 1.3 演示数据和表头

当前是模拟系统，没有接入真实 HIS、PACS、登录或医生身份认证。右侧八张图是静态图片资源，不是 DICOM 阅片器。`doctor-demo` 是模拟医生标识，不是登录结果。

报告演示的标题、logo、病例字段和签名走专用展示分支：

- 标题为“瑞派宠物影像诊断中心 / 影像诊断报告”。
- 字段来自 `demoReportFields(data)`，当前第一项标签实际为“名字”。
- 特定旧演示病例的名字、性别、年龄会在展示时修正，不改写已保存的数据。
- 演示表头表尾不等于把“自由模板”文档直接插进来。`NativeTemplateWorkspace` 独立保存和编辑，当前报告页没有把它作为生成报告的来源。

定位：[ReportPaper.vue](../src/ReportPaper.vue)、[demo-report.mjs](../src/demo-report.mjs)。

## 2. 组件怎么分工

可以把组件理解成“页面中有自己逻辑的一块界面”。父组件负责组织，子组件负责局部细节。

```text
main.js：创建 Vue 应用，注册 Yiitap 插件，加载 CSS
└─ App.vue：持有医院、病例、报告正文、加载状态、打印快照
   ├─ ClinicalSidebar.vue：个人模板搜索、草稿、本机保存
   │  └─ ClinicalDetail.vue：描述/诊断输入框、追加、引用按钮
   ├─ ReportPaper.vue：表头 + 正文 + 表尾
   │  └─ BodyEditor.vue：正文编辑器及对外的引用方法
   │     ├─ YiiEditor：Yiitap 编辑器界面
   │     └─ ColumnInsertControl.vue：栏内跟随鼠标的加号
   ├─ EvidenceSidebar.vue：影像选择/拖放、既往检查
   │  └─ ClinicalDetail.vue：复用输入界面；不给历史记录保存按钮
   └─ ReportPrintPreview.vue：独立打印遮罩、准备页面、触发打印

插入菜单另有一条创建路径：
Yiitap 的 slash 触发器
└─ suggestion.js：用 VueRenderer 创建 SlashMenu.vue
   └─ KeyImagePicker.vue：关键影像多选
```

同一个 `ClinicalDetail` 用在左侧和右侧，但父组件传的参数不同：个人模板传 `can-save`，历史没有这个参数。因此它们能共用输入和引用界面，同时保留不同的保存规则。

正文内容、菜单 UI 和打印算法分文件，是为了让它们各自处理自己的问题。例如“多选框是否勾选”放 Vue 组件里，“在文档哪个位置插入图片”放编辑器事务函数里。

## 3. 先掌握这里用到的 Vue 3 知识

本节例子取自当前实现或做了精简；标为“简化”的代码用于理解，不是建议直接替换原代码。

### 3.1 `.vue` 文件与 `<script setup>`

一个 Vue 单文件组件通常有三部分：

```vue
<script setup>
// JavaScript：状态、函数、导入其他组件
</script>

<template>
  <!-- 界面：根据状态显示内容、响应点击 -->
</template>

<style>
/* 样式 */
</style>
```

`<script setup>` 是本项目使用的组合式 API 写法。这里声明的变量、函数，以及导入的组件，可以直接在 `<template>` 使用。项目中很多 CSS 是全局导入，不能假设一个 `.vue` 文件里的样式只影响自己。

### 3.2 `ref`：能让界面跟着变化的数据

例如搜索个人模板：

```js
const query = ref('');
```

```vue
<input v-model="query" />
```

`query` 是一个响应式容器。在 JavaScript 中读取/赋值用 `query.value`；在模板中 Vue 会自动解开这一层，所以写 `query` 即可。输入框变化时，`v-model` 自动更新搜索词，依赖它的模板列表也会更新。

`App.vue` 里的 `body = ref(emptyBody())` 是当前报告正文 JSON，`loading`、`saving`、`printSnapshot` 也是同样的响应式状态。

### 3.3 `computed`：从现有数据算出显示结果

`ClinicalSidebar.vue` 的搜索结果大致是：

```js
const visible = computed(() => templates.value.filter(t =>
  `${t.name} ${t.keywords}`.toLowerCase().includes(query.value.trim().toLowerCase())
));
```

无需在每次敲字时手动重画列表。Vue 知道 `visible` 依赖模板和搜索词，会随依赖变化更新结果。

另一种用途是“有没有未保存修改”：比较当前草稿与已保存内容。`computed` 负责算答案；保存或提醒这样的操作由其他函数负责。

### 3.4 `watch`：数据变化后做一件事

`App.vue` 在医院或病例变化后清掉选中的影像：

```js
watch([hospital, caseId], () => selectedImage.value = '');
```

个人模板侧栏监听 `props.hospital`，医院改变时重新读取本机模板；带 `{ immediate: true }` 表示刚建立监听时也先执行一次。

区别可以这样记：`computed` 负责“算出结果”，`watch` 负责“变化之后执行动作”。本项目并没有监听正文后自动发保存请求。

### 3.5 props 与事件：父子组件之间怎么传话

父组件传给子组件的数据叫 props；子组件通过事件告诉父组件发生了什么。

```vue
<!-- App.vue 中的关键部分，简化 -->
<ReportPaper :body="body" @update-body="v => body = v" />
```

- `:body="body"`：把变量内容传进去；冒号是 `v-bind:` 的缩写。
- `@update-body="..."`：监听子组件事件；`@` 是 `v-on:` 的缩写。
- 子组件用 `defineProps` 声明接收项，用 `defineEmits` 声明可发送的事件。

正文变化的实际传递链是：

```text
YiiEditor update
→ BodyEditor 用 getJSON() 读取正文，发出 update
→ ReportPaper 发出 updateBody
→ App 更新 body
```

`updateBody` 在 Vue 模板中用 `@update-body` 监听，是同一个组件事件。

### 3.6 自定义组件的 `v-model`

```vue
<ClinicalDetail v-model="draft" />
```

它相当于传入 `modelValue`，并监听 `update:modelValue` 更新 `draft`。

`ClinicalDetail.update()` 用 `{ ...props.modelValue, [key]: value }` 新建一份对象后发给父组件，而不是直接修改 props。这样“草稿归谁管理”比较清楚，也方便比较未保存状态。

这里的 `v-model` 用在普通输入和详情组件上；**正文编辑器不是通过 `v-model` 双向同步的**，而是 `content` 初始化输入加 `update` 事件输出。

### 3.7 两种 `ref` 和 `defineExpose`

这里还会见到：

```js
const reportPaper = ref(null);
reportPaper.value?.insertTemplate(content);
```

```vue
<ReportPaper ref="reportPaper" />
```

这是“组件引用”：挂载以后，用它访问某个子组件实例。`ReportPaper` 和 `BodyEditor` 分别通过 `defineExpose({ insertTemplate })` 把方法开放给父级。

因此引用走的是“调用子组件方法”，正文变更走的是“向父组件发事件”。两者方向不同，各有用途。`?.` 是 JavaScript 可选链，子组件还没出现时不调用。

### 3.8 为什么编辑器实例用 `shallowRef`

```js
const editor = shallowRef(null);
```

正文 JSON 适合当普通响应式数据；编辑器实例内部有复杂状态、插件和对象关系，所以这里用 `shallowRef` 保存其引用，不让 Vue 递归代理整台编辑器。编辑过程仍由编辑器自己的状态系统管理，Vue 通过事件拿到结果。这个用法也符合 [Vue 对外部状态系统集成的说明](https://vuejs.org/guide/extras/reactivity-in-depth.html#integration-with-external-state-systems)。

### 3.9 `key`、生命周期、`nextTick`

- `:key="bodyKey"`：key 改变时重建正文组件。加载新医院/病例完成后，父级递增 `bodyKey`，避免把上一个病例的编辑器状态继续拿来用。它不是每敲一个字就重建。
- `onMounted`：界面挂载后加载数据、监听快捷键。`onBeforeUnmount`：移除监听、取消异步准备、清理拖动状态。
- `nextTick()`：等待 Vue 本轮界面更新完成。例如打印组件先确保测量容器已经生成，再访问 DOM 计算尺寸。
- `Teleport to="body"`：逻辑上还属于当前组件，实际 DOM 放到页面 body 下，用于浮动加号、拖动插入线和打印遮罩，减少被父容器裁剪的问题。
- `v-if` 决定是否创建一块界面；`v-show` 保留界面，只切换显示状态；`v-for` 生成列表，稳定的 `:key` 帮助 Vue 区分每项。
- `@mousedown.prevent` 是事件修饰符，阻止鼠标按下的默认行为。插入菜单里这样做，可以减少点击菜单导致正文失去选区的问题。

以上知识已足以读懂本页面的大部分 Vue 代码。响应式基础可参阅 [Vue 官方文档](https://vuejs.org/guide/essentials/reactivity-fundamentals)。

## 4. 数据如何加载、更新和保存

### 4.1 首次打开页面

`App.vue` 的 `load()` 大致按以下顺序执行：

1. 并行请求当前医院模板 `template` 与病例列表 `cases`。
2. 没有合法的当前病例时，选列表第一项。
3. 并行请求病例数据 `cases/{caseId}` 与已保存报告 `reports/{caseId}`。
4. 有已保存报告就取它的正文，否则使用 `emptyBody()`。
5. 保存一份正文比较基准，递增编辑器 key，结束加载状态。

所有路径前面都有 `/api/hospitals/{hospital}/`。`Promise.all` 表示互不依赖的请求一起发；`async/await` 让后续代码等待返回；`try/catch/finally` 分别处理正常结果、错误和清理加载状态。

每次加载还有一个递增的 `loadVersion`。如果旧请求比新请求更晚返回，旧结果会被丢弃，避免快速切换时显示错病例。

### 4.2 正文是一棵 JSON 树

正文不只是一个长字符串，也不是把编辑器 DOM 原样保存。下面是合法结构的简化例子：

```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [{ "type": "text", "text": "检查所见：" }]
    },
    {
      "type": "columns",
      "content": [
        { "type": "column", "content": [{ "type": "paragraph" }] },
        { "type": "column", "content": [{ "type": "paragraph" }] }
      ]
    }
  ]
}
```

`type` 表示是什么，`content` 表示里面有什么，`attrs` 表示这个节点的参数，文字格式一般用 `marks`。`doc → columns → column → paragraph` 是父子关系。

结构化文档让“移动整个栏”“保存表格”“打印图片”成为可能，但它也要求每次修改都满足编辑器的结构规则。不能只修改浏览器里一段 HTML 就期待保存、撤销和打印都知道这次变化。

### 4.3 三种数据，三种保存位置

| 数据 | 放在哪里 | 什么时候持久化 |
| --- | --- | --- |
| 当前正文编辑 | 编辑器内部状态 + `App.body` | 正文更新只回传内存；真正保存要走报告 PUT 接口，当前报告页没有可见的直接保存入口 |
| 个人模板修改 | 侧栏草稿 + 浏览器 `localStorage` | 点击个人模板“保存”；按医院和模拟医生隔离 |
| 既往检查临时修改 | `EvidenceSidebar.draft` 的对象副本 | 不保存回历史；切换历史条目会换成对应副本 |

个人模板的本机 key 形如 `report-demo:personal-templates:v1:a:doctor-demo`，换浏览器或清空站点存储就不会得到同一份本机修改。

### 4.4 后端已经具备的保存能力

`vite.config.mjs` 注册 `reportApi()`，在 Vite 开发服务和预览服务里挂上 API 中间件。这里没有另起一个 Express 服务。`server/store.mjs` 使用 Node 内置 `node:sqlite`，把模板与报告 JSON 放进 `data/reports.sqlite`。

已有 `save()` 分支会提交正文和上下文：医院在 URL 中，正文放 `body`，上下文包括模板、病例 ID 和报告版本。后端检查病例所属医院，用共享的 `bodySchema` 验证文档，再比较 `reportRevision`；版本过期则拒绝覆盖。

首次保存记录模板和病例数据快照；已有报告继续沿用原快照，之后保存更新正文和版本。因此后来改医院模板，不会顺手改掉旧报告的模板快照。报告演示的专用表头显示修正仍是单独一层展示逻辑。

这里要区分“后端能保存”和“当前 UI 已经提供保存流程”。本版只满足前者及相关公共逻辑；顶部“提交报告”没有调用 `save()`，正文也没有自动保存。

定位：[App.vue](../src/App.vue)、[api.mjs](../server/api.mjs)、[store.mjs](../server/store.mjs)、[clinical-assistance.mjs](../src/clinical-assistance.mjs)。

## 5. Yiitap、Tiptap、ProseMirror 分别是什么

**本项目确实使用了 Tiptap API，而且不少特殊操作还直接使用 ProseMirror API。** Yiitap 与 Tiptap 不是二选一；可以先用 Yiitap 获得现成编辑界面，再在它暴露的编辑器实例上写更细的行为。

| 层次 | 在这里负责什么 | 项目中的证据 |
| --- | --- | --- |
| Vue 3 | 按钮、侧栏、弹窗、状态和组件通信 | `.vue` 文件、`ref` / `computed` / props / emit |
| Yiitap | 成套富文本 UI、气泡菜单、块旁控件、slash 触发和分栏扩展 | `YiiEditor`、`OSlash`、`OSlashZh`、`OMultiColumn` |
| Tiptap | 编辑器实例、命令链、自定义节点/扩展、Vue 菜单渲染桥接 | `editor.chain()`、`Node.create()`、`Extension.create()`、`VueRenderer` |
| ProseMirror | 文档模型、位置、选区、事务、插件、历史分组、DOM 序列化 | `state.tr`、`TextSelection`、`NodeSelection`、`Plugin`、`DOMSerializer` |
| 浏览器 API / CSS | 拖放、鼠标坐标、动画、资源加载、打印、纸张样式 | `dataTransfer`、`getBoundingClientRect()`、`animate()`、`window.print()` |

本地 Yiitap 包本身说明它建立在 Tiptap 之上；其 `YiiEditor` 实现通过 Tiptap 的 Vue 集成创建编辑器，`create` 事件直接传出编辑器实例。也就是说，`BodyEditor.ready(ed)` 中的 `ed` 可以调用 Tiptap 的编辑器方法，不是另一个只能操作 Yiitap 专属函数的对象。

`@tiptap/pm/state`、`@tiptap/pm/model`、`@tiptap/pm/history` 虽然路径有 `tiptap`，导出的 `Plugin`、`Fragment`、`TextSelection` 等属于 ProseMirror API。技术上最好说“通过 Tiptap 提供的包入口使用 ProseMirror”，不要把它们全叫成 Tiptap 高层命令。

Tiptap 编辑器与命令概念可对照 [Editor Instance](https://tiptap.dev/docs/editor/api/editor) 和 [Commands](https://tiptap.dev/docs/editor/api/commands)；文档模型、选区和事务可对照 [ProseMirror Guide](https://prosemirror.net/docs/guide/)。下面以仓库代码解释具体调用。

## 6. 正文编辑器如何接进页面

### 6.1 应用启动时注册插件

入口 [main.js](../src/main.js)：

```js
createApp(App).use(YiiEditorPlugin).mount('#root');
```

它创建 Vue 应用，安装 Yiitap 插件，再显示到 HTML 的 `#root`。入口先导入 Yiitap CSS，再导入项目覆盖样式；后续 CSS 的顺序会影响侧栏、字号和编辑器外观。

### 6.2 `YiiEditor` 提供现成界面

[BodyEditor.vue](../src/editor/BodyEditor.vue) 的核心用法可简化为：

```vue
<YiiEditor
  :content="content"
  :editable="!readonly"
  :extensions="extensions"
  :title="false"
  locale="zh-CN"
  page-view="full"
  :show-main-menu="false"
  :show-bubble-menu="!readonly"
  :bubble-menu="['bold', 'italic', 'underline', 'strike']"
  :show-floating-menu="false"
  :show-side-node="false"
  :side-menu="{ show: !readonly, add: 'empty' }"
  @create="ready"
  @update="({ editor: e }) => emit('update', e.getJSON())"
/>
```

`content` 是初始文档，`editable` 控制是否可编辑，`extensions` 决定额外认识哪些节点/操作。选中文本后的气泡格式菜单由 Yiitap 提供；块旁加号和手柄也是利用它的侧边菜单界面。

`page-view="full"` 是编辑器展示方式，**不是 A4 自动分页功能**。报告打印的分页是项目单独写的。

### 6.3 在 `ready(ed)` 拿到 Tiptap 编辑器

当前初始化做了三件主要的事：

1. 将 `ed` 存到 `shallowRef`，后续引用和拖动操作都使用它。
2. 调用 `ed.unregisterPlugin('trailingNode')`，关闭自动尾节点插件，让项目自己的插入后光标/段落规则接管相关行为。
3. 在编辑器 DOM 上加 `aria-label`、`role` 等辅助信息，使可编辑正文和只读预览有不同语义。

`getJSON()`、`unregisterPlugin()` 是 Tiptap 编辑器 API；`view.dom` 则是在访问它底下的 ProseMirror 编辑视图 DOM。

### 6.4 扩展决定文档能容纳什么

[body-schema.mjs](../src/editor/body-schema.mjs) 的 `bodyExtensions()` 组合了：

- `ReportSections`：给原有段落、标题等加“描述/诊断”语义属性。
- `ReportImage`：项目自己的报告图片块。
- 通过 Yiitap `createExtensionList()` 取得表格、对齐、颜色等扩展。
- 编辑模式的 `OMultiColumn` 和项目的 `ColumnDeletion`。

只读模式改用 `ColumnContainer`、`Column` 保留栏结构，不加载有编辑行为的分栏插件，也不加载删除扩展；图片交互还会检查 `editor.isEditable`。这比只把按钮藏起来更完整。

另外，`getSchema([StarterKit, ...bodyExtensions()])` 建立一份供校验和序列化使用的 `bodySchema`。Yiitap 创建可编辑实例时会自行组织基础扩展；这里单独创建 schema，是让服务器、打印及测试理解同一类正文结构，并不是第二个可见编辑器。

“schema” 可以理解成文档的结构规则：允许哪些节点、里面能放什么。它不是数据库表结构，也不是 Vue 组件列表。

## 7. 逐项拆解编辑操作

### 7.1 `/` 插入菜单：触发、展示、执行分开

调用路径：

```text
输入 / 或 ／，或使用块旁加号
→ Yiitap OSlash / OSlashZh 维护触发状态和文本范围
→ businessSuggestion() 提供候选项和展示生命周期
→ VueRenderer 渲染 SlashMenu.vue
→ 用户选菜单项
→ executeNativeInsert(editor, range, item, options)
→ Tiptap 命令或 ProseMirror 事务修改正文
```

`range` 是菜单这次对应的文档范围，通常覆盖 slash 命令文字；它不是图片区域的屏幕坐标。选择菜单项后先移除这段命令文字，再插入目标内容。

这里没有从零实现 slash 的触发插件，而是配置 Yiitap 的 `OSlash` / `OSlashZh`。但候选项和菜单界面是项目自己的：原菜单会把业务中文标签当作内部翻译键，所以项目改用 `SlashMenu.vue` 展示名称、分栏预览和影像多选。

`suggestion.js` 中：

- `onStart`：`new VueRenderer(SlashMenu, ...)` 创建 Vue 菜单并放到 body。
- `onUpdate`：通过 `updateProps()` 更新搜索结果、范围等。
- `onKeyDown`：将方向键、Enter、Esc 交给菜单组件处理。
- `onExit`：销毁组件和 DOM，解绑滚动/窗口变化监听。

**API 归属**：触发器是 Yiitap；`VueRenderer` 来自 `@tiptap/vue-3`；菜单内部的选中项和勾选数组是 Vue 状态；`ResizeObserver`、弹层定位和滚动监听是浏览器功能。

定位：[suggestion.js](../src/free-template/suggestion.js)、[SlashMenu.vue](../src/free-template/SlashMenu.vue)、[menu.mjs](../src/free-template/menu.mjs)。

### 7.2 普通内容插入：Tiptap 命令链

正文菜单真正执行动作时，会遇到这一类写法：

```js
// 理解命令链的精简示例；原函数还负责撤销分组、光标位置等。
editor.chain()
  .focus()
  .deleteRange(range)
  .setHeading({ level: 2 })
  .run();
```

逐步读：

1. `chain()`：开始组织一组编辑命令。
2. `focus()`：把输入焦点交还正文。
3. `deleteRange(range)`：移除触发菜单时留下的命令文本。
4. `setHeading({ level: 2 })`：把当前位置的文本块设为二级标题。
5. `run()`：执行这组命令，返回是否执行成功。

这不是对后端发请求，也不是 Vue 的链式语法，而是 **Tiptap 命令 API**。同一条链中的文档修改共同构造事务；不要在链中随意另开不相关的编辑器命令，否则容易破坏位置与历史的组织。

| 页面动作 | 当前用到的命令 | 谁提供能力 |
| --- | --- | --- |
| 文本 | `setParagraph()` | Tiptap 段落相关扩展 |
| 一级/二级/三级标题 | `setHeading({ level })` | Tiptap 标题扩展 |
| 无序/有序列表 | `toggleBulletList()` / `toggleOrderedList()` | Tiptap 列表扩展 |
| 引用块 | `toggleBlockquote()` | 由已加载的引用块扩展注册到 Tiptap 命令系统 |
| 表格 | `insertTable({ rows: 2, cols: 3, withHeaderRow: false })` | 表格扩展；本项目经 Yiitap 加载 |
| 分割线 | `setHorizontalRule()` | 已加载的分割线扩展 |
| 普通分栏 | `insertMultiColumn(item.columns)` | Yiitap `OMultiColumn` 注册的扩展命令；不是 Tiptap 核心自带 |
| 图片布局 JSON | `insertContent(layout)` | Tiptap 内容插入命令 + 项目生成的节点数据 |
| 精细调整 | `.command(({ tr }) => ...)` | Tiptap 自定义命令入口，内部继续使用 ProseMirror 事务 |

要特别区分两个“引用”：菜单里的“引用块”调用 `toggleBlockquote()`，用于段落样式；侧栏“引用”按钮是插入模板/历史内容，走的是下一节的自定义事务。

`bodyMenuItems()` 不提供“业务字段”选项。共享的 `menu.mjs` 确实还能插入 `businessField`，但那条分支主要供独立自由模板页面使用，不能因此认定报告正文也有业务字段菜单。

### 7.3 侧栏引用：为什么保留选中的文字

点击左侧或右侧“引用”时，调用顺序是：

```text
ClinicalDetail emit('cite', modelValue)
→ 侧栏 emit('insert', entry)
→ App.insertTemplate(entry)
→ ReportPaper 暴露的 insertTemplate(entry)
→ BodyEditor.insertTemplate(entry)
→ insertCitationTransaction(editor.state, entry)
→ editor.view.dispatch(tr)
```

先看条件检查。`BodyEditor` 有一个普通布尔变量 `positioned`，通过正文里的鼠标松开、键盘事件和菜单插入回调更新。它记录“用户是否选定过合适的正文位置”；**没有另外在 Vue 中保存一个永久的数字光标坐标**。真正插入时读取的是编辑器仍保留的当前 selection。

引用要求编辑器可编辑，且选区末端位于可容纳行内内容的位置；描述和诊断至少有一项非空。不符合条件就返回状态，父级不弹通知。

核心逻辑位于 `insertCitationTransaction()`，下面为缩减后的真实思路：

```js
const pos = state.selection.to;
const tr = closeHistory(state.tr)
  .replaceWith(pos, pos, Fragment.fromArray(nodes));

tr.setSelection(TextSelection.create(tr.doc, pos + insertedSize));
return tr;
```

这里有三个重要知识点：

- **selection** 是编辑器里的选区。`from`、`to` 是文档中的数值位置。它们不是 DOM 节点序号；嵌套节点也占位置，不能直接当成字符串下标。
- **transaction（事务）** 是一份“准备怎样改文档”的计划。`state.tr` 创建它，`view.dispatch(tr)` 才真正提交给编辑视图并更新状态。
- `replaceWith(pos, pos, ...)` 的起止位置相同，所以是“在这里插入”，不会删掉已有内容。使用 `selection.to` 就把新内容加在选区末端；即使先选中一段文字，也保留这段文字。

描述和诊断被转成文字节点，换行用 `hardBreak`，按描述在前、诊断在后的顺序插入。这里不会自动重建“描述/诊断”两个标题，也不会根据语义属性去覆盖已有段落。插入结束后，用 `TextSelection` 将光标放到新文字末尾，再让编辑器获得焦点。

`Fragment` 是一组待插入的文档节点；`TextSelection` 表示文字光标/文字选区；`closeHistory()` 用来切开撤销分组。引用事务前后设置历史边界，使一次引用能作为单独的撤销动作。

**API 归属**：这是通过 `@tiptap/pm/*` 使用 ProseMirror，不是调用 Tiptap 的 `insertContent()`。外层持有的是 Tiptap 编辑器，底层精确操作它的状态和视图。

`report-sections.mjs` 里仍保留 `replaceSectionsTransaction()`，它会按描述/诊断标记替换内容，也有旧测试覆盖；**当前 `BodyEditor.insertTemplate()` 调用的是 `insertCitationTransaction()`**。看到旧函数和测试名“替换”时，不要误以为当前引用还是覆盖正文。

定位：[BodyEditor.vue](../src/editor/BodyEditor.vue)、[report-sections.mjs](../src/editor/report-sections.mjs)、[citation-insertion.test.mjs](../tests/citation-insertion.test.mjs)。

### 7.4 分栏及插入后光标：文档位置不是页面坐标

普通分栏使用 Yiitap 的原生 `columns → column` 节点，每个新栏有可编辑的空段落。菜单通过 `insertMultiColumn(n)` 创建布局，然后项目补一段定位光标的逻辑。

思路是：

1. 从当前 selection 的 `$from` 出发，沿父节点向上找到整个 `columns`。
2. `$from.after(depth)` 计算整个分栏之后的文档位置。
3. 后面已有段落就使用它；没有就创建一个空 `paragraph`。
4. `tr.setSelection(TextSelection.create(tr.doc, after + 1))` 把光标放入该段落。

`$from` 叫“解析后的文档位置”，携带父节点链等信息；它前面的 `$` 是命名习惯，不是 jQuery。这里 `after + 1` 是进入段落内部的文本位置，不是屏幕向下移动一个像素。

正文菜单中其他块也会尽量把光标放到新块之后的正文行；该插入回调同步标记 `positioned = true`，所以下一步可以直接点击侧栏引用。自由模板页共享菜单，但普通块的插入后定位规则并非全部相同。

栏内加号是另一层适配：`ColumnInsertControl` 跟踪鼠标，找当前栏里的文字块，显示独立浮动按钮。点击后用 `insertColumnSlash()` 在该块内插入 `/` 并设置选区，于是继续复用同一套 slash 菜单，而不是复制一套栏内菜单。旧的空图片位置也有特殊处理：在其后补含 `/` 的段落。

定位：[menu.mjs](../src/free-template/menu.mjs)、[ColumnInsertControl.vue](../src/editor/ColumnInsertControl.vue)、[column-insert.mjs](../src/editor/column-insert.mjs)。

### 7.5 关键影像多选：勾选归 Vue，插图归编辑器

`KeyImagePicker.vue` 用 `ref([])` 存选择顺序，用 `computed` 算将生成几行几列。点一张切换勾选，不立刻插入；点“插入 N 张”才把 ID 列表交给菜单执行函数。方向键选择、空格勾选、Enter 插入也由这个 Vue 组件处理。

`insertKeyImagesTransaction()` 负责文档变化：

1. 按影像 ID 去重，过滤无效 ID，保持选择顺序。
2. 用菜单打开时的 `range` 检查是否已在 `column` 内。
3. 已在栏内，只插入 `reportImage` 块，不创建嵌套分栏。
4. 栏外创建等宽栏；4 张拆成两行两列，6 张拆成两行三列，其他数量一行。
5. 新布局每张图下面加一个空段落，方便点击后输入文字。
6. 转成 schema 节点，用 `Fragment` / `Slice` 放进事务，再由外层定位光标、提交事务和关闭历史组。

`Slice` 可以理解成“准备粘进文档的一片结构化内容”；这里用完整块片段插入。菜单不仅关心展示，还要把原始 `range` 保留到多选完成，防止勾选几张后把图插到其他位置。

需要区分两类图片菜单：**“关键影像”直接选真实演示图并插入；“四张图片”等预设先创建待填写的布局。** 两者不等同。

定位：[KeyImagePicker.vue](../src/free-template/KeyImagePicker.vue)、[key-image-insert.mjs](../src/editor/key-image-insert.mjs)、[key-image-menu.test.mjs](../tests/key-image-menu.test.mjs)。

### 7.6 自定义图片节点：`Node.create()` 与 NodeView

正文里图片不是随便插入一个 `<img>`。项目定义了 `reportImage`：

```js
// 摘录，省略其他配置
export const ReportImage = Node.create({
  name: 'reportImage',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return { imageId: { default: null }, caption: { default: '' } };
  },
  // parseHTML、renderHTML、addNodeView、addProseMirrorPlugins ...
});
```

这是 **Tiptap 自定义 Node API**。`block` 表示它占一个内容块；`atom: true` 表示编辑时把它当一个整体，不把图片内部当作可编辑文字。

持久化内容主要是 `imageId` 和 `caption`，不是把图片二进制塞进正文。渲染时用 `keyImage(id)` 查静态资源地址；旧图片 ID 仍可解析，所以旧报告不会只因右侧演示列表换图就失效。

三个方法的职责很容易混：

| 方法 | 负责什么 | 本项目例子 |
| --- | --- | --- |
| `parseHTML()` | 从已有 HTML 识别这种节点 | 识别 `figure[data-report-image]` 并读属性 |
| `renderHTML()` | 定义标准输出结构 | 输出 figure、图片和图注；打印序列化会用到它 |
| `addNodeView()` | 定义编辑器内部的交互界面 | 创建图片 DOM、填入/替换按钮、移除按钮、拖放处理 |

这里 NodeView 是用 `document.createElement()` 写的原生 DOM，**没有使用 `VueNodeViewRenderer`，不是 Vue 图片组件**。NodeView 的 `update()` 在节点变化时更新显示，`stopEvent()` 帮助避免按钮/拖放事件被正文当成普通输入处理。

替换已有图片时，代码通过 `getPos()` 获取节点文档位置，再调用：

```js
editor.view.dispatch(
  closeHistory(editor.state.tr).setNodeMarkup(pos, undefined, attrs)
);
```

`setNodeMarkup()` 修改图片节点属性，从而改变图片内容。不能只改 DOM 上的 `img.src`，否则 JSON 不会同步，撤销与打印也不会得到一致结果。

删除栏内图片时，如果栏还有其他内容就删除图片节点；如果图片是最后一个子节点，就用空段落代替，确保留下的栏可编辑。栏外图片删除走清空图片属性的兼容行为，不是所有删除场景都同一种处理。

定位：[report-images.mjs](../src/editor/report-images.mjs)、[key-images.mjs](../src/key-images.mjs)。

### 7.7 右侧影像拖放：浏览器事件加 ProseMirror 插件

右侧开始拖图时，`EvidenceSidebar.drag()` 将 `{ id, hospital, caseId }` 写入浏览器 `dataTransfer`，使用自定义类型 `application/x-report-key-image`。这一步是原生 HTML 拖放，不是 Tiptap 命令。

接收有两条路径：

- 已有图片位置：图片 NodeView 的 `drop` 处理填入或替换。
- 栏内其他区域：`imageColumnDropPlugin()` 用 ProseMirror `Plugin` 的 `handleDOMEvents` 接收，计算插入位置，替换空段落或追加到合适块后面。

`readImageDrop()` 校验拖放数据的医院/病例与当前 scope 一致，同时查验影像 ID。它是本地演示的数据范围校验，不等于后端身份认证。

**不要把它与六点手柄的块排序混为一谈**：右侧向正文拖图是复制图片的原生拖放；正文块排序是项目接管的鼠标交互。

### 7.8 分栏删除与空栏点击

`ColumnDeletion` 用 `Extension.create()` 扩展编辑行为，注册 Delete、Backspace 快捷键和点击插件。

- 点栏容器自己的边缘时，用 `NodeSelection.create()` 选择整个节点。
- 按 Delete，只有选中节点确实是 `columns` 或 `column` 才执行布局删除。
- 删除单栏保留邻栏；删除最后一栏时连外层容器一起删除。
- 如果是文字光标/文字选区，不走布局删除逻辑，留给普通文字操作。
- 点击新空栏内部时，使用 `TextSelection` 将光标放到空段落中；点边缘仍可以选择整个栏。
- 特定情况下在分栏后的段落开头按 Backspace，会拦截默认合并，避免错误地多生成一栏。

`NodeSelection` 是“选中一个完整节点”，`TextSelection` 是“选文字或放光标”。分清这两种 selection，才能理解为什么有时 Delete 删整个栏，有时只删文字。

只读正文不加载这个删除扩展；插件内部也检查可编辑状态。定位：[column-delete.mjs](../src/editor/column-delete.mjs)。

### 7.9 六点手柄拖动：UI 复用 Yiitap，排序自己完成

`useBlockDrag()` 是一个 Vue composable，也就是把一组相关状态和函数抽成可复用逻辑。它接收编辑器引用和是否禁用的判断函数，返回鼠标处理函数及 `dropLine`。正文与自由模板编辑器共享它。

实际工作分成两部分：

**交互和动画：** 找到 Yiitap 的 `.o-drag-btn`，鼠标移动超过 4px 后开始拖动；用 `getBoundingClientRect()` 取得块的位置，用 CSS transform 让原块跟随鼠标 Y 坐标，`requestAnimationFrame` 持续更新，靠近边缘自动滚动。周围块使用 FLIP 思路：先记旧位置，再排序，再从旧位置偏移过渡到新位置。Esc、窗口失焦或放到编辑区域外会尝试恢复原顺序。

**真正改文档：** `reorderBlock()` 遍历顶层块，找到源位置和目标边界，用事务 `.delete(from, end).insert(target, source.node)` 移动同一个节点，再设置合理选区。它不是只换几个 DOM 元素的顺序；图片、表格、分栏内的内容仍跟着整个节点保留。

这里 CSS 临时样式尽量从编辑器根节点施加，避免直接改内容块样式被 ProseMirror 的 DOM 观察机制当成文档变化并重建节点。手柄还做了约 140ms 的跨块悬停判断和缩放坐标适配，避免菜单在鼠标经过时不停上下跳。

普通一次 `reorderBlock` 使用一个事务，并通过 `closeHistory` 控制与先前输入的历史边界；连续拖动跨过多个位置会多次提交。代码按时间决定是否切开分组，所以不能简单推断“任意长时间拖动一定只占一步撤销”。这与一次引用的明确前后历史边界不同。

当前这条自定义六点手柄路径监听的是 `mousedown / mousemove / mouseup`，不要因为项目另一个 `pointer-sort.js` 支持更多指针类型，就认定这里也已经完成触屏/手写笔适配。

定位：[use-block-drag.js](../src/editor/use-block-drag.js)、[block-drag.mjs](../src/free-template/block-drag.mjs)、[effective-zoom.mjs](../src/editor/effective-zoom.mjs)、[side-menu-position.mjs](../src/editor/side-menu-position.mjs)。

### 7.10 撤销/重做：事务与保存不同

Yiitap 初始化的基础编辑扩展提供撤销/重做能力。项目在引用、图片替换和删除等自定义操作中进一步使用 `closeHistory`，避免与前面输入合成一个不合适的撤销步骤。

需要区分四件事：

1. `state.tr` 生成本地文档修改事务。
2. `view.dispatch(tr)` 把事务提交给当前编辑器。
3. 历史插件记录可撤销的修改组。
4. HTTP PUT 才是把正文持久化到后端。

所以 `dispatch()` 不是“保存报告”，`closeHistory()` 也不是清空历史或关闭编辑器；Vue 的 `emit()` 是组件传消息，同样不等于保存。

### 7.11 API 归属速查

| 在源码中看到的写法 | 属于哪一层 | 一句话理解 |
| --- | --- | --- |
| `<YiiEditor>`、`createExtensionList()` | Yiitap | 使用现成编辑界面并组合扩展 |
| `OSlash` / `OSlashZh` | Yiitap 扩展 | 识别 slash，维护菜单生命周期 |
| `insertMultiColumn()` | Yiitap 注册到 Tiptap 的命令 | 创建原生栏节点 |
| `chain().focus()...run()` | Tiptap | 组合并执行编辑命令 |
| `commands.command()`、链中的 `command()` | Tiptap | 进入自定义命令逻辑 |
| `getJSON()`、`isEditable`、`unregisterPlugin()` | Tiptap 编辑器 | 读取正文/状态，管理编辑器插件 |
| `Node.create()` / `Extension.create()` | Tiptap | 增加文档节点或编辑能力 |
| `addNodeView()` | Tiptap 的节点扩展钩子 | 提供编辑器内的节点交互视图 |
| `VueRenderer` | Tiptap Vue 集成 | 在编辑器插件流程中挂载 Vue 菜单 |
| `state.doc` / `state.selection` / `state.tr` | ProseMirror | 当前文档、选区和待执行修改 |
| `view.dispatch()`、`posAtDOM()`、`nodeDOM()` | ProseMirror 视图 | 提交事务，在文档位置和 DOM 之间转换 |
| `TextSelection` / `NodeSelection` | ProseMirror | 文字光标/选区，完整节点选区 |
| `Plugin` / `Fragment` / `Slice` | ProseMirror | 扩展事件处理，组织待插入内容 |
| `closeHistory()` | ProseMirror 历史 | 设置历史分组边界 |
| `DOMSerializer.fromSchema()` | ProseMirror 模型 | 按节点规则输出 DOM |
| `ref` / `watch` / `Teleport` | Vue | 维护界面状态、响应变化、挂载弹层 |
| `dataTransfer` / `window.print()` | 浏览器 | 拖放数据和系统打印 |

## 8. 打印为什么要单独实现

### 8.1 打印的是当前内容快照

`App.openPrint()` 克隆当前 `template`、`data`、`body`，并带 `demo: true` 放到 `printSnapshot`。打印组件拿这份快照生成页面，因此即使正文没有保存，也能打印当前看到的版本。

“打印快照”和“已保存报告快照”是不同用途：前者是本次打印的内存副本；后者在保存报告时存进 SQLite，用来保留报告创建时的模板和病例数据。

### 8.2 不是截图，也不是直接打印编辑器 DOM

调用路径：

```text
点击打印 / Ctrl+P / Cmd+P
→ App.openPrint() 克隆当前内容
→ ReportPrintPreview.prepare()
→ buildPrintPages() 准备和测量
→ preparePrintBody() 清理打印副本
→ DOMSerializer 根据 bodySchema 生成正文 DOM
→ paginate() 按实际尺寸计算页内容
→ 生成所有 A4 页面，显示预览
→ 用户点击“打印 / 保存 PDF”
→ window.print() 进入浏览器系统打印
```

`DOMSerializer` 依据 schema 的节点输出规则工作，因此打印图片使用 `ReportImage.renderHTML()`，不会把 NodeView 中的编辑按钮也带过去。预处理还会清掉空图片提示，并让空栏、表格单元格保留合法结构。

这一步使用 ProseMirror API；分页、纸张布局和系统打印则由项目与浏览器承担。项目没有调用云端 PDF 转换服务，也没有使用 Yiitap/Tiptap 的收费分页组件来完成这套 A4 分页。

### 8.3 为什么要等字体和图片

字体换了或图片还没加载，内容高度就可能变化。`waitForPrintResources()` 等待字体就绪和图片 `decode()`，失败/超时则显示错误，不继续开放不完整的打印结果。

关闭预览时用 `AbortController` 取消后续准备过程。Vue `nextTick` 只保证 Vue 的 DOM 更新完成，不能代替字体和图片加载等待。

### 8.4 分页的大致算法

`buildPrintPages()` 先在隐藏测量区创建 A4 DOM，测出正文可用高度和宽度；第一页有表头，后面没有，所以首页与续页的容量不同。`paginate()` 再按顺序放内容：

- 能放下的块留在本页，放不下就尝试移到下一页。
- 过长文字用二分查找决定本页最多放多少文字节点内容。
- 列表和引用块递归拆分；有序列表续页调整起始序号。
- 表格优先按行分页，有表头时续页重复表头；过高行再拆单元格内容。
- 分栏按各栏内容分别续页，保留栏序和空栏，避免长短栏造成内容丢失。
- 图片行尽量整体保留，图片用打印 CSS 限高和等比例缩放。
- 实在无法安全放进单页时抛出错误，不假装已经成功分页。

签名作为特殊的 `printSignature` 参与空间测量，输出时放到最后一页底部、页码上方。医院抬头、logo、报告标题和病例字段只显示在首页；每页都有“第 X 页 / 共 Y 页”。

### 8.5 屏幕字号与纸张字号

界面用了较大的可读字号和类似缩放的样式，打印用独立的 [print.css](../src/printing/print.css) 固定 A4 布局。打印时还强制栏不换成竖向，避免 Yiitap 的窄屏样式把多栏堆成一列。

预览与打印复用同一批已计算的页面 DOM；最终系统打印仍需选择 A4、100% 缩放并关闭浏览器自带页眉页脚。保存 PDF 是浏览器打印能力，不是顶部占位按钮的导出功能。

定位：[ReportPrintPreview.vue](../src/ReportPrintPreview.vue)、[render.mjs](../src/printing/render.mjs)、[paginate.mjs](../src/printing/paginate.mjs)。

## 9. 查代码和继续学习的路线

### 9.1 按问题找文件

| 想理解或修改什么 | 先看这里 | 接着看 |
| --- | --- | --- |
| 默认进入报告、按钮是否生效、加载与保存 | [App.vue](../src/App.vue) | [api.mjs](../server/api.mjs)、[store.mjs](../server/store.mjs) |
| 报告纸张、表头表尾、演示数据 | [ReportPaper.vue](../src/ReportPaper.vue) | [demo-report.mjs](../src/demo-report.mjs)、[demo-report.css](../src/demo-report.css) |
| 个人模板搜索与本机保存 | [ClinicalSidebar.vue](../src/ClinicalSidebar.vue) | [ClinicalDetail.vue](../src/ClinicalDetail.vue)、[clinical-assistance.mjs](../src/clinical-assistance.mjs) |
| 既往检查和右侧影像 | [EvidenceSidebar.vue](../src/EvidenceSidebar.vue) | [key-images.mjs](../src/key-images.mjs) |
| 编辑器初始化和正文回传 | [BodyEditor.vue](../src/editor/BodyEditor.vue) | [body-schema.mjs](../src/editor/body-schema.mjs) |
| 插入菜单有哪些项、怎么执行 | [menu.mjs](../src/free-template/menu.mjs) | [suggestion.js](../src/free-template/suggestion.js)、[SlashMenu.vue](../src/free-template/SlashMenu.vue) |
| 模板和历史如何引用进正文 | [report-sections.mjs](../src/editor/report-sections.mjs) 的 `insertCitationTransaction` | `BodyEditor.insertTemplate` |
| 图片节点、填图、移除、拖放 | [report-images.mjs](../src/editor/report-images.mjs) | [key-image-insert.mjs](../src/editor/key-image-insert.mjs) |
| 分栏选择、删除、栏内加号 | [column-delete.mjs](../src/editor/column-delete.mjs) | [column-insert.mjs](../src/editor/column-insert.mjs)、[ColumnInsertControl.vue](../src/editor/ColumnInsertControl.vue) |
| 块拖动及动画 | [use-block-drag.js](../src/editor/use-block-drag.js) | [block-drag.mjs](../src/free-template/block-drag.mjs) |
| 打印页数、表头、签名、图片跨页 | [render.mjs](../src/printing/render.mjs) | [paginate.mjs](../src/printing/paginate.mjs)、[print.css](../src/printing/print.css) |

### 9.2 建议学习顺序

1. 先看 `ClinicalDetail.vue`。它体量小，能同时学会 `<script setup>`、props、emit、`v-model`、条件显示和点击事件。
2. 再看 `ClinicalSidebar.vue`。理解 `ref`、`computed`、`watch`、草稿、副本和 `localStorage`。
3. 看 `App → ReportPaper → BodyEditor`。画出正文如何传入、变化后如何回传，理解组件引用和 `defineExpose`。
4. 看 `menu.mjs`。先只读标题、列表、表格分支，掌握 Tiptap 命令链，不必一开始读所有光标补丁。
5. 看 `insertCitationTransaction()`。这是理解 ProseMirror 文档位置、事务和选区的较短实例。
6. 看 `ReportImage`。学习自定义节点、attrs、NodeView 和事件插件。
7. 最后看拖动和打印。它们还涉及坐标、布局测量、DOM 观察、动画和异步资源，难度比 Vue 基础高得多。

对照外部资料时，先看项目锁定的版本和实际导入；不能把最新版例子不加区分地套进来。Yiitap 的官方源码入口是 [pileax-ai/yiitap](https://github.com/pileax-ai/yiitap)；Tiptap 自定义扩展概念可读 [Extension API](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension)。本项目的行为细节应继续以本文链接的仓库函数为准。

## 10. 核对方式与常见误解

### 10.1 这份说明如何核对

本文按 `914793d` 的组件、函数调用和本地依赖包实现梳理，并在本地浏览器核对了默认报告页和实际打印预览。浏览器中确认了“提交报告”标签、八张影像、可编辑侧栏及打印预览的首页字段和末页签名；多页拆分等行为主要结合算法和现有自动化测试核对，未把单页预览当作所有场景的人工验收。

已有测试入口是 `package.json` 的 `test` 脚本，即：

```sh
# 在 prototype/ 中运行，需要 Node.js 24+
node --test tests/*.test.mjs
```

这会运行当前全部 Node 测试，包括正文引用、分栏光标/删除、图片插入、保存、分页及 Sites 相关用例。浏览器专用用例另见 [tests/browser/README.md](../tests/browser/README.md)，不等于已被这个命令全数执行。

| 需要回归的行为 | 对应测试 |
| --- | --- |
| 引用不替换选中文字、可单步撤销 | [citation-insertion.test.mjs](../tests/citation-insertion.test.mjs) |
| 新分栏内有空段落、光标在布局后面 | [column-insertion-cursor.test.mjs](../tests/column-insertion-cursor.test.mjs) |
| 删除整栏/单栏与文字删除的区别 | [column-delete.test.mjs](../tests/column-delete.test.mjs) |
| 分栏后 Backspace 不误增列 | [column-backspace.test.mjs](../tests/column-backspace.test.mjs) |
| 关键影像选择、2×2 / 2×3、栏内复用 | [key-image-menu.test.mjs](../tests/key-image-menu.test.mjs) |
| 插入正文块后的光标与引用 | [report-block-cursor.test.mjs](../tests/report-block-cursor.test.mjs) |
| 分页、续页内容和输出规则 | [print.test.mjs](../tests/print.test.mjs)、[print-first-header.html](../tests/browser/print-first-header.html) |
| 报告存储、快照及版本冲突 | [store.test.mjs](../tests/store.test.mjs)、[workbench.test.mjs](../tests/workbench.test.mjs) |

上表路径以当前仓库文件为准；修改文档时也应检查链接是否仍存在。

本次文档整理后重新运行全部 Node 测试，结果为 **161 项通过，0 项失败**。没有修改应用功能代码；浏览器核对未保存正文或个人模板，也未执行系统打印。

### 10.2 常见误解对照

| 容易产生的理解 | 当前实际情况 |
| --- | --- |
| 用了 Yiitap 就没有使用 Tiptap | Yiitap 暴露 Tiptap 编辑器，项目直接调用命令和扩展 API |
| 所有 `@tiptap/pm` 调用都是高层 Tiptap 命令 | 其中很多是 ProseMirror 的模型、状态、事务与视图 API |
| 页面上的按钮都已经接通 | 顶部只有打印有动作；提交、阅片等是占位 |
| `getJSON()` / `dispatch()` 就是保存 | 它们是读取/更新本地编辑状态；写后端还要调用 PUT |
| 引用会清空并替换“描述/诊断” | 当前路径是在选区末端插入普通文字和换行，保留已有内容 |
| `NodeView` 决定所有输出 | 它主要负责编辑器内交互；打印使用 schema 的序列化规则 |
| 分栏只是 CSS，把 DOM 并排就行 | 它还是真实文档节点，修改必须维持合法结构及选区 |
| 六点块排序和右侧拖图是一套机制 | 前者为自定义鼠标排序；后者用原生拖放加插件接收 |
| `page-view="full"` 自带 A4 分页 | 分页由项目测量和拆分算法实现 |
| 保存个人模板会同步所有电脑 | 当前只存本机浏览器，医院和医生标识只是存储分组 |
| 未保存警告说明已经自动保存 | 它只提醒存在内存修改，不能代替持久化 |

读代码时先问三个问题会更容易定位：**谁拥有这份数据？谁真正改变了编辑器文档？这次变化有没有写入持久存储？** 页面按钮、Vue 状态、编辑器事务和后端保存分别回答不同的问题。

## 11. 结合注释代码逐步学习

### 11.1 怎么用这些注释

在编辑器中同时打开本文与对应源码。用全局搜索找 `【学习06】` 这样的编号，能把一个功能分散在不同文件中的入口串起来；再搜索下面列出的函数名，阅读函数旁的细节注释。编号表示知识主题，不表示源码行号，不会因前面增加几行注释就失效。

注释分三层：文件开头说明“这一层负责什么”，函数前说明输入/返回/副作用，关键语句前解释“为什么要这样处理”。Vue 模板里也补了 props、事件、组件 key 和 Teleport 的对应说明。

源码保留了当前格式和已有逻辑。不要要求自己第一遍就读懂某个很长的单行函数；先从注释找到输入和输出，再把表达式按 `;`、条件分支和调用关系拆开看。尤其不要先从拖动和分页算法入手。

### 11.2 先读组件，再读编辑器

以下是推荐顺序，按难度排序；不必按编号从 01 读到底。

| 阅读顺序 | 搜索编号与打开文件 | 这一步掌握什么 | 阅读后自己回答 |
| --- | --- | --- | --- |
| 1 | `【学习02】`：[ClinicalDetail.vue](../src/ClinicalDetail.vue) | props、emit、自定义组件 `v-model`、对象复制、追加草稿 | 为什么输入框改变后要发 `update:modelValue`，而不是直接改 props？ |
| 2 | `【学习02】`：[ClinicalSidebar.vue](../src/ClinicalSidebar.vue)、[clinical-assistance.mjs](../src/clinical-assistance.mjs) | `ref`、`computed`、`watch`、副本、本机存储 | 草稿、已保存模板和搜索列表分别是谁？点击保存后什么触发 dirty 变为 false？ |
| 3 | `【学习01】`：[main.js](../src/main.js)、[App.vue](../src/App.vue) | 应用挂载、页面状态、异步加载、请求过期保护 | 首次打开为什么是报告页？两轮 load 乱序返回时怎么避免显示旧结果？ |
| 4 | `【学习03】`：[ReportPaper.vue](../src/ReportPaper.vue)、[BodyEditor.vue](../src/editor/BodyEditor.vue)、[demo-report.mjs](../src/demo-report.mjs) | props 向下/事件向上、`defineExpose`、组件 ref 与编辑器实例的区别 | 哪个对象是 Vue 组件？哪个是 Tiptap 实例？正文 JSON 最终归谁持有？ |
| 5 | `【学习04】`：[body-schema.mjs](../src/editor/body-schema.mjs) | 节点、扩展、schema、只读行为 | 为什么只读仍要保留 Column/ColumnContainer，却不加载 ColumnDeletion？ |
| 6 | `【学习05】`：[menu.mjs](../src/free-template/menu.mjs)，再读 [suggestion.js](../src/free-template/suggestion.js)、[SlashMenu.vue](../src/free-template/SlashMenu.vue) | Tiptap 命令链、Yiitap 触发器、VueRenderer、菜单范围 | 选择二级标题时，哪一步只是显示候选，哪一步真正修改文档？ |
| 7 | `【学习06】`：[BodyEditor.vue](../src/editor/BodyEditor.vue)、[report-sections.mjs](../src/editor/report-sections.mjs) | EditorState、事务、Fragment、TextSelection、历史边界 | 为什么 `replaceWith(pos,pos,...)` 能保留已选中文字？dispatch 与保存有什么区别？ |
| 8 | `【学习07】`：[KeyImagePicker.vue](../src/free-template/KeyImagePicker.vue)、[key-image-insert.mjs](../src/editor/key-image-insert.mjs)、[report-images.mjs](../src/editor/report-images.mjs) | 多选状态、文档节点、自定义 NodeView、图片拖放 | 勾选图片会不会立即改变正文？图片数据和编辑按钮分别定义在哪里？ |
| 9 | `【学习08】`：[column-insert.mjs](../src/editor/column-insert.mjs)、[column-delete.mjs](../src/editor/column-delete.mjs)、[ColumnInsertControl.vue](../src/editor/ColumnInsertControl.vue) | DOM 与文档位置转换、选中文字/整节点的区别 | 点空栏内部和点边缘为什么不同？为什么要先检查 target 节点仍是同一个对象？ |
| 10 | `【学习09】`：[use-block-drag.js](../src/editor/use-block-drag.js)、[block-drag.mjs](../src/free-template/block-drag.mjs) | composable、动画帧、FLIP、节点移动事务 | transform 负责什么？如果只清 transform 不恢复文档，取消拖动会留下什么问题？ |
| 11 | `【学习10】`：[ReportPrintPreview.vue](../src/ReportPrintPreview.vue)、[render.mjs](../src/printing/render.mjs)、[paginate.mjs](../src/printing/paginate.mjs)、[print.css](../src/printing/print.css) | 异步取消、DOMSerializer、真实测量、递归分页、纸张样式 | nextTick 为什么不能代替图片加载？为什么测量容器不能用 display:none？ |
| 12 | `【学习11】`：[App.vue](../src/App.vue)、[api.mjs](../server/api.mjs)、[store.mjs](../server/store.mjs) | fetch、JSON、Vite 中间件、SQLite、版本与快照 | 哪一步才真正写磁盘？版本检查和正文 schema 检查各自防什么问题？ |

### 11.3 用四条真实操作链把代码连起来

#### 第一条：改个人模板中的一句话

先不碰正文编辑器。打开 `ClinicalDetail.update()`，看见：

```js
function update(key, value) {
  emit('update:modelValue', { ...props.modelValue, [key]: value });
}
```

逐项对应：

- `key` 是 `findings` 或 `impression`，来自输入框事件。
- `{ ...props.modelValue }` 复制原对象，`[key]: value` 覆盖本次字段。
- `emit()` 送出新的草稿；`ClinicalSidebar` 中的 `v-model="draft"` 接住它。
- `dirty` 比较 `draft` 与列表中的已保存条目，界面显示未保存状态。
- 点个人模板“保存”才进入 `ClinicalSidebar.save()`，再写本机存储。

自检：`emit('cite', modelValue)` 与 `emit('update:modelValue', ...)` 是两类事件；前者请求引用，后者只改当前草稿。它们都不直接调用 SQLite。

#### 第二条：把模板引用到正文光标处

按下面顺序搜索函数名；先不读旧 `replaceSectionsTransaction`：

```text
ClinicalDetail 中 emit('cite', modelValue)
→ ClinicalSidebar / EvidenceSidebar 转发 insert
→ App.insertTemplate
→ ReportPaper 的 defineExpose({insertTemplate: ...})
→ BodyEditor.insertTemplate
→ insertCitationTransaction
→ editor.value.view.dispatch
→ YiiEditor update / e.getJSON()
→ ReportPaper updateBody
→ App 的 @update-body 更新 body
```

阅读 `BodyEditor` 时，把三个对象分开：

| 名称 | 是什么 | 关键用途 |
| --- | --- | --- |
| App 中的 `reportPaper.value` | Vue 子组件引用 | 调用纸张组件暴露的 `insertTemplate` |
| ReportPaper 中的 `bodyEditor.value` | Vue 子组件引用 | 再调用正文组件暴露的方法 |
| BodyEditor 中的 `editor.value` | Yiitap 创建并暴露的 Tiptap 实例 | 读取 `state`、构建/提交事务、获取 JSON |

再读核心事务代码：

```js
const pos = state.selection.to; // 选区末端，不是鼠标屏幕坐标
const tr = closeHistory(state.tr)
  .replaceWith(pos, pos, Fragment.fromArray(nodes)); // 相同起止位置：只插入
tr.setSelection(TextSelection.create(tr.doc, pos + insertedSize));
```

这是结构讲解片段，`insertedSize` 在实际代码中由节点 `nodeSize` 累加得到。重点看 `tr.doc`：它是本次修改后的文档；构建事务时旧 `state.doc` 还没包含新内容，不能混用。

自检：这条链结束于更新内存正文，不会经过 `api.mjs`；一次引用可以撤销，但不代表已经保存。

#### 第三条：从 slash 菜单插入四张关键影像

先读 `KeyImagePicker.selected` 和 `toggle()`，再到 `menu.mjs` 的 `action==='keyImages'` 分支，最后看 `insertKeyImagesTransaction()`。

```text
Vue selected：按选择顺序记录四个 ID
→ emit('insert', IDs)
→ SlashMenu.insertImages：组装 action / imageIds
→ suggestion.js 注入的 onPick：携带原 range
→ executeNativeInsert：选择图片事务分支
→ insertKeyImagesTransaction：判断栏内还是栏外，生成节点
→ cursorAfterLastInsertion：布局后段落与光标
→ dispatch：正文改变
```

栏外四张生成两组 `columns`，每组两栏；各栏内是图片和空段落。栏内选择四张则直接向当前栏插四个图片块，不套成 2×2 新布局。两条路径使用相同勾选界面，但文档结构不同。

自检：四张“关键影像”与“四张图片”预设的区别是什么？前者带具体图片，后者先建空布局；可以在 `menu.mjs` 的不同 action 分支对照。

#### 第四条：打印一份尚未保存的报告

从 `App.openPrint()` 开始，看快照被传到 `ReportPrintPreview`，然后追 `prepare → buildPrintPages → paginate`。把两个“等待”分开：

1. `nextTick()` 等 Vue 先把测量容器挂到 DOM。
2. `waitForPrintResources()` 等字体与图片稳定，才能算实际排版尺寸。

`paginate()` 只知道“这些节点能不能放下”，通过 `fits` 回调向 `render.mjs` 询问浏览器尺寸，因此 Node 测试可以传一份模拟测量函数。这个设计让分页决策可以独立测试，而不需要在算法文件里使用 Vue 或浏览器。

自检：打印开始和结束都没有报告 PUT 请求。`printSignature` 是打印专用占位块，不是供用户插入正文的 schema 节点；它先参与分页测量，最终被移到末页底部。

### 11.4 四组“小观察”，不用先改功能

以下是供学习时手动尝试的操作，不代表本轮已逐项人工测试。使用模拟数据练习即可；正文当前没有直接保存入口，刷新会丢失未保存编辑，浏览器可能先弹离开提示。个人模板“保存”会修改本机存储，练习时不必点击。

1. **观察 Vue 数据流**：在个人模板描述里加一句话，看未保存标记；再看源码 `update → v-model → dirty`。解释为何右侧历史内容没有同步变化。
2. **观察引用选区**：先在正文选中几个字，再点击侧栏引用，观察原文字仍保留；用一次撤销检查这次插入。对照 `selection.to` 和相同起止位置的 `replaceWith`。
3. **观察“坐标”的两种意义**：栏内移动鼠标时，加号按 `getBoundingClientRect()` 的屏幕像素定位；点击后插入 `/` 则要用文档 pos。把 `columnInsertTarget` 返回值的 `left/top` 与 `pos` 分别圈出来。
4. **观察输出与交互分离**：正文中能看到图片移除按钮，打印预览中没有。找到 `ReportImage.addNodeView()` 与 `renderHTML()`，解释为什么不需要打印时逐个隐藏 NodeView 按钮。

### 11.5 调试时应该在哪里停下来

如果使用浏览器开发者工具，可以在以下函数内部设置断点，再执行对应页面操作。函数名适合全局搜索定位，避免依赖容易变化的行号。

| 断点 | 重点观察 | 正常情况下应理解到的事 |
| --- | --- | --- |
| `ClinicalDetail.update` | `key`、`value`、`props.modelValue` | 输入组件通过新对象事件更新草稿 |
| `BodyEditor.ready` | 参数 `ed`、`ed.state`、`ed.view` | Yiitap create 给出的就是可操作的 Tiptap 实例 |
| `BodyEditor.insertTemplate` | `positioned`、`state.selection.from/to` | Vue 的布尔标记与编辑器当前选区是两回事 |
| `insertCitationTransaction` | `state.doc.toJSON()`、`tr.doc.toJSON()` | 构建事务时即可比较修改前/后文档；返回不等于已 dispatch |
| `executeNativeInsert` | `item.action`、`range`、`options.afterBlock` | 同一菜单适配器为不同操作选择不同执行路径 |
| `ReportImage` NodeView 的 `change` | `getPos()`、`attrs` | 替图改的是节点属性，不只是 DOM 的 src |
| `reorderBlock` | `from`、`boundary`、`target`、`nodeSize` | 先删除源节点后，目标位置为什么要重新计算 |
| `buildPrintPages` | `firstCapacity`、`continuationCapacity`、`pages` | 首页与续页容量不同，页数来自实际内容测量 |
| `store.saveReport` | `context.reportRevision`、`currentRevision` | 只有真实 PUT 走进持久化层才会停在这里；顶部占位“提交报告”不会触发它 |

学习过程中只查看这些值即可，不要在控制台直接调用 `dispatch` 或保存接口来“试一下”，否则会绕过页面的交互前提。想验证保存层，优先读现有 `store.test.mjs` 的临时数据库用例。

### 11.6 这轮注释修改怎样保证不改变行为

这轮新增说明涉及页面组件、菜单适配、文档扩展、图片/分栏、拖动、打印和保存层。验证分为三部分：

- 将本轮修改与修改前版本比较，忽略注释和位置元数据后，检查 JavaScript 语法树；Vue 文件另外比较关闭注释输出时的模板编译结果及原有样式内容，CSS 比较去除注释后的内容。
- 重新运行全部 Node 测试及生产构建，检查注释没有误入字符串、模板结构或编译路径。
- 检查文档内的文件链接、学习编号和 Markdown 代码块，确保能按本节路线找到真实源码。

这比只看“diff 新增了很多 `//`”更可靠；它仍不等于每一个浏览器交互都重新做过人工验收。实际测试与核对结果见本次提交说明。

本轮验证结果：29 个源码/样式文件的语法树、模板编译或去注释内容比对一致；161 项 Node 测试全部通过；生产构建及 Sites 构建文件准备成功。文档链接、目录锚点、11 组学习编号和代码块检查通过。本地浏览器确认报告页正常加载；没有逐项重做所有编辑交互。构建仍有项目已有的大 chunk 体积提示。
