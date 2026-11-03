# 自由模板实现验收（2026-11-02）

**Findings**
- 无未处理的 P0/P1/P2。独立审查发现的键盘工具栏、保存冲突提示、拖动撤销合并和取消拖动问题均已修复。
- P3：字段 token 未重复显示数据库图标；默认工具栏展示更多实用操作。采用现有系统字体/Phosphor 图标，与生成稿存在细微字形差异。

## 视觉证据与对比
- Source visual truth: `designs/medical-report-yiitap-native-v2.png`，1586 × 992。
- Local implementation: `http://127.0.0.1:4173/#native-templates`。
- Browser screenshot: `prototype/qa/native-template/desktop-final.png`，CSS viewport 1586 × 992、输出像素 1586 × 992（1:1）；无需密度缩放。
- Full-view combined comparison: `prototype/qa/native-template/compare-final.png`。同一张图并排比较源稿/实现。
- Focused combined comparison: `prototype/qa/native-template/focus-final.png`。同一张图比较工具栏、标题、分割线、表格与字段。
- Interaction state: 源稿打开斜杠菜单；最终交付截图为已保存空闲态。另有 `desktop-slash.png` 和 `compare-after.png` 展示实际斜杠菜单。菜单因底部空间不足向上展开属于预期定位行为。
- Responsive evidence: `prototype/qa/native-template/mobile-content.png`、`mobile.png`，390 × 844；文档宽度与视口同为 390 px，无页面水平溢出。移动导航可展开/收起；鼠标块拖动面向桌面，未验证触摸拖动。

## 对比迭代
1. 初始 `desktop-before.png` / `compare-before.png`：字段 token 与表格文字偏小、编辑器纵向空间不足（P2）。将 token 从 11 px 调至 13 px、字段行文字调至 13 px、编辑器主体最小高度从 510 px 调至 570 px。
2. `desktop-slash.png` / `compare-after.png` / `focus-after.png`：Yiitap 默认标题内边距叠加、原生分割线偏淡、整页预览页尾超出同尺寸截图（P2）。清除多余标题 padding、显式定义分割线、收紧新菜单顶部间距及预览高度。
3. `desktop-final.png` / `compare-final.png` / `focus-final.png`：上述问题已修复；页尾可见，主体层级/编辑区与预览关系一致。未处理的差异均为下述已说明的产品适配或 P3。

## 五项视觉核对
- 字体：沿用系统无衬线中文 UI 字体，报告标题使用宋体；编辑器 h1/h2 为 27/22 px，预览为 24/19 px，层级清晰。图稿字形与系统字形不完全一致，接受。
- 间距：左导航、页面标题、双栏编辑/预览、表头表尾切换、格式工具栏、纸面留白均保留。新增菜单和独立保存说明使上方区域稍高；属于明确保留原功能的适配。
- 色彩：暖白/灰白、细灰边框、沙金激活态与字段 token、黑色保存按钮。原生编辑器浮层已限定在新页面内着色。
- 图像/图标：功能界面无照片或插画；使用项目现有 Phosphor 与 Yiitap 图标。未用截图充当实现。
- 文案：沿用业务名称与原医院字段；数据来自现有模拟病例，不替换成图稿中的另一组示例。未新增虚构模板切换选项。

## 功能验证
- 真实浏览器：新菜单；表头/表尾切换；自由输入；中文斜杠菜单和业务字段插入；表格/两栏插入；字段直接拖动；块拖动及撤销；Enter 激活撤销按钮；字段定义独立添加；模拟数据切换；放大预览；保存后刷新恢复；未保存离开保护；A/B 医院切换；原模板配置及报告演示均可打开。
- 保存冲突实际触发，弹窗内显示“模板已在其他窗口更新，请重新加载后再保存”，没有覆盖服务器文档。截图 `prototype/qa/native-template/save-conflict.png`。
- 39/39 Node 测试通过：覆盖独立绑定、医院/报告快照隔离、新 SQLite 保存重开、版本冲突、schema/属性验证、零值、保存期间编辑合并、块拖动与历史边界等。
- 生产构建通过，Sites 打包产物生成。仍有 Yiitap 依赖块超过 500 kB 的体积警告，未发生编译错误。
- 浏览器最终 warn/error 日志为空。取消拖动的 Escape/blur/边界清理由独立代码审查复核；未用自动化鼠标序列实测按住拖动时的 Escape。
- 本轮未修改旧数据存储模块；新编辑器使用独立 SQLite。浏览器测试新增的内容已从新模板清理，A 模板恢复为原模板的初次转换内容。

## 明确范围
自由模板目前独立编辑、保存和预览，尚不参与旧“报告演示”的报告生成。页尾/正文在预览里是展示，不提供正式打印分页/PDF。首次复制不逐像素复刻旧网格边框和自定义列宽。新菜单为本地应用功能，未部署外网；Sites 静态打包检查不等于 SQLite 后端云部署。

**Implementation Checklist**
- [x] 新菜单与原功能并存。
- [x] Yiitap 文档能力、中文菜单与拖拽适配。
- [x] 保存隔离、冲突提示、数据验证。
- [x] 浏览器交互、视觉并排对比、39 项测试和构建。
- [x] 独立审查问题修复并复核。

final result: passed

### 2026-11-04 follow-up — Delete selected column layouts

Report body and free-template editors share a column selection/Delete extension. A 5px top/bottom selection area and teal outline make layout selection visible. Native add/resize controls between columns remain available. Text/media clicks retain normal editing; Delete only handles a selected column or column container. Removing the last individual column also removes its wrapper.

Browser checks at 1280 × 720 passed in both report body and free-template header: click the top edge, verify the column-container selection, press Delete (container count 1 → 0), undo once (0 → 1). No error-level console messages. Screenshot: `designs/column-delete-selected.png`.

82/82 tests and Vite/Sites build preparation passed. Tests cover both schemas, surrounding text, single-column removal, last-column cleanup, whole-container undo, cursor/text-selection fallthrough and read-only click protection.

final result: passed

### 2026-11-04 follow-up — reuse the current column

User correction: insert image blocks directly into the current column when the menu anchor is inside a column. The footer now says 插入当前栏; outside columns it continues to show 将生成 N 列.

Browser verification in a fresh report: create a two-column row, insert two selected images in its first column, and inspect the rendered DOM. The row still has two columns and two images, with zero nested column containers. The adjacent column remains unchanged. Screenshot: `designs/key-image-within-column-verified.png`. No error-level console messages.

74/74 tests passed, including one/multiple images in empty/nonempty columns, ancestor detection through a list, original-anchor detection independent of the current selection, surrounding-content preservation and single-step undo. Vite and Sites build preparation passed.

final result: passed


## 2026-11-04 — Key image cascade menu

- Source visual truth: `designs/key-image-menu-approved.png` (1536 × 1024 design board).
- Implementation: `http://127.0.0.1:5177/`; `designs/key-image-menu-verified.png` and `designs/key-image-columns-verified.png` (1280 × 720 browser captures; CSS pixel density 1). A 719 × 881 browser view was also exercised for keyboard selection and viewport containment.
- Comparison: `designs/key-image-comparison.png` contains full views and focused menu crops in one image. The design board includes two states and presentation headings; comparison targets the cascade controls and resulting native image row, rather than treating the board as one app viewport.
- Typography: native system Chinese font; 13px image names, 11px metadata and count, 14px panel heading. Clear hierarchy, no clipped feature labels.
- Layout: native first menu preserved with a custom-block section; secondary panel 340px wide, three thumbnail rows, count/clear/insert footer. Clamp to viewport using actual panel height.
- Colors: white surfaces, subtle gray dividers, restrained teal checked rows/checkboxes/primary action.
- Assets: reuse the actual key-image source assets used by the existing evidence rail. Result uses existing native image rendering and proportional scaling, with one equal column per selected image.
- Copy: 关键影像、支持多选、已选 N 张、将生成 N 列、清空、插入 N 张. Added keyboard help is intentional. Existing menu entries remain available under 更多内容.

### Comparison history

1. [P2, resolved] Secondary panel clipped at bottom when using an estimated height. Measure actual panel height after render and clamp it to the viewport. Post-fix capture shows all three rows, footer and keyboard help.
2. [P2, resolved] Entry initially required menu scrolling. Move it directly below the first five basic actions.
3. [P2, resolved] Panel could use stale anchor geometry during scrolling. Resolve the live expanded entry and reposition after suggestion-host style updates and scroll/resize. Fresh-page tests in both scroll directions verified that the panel follows the entry, subject to viewport clamping.
4. Final comparison: no remaining actionable P0/P1/P2 differences for this feature. The surrounding existing editor layout and image-block controls are retained.

### Interaction verification

- Plus and slash entry, multi-selection without dismissing the panel, clear and disabled empty-selection insertion.
- Arrow keys/Space multi-selection, Enter insertion, Escape dismissal.
- Three images insert at the original trigger, preserving surrounding paragraphs.
- Browser figure count: 3 before insertion → 6 after insertion → 3 after one undo; redo restores the group.
- Node suite: 71/71, including native schema validation and report storage.
- Browser error-level console logs: none.
- This is a local implementation; no publication or database migration.

final result: passed
