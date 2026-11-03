# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Approved template behavior (2026-11-01)

Header and footer fields are editable defaults, never a fixed required list. Users can add, delete, rename and reorder fields, and add, replace or remove their data bindings. Layout fields and the binding list are independently managed: deleting, renaming or reordering either must not change the other's rows, names or order. Adding a layout field does not automatically add a binding row; bindings are added explicitly. Preserve independent binding metadata on save/reload, including empty lists. Existing field-ID data lookups continue to supply report values. Empty regions must save and reload correctly. Hospital name belongs in the header configuration and is rendered centered above the report title. Preserve hospital isolation and existing report snapshots.

## Approved doctor workspace (2026-11-01)

Use `assets/doctor-workspace-reference.png` for the report demo. Current patient, historical records and common templates stack in the left assistance column, with both history and templates visible; report writing stays on the right. History is scoped to the current demo patient and opens read-only. Common templates support search, body-part filters, preview and undoable insertion that preserves existing text. All examples remain explicitly simulated.

## Approved free-template menu (2026-11-02)

The user approved `designs/medical-report-yiitap-native-v2.png` for implementation as a new menu while retaining existing functionality. Keep 自由模板 separate from 模板配置 and 报告演示. Its header/footer rich documents use Yiitap, free text, slash insertion, block/field drag, tables, columns and reusable business-field tokens. Default fields should already be available. Persist the new format independently; do not silently replace legacy templates or existing report snapshots. Preserve independent binding metadata when tokens are edited or removed.

## Approved report body controls (2026-11-02)

The report body uses the same Yiitap add, block menu and six-dot drag controls as free templates. Share block drag behavior, retain undoable common-template insertion, and persist all body blocks exposed by the insertion menu. History and full-page previews remain read-only.

The report body has no fixed top format toolbar or “报告正文” label strip. Use Yiitap’s inline block controls, selection bubble menu and keyboard shortcuts for editing.

## Overall color direction (2026-11-03)

Use `designs/20261103-110624.jpg` as the overall color reference: charcoal toolbar, light-gray navigation and work surfaces, white cards and report paper, and restrained teal accents. Preserve the existing layouts, functionality, and meaningful status colors.

## Approved report workbench (2026-11-03)

This supersedes the older stacked doctor-workspace layout and insertion behavior. Report demo uses the reference image's three-column arrangement: personal templates left, native Notion-style Yiitap body editor center, key images and patient-scoped history right. Personal templates allow editing, appending, separate saving and citation. History allows temporary editing/appending and citation but never saving back. Citation REPLACES the report's description and diagnosis, preserves other blocks (especially images, columns and tables), and is undoable. Keep semantic section identifiers on native blocks. Use native editor columns with droppable image blocks, supporting two/three/four/six and custom image layouts; persist them with reports and render previews read-only. All data/images are simulated. Personal template persistence is local to the browser and scoped to hospital/mock doctor.

## Approved report printing (2026-11-03)

Report demo prints the current editor content, including unsaved edits, without saving it. Show A4 portrait paginated preview before system printing/PDF. Repeat configured hospital/report heading and patient header fields on every page; signature/footer fields appear only on the last page, with page X / Y numbering on all pages. Preview and print share pagination. Long text, lists, tables (repeat headers; split oversized rows), and uneven native columns must continue without clipping or text loss. Keep image rows together where possible and scale images proportionally. Exclude editor controls and empty image prompts. Wait for fonts/images and surface preparation errors instead of offering incomplete printing.

Report printing footer alignment (2026-11-03): final-page signature fields are always bottom-aligned above the page number, including short reports. Reserve their actual wrapped height and a clear gap during pagination; never overlap body content. Use a fine separator and tidy, restrained footer typography.

## Shared navigation (2026-11-03)

Report demo uses the same global sidebar sizing, visible labels, icon alignment and active styling as template configuration and free templates. Do not collapse navigation specifically for report mode; retain the shared responsive behavior.

## Report demo entry and toolbar (2026-11-03)

This supersedes shared navigation for report mode: open report demo by default and hide global navigation there without an expand control. Keep the report's personal-template and evidence sidebars. Above the report, show the reference toolbar in this order: 选择模板、阅片、检查单、病历资料、收藏、相似病例、危急值、编辑检查、打印、导出报告. Only printing is connected for now; the other buttons are visual placeholders without an unavailable label.

The report demo's overall visual layout should closely follow the supplied reference image: full-width three-column workspace, gray template rail, charcoal report toolbar, white report paper, and white evidence rail. Remove the patient summary, case selection, save status, and report-save controls above the paper; retain the enlarged preview control at the paper's upper right. Use larger toolbar buttons.

## Approved pointer reordering (2026-11-03)

Template layout fields and the 字段与数据绑定 rows both reorder with the same pointer-based interaction: a floating ghost follows the pointer, the source slot becomes a dashed placeholder, and neighbouring rows/cards slide with a short FLIP animation while the order commits live. Drag starts after a 4px threshold, supports mouse, touch and pen, auto-scrolls near list edges, cancels on Esc, blur or a drop outside the container, and respects `prefers-reduced-motion`. Keep the existing arrow-key reordering and single-transaction editor history; never revert to native HTML5 drag-and-drop for these controls.

## Approved content-block drag (2026-11-03)

The report body and free-template editors lift the dragged block itself (not a separate ghost): it follows the pointer's Y position directly, keeps its grab point, and shows a highlighted insertion line in the gap. The Yiitap side controls, including the six-dot drag handle, stay anchored to the current block as the pointer moves within it; after hovering another block for about 140 ms, they move to that block. They do not continuously track the pointer's Y position. Blocks between the old and new slots slide with a spring FLIP animation (slight overshoot) while the order commits live. Dropping bounces the block into its slot; Esc, blur, or dropping outside the editor restores the original order. Keep the existing Yiitap six-dot handle, click suppression, focus behavior, and single-step undo for discrete moves. Never revert these blocks to native HTML5 drag-and-drop. The block's direct vertical follow supersedes the trailing motion originally approved on 2026-11-03 (updated 2026-11-04).

## Approved column picker (2026-11-03)

The report body and free-template slash menus share a Feishu-style column picker: preview five bars, choose 2–5 editable native columns by pointer or keyboard, and preserve the existing image layouts and business-field menu.

When hovering over a text block inside a column, show only an add button following the pointer in that column; clicking it opens the insert menu on that block without creating another row. Do not show the button on non-text blocks. Restore the normal block controls outside columns.

## Approved key image menu (2026-11-04)

The report body's plus/slash insert menu includes 关键影像 under 自定义块. Open a secondary menu with image thumbnails, names, metadata and multi-select checkboxes using the same key-image data as the evidence sidebar. Keep the menu open while selecting; show the selected count and resulting column count, 清空 and 插入 N 张. Insert at the original menu anchor, one equal native column per selected image in selection order. Preserve surrounding content, report persistence, read-only/print rendering and single-step undo. The approved visual is `designs/key-image-menu-approved.png`.

When the insertion anchor is already inside a column, insert the selected image blocks directly into that current column in selection order; do not create nested columns. Show 插入当前栏 in the selection summary. Only insertions outside columns create one new column per selected image.
