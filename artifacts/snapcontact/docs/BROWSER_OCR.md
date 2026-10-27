# Browser preview image reading

The browser preview reads imported screenshots/photos with Tesseract.js in a
local Web Worker. It does not use the native SnapCapture module and does not
upload images or recognized contact data.

## Limits

- The engine, WASM core and English model are downloaded from jsDelivr.
  Internet access is required to obtain these assets; browser caching is not an
  offline guarantee. The language model can be cached locally by Tesseract.
- The initial browser model is English. Phone-number recognition and business
  names in other scripts may require manual text correction.
- Local blob/data image inputs only; remote image URLs are rejected.
- Images are downscaled to a maximum dimension of 4096 pixels before OCR.
- Small images are enlarged before OCR, with the same 4096-pixel limit.
  Automatic page segmentation handles separate contact cards and columns.
- Engine work is bounded by a two-minute timeout and workers are terminated
  after success/failure. Loading/download failures give an actionable Retry
  message and retain the manual text option.
- Native contact creation and OS share intake still require an installed
  native build. iOS Vision and bundled Android ML Kit remain unchanged.

## Verification

Chromium browser test passed on 2026-10-27:

1. Completed onboarding and imported a locally generated PNG through the
   actual browser image-picker input.
2. Real engine/core/model downloads completed; no console errors or failed
   requests occurred.
3. `ACME CAFE` and `+44 20 7946 0958` were recognized into editable fields.
4. Native-only saving remained disabled and explicitly labeled.
5. A blank PNG produced no-number messaging. Retry and clear/import recovery
   remained usable.
6. Captured network traffic showed asset GET requests, not image/contact uploads.

The initial 22 automated tests and the mobile TypeScript check passed. iOS and Android
production JavaScript exports passed without bundling the browser-only engine.
The dependency audit remains at the previously documented two High and one
Moderate finding; no new dependency findings were introduced.

Safari/Firefox verification and installed-device testing remain covered by
the existing project test work.

## Mixed-country image verification

An additional browser pass using the supplied six-country illustration detected
six separate rows: United States, Germany, Poland, United Kingdom, Brazil and
Canada. US and Canadian numbers were distinguished despite sharing calling
code +1. The summary updated after editing one row to a French number without
changing the other five rows. A global default is shown only when needed for
local-format or unresolved numbers; it does not override international prefixes.

The Polish repeated-digit sequence was not fully recognized from the small
illustration. Its +48 prefix still identified Poland, while invalid digits stayed
flagged and unselected. Copy worked without altering the digits; Call and
WhatsApp remained blocked. This is an OCR limitation, not a reason to fabricate
digits or mark the number valid. Higher-resolution input or manual correction
remains necessary for that row.

At this point all 29 automated tests and the mobile TypeScript check pass.
Tesseract may emit its informational “Estimating resolution” line through browser
stderr; this did not prevent recognition.
