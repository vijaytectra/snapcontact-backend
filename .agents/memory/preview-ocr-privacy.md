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
