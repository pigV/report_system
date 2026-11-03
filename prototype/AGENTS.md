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
