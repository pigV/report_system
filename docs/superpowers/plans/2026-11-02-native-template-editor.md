# Native report template editor Implementation Plan

> Execute inline with superpowers:executing-plans; final fresh review. User approved implementation of medical-report-yiitap-native-v2.png and a new menu preserving old functionality.

**Goal:** Add 自由模板 alongside 模板配置 and 报告演示, with genuine Yiitap writing, slash insertion, native block drag, tables/columns, business tokens, independent persistence and live preview.
**Architecture:** New free-template component owns the document and binding UI. A separate SQLite file/store and native-template endpoint isolate new format from existing templates/reports. First load derives a document from current legacy template; subsequent saves are independent. Shared editor schema validates JSON on the server.
**Tech Stack:** Existing Vue 3, Yiitap 0.19.3, Tiptap 3, Node 24 SQLite; no new dependencies.
**Spec:** designs/medical-report-yiitap-native-v2.png and user-approved conversation design, plus prototype/AGENTS.md.

## Constraints / rulings
- Preserve all existing dirty files; work in place because the current approved prototype exists in uncommitted changes. No reset, branch switch, commit, or push.
- Independent native-templates.sqlite, no migrations to reports.sqlite. New template does not apply to legacy report generation; the separate menu says this clearly.
- Header/footer editing only; body remains doctor's independent existing workflow. A4 preview is not PDF/pagination implementation.
- Bindings survive token deletion/reorder. Existing tokens reuse definitions. Custom binding rows are explicitly added.
- No raster assets needed; use existing Phosphor icon library and neutral design tokens.

## Review focus
- New/legacy/hospital/report snapshot isolation across SQLite reopen.
- Concurrent saves and edits arriving while a save is pending.
- Empty documents, invalid nodes/styles, missing bindings and zero sample values.
- Switching hospital/view with unsaved input; failed or stale load/save.
- Real slash menu and block drag work in the browser; previews preserve editor formatting.

## Tasks
- [x] 1. Add free-template/model.mjs and server/native-store.mjs; tests/native-template.test.mjs first (conversion, schema, independent bindings, persistence, conflicts and isolation). Add API route without changing old store.
- [x] 2. Add NativeTemplateWorkspace.vue, NativeEditor.vue, NativeDocument.vue, native-template.css and scoped business token extension. Integrate new navigation/save guard; leave legacy modules alone except shared shell hooks. Use Yiitap slash lifecycle and side menu; adapt Chinese business menu rendering and WebKit drag through ProseMirror transactions. Add binding drawer and full preview, keyboard-safe controls.
- [x] 3. Run full tests/build, browser exercise save/reload, header/footer, / insertion, drag, preview, bindings, old menus and hospital switching; capture comparison against reference, fix issues, fresh review, record QA and update instructions/docs.

## Progress
Baseline: 30/30 tests passed. Source is main with pre-existing uncommitted approved work. No server listening on 4173. Use bundled Node runtime.

Completed: 39/39 tests, production build, browser save/reload, field and block drag/undo, slash insertion, table/columns, bindings, footer, hospital/legacy navigation, stale-save dialog and responsive layout. QA comparison stored under prototype/qa/native-template; latest report at project root design-qa.md. Independent review findings fixed (keyboard commands, modal errors, drag history boundary and cancellation). Test-only content removed from new A template; old templates/reports retained.
