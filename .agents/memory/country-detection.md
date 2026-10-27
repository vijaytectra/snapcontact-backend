---
name: Country detection expectations
description: Automatic country handling and honest number validation in capture review
---

The user expects the country/calling code to be detected automatically from
the number shown in an image, without requiring manual country selection
when an international prefix is present.

**Why:** A number-validation error was mistaken for failed country detection.
Review must distinguish detection of the calling code from whether the
remaining digits belong to a valid numbering plan.

**How to apply:** Detect per candidate rather than changing one global default
for mixed-country images. Show shared-code ambiguity honestly, retain validation
for invalid/example numbers, and use the selected default only when the image
does not supply enough country information. Never invent a country or digits
merely to remove a warning.
