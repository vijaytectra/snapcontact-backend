---
name: Preview OCR privacy
description: Distinguishing browser engine downloads from capture uploads and native offline operation
---

Browser image-reading fallbacks must process capture data locally. Downloading
the OCR engine/model is acceptable when disclosed, but do not describe the
browser's first scan as offline or equate model caching with guaranteed offline
availability.

**Why:** The native-only warning made the primary image-import journey unusable
in preview. Browser OCR solves that without violating the no-cloud-upload
requirement; its software downloads are a different privacy/network boundary.

**How to apply:** Keep browser OCR separate from native build dependencies,
retain the installed app's native engines, and verify network behavior when
changing the browser engine or its resource-loading configuration.

OCR language models must match the shipped WASM core's supported arithmetic and
engine features; do not swap trained-data files solely because they are labeled
“best.”

**Why:** Testing an official floating-point English model against the installed
Tesseract.js core failed at recognition with an unsupported dot-product function.
Passing a large model as a serialized Buffer also exhausted the Node worker heap.
Neither failure establishes that the model is a safe browser fallback.

**How to apply:** Verify model/core compatibility using an actual recognition
pass before changing production downloads. Prefer supported model distributions
and avoid serializing large model data into worker messages.
