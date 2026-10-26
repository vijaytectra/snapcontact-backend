---
name: Expo security compatibility
description: Safe dependency-remediation boundaries for SnapContact's Expo toolchain
---

Do not force global major-version overrides into Expo internals just to clear
the dependency scanner. Assess mobile runtime exposure separately from how
dependencies are classified in package manifests.

**Why:** Expo Router's CommonJS query-string dependency cannot directly consume
the ESM decoder fix using the same import contract. Project-controlled Zod
consumers can migrate independently of CLI code still written for Zod 3.
Mobile packages listed under devDependencies may still ship in the application.

**How to apply:** Recheck current package metadata and dependency paths first.
Prefer compatible parent updates or scoped patch floors; use a separately
verified SDK upgrade/backport for incompatible fixes. Report remaining findings
honestly rather than suppressing or silently accepting them.
