# Prototype progress — 2026-11-01-prototype.md

- Completed: Vue adaptation of Product Design starter, actual Yiitap editors, field nodes, binding and document model.
- Completed: SQLite templates/reports, local same-origin API, mock case data and immutable report template snapshots.
- Completed: admin/doctor flows, edit/save/reload, preview modes, keyboard field protection, responsive layouts.
- Review findings fixed: in-flight template/body save races; case switching during save; missing doctor body in full preview; fixed fields removable by Backspace; span-aware column width; invalid leaf JSON content; report revision conflicts.
- Meaningful regression coverage: model, schema validation, editing-state merge, span placement, SQLite reopen, hospital isolation, report snapshots and version conflicts.
- Browser verified: A/B 6/5 fields; B footer2; mapping reflection; label rename-save-reload; layout-save-reload; drag; style/span; unsaved cancel/restore; doctor body save/reopen; full preview body; zero/null display; mobile navigation and no horizontal overflow.
- Implementation choice: local Vite middleware hosts SQLite API; cloud deployment is intentionally not performed and requires backend adaptation.
- Implementation choice: manually protected fixed field node layout within Yiitap, not arbitrary absolute-position canvas.
- Development-only Yjs duplicate-import warning appeared during hot module replacement; verify clean startup separately before handoff.
- Current code uses pnpm; bundled Node/npm-free environment required absolute runtime path. System Python lacks Pillow; bundled Python used to inspect screenshot metadata.

- Final: visual QA passed; final clean reload produced zero new console errors; default viewport restored and preview tab retained. 13 tests passed and production build completed with documented chunk-size warnings.
