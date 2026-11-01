# Flexible report fields

Correction approved later on 2026-11-01: layout fields and the binding list are independently managed. The deletion-cascades-to-binding behavior described below is superseded by `../plans/2026-11-01-independent-bindings.md`. Deleting, renaming or reordering a layout field must preserve binding rows, names and order, and vice versa.

User approved on 2026-11-01: header/footer fields are defaults, not mandatory. Allow adding, deleting, renaming, ordering, binding, rebinding and unbinding fields. Deletion removes its binding. Empty regions can be saved and populated again. Hospital name is editable in the header configuration, centered above the report title and saved with the template. Existing templates and saved report snapshots remain compatible.

Approach: extend the current template JSON and shared schema/validation, keeping the current editor and SQLite persistence. UI-only changes would leave editor and server restrictions in place, so all three layers must change together. Known backend paths remain the binding choices; adding a display field does not create backend data.
