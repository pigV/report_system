# Key Image Menu Implementation Plan

**Goal:** Implement the approved 关键影像 cascade menu: select multiple images and insert one native column per image at the original insertion row.

**Architecture:** Reuse the report's keyImages source and reportImage/columns schema. Keep multi-selection in the menu until confirmation; execute a single ProseMirror transaction using the suggestion's anchored range. Existing report persistence and printing consume the native nodes.

**Tech Stack:** Vue 3, Yiitap/Tiptap, ProseMirror, node:test, Vite.

**Spec:** User-approved generated mock, 2026-11-04: `designs/key-image-menu-approved.png`.

## Constraints and review focus

- Preserve unrelated in-progress changes and existing menu entries.
- Empty selection cannot insert; unknown IDs must not create empty image slots.
- One, two and three selected images create exactly that many columns, preserving selection order.
- Insertion preserves surrounding text, including within a column; one undo removes the whole group.
- Native nodes survive serialization and report storage, and render in read-only/print views.

## Tasks

- [x] Add failing transaction/menu tests for counts, invalid/empty IDs, anchor position, text preservation, undo and serialization.
- [x] Add a focused image-column transaction helper and connect the report menu action.
- [x] Add the cascade multi-select panel, selection count, clear/insert controls, keyboard support and viewport positioning.
- [x] Record approved behavior in prototype/AGENTS.md; run the full test suite and build.
- [x] Verify the primary flow and resulting layout in the in-app browser; retain a screenshot.

## Verification

- 71/71 node tests passed, including exact image counts, selection order, anchored insertion, surrounding text, undo and report storage.
- Browser: plus entry, slash entry, click multi-selection, clear/disabled state, keyboard multi-selection, insertion, single-step undo (6 figures to 3) and redo.
- Browser scroll positioning checked against the live menu anchor; no error-level console messages.
- Self-review completed; no commit or deployment requested.
