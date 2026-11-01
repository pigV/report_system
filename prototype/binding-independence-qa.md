# Independent binding verification — 2026-11-01

- Regression phase: 7 expected failures before implementation, including cascaded deletion and detached-binding validation.
- Full suite: 30/30 tests pass. Tests cover legacy metadata initialization, independent binding operations, layout deletion/rename/reorder, editor undo, empty lists, invalid metadata, SQLite reopen, stale-save rejection, hospital isolation and unchanged report snapshots.
- Production build passes; Vite reports a non-blocking large-chunk warning.
- Browser at `http://127.0.0.1:4173/`: deleting the upper patient-name field leaves 5 layout fields and all 6 binding rows, including the patient-name mapping. Renaming the layout's gender field and the age binding changes only the respective labels. Removing the gender binding retains the layout field. Moving the age binding upward leaves layout order unchanged.
- Browser test edits were discarded using the application's restore action; original saved fields and bindings are restored. Persistence was exercised against temporary test databases, not by overwriting the user's saved template.
- Screenshot: `binding-independence-qa.png` shows the temporary deletion test (5 layout fields, 6 bindings).
- Independent read-only code review found no actionable issues within the approved scope.
