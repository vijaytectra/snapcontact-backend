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

Invalid-number handling is **copy only**, as explicitly chosen by the user.
Permit copying the entered text without changing its digits, retain the warning,
and keep selection, saving, calls and WhatsApp blocked.

**Why:** Users may need to retain OCR text even when it is not a valid callable
number. Copying text must not imply successful validation or authorize dialing.

**How to apply:** Preserve the unvalidated input for copying and label that
outcome honestly. Continue normal international formatting for validated numbers.

Number-plan validity is not proof that OCR captured the original digits exactly.
Keep the review step even for valid results.

**Why:** Low-resolution runs of narrow repeated digits can be dropped or merged
by OCR. Scaling and segmentation help, but cannot justify inventing missing digits.

**How to apply:** Separate country-prefix detection, OCR fidelity and structural
number validity. Preserve uncertainty and offer better source images or explicit
correction rather than silent digit substitution.
