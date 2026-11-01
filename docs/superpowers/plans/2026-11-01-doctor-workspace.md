# Doctor Workspace Implementation Plan

> Execution: inline with executing-plans; user approved the visual implementation. Preserve existing uncommitted work.

**Goal:** Implement the approved patient/history/template assistance column with usable report insertion.

**Architecture:** A dedicated Vue clinical sidebar consumes explicit mock data; existing App owns case selection and persistence. ReportPaper exposes BodyEditor insertion; a ProseMirror transaction inserts blocks without replacing selected text and remains undoable.

**Tech Stack:** Existing Vue 3, Yiitap/Tiptap, Phosphor icons, Node tests and SQLite report API.

**Spec:** `docs/superpowers/specs/2026-11-01-doctor-workspace-design.md`

## Constraints and review focus

- Preserve flexible fields, saved reports, hosting worker and production data.
- History must match hospital, case and patient; second example has no history.
- Search/category changes cannot leave an invisible template insertable.
- Insertion must retain existing and selected text, undo in one step, and persist via existing save.
- Hospital/case switch clears expanded details; saving disables insertion.
- Narrow screens must retain controls without horizontal overflow.

## Tasks

- [x] Add tests for history scoping, filtered search and schema-valid, non-destructive, undoable template insertion. Run before implementation to establish failure.
- [x] Implement `src/clinical-assistance.mjs` and `src/editor/insert-template.mjs`; run targeted tests.
- [x] Implement `src/ClinicalSidebar.vue`, connect App → ReportPaper → BodyEditor, and add scoped doctor-page styles matching the approved image.
- [x] Run full tests and build; verify history dialog, search/empty states, insertion/undo, persistence, switching, and narrow viewport in browser.
- [x] Save visual QA evidence and update project documentation with approved behavior and verified limits.

## Completion evidence

25/25 Node tests passed, production build passed (existing large-chunk warning remains), git diff --check passed. Browser history, filtering, insertion/undo, case empty state and save/reopen verified; desktop/mobile visual QA passed. Independent review found no important issues. See `prototype/doctor-workspace-design-qa.md` and `prototype/qa/doctor-workspace/verification.md`. No commit or deployment performed; pre-existing changes retained.
