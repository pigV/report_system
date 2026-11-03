# Bottom-aligned report footer

User approved: signatures remain final-page only, fixed above page numbers; short reports leave natural whitespace, long reports reserve the measured footer height. Keep configurable fields and understated typography.

Implementation: retain the flow signature in measurement so its actual wrapped height plus separation participates in pagination. Use the page's bottom padding as the content boundary. In rendered output move the signature outside the body and anchor it at that same boundary. Inline label/value footer fields align within the configured grid, with a fine separating rule.

Tasks:
- Adjust render.mjs measurement boundary/output and print.css footer layout.
- Verify short/multi-page/multiline footer geometry in browser and actual PDF preview, plus existing tests/build.
- Record approved behavior and verification. No commit/push requested.

Verification completed:
- 60 existing Node tests passed; Vite build and Sites packaging passed (existing chunk size advisory).
- Browser geometry: short report, normal image report, and 11-page report with multiline footer all end the signature 18 mm above the paper edge, only on the final page. Multiline footer measured 170.74 px tall with 165.62 px body clearance; no horizontal overflow.
- Chrome system Save as PDF preview verified for the short report: one page, ample whitespace, footer rule/signatures at bottom with separate page number.
- Independent code review found no blockers. Physical printer not tested. Preview screenshot in ignored prototype/qa/footer-bottom-preview.png.
