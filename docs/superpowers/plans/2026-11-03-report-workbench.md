# Report Workbench Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this approved plan inline.

**Goal:** Build the approved three-column report workspace with replacement citation and draggable key images.

**Architecture:** Extend existing Vue/Yiitap editor with semantic attributes on native text nodes and image-slot nodes inside native columns. Share node definitions with server validation. Store personal mock templates locally, scoped by hospital and mock doctor.

**Tech Stack:** Vue 3, Yiitap/Tiptap 3, Node test runner, existing SQLite report API.

**Spec:** docs/superpowers/specs/2026-11-03-report-workbench-design.md (records approved conversation).

## Global Constraints

- Preserve existing template configuration, free templates and report snapshots.
- Citation replaces description/diagnosis, preserving unrelated blocks and allowing undo.
- History changes are temporary; all records/images are simulated.
- Native Notion-style block controls remain the editing interface.

## Review Focus

- Repeated citation, empty content and legacy heading documents must preserve unrelated content.
- Images in native columns survive replacement, save/reload, and read-only rendering.
- Template storage failure must be visible; hospital/doctor namespaces must not overlap.
- Switching history records must discard drafts without mutating source records.
- Desktop layout and narrow viewport must keep all actions reachable.

## Tasks

- [x] 1. Tests and model: `editor/report-sections.mjs` exposes `replaceSectionsTransaction(state, entry)`; test repeat/undo/legacy and content preservation. `clinical-assistance.mjs` supplies cervical seeds and scoped personal-template storage helpers; test persistence and isolation.
- [x] 2. Images: `editor/report-images.mjs` defines image slot and `imageLayout(rows, columns)` using native columns; `key-images.mjs` supplies local simulated assets and scoped drag payload. Test layout and store roundtrip. Wire slash insert menu and BodyEditor.
- [x] 3. Panels: replace ClinicalSidebar with personal-template editor; add shared ClinicalDetail and right EvidenceSidebar; integrate App and three-column styles. History draft resets; local template save errors shown.
- [x] 4. Run `node --test tests/*.test.mjs`, build with Vite, start local server and verify browser interactions and layout. Update prototype/AGENTS.md with confirmed behavior. Review final diff.

## Execution notes

User confirmed execution; no extra approval gate. Implement in the current clean user workspace so preview reflects their checkout. No deployment/push requested.

## Verification results

49 Node tests passed. Vite production build and Sites packaging passed (existing large-chunk advisory remains). Browser checks at desktop width and the narrow in-app viewport: native three-image layout, real drag into all three slots, report save/reload, personal template append/save/reload, replacement citation retaining images, undo, history draft reset, custom 2×2 layout, read-only preview, unsaved-change guard, and empty history case. Independent review found list/quote traversal and empty-column edge cases; all three fixed and covered by regression tests. No commit or push requested.
