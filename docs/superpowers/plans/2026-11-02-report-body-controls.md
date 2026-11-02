# Report Body Controls Implementation Plan

**Goal:** Give the report body the same Yiitap add, block menu and drag controls as free templates, as approved in chat.

**Architecture:** Share the existing mouse drag handler between both editors. Enable Yiitap side controls and reuse the slash menu's basic insertions. Keep body persistence compatible with every newly available block.

**Tech Stack:** Vue, Yiitap 0.19.3, Tiptap 3, SQLite, Node test runner.

**Spec:** User's two screenshots and confirmed proposal in this chat.

## Constraints and review focus

- Preserve report snapshots, hospital isolation, template insertion, and read-only history.
- Preserve free-template field insertion and dragging.
- Drag cancellation, same-position drops and undo must not corrupt content.
- New blocks must survive save/reload; controls must fit inside the report paper.

## Tasks

- [x] Extract NativeEditor's drag lifecycle into `src/editor/use-block-drag.js` and reuse it in both editors.
- [x] Enable BodyEditor side controls, basic slash insertions and scoped styles.
- [x] Add a shared body schema and persistence regression for nested inserted blocks and reordered content.
- [x] Run the full test suite and build, then check add, block menu, drag, undo, save/reload, read-only history and free-template drag in the browser.

## Progress

- Existing repository is clean. Implementation continues in the user's current prototype checkout.
- Found that the existing body validator rejects table/column nodes; align its schema with Yiitap before enabling those menu entries.

- Verification: 42/42 Node tests passed; production build passed (chunk-size warning remains).
- Browser: paragraph drag and undo, block menu, plus-to-table insertion, save/reload, read-only history and preview, common-template insertion/undo, free-template drag/undo passed.
- Original simulated report restored after browser persistence check; no QA content remains saved.
- Final review found readonly column editing handlers; fixed by keeping column schema nodes without editing plugins in readonly instances. Regression reproduced 2→3 columns before the fix and passes after the fix.
- Verified blank-body hover controls and restored the preview to the original saved A-hospital report. No review findings remain deferred.
