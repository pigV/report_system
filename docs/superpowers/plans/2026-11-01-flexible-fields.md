# Flexible Report Fields Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task.

**Goal:** Editable hospital heading and freely configurable header/footer fields and bindings.
**Architecture:** Shared template helpers and schema drive the editor, preview and persistence validation. Missing hospitalName retains the legacy hospital default; an explicit blank hides the heading. Empty bindings are valid and displayed as 未绑定.
**Tech Stack:** Vue 3, Tiptap/Yiitap, Node test runner, SQLite.
**Spec:** docs/superpowers/specs/2026-11-01-flexible-fields-design.md

## Global Constraints
- Work in the existing report_design project; this is not CRM.
- Keep Sites hosting and worker files intact.
- Preserve saved report snapshots and independent hospital templates.

## Review Focus
- Delete the last field, save, reload and add another.
- Unique field identities across both regions; unsafe identities rejected.
- Unbound fields save and render without a misleading bound count.
- Legacy templates and report snapshots retain the hospital heading.
- Editor updates accept added/removed fields without restoring the fixed list.

### Task 1: Model and persistence
- [x] Add failing tests for dynamic fields, empty regions, unbinding, heading, persistence and isolation.
- [x] Implement addTemplateField(template, region, id), removeTemplateField(template, region, id), reportHospitalName(template) in src/report-model.mjs, empty grids in template-schema.mjs and structural editor guard in editor-state.mjs/nodes.js.
- [x] Run the full Node test suite and verify passing results.

### Task 2: UI and verification
- [x] Add field controls, binding removal, empty states, heading input and preview rendering in App.vue, TemplateEditor.vue, ReportPaper.vue and style.css.
- [x] Record approved prototype requirements in prototype/AGENTS.md.
- [x] Build, open local preview, exercise add/delete/unbind/save/reload and hospital switching.
- [x] Review diff and record verification outcomes.

## Execution record
User approved implementation; continue within the existing workspace without another approval round. No publish or push requested.

Verification: 20/20 Node tests pass, including real ProseMirror history undo restoring deleted bindings, empty-region SQLite persistence, legacy headings, and hospital/snapshot isolation. Production build and Sites packaging pass; Vite reports a non-blocking large-chunk warning.

Browser verification: add, rename, bind, unbind, save, reload, delete all header fields, re-add, reset, add/delete footer fields, switch A/B hospitals, and keyboard delete/undo all verified. A Vue NodeView selection race was reproduced and fixed by waiting for nextTick before selecting. Final browser console has no errors. Temporary test field and hospital heading changes were removed; original example content restored. Screenshot: prototype/qa/flexible-fields.png (ignored).

Independent review found one issue: undo restored fields without bindings. Fixed with an in-session removed-binding cache, cleared on load/reset and excluded from persisted JSON. Regression test reproduces actual ProseMirror deletion/undo. No deferred findings.
