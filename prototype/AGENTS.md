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

Exception (2026-11-04): an empty report-image slot in a column must also expose the editor add button, so images can be added through the insert menu after removal. Keep other non-text blocks unchanged.

After deleting an image from a column, remove the image block rather than creating an image placeholder. Keep the empty column available for image drag-and-drop and its editor add button; preserve existing saved placeholders.

## Approved key image menu (2026-11-04)

The report body's plus/slash insert menu includes 关键影像 under 自定义块. Open a secondary menu with image thumbnails, names, metadata and multi-select checkboxes using the same key-image data as the evidence sidebar. Keep the menu open while selecting; show the selected count and resulting column count, 清空 and 插入 N 张. Insert at the original menu anchor, one equal native column per selected image in selection order. Preserve surrounding content, report persistence, read-only/print rendering and single-step undo. The approved visual is `designs/key-image-menu-approved.png`.

When the insertion anchor is already inside a column, insert the selected image blocks directly into that current column in selection order; do not create nested columns. Show 插入当前栏 in the selection summary. Only insertions outside columns create one new column per selected image.

Outside existing columns, selecting four key images inserts a 2×2 layout and selecting six inserts a 2×3 layout, in selection order. Show the resulting rows and columns in the picker. Other selection counts and insertion inside an existing column retain their prior behavior.

The 四张图片 and 六张图片 layout presets create empty editable columns without “拖入关键影像” placeholder blocks. Keep image drag-and-drop and the editor add button available in those columns; preserve existing report snapshots and other layout presets.

## Column deletion (2026-11-04)

In the report body and free-template editors, clicking a column container's top/bottom edge selects the layout; pressing Delete removes that selected container. Keep the existing add/resize controls between columns. Selecting an individual column removes only that column, removing the wrapper when its final column is deleted. Cursor/text selections inside columns retain normal text deletion. Read-only views cannot delete layouts, and layout deletion is undoable in one step.

## Deployment shape (2026-11-04)

The test server is internal/VPN-only, Linux, and has no Node or pnpm preinstalled; plain HTTP is acceptable. Package on the Windows dev machine with `deploy/pack.ps1`, then upload `deploy/install.sh` plus the tarball and run `sudo bash install.sh <tarball>` on the server. `install.sh` installs Node 24 and pnpm 12 into `<app dir>/runtime` (never system-wide), extracts the package without touching `data/`, installs systemd service `report-prototype` (user `report`) and self-checks `/api/hospitals` plus the home page. nginx is optional; when used it must forward `Host $http_host` and the service stays bound to 127.0.0.1:4173. Without nginx, deploy with `--host 0.0.0.0` and access port 4173 directly inside the VPN. The app has no authentication, so it must never be exposed publicly. Lockfile is `lockfileVersion: 9.0` and requires pnpm 12; `vite preview` is the runtime because the SQLite API is a Vite middleware plugin.

Packaging goes through `deploy/pack-archive.mjs` (Node), not `tar`: the dev machine runs a transparent-encryption DLP client, so `tar`/`cp` read ciphertext and produced a package whose HTML/JS arrived encrypted on the server. Node reads plaintext and writes a plaintext `.tar.gz`; `install.sh` verifies `dist/client/index.html` starts with `<!doctype` and then checks every file against the bundled `.pack-manifest` (sha256) before starting the service.

## Report demo visual update (2026-11-04)

For report-demo presentation only, use the reference heading “瑞派宠物影像诊断中心” / “图像诊断报告”, the supplied hospital logo, larger patient/exam fields and the supplied signature/footer reference. The demo shows the eight supplied key images; retain legacy image IDs for existing reports. Do not overwrite saved templates or report snapshots. Match the demo in enlarged and paginated print previews, with signatures only on the last page. Keep slash insertion and block controls without showing the editor hint or focus stripe.

The report demo's first header field is labeled “型号” instead of “名字”; retain its existing data value.

## Interface typography (2026-11-04)

Use larger, readable interface text for an older user group while preserving the existing overall layout and visual style. The interface should resemble browser zoom at 125%, based on the already enlarged typography; printing remains at its configured A4 scale.

## Report print header (2026-11-04)

This supersedes the earlier repeated-report-header rule. The hospital heading, logo, report title and patient/exam header fields appear only on the first printed page. Continuation pages use the reclaimed space for report content. Print preview and print/PDF share pagination; retain table continuation headers, page numbers on every page, and the bottom-aligned signature/footer on the final page.

## Report citation insertion (2026-11-04)

This supersedes replacement citation behavior: personal-template and history citations insert both description and diagnosis at the last position chosen in the editable report body, preserving existing content including selected text. Citation clicks show no notifications, including when there is no position or content to insert. A citation is undoable in one step.

## Column insertion cursor (2026-11-04)

After creating native columns from the insert menu in the report body or free-template editor, place the cursor on the line immediately below the entire layout. Preserve existing content there; create an empty paragraph if needed. The insertion remains undoable in one step.

## Report block insertion cursor (2026-11-04)

After creating a report body block via the insert menu, put the cursor on the body line after the entire new block, preserving existing content and creating a paragraph when necessary. This cursor is immediately available for citation without another click. Keep block insertion and citation individually undoable. Do not change other free-template insertion behavior.

## Empty column editing (2026-11-04)

When inserting ordinary native columns in the report body or free-template editor, each column has an empty editable paragraph, while the initial cursor remains below the whole layout. Clicking the interior of an empty column places the cursor in its paragraph. Preserve individual-column and layout edge selection, resizing, existing content behavior, image layout presets, and single-step undo.

New layouts created by the report body's key-image menu also place an empty editable paragraph below each image; clicking the column's empty interior positions the cursor there. Preserve image interaction, layout edge selection, single-step undo, existing report snapshots, and the behavior of inserting images into an existing column.
