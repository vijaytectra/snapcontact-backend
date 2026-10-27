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

All 22 automated tests and the mobile TypeScript check passed. iOS and Android
production JavaScript exports passed without bundling the browser-only engine.
The dependency audit remains at the previously documented two High and one
Moderate finding; no new dependency findings were introduced.

Safari/Firefox verification and installed-device testing remain covered by
the existing project test work.
