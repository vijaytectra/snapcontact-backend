# SnapContact — native build, device testing, and release

SnapContact is a working-name, local-first iOS/Android application, not a web
mockup. **Native source has been implemented, but a signed IPA/APK/AAB has not
been produced or tested on a physical device in this environment. Do not
describe this as store-ready until the native build and device checklist pass.**

## What runs where

| Capability | Browser / Expo Go | Installed native app |
| --- | --- | --- |
| Onboarding, country search, text input, number extraction, review/edit | Yes | Yes |
| Copy | Depends on browser clipboard / supported in Expo Go | Yes |
| Photo import / camera | Device and browser dependent | System picker / camera |
| Offline OCR | No; explicit message and text-entry alternative | Apple Vision / bundled Android ML Kit |
| Incoming image shares | No | Android SEND intent / iOS Share Extension |
| System contact editor and save result | No; disabled honestly | Native contact UI |
| Call / WhatsApp | Depends on installed handlers | Explicit handoff to installed apps |

No server, login, contacts-reading permission, cloud OCR, cloud upload, ads,
analytics SDK, payment SDK, scraping, background photo-library monitoring, or
background reading of other apps is part of the capture product. The template
API service is not used by this app.

## Requirements and identifiers

- Install workspace dependencies with `pnpm install`.
- Apple builds require an Apple Developer membership, an available bundle ID,
  and signing/provisioning for **two targets** plus their shared App Group.
- Android builds require Android Studio, a compatible Android SDK and JDK 17+
  on a development machine; follow the generated Gradle/RN toolchain requirements.
- This source initializes application IDs to `app.snapcontact.capture`, extension
  ID `app.snapcontact.capture.share`, and group `group.app.snapcontact.capture.share`.
  Verify availability/ownership before the first release. Do not casually change
  identifiers after shipping: they determine app identity and upgrade continuity.
- Minimum supported OS versions follow Expo SDK 57's generated project. The share
  extension itself targets iOS 16+. Use current supported iOS/Android devices.
- All Expo configuration is static in `app.json`. Do not introduce dynamic app config.

## Local verification commands

From the workspace:

```sh
pnpm --filter @workspace/snapcontact run typecheck
pnpm --filter @workspace/snapcontact run test
```

From `artifacts/snapcontact`:

```sh
pnpm exec expo install --check
pnpm exec expo prebuild --no-install --platform all
pnpm exec expo-modules-autolinking resolve --platform android
pnpm exec expo-modules-autolinking resolve --platform apple
```

`prebuild` generates the native projects from the committed local module and
configuration plugin. It is **not** a native compiler or a signing check. The
generated `ios/` and `android/` directories are ignored because the reproducible
sources live in `modules/`, `native/`, `plugins/`, and `app.json`.
Prebuild can add dependency entries to package.json; review/dedupe those changes
without changing Expo/React Native versions. Install dependencies again if needed.

Tests cover international/national dialing, country-specific international
prefixes, Unicode digits, invalid fragments, extension-aware deduplication,
name suggestions, multiple candidates, no-number states, and sequential
contact-editor save/cancel/error semantics. Native platform UI, OCR accuracy,
permission dialogs, cold/warm share delivery, and signing need device testing.

## Android: a real installable development APK

1. Export/clone the source to a machine with Android Studio and install workspace
   dependencies.
2. Run prebuild above. Open `artifacts/snapcontact/android` in Android Studio and
   let Gradle sync download dependencies (including the **bundled** ML Kit models).
3. Select a connected Android device with developer mode enabled. Use Android
   Studio's Run action to compile/install a development build. Use the managed
   development server when testing development JavaScript.
4. To test **offline without Metro**, make a release build with JavaScript/assets
   bundled. Android Studio: Build → Generate Signed App Bundle / APK. Use a
   securely held release keystore; never commit signing passwords or key files.
   An APK can be installed on a device; a signed AAB is for Google Play.
5. Launch once, close, enable airplane mode, relaunch, import a local image and
   complete capture → review → native contact editor → Save. Repeat on a fresh
   install with airplane mode already on to confirm no model downloads are needed.
6. Include Google Contacts and at least one OEM contacts app in acceptance tests.

The native module uses ACTION_INSERT and `finishActivityOnSaveCompleted`.
Some OEM contacts apps do not return a reliable RESULT_OK even after saving.
SnapContact reports **Save not confirmed**, stops the batch, and keeps remaining
numbers selected rather than falsely claiming a confirmed save. Check the
contacts app before retrying to avoid duplicates. This is a platform limitation,
not something the app resolves by requesting access to the entire address book.

## iOS: native build and shared image handling

- In the generated Xcode project, confirm the **SnapContactShare** target exists,
  compiles `ShareViewController.swift`, and is embedded in the host application.
  Its deployment/signing settings and version must be compatible with the host.
- Both host and extension need the App Group capability and provisioned profiles
  for `group.app.snapcontact.capture.share`. Use the same Apple development team.
- The local module is autolinked as `SnapCapture` and uses Apple's Vision OCR and
  CNContactViewController. Test its delegate callbacks on a real device.
- To share: Photos → select **one** image → Share → SnapContact. Wait for
  “Image ready”, tap Done, then **open SnapContact yourself**. This implementation
  intentionally does not use unsupported extension tricks to auto-launch the host.
  The host consumes the queued image on launch or foreground.
- One shared image is queued. A later share replaces the queued image. If a review
  is already open, discard it to load the waiting image. Images above 25 MB fail
  with an explanation; multi-image sharing is deliberately not supported.
- For a native development build on macOS, open the generated project in Xcode
  after installing its CocoaPods dependencies, select a device/team, and Run.
  This is development/device testing, not a manual App Store submission workflow.
- Browser and Expo Go are not proof that this local native module or extension
  builds. Their explicit preview limitations are intentional.

## Device acceptance checklist — release gates

Use at least one small iPhone, a current iPhone, a Pixel, and an OEM Android phone.
Use test numbers; never place real calls or send messages unintentionally.

- [ ] Fresh onboarding works offline and persists only country/welcome preference.
- [ ] Sharing before onboarding goes to review and does not lose the image.
- [ ] Import system picker: choose one photo, cancel, choose another, deny limited
      access if prompted, retry, and test a cloud-only photo while offline.
- [ ] Camera: first grant, deny, permanent deny → Settings, cancel capture,
      rotate image, reshoot, and return after app backgrounding.
- [ ] OCR: screenshots, EXIF-rotated photos, HEIC/JPEG/PNG, low contrast, blurry
      image, no text, multiple phone lines, same-line multiple numbers, >25 MB,
      huge dimensions, corrupt file. Crop via Photos first when needed.
- [ ] Country: locale suggestion verified (not treated as authoritative), all
      countries searchable, shared calling codes, leading zeros, +/00/011/0011
      prefixes, Unicode digits, extensions, possible-but-invalid fragments.
- [ ] Review: nearby names are suggestions, not certainty. Edit both fields,
      correct invalid row then select, change country without losing edits,
      select none/all, deduplicate repeats, expand/fix recognized text, rescan.
- [ ] Save: 1 and 3 selected contacts; edit native fields before save; confirmed
      save; Cancel on first/second editor; Android Back; no contacts handler;
      interruption/process death. Never count an unconfirmed editor as saved.
- [ ] Copy notice explains clipboard sharing. Dialer opens without automatic call.
      WhatsApp present/absent, no account for number, and no automatic sending.
- [ ] Share cold start, warm start, existing review, two consecutive shares,
      unsupported file type, source revokes URI permission, and repeated foreground.
- [ ] Airplane-mode release build works from **first launch**, not just cached dev.
- [ ] VoiceOver/TalkBack: every action/checkbox/text field, selection state,
      loading/error announcements and logical focus order; text size 200%;
      reduced motion; sufficient contrast; keyboard does not hide action fields.
- [ ] Light/dark themes, 375-point width, large fonts, long localized country names,
      RTL device, Android edge-to-edge back/home gesture areas.
- [ ] Discard removes app-owned temporary images. No contacts or screenshots in
      AsyncStorage, logs, crash logs, analytics, network requests or OS backup.
- [ ] Network inspection on a **release** binary confirms capture sends no images/
      contacts. Development Metro traffic is not product data collection.

### OCR limitations

OCR is best-effort; it cannot guarantee every number or accurate business-name
association. Apple Vision script/language support varies by OS. Android bundles
Latin, Chinese, Devanagari, Japanese and Korean recognizers; it does not claim
full OCR coverage for every world script. Number validation covers the numbering
plans in the bundled libphonenumber metadata, not actual subscriber ownership
or WhatsApp membership. Unsupported scripts and misread characters can be
repaired through editable recognized text or pasted/manual input. International
numbers with `+` are preserved independently of the default country.

## App Store release

Replit's Publish / Expo Launch is the guided iOS build, signing, TestFlight,
App Store Connect upload and App Store submission path. Use that flow and an
Apple Developer account; do not treat publishing the browser preview as shipping
the native app. **Before using it for this app, confirm it can provision/sign
the extra Share Extension and App Group.** A generated extension target alone is
not proof of cloud-signing support. If the flow reports an extension entitlement
or provisioning failure, inspect build logs and resolve that blocker before
claiming the app is releasable. No signing credentials are requested in chat.

Before submitting:

1. Complete all device gates above on a signed release/TestFlight build.
2. Confirm ownership of both identifiers and the App Group; increment version/
   build numbers, verify icon and working-name branding.
3. Provide actual support and privacy-policy URLs, age rating, screenshots from
   real devices, category, release notes and export-compliance answers.
4. Review Apple's privacy labels and the generated required-reason privacy
   manifests against **every compiled dependency**, not only app code.
   Intended app behavior is no developer data collection, no tracking.
5. Reviewer notes: no login; photo/camera import; on-device OCR; manual number
   review; contact saving delegated to system UI; single-image sharing requires
   reopening the host; initial release is free.
6. TestFlight external tester feedback and final native crash checks before review.

## Google Play release

Replit's integrated publishing currently handles iOS, not Google Play. Build a
signed **AAB** using Android Studio, then use the Google Play Console internal
testing track. Protect the signing/upload keys and enable Play App Signing.
Meet the current target API, account verification/testing, app-access, content
rating, Data Safety, privacy policy and store-listing requirements shown in Play
Console at release time; these change and should not be guessed from this file.
No READ_CONTACTS/WRITE_CONTACTS or broad media storage permission is needed by
the intended system-picker/system-editor design.

## Localization and future lifetime access

The English UI dictionary is `lib/strings.ts`, runtime copy is
`lib/runtimeStrings.ts`, and native error fallbacks/extension copy also need
translation before claiming another language. Country labels use the device
locale's Intl.DisplayNames. Number validation and Unicode digit normalization are
not restricted to English. No full translation or RTL certification is claimed.

`lib/entitlements.ts` is a free-release access boundary. Later lifetime purchases
must be a separate store-compliant non-consumable entitlement with restore
purchases and prices obtained from the user's Apple/Google storefront, not the
phone-number country. No pricing, checkout, billing SDK or payments are present.
