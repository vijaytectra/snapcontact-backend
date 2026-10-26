# SnapContact security remediation

Audit date: 2026-10-26. Scope: existing workspace dependencies, static server,
application/native privacy paths, typechecks, tests and build compatibility.

## Results

| Scanner | Before | After |
|---|---|---|
| Replit dependency audit | 23: 1 Critical, 10 High, 8 Medium, 4 Low | 3: 0 Critical, 2 High, 1 Medium, 0 Low |
| Replit static analysis | 2 High | 0 findings |
| Replit privacy/dataflow | 0 findings | 0 findings |
| pnpm audit | 23: 1 Critical, 9 High, 9 Moderate, 4 Low | 3: 0 Critical, 2 High, 1 Moderate, 0 Low |

Medium means the scanners' `moderate` category. The initial severity discrepancy
is uuid: Replit rated it High and pnpm rated it Moderate. Both final dependency
audits agree. Twenty dependency findings were eliminated; three remain.
These results are not a certification that the application is secure.

## Dependency inventory and changes

Paths below identify representative dependency chains, not every duplicate
instance. “Tooling” means build/development use; mobile manifest entries under
devDependencies can still contain shipped JavaScript, as noted for Router.

| Package | Before → selected version | Representative path / exposure | Outcome |
|---|---|---|---|
| proxy-addr | 2.0.7 → 2.0.8 | API server → Express; server runtime | Fixed via Express 5.3.0 |
| body-parser | 2.3.0 → 2.4.0 | API server → Express; server runtime | Fixed via Express 5.3.0 |
| vite | 7.3.6 → 7.3.7 | mockup-sandbox; development/build tool | Fixed |
| source-map-js | 1.2.1 → 1.2.2 | sandbox → Tailwind/PostCSS; also Metro tooling | Fixed with compatible patch override |
| brace-expansion | 5.0.9 → 5.0.12 | Expo → CLI → glob → minimatch; tooling | Fixed with compatible patch override |
| markdown-it | 14.3.1 → 14.3.3 | api-spec → Orval → TypeDoc; tooling | Fixed with compatible patch override |
| fast-uri | 3.1.7 → 3.1.9 | api-spec → Orval → Scalar parser → Ajv; tooling | Fixed with compatible patch override |
| uuid | 7.0.3 → removed vulnerable chain | splash-screen → config-plugins → xcode; tooling | config-plugins 57.0.10 → 57.0.11, xcode 3.0.1 → 4.0.0 removes uuid |
| zod | project catalog 3.25.76 → 4.6.7 | shared API validators, database package, sandbox, mobile direct dependency | Project dependencies fixed; CLI's separate 3.25.76 remains |
| node-forge | 1.4.0 unchanged | Expo → CLI; tooling | No patched release available in audit |
| decode-uri-component | 0.2.2 unchanged | Expo Router → query-string 7.1.3; mobile routing runtime | Upstream-compatible fix not verified |

The Zod major update was limited to project-controlled catalog consumers,
with Orval generation explicitly switched to Zod 4 and code regenerated.
zod-validation-error was updated from 3.4.0 to 4.0.2 for Zod 4 compatibility.
No global Zod-major override was imposed on Expo internals.

All compatible patch overrides are scoped by affected version ranges.
The lockfile was retained and updated; the one-day package release-age guard
and existing security controls remain enabled.

## All 23 original advisory findings

Each row gives its patched floor; the inventory above supplies the original
installed version, selected version and dependency chain.

| Advisory | Package | Severity (Replit) | Patched floor | Result |
|---|---|---|---|---|
| GHSA-jqcg-44mw-7w3h | proxy-addr | Critical | 2.0.8 | Fixed |
| GHSA-27r3-jxmh-p828 | body-parser | High | 2.4.0 | Fixed |
| GHSA-587h-7wmj-h5pm | vite | High | 7.3.7 | Fixed |
| GHSA-698v-4r3x-3vcv | vite | Medium | 7.3.7 | Fixed |
| GHSA-r825-w8mm-5pxw | vite | Medium | 7.3.7 | Fixed |
| GHSA-rq7h-c2jc-7f22 | vite | Medium | 7.3.7 | Fixed |
| GHSA-9jrq-w75r-8gcw | vite | Low | 7.3.7 | Fixed |
| GHSA-68fv-2mgg-jv7q | source-map-js | High | 1.2.2 | Fixed |
| GHSA-qhr7-859c-m2p7 | brace-expansion | High | 5.0.11 | Fixed |
| GHSA-6j4f-fj2g-mc7p | brace-expansion | High | 5.0.10 | Fixed |
| GHSA-q2hr-2g5m-vwhr | brace-expansion | Medium | 5.0.12 | Fixed |
| GHSA-r7fv-28h4-cvq7 | markdown-it | High | 14.3.2 | Fixed |
| GHSA-gfr2-rv44-r23c | markdown-it | High | 14.3.3 | Fixed |
| GHSA-vfgh-jcmw-g37q | markdown-it | Low | 14.3.3 | Fixed |
| GHSA-hrr3-gc8f-f4qj | fast-uri | Medium | 3.1.8 | Fixed |
| GHSA-w74x-v6f9-j3xg | fast-uri | Medium | 3.1.9 | Fixed |
| GHSA-wjr9-j795-jxcr | fast-uri | Medium | 3.1.9 | Fixed |
| GHSA-xhq7-xmqj-769h | fast-uri | Low | 3.1.9 | Fixed |
| GHSA-333x-w4r6-6crp | fast-uri | Low | 3.1.9 | Fixed |
| GHSA-w5hq-g745-h8pq | uuid | High | 11.1.1 | Vulnerable package removed |
| GHSA-mrhx-c7xc-m3w5 | zod | High | 4.6.6 | Remains in Expo CLI only |
| GHSA-86w9-cpqp-85rv | node-forge | High | None published | Remains |
| GHSA-vcc3-ghjq-m6fr | decode-uri-component | Medium | 0.5.0 | Remains |

Advisory details: https://github.com/advisories/ followed by the advisory ID.

## Remaining risks and mitigation plan

1. **High — node-forge 1.4.0:** malformed RSA signature verification. Installed
   through Expo CLI, not used by SnapContact's OCR/contact code. Do not feed
   untrusted certificates, signing metadata or cryptographic inputs into this
   toolchain. Track a patched forge/Expo release and rerun the audit before
   release. Development-only placement reduces exposure; it does not fix the bug.
2. **High — Zod 3.25.76 in Expo CLI:** resource exhaustion on oversized validation
   input. Project-controlled runtime validators now use 4.6.7. Keep CLI metadata
   trusted and avoid exposing development servers as production services.
   Upgrade through a compatible Expo CLI release, or test a supported SDK
   upgrade separately. Forcing Zod 4 into CLI code written for Zod 3 was not
   considered a safe fix.
3. **Medium — decode-uri-component 0.2.2:** malformed percent-encoded input can
   cause CPU exhaustion. Unlike the two CLI findings, this chain can ship through
   Expo Router. Version 0.5.0 is ESM, while query-string 7.1.3 requires its
   CommonJS dependency. A forced override is not API/module-compatible.
   Avoid untrusted deep links as an interim precaution; this is **not** a complete
   mitigation. Before store release, resolve through an upstream-compatible
   Router/query-string update or an explicitly tested backport/SDK upgrade.

The security-remediation work is therefore not fully complete. No vulnerable
dependency was hidden or falsely marked fixed.

## Code and privacy review

- Static serving now inventories approved files at startup. Requests select an
  approved reader instead of constructing filesystem paths.
- Traversal, malformed encoding, backslashes, null bytes, hidden files and
  symlink escapes are rejected. Manifest platforms use a fixed allowlist.
- Readers reject assets replaced with symlinks after inventory and open final
  files with `O_NOFOLLOW`. Deployment assets must remain locally read-only.
- URL parsing rejects malformed requests; base-path matching respects boundaries.
- No hardcoded credential patterns were found in the inspected application
  and native sources. No secret values were accessed or included in this report.
- API logging excludes query strings and request bodies; configured redaction
  covers authorization/cookies. The current API is a public health endpoint;
  unrestricted CORS is not access control and must be reconsidered if private
  endpoints are introduced.
- OCR remains local: iOS Vision and bundled Android ML Kit. No external OCR,
  image upload, contact upload, scraping or login was introduced.
- Existing native code limits shared image size, downscales decoded images and
  excludes shared image storage from backup. The iOS extension uses protected
  App Group storage. No native source/configuration was overwritten.
- Preserved identifiers: `app.snapcontact.capture`,
  `app.snapcontact.capture.share`, `group.app.snapcontact.capture.share`.
  Android configuration and the iOS Share Extension remain unchanged.
- Markdown dependencies belong to API-generation tooling, not an app-provided
  HTML/Markdown rendering surface.

## Verification actually performed

- `pnpm install --frozen-lockfile`: passed.
- `pnpm run typecheck`: passed, including libraries, API, sandbox, mobile, scripts.
- `pnpm --filter @workspace/snapcontact test`: 18/18 passed. Includes new
  traversal, encoding, hidden-file and symlink regression checks.
- `pnpm --filter @workspace/api-spec run codegen`: passed; libraries typecheck.
- `expo install --check`: dependencies up to date.
- API production build: passed; restarted API returned `{"status":"ok"}`.
- Sandbox Vite production build: passed with PORT and BASE_PATH supplied.
  The first standalone invocation lacked PORT and failed configuration loading;
  supplying the expected build environment resolved that invocation.
- Expo iOS and Android production JavaScript/Hermes exports: passed. Temporary
  outputs were kept outside the repository.
- Existing Xcode project parsed and serialized in memory with updated xcode/
  config-plugins. No native project files were written and no prebuild ran.
- All three managed workflows restarted. App preview rendered onboarding.
- Fresh Replit dependency, static-analysis and privacy scans completed.

Not performed: signed IPA/AAB/APK compilation, store submission, real-device OCR,
share-extension execution, and native contact-editor save/cancel validation.
Those remain part of the existing build/device-testing work.

Non-blocking environment warnings remain: Node's TypeScript module-detection
warning, missing optional React Native Metro-config peers, and the Linux React
Native DevTools executable lacking `libnspr4.so`. The latter affects the desktop
debugger, not the running app preview or the successful mobile bundle exports.
