# Print column regression

With the Vite development server running, open `/tests/browser/print-columns.html`.
The fixture uses the production renderer and both the print and Yiitap CSS (in
application order). It contains two-, three-, four-column rows, a resized 1:2
row, and two rows of three images that continue onto a later page.

Check at desktop width and at 740px width, then click **打印测试**. After cancelling
the system print dialog, the JSON must report `media: "print"`, 3 pages, 6 rows,
and an empty `failures` array. Check that the system preview also has 3 pages.
This browser-only regression is separate from the Node unit tests.

Before the fix, Yiitap's `max-width:768px` rule made columns wrap at 100% width.
The 740px check reported stacked columns, incorrect width ratios and 10 pages;
the normal report also expanded from one preview page to two printed pages.

# First-page report header regression

Open `/tests/browser/print-first-header.html` with the Vite server running. The
fixture checks single- and multi-page reports using the production renderer,
including demo and configured headings, long text, repeated table headers,
continuation page space, page numbers and last-page footer geometry. The JSON
result must contain an empty `failures` array.

# Zoomed side-menu regression

With the development server and a Chromium-compatible browser running with a
remote debugging port, run `node tests/browser/side-menu-zoom.cjs`. Set
`APP_URL` and `CDP_PORT` if they differ from `http://127.0.0.1:5174/` and
`9339`. The check exercises both editors at 100% and 125%, including hover
anchoring, dragging and the add button; it does not save the edited document.

# Column backspace regression

With the development server and a Chromium-compatible browser running with a
remote debugging port, run `node tests/browser/column-backspace.cjs`. Set
`APP_URL` and `CDP_PORT` if they differ from `http://127.0.0.1:5174/` and
`9339`. The isolated fixture tests actual keyboard events in both editor schemas
without changing saved reports or templates.
