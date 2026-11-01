# Independent layout fields and binding rows

Approved in chat: removing, renaming or reordering a layout field must not change the binding list; binding-list operations must not add, delete, rename or reorder layout fields. Save/reload must preserve that independence.

Implementation uses the existing Vue editor and JSON/SQLite storage. Keep the existing field-ID-to-data-path lookup for report values; store binding-row names, region and order in a separate `bindingFields` array. Initialize this metadata once for legacy templates. An explicit empty list remains empty. Existing saved report snapshots remain untouched.

1. Update regression tests for deletion, editor undo and empty layouts. Add tests for independent binding-row edits, legacy conversion, orphan binding validation and SQLite reopen/hospital/snapshot isolation. Run and observe expected failures.
2. Update `prototype/src/report-model.mjs`, `src/editor-state.mjs` and `server/store.mjs`: preserve bindings on layout edits, normalize legacy metadata, independently validate and persist binding rows.
3. Update `prototype/src/App.vue`: use independent rows, separate deletion/rename/reordering, provide an explicit binding-add action and a layout-name input. Use a distinct drag type so cross-panel dragging cannot mutate the other list.
4. Run the full test suite and production build. Start/open the local preview and exercise deletion in both directions, save/reload, rename, reorder and empty states. Record the corrected project rule in `prototype/AGENTS.md`.

Review focus: legacy templates without metadata; empty lists reappearing after reload; keyboard delete/undo clearing or reviving bindings; binding drag affecting layout; stale saves and historical snapshots.
