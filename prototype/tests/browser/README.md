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
