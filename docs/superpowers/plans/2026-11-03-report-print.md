# Report Print Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this approved plan inline.

**Goal:** Add reliable A4 multi-page preview and printing of current report content.
**Architecture:** Pure document pagination with injected real DOM measurement; print-specific renderer using the existing body schema and template fields; Vue preview snapshots current report and waits for fonts/images. Same pages serve preview and native printing.
**Tech Stack:** Vue, Tiptap/ProseMirror serialization, browser DOM, Node tests.
**Spec:** docs/superpowers/specs/2026-11-03-report-print-design.md

## Global Constraints
- Current unsaved body prints without database writes.
- Repeated configured header, final signature only, numbered A4 pages.
- No clipped text/images or editor controls; preserve editable document unchanged.
- No added production dependencies and no changes to Sites packaging.

## Review Focus
- Long styled paragraphs and very tall single table rows: no lost/duplicated text.
- Tables with headers/merged cells: correct continuation and header repetition.
- Uneven multi-column text: preserve column identities, order and image placement.
- Font/image loading, closing while preparing, and print failures: no stale job or partial print.
- Exact-fit, empty body, signature overflow, oversized header: no silent overflow.

## Tasks
- [x] 1. Add pure `printing/paginate.mjs` and tests: paginate blocks, split text/lists/tables/columns using measured fit, preserve originals and fail clearly on unsplittable content.
- [x] 2. Add `printing/render.mjs`, print CSS and `ReportPrintPreview.vue`: actual-size measurement, resource readiness, repeated headers/final signature/page counters, ready/error/print states.
- [x] 3. Wire App print action with current snapshot and document confirmed rules in AGENTS.md.
- [x] 4. Run tests/build, browser checks of current report and a long mixed-content fixture, validate actual PDF output if native save is available, independent code review and regressions.

## Execution notes
User confirmed implementation. Continue in current user workspace, preserving existing functionality; no commit/push requested for this feature. No further plan approval is needed.


## Verification results
- 60 Node tests passed, including 11 printing regressions; Vite production build passed (existing large-chunk advisory remains).
- Chrome: current report prints as one page; mixed long paragraph/table/oversized row/uneven columns/three-image fixture renders 11 pages, all within page bounds.
- Native Save as PDF produced exactly 11 A4 pages; rendered all pages and inspected the contact sheet. Repeated patient headers/page numbers, continuation table headers, final image row/signature, no extra blank page.
- Independent review fixes: fixed-width table cells normalized in print copy; normal first rows moved intact; native preview dialog closed before opening print overlay. Browser width guard exposed Yii column negative margins; print CSS now resets them. Final browser retest passed for both current report and 11-page fixture.
- Physical printer output and other browser engines were not tested. QA fixture/PDF/screenshots are ignored local artifacts under prototype/qa.
