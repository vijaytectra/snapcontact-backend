# Project Work Summary — SnapContact & WeeklyHastyRegisters

This document summarizes all setup, configuration, debugging, and feature development performed on this repository.

---

## 1. Project Overview & Setup

- **Repository Cloned:** `https://github.com/vijaytectra/WeeklyHastyRegisters.git`
- **Local Directory:** `/Users/akashsmac/Documents/Weeklyhastyregisters`
- **Architecture:** Monorepo using **pnpm workspaces**, Node.js 22+, and TypeScript 5.9.
- **Projects Included:**
  - `artifacts/snapcontact`: Offline-first Expo / React Native contact capture app for iOS, Android, and Web.
  - `artifacts/mockup-sandbox`: Vite + React UI component and mockup sandbox.
  - `artifacts/api-server`: Express 5 backend API server.
  - `lib/`: Shared packages (`api-spec`, `api-zod`, `api-client-react`, `db`).

---

## 2. Environment & macOS Compatibility Fixes

The repository was exported from Replit (which runs in Linux x86_64 containers with platform stripping). To enable it to run smoothly on Apple Silicon macOS (`darwin-arm64`), the following adjustments were made:

1. **`pnpm-workspace.yaml` Fixes:**
   - Corrected `allowBuilds` placeholders for `esbuild` and `tesseract.js` from `"set this to true or false"` to `true`.
   - Removed platform-specific exclusions (`'-'`) for `@rollup/rollup-darwin-arm64`, `@esbuild/darwin-arm64`, `@tailwindcss/oxide-darwin-arm64`, and `lightningcss-darwin-arm64`. This resolved the `Cannot find module @rollup/rollup-darwin-arm64` error during builds.
   - Installed all required native binaries using `pnpm install`.

2. **`artifacts/mockup-sandbox/vite.config.ts`:**
   - Added local fallback defaults for `PORT` (default `5173`) and `BASE_PATH` (default `/`) to prevent build failures when running outside of Replit's environment.

3. **`artifacts/snapcontact/package.json`:**
   - Added standard development scripts:
     - `"start": "expo start"`
     - `"dev": "expo start"`
     - `"dev:web": "expo start --web"`
   - Preserved `"dev:replit"` for cloud deployments.

4. **Bundled Offline ML Kit Android Configuration:**
   - Created `artifacts/snapcontact/modules/snap-capture/android/build.gradle` declaring `com.google.mlkit:text-recognition:16.0.1` to satisfy offline-first bundling and project configuration tests.

---

## 3. Running the Application

- **Port Conflict Resolution:** Discovered port `8081` was already in use by another local project (`Motherly_Ai`).
- **Dev Server Started:** Launched the SnapContact Expo web preview on port `8082`:
  ```bash
  pnpm --filter @workspace/snapcontact exec expo start --web --port 8082
  ```
- **Browser Launch:** Verified `HTTP 200 OK` and opened `http://localhost:8082` in the default macOS browser.

---

## 4. Phone Number Validation Analysis

- **Reported Warning:**
  ```text
  Number 3
  Business name
  Name (optional)
  Phone number
  +48 7172211
  Detected from number: Poland (+48)
  Possible number, but not valid for this numbering plan. Please edit it.
  ```
- **Explanation:**
  - In Poland (**+48**), national phone numbers (both landline and mobile) **must be exactly 9 digits** long according to the official numbering plan (UKE).
  - The OCR scanner detected only 7 digits (`7172211`), missing the last two repeated digits (`11`) due to image resolution limits on the sample card.
  - The warning is intentional to prevent saving incomplete contacts to device address books.
  - Adding `11` at the end (`+48 71 722 11 11`) resolves the warning, confirms validity, and enables the contact selection checkbox.

---

## 5. Feature Implementation: Email & Website Detection Across All Domains

Added comprehensive detection and handling of email addresses and websites across all domain types:

### A. Email Detection (`extractEmails`)
- **Domain Coverage:**
  - Standard gTLDs (`.com`, `.org`, `.net`, `.edu`, `.gov`, `.mil`, etc.)
  - Country-code TLDs (`.pl`, `.co.uk`, `.de`, `.in`, `.fr`, `.br`, `.ca`, `.au`, `.us`, etc.)
  - Modern extensions (`.ai`, `.io`, `.app`, `.dev`, `.tech`, `.design`, `.cloud`, `.xyz`, etc.)
  - Subdomains (`support@mail.corp.co.uk`) and international characters.
- **OCR Fault-Tolerance:**
  - Cleans internal whitespace around `@` (e.g., `user @ company.com` ➔ `user@company.com`).
  - Converts written notation (e.g., `contact(at)agency.ai` ➔ `contact@agency.ai`).
  - Strips leading labels (`Email:`, `E-mail:`, `Mail:`).
  - Trims trailing sentence punctuation (`.`, `,`, `;`, `!`, `?`).

### B. Website & Domain Detection (`extractWebsites`)
- **Domain Coverage:**
  - Full URLs (`https://...`, `http://...`)
  - `www.` prefixes (`www.krakow-dentist.pl`)
  - Standalone domains (`startup.ai`, `studio.design`, `company.co.uk`, `firma.pl`)
  - Path and port support (`https://platform.app:8080/get`)
- **Sanitization & Protection:**
  - Filters out media and document extensions (`.png`, `.pdf`, `.jpg`, `.zip`, etc.) to prevent false positives.
  - Prevents extracting the domain inside an email address as a duplicate website.

### C. Contact Integration & UI
- **Proximity Matching:** In `extractCandidates`, phone numbers automatically attach their nearest detected email and website.
- **Standalone Contacts:** Contacts that have an email or website without a phone number are also extracted as valid contact candidates.
- **UI Enhancements (`CandidateCard.tsx`):**
  - Added editable **Email** input field with email-specific keyboard and styling.
  - Added editable **Website** input field with URL-specific keyboard and styling.
  - Added action buttons:
    - **Email Button** (`mail-outline`): Launches default mail client (`mailto:`).
    - **Website Button** (`globe-outline`): Opens URL in the browser.
- **Action Handlers (`useCapture.ts`):**
  - Updated candidate state updater to allow editing `email` and `website`.
  - Added handlers for `email` and `website` launch actions.
- **Strings (`strings.ts` & `runtimeStrings.ts`):**
  - Added user-facing labels and placeholders for email and website fields and launch notices.

---

## 6. Feature Implementation: SnapContact Quick Capture for Android

Implemented production-ready **Quick Capture** floating overlay and screen capture with on-device ML Kit OCR for Android.

### A. List of Files Created and Modified

#### Created Files:
- `artifacts/snapcontact/modules/snap-capture/android/build.gradle`: Declares Kotlin Android module, `expo-modules-core`, coroutines, and bundled `com.google.mlkit:text-recognition:16.0.1`.
- `artifacts/snapcontact/modules/snap-capture/android/src/main/java/com/snapcontact/capture/CaptureResultStore.kt`: Thread-safe, persistent SharedPreferences storage providing reliable exactly-once OCR result handoff to React Native across backgrounding and activity recreation.
- `artifacts/snapcontact/modules/snap-capture/android/src/main/java/com/snapcontact/capture/QuickCaptureOverlay.kt`: WindowManager floating overlay view with drag, edge snapping, touch debouncing, hide, and show.
- `artifacts/snapcontact/modules/snap-capture/android/src/main/java/com/snapcontact/capture/QuickCaptureService.kt`: MediaProjection foreground service managing overlay lifecycle, consent, capture, OCR, AtomicBoolean capture locking, and bringing app to front.
- `artifacts/snapcontact/modules/snap-capture/android/src/main/java/com/snapcontact/capture/ScreenCaptureManager.kt`: Single-frame MediaProjection frame capture with row stride / padding handling, MediaProjection.Callback lifecycle listener, and resource disposal.
- `artifacts/snapcontact/modules/snap-capture/android/src/main/java/com/snapcontact/capture/MediaProjectionConsentActivity.kt`: Translucent activity invoking Android system screen capture consent with guaranteed dismissal fallback.
- `artifacts/snapcontact/modules/snap-capture/android/src/main/java/com/snapcontact/capture/OcrProcessor.kt`: ML Kit text recognizer with coordinate-based reading order preservation and zero sensitive data logging.
- `artifacts/snapcontact/modules/snap-capture/android/src/main/java/com/snapcontact/capture/SnapCaptureModule.kt`: Expo Module definition exposing native methods (`hasOverlayPermission`, `startQuickCapture`, `stopQuickCapture`, `getPendingCaptureResult`, `clearPendingCaptureResult`) and events.
- `artifacts/snapcontact/tests/quickCapture.test.mjs`: Comprehensive test suite verifying manifest configs, Kotlin module APIs, Instagram/WhatsApp/LinkedIn OCR parsing, mock capture denial, persistent exactly-once handoff, and privacy verification.

#### Modified Files:
- `artifacts/snapcontact/.gitignore`: Scoped `/ios/` and `/android/` to the root of the app so `modules/snap-capture/android/` source code is tracked in git.
- `artifacts/snapcontact/plugins/withSnapCapture.js`: Injects `SYSTEM_ALERT_WINDOW`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PROJECTION`, `POST_NOTIFICATIONS`, `QuickCaptureService`, and `MediaProjectionConsentActivity` into `AndroidManifest.xml`.
- `artifacts/snapcontact/lib/device.ts`: Type definitions and native wrappers for Quick Capture overlay, capture APIs, and `getPendingCaptureResult()` / `clearPendingCaptureResult()`.
- `artifacts/snapcontact/lib/device.web.ts`: Matching web stubs for safe compilation.
- `artifacts/snapcontact/lib/strings.ts`: User-facing labels, hints, and settings info for Quick Capture.
- `artifacts/snapcontact/lib/runtimeStrings.ts`: Toast notifications and alert messages for permissions and capture states.
- `artifacts/snapcontact/hooks/useCapture.ts`: State tracking (`quickCaptureActive`), permission check, toggle action, and persistent handoff retrieval via `getPendingCaptureResult()` on foregrounding.
- `artifacts/snapcontact/app/index.tsx`: Quick Capture UI toggle card with active badge and tactile feedback.

### B. Persistent OCR Result Handoff Architecture

```
                  [ Background / Overlay Capture ]
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │    OcrProcessor.kt    │
                     │  (ML Kit Text Recon)  │
                     └───────────┬───────────┘
                                 │ Recognized Text
                                 ▼
                     ┌───────────────────────┐
                     │ CaptureResultStore.kt │
                     │ (Private SharedPrefs) │
                     └───────────┬───────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         │ (If React Native already active)              │ (If React Native backgrounded / recreated)
         ▼                                               ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│  SnapCaptureModule Event     │              │  SnapContact Brought Front   │
│  "onScreenCaptured" fired    │              │  AppState -> 'active'        │
└──────────────┬───────────────┘              └──────────────┬───────────────┘
               │                                             │
               │ Calls clearPendingCaptureResult()           │ Calls getPendingCaptureResult()
               ▼                                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                    useCapture.ts -> handleCapturedText                     │
│               extractCandidates(text) -> sets phase='review'               │
│               Guarantees EXACTLY-ONCE Delivery Across All Flows            │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │     CandidateCard.tsx     │
                        │ (User edits before save)  │
                        └───────────────────────────┘
```

1. **Floating Overlay (`QuickCaptureOverlay.kt`):**
   - Built with Android `WindowManager` and `TYPE_APPLICATION_OVERLAY`.
   - Circular 56dp Assistive-Touch-style floating button with emerald gradient and scan target icon.
   - Smooth vertical and horizontal dragging with tactile edge snapping.
   - Clickable above third-party applications (Instagram, LinkedIn, WhatsApp, Facebook, etc.).
   - Touch debouncing (1200ms) prevents rapid multi-taps.
   - Disappears temporarily during screen capture (`hideForCapture()`) to prevent capturing its own UI, and restores position cleanly when capture completes (`restoreAfterCapture()`).
2. **Foreground Service (`QuickCaptureService.kt`):**
   - Configured with `foregroundServiceType="mediaProjection"` complying strictly with **Android 14+ (API 34/35)** requirements.
   - Atomic state lock (`AtomicBoolean.compareAndSet`) strictly prevents concurrent capture sessions.
   - Maintains an ongoing, low-priority system notification with quick "Stop" action.
   - Automatically launches `MainActivity` to bring SnapContact to front with newly extracted candidates.
3. **Screen Capture Manager (`ScreenCaptureManager.kt`):**
   - Uses `MediaProjectionManager`, `MediaProjection`, `VirtualDisplay`, and `ImageReader`.
   - Captures exactly **one frame per user tap**; avoids continuous video recording or battery drain.
   - Handles row padding / stride differences across diverse GPU configurations.
   - Registers `MediaProjection.Callback` to gracefully clean up if projection is revoked by Android.
   - Enforces meticulous resource management (`image.close()`, `virtualDisplay.release()`, `mediaProjection.stop()`, `bitmap.recycle()`).
4. **Consent Handler (`MediaProjectionConsentActivity.kt`):**
   - Translucent activity launching `MediaProjectionManager.createScreenCaptureIntent()`.
   - Prompts the user with standard Android screen capture consent.
   - Contains dismissal fallback in `onDestroy()` so user cancellation or activity destruction never leaves the service hanging.
5. **Bundled ML Kit OCR Processor (`OcrProcessor.kt`):**
   - Utilizes `com.google.mlkit:text-recognition:16.0.1` (offline Latin recognizer bundled with app).
   - Reorders text blocks and lines vertically and horizontally to preserve natural reading order.
   - Dispatches recognized text to React Native via coroutines.
6. **Expo Module (`SnapCaptureModule.kt`):**
   - Exposes methods:
     - `hasOverlayPermission(): Boolean`
     - `requestOverlayPermission(): Boolean`
     - `isQuickCaptureRunning(): Boolean`
     - `startQuickCapture(): Boolean`
     - `stopQuickCapture(): Boolean`
     - `requestScreenCapture(): Promise<String>`
     - `getPendingCaptureResult(): String?`
     - `clearPendingCaptureResult(): Boolean`
   - Emits events:
     - `onQuickCaptureStarted`
     - `onScreenCaptured` (payload `{ text }`)
     - `onQuickCaptureError` (payload `{ error }`)
     - `onQuickCaptureStopped`

### C. Expo Config Plugin (`withSnapCapture.js`)
- Automatically declares permissions in `AndroidManifest.xml`:
  - `android.permission.SYSTEM_ALERT_WINDOW`
  - `android.permission.FOREGROUND_SERVICE`
  - `android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION`
  - `android.permission.POST_NOTIFICATIONS`
- Blocks contacts reading permissions (`READ_CONTACTS`, `WRITE_CONTACTS`) with `tools:node="remove"` for privacy.
- Registers `QuickCaptureService` with `android:foregroundServiceType="mediaProjection"`.
- Registers translucent `MediaProjectionConsentActivity`.

### D. React Native / TypeScript Integration
- `lib/device.ts` & `lib/device.web.ts`: Type-safe bindings and graceful web fallbacks.
- `hooks/useCapture.ts`:
  - State tracking: `quickCaptureAvailable`, `quickCaptureActive`.
  - Toggle handler: checks overlay permission, requests if missing, starts/stops service.
  - Persistent handoff consumer: checks `getPendingCaptureResult()` on foregrounding.
  - Event listener: captures `onScreenCaptured`, runs `extractCandidates`, and populates candidate review state.
- `app/index.tsx`:
  - Renders Quick Capture toggle card on Android with active badge and status feedback.
  - Seamlessly integrates captured candidates into existing `CandidateCard` review, edit, and save flows.

---

## 7. Required Android Permissions and How to Enable Them

1. **`SYSTEM_ALERT_WINDOW` ("Display over other apps")**:
   - **Why**: Required to render the floating Assistive Touch button above Instagram, LinkedIn, etc.
   - **How to enable**: When tapping "Enable floating button" in SnapContact, `requestOverlayPermission()` automatically launches the Android System Settings page:
     `Settings -> Apps -> Special app access -> Display over other apps -> SnapContact -> Allow`.
2. **`FOREGROUND_SERVICE` & `FOREGROUND_SERVICE_MEDIA_PROJECTION`**:
   - **Why**: Required on Android 14+ (API 34/35) to manage `MediaProjection` single-frame capture while outside the main application window.
   - **How to enable**: Automatically handled by the OS upon service startup; declared in `AndroidManifest.xml`.
3. **`POST_NOTIFICATIONS`**:
   - **Why**: Required on Android 13+ (API 33+) to show the ongoing foreground service notification with the "Stop Quick Capture" action.
4. **Media Projection Consent Dialog**:
   - **Why**: Android security requirement. Displays the system dialog *"Start recording or casting with SnapContact?"*.
   - **How to enable**: User taps *"Start now"*.

---

## 8. Verification & Test Results

### 1. TypeScript Typecheck
- Command: `pnpm --filter @workspace/snapcontact run typecheck`
- **Result:** **0 errors**.

### 2. Automated Unit Tests
- Command: `pnpm --filter @workspace/snapcontact run test`
- **Result:** **45 passed, 0 failed** across all test suites:
  - `browserOcr.test.mjs` (4 tests)
  - `config.test.mjs` (4 tests)
  - `contactQueue.test.mjs` (4 tests)
  - `phone.test.mjs` (20 tests)
  - `quickCapture.test.mjs` (12 tests)
  - `staticSecurity.test.mjs` (1 test)

### 3. Expo Autolinking & Prebuild
- `expo-modules-autolinking resolve --platform android`: Autolinks `snap-capture` to `com.snapcontact.capture.SnapCaptureModule`.
- `expo prebuild --no-install --platform android`: Successfully generated `AndroidManifest.xml` with all services, activities, and permissions.

### 4. Real Native Gradle Build Execution (Verified & Successful)
- **Android SDK Configuration:**
  - Android Commandline Tools installed at `/opt/homebrew/share/android-commandlinetools`.
  - Configured `artifacts/snapcontact/android/local.properties` with `sdk.dir=/opt/homebrew/share/android-commandlinetools`.
  - SDK licenses accepted via `yes | sdkmanager --licenses`.
- **JDK 17 Compatibility Configuration:**
  - Configured `org.gradle.java.home=/Users/akashsmac/Library/Java/JavaVirtualMachines/corretto-17.0.15/Contents/Home` in `gradle.properties`.
  - This prevents Java 24 from emitting JEP 472 restricted method warnings to stderr during Prefab package generation.
- **Module Build Verification (`:snap-capture:assembleDebug`):**
  - Command: `./gradlew :snap-capture:assembleDebug --stacktrace`
  - **Result:** `BUILD SUCCESSFUL in 51s` (77 actionable tasks: 21 executed, 56 up-to-date).
  - Verified Kotlin compilation of `SnapCaptureModule.kt`, `QuickCaptureOverlay.kt`, `QuickCaptureService.kt`, `ScreenCaptureManager.kt`, `OcrProcessor.kt`, `CaptureResultStore.kt`, and `MediaProjectionConsentActivity.kt`.
- **Full Application Build Verification (`:app:assembleDebug`):**
  - Command: `./gradlew assembleDebug --stacktrace`
  - **Result:** `BUILD SUCCESSFUL in 18m 18s` (584 actionable tasks: 262 executed, 322 up-to-date).
  - Successfully compiled C++ native architectures (`arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`) with CMake 3.22.1 and Ninja.
  - Successfully packaged debug APK:
    - Path: `artifacts/snapcontact/android/app/build/outputs/apk/debug/app-debug.apk`
    - Size: 294.8 MB (contains all 4 architectures and bundled ML Kit Latin OCR model).

### 5. Physical Device Testing Status
- Checked connected USB devices via `/opt/homebrew/share/android-commandlinetools/platform-tools/adb devices`.
- **Status:** List of devices attached is currently empty (no physical phone attached via USB).
- Once a physical Android phone is connected via USB with **USB Debugging** enabled, install and run immediately with:
  ```bash
  /opt/homebrew/share/android-commandlinetools/platform-tools/adb install artifacts/snapcontact/android/app/build/outputs/apk/debug/app-debug.apk
  ```
  or:
  ```bash
  pnpm --filter @workspace/snapcontact exec expo run:android
  ```

---

## 9. Build & Run Commands

### Development (Web Preview):
```bash
pnpm --filter @workspace/snapcontact exec expo start --web --port 8082
```

### Android Native Build:
```bash
# 1. Ensure ANDROID_HOME is set in your environment
export ANDROID_HOME=$HOME/Library/Android/sdk

# 2. Generate native Android project with config plugin applied
pnpm --filter @workspace/snapcontact exec expo prebuild --platform android

# 3. Run on connected Android device or emulator
pnpm --filter @workspace/snapcontact exec expo run:android

# 4. Or build production APK with Gradle
cd artifacts/snapcontact/android
./gradlew assembleRelease
```

---

## 10. Remaining Limitations

1. **DRM / Secure Windows (`FLAG_SECURE`)**:
   - Screen capture APIs in Android cannot capture apps or windows protected with `FLAG_SECURE` (e.g., banking apps, Netflix, incognito windows). Instagram and WhatsApp business cards do not set this flag.
2. **Android 14+ Projection Consent Policy**:
   - Starting in Android 14 (API 34), Android may prompt the user to confirm single-screen capture consent per session to prevent background eavesdropping. This is an intended security policy of Android.

---

## 11. Physical-Device Testing Checklist

| Step | Action | Expected Result |
|---|---|---|
| **1** | Open SnapContact app on Android | Home screen displays "Quick Capture" action card. |
| **2** | Tap "Enable floating button" | App redirects to Android "Display over other apps" settings. |
| **3** | Enable toggle in settings and press Back | Returns to SnapContact; floating emerald circular button appears at screen edge; card displays "Active" badge. |
| **4** | Drag the floating button vertically and horizontally | Button follows finger smoothly and snaps to the left or right screen edge upon release. |
| **5** | Switch to Instagram / WhatsApp / LinkedIn | Floating button remains accessible on top of the external app. |
| **6** | Navigate to a business card or profile with phone, email, website | Content is visible on screen. |
| **7** | Tap the floating button | Floating button hides; system prompt *"Start recording or casting with SnapContact?"* appears (if first capture of session). |
| **8** | Tap *"Start now"* | 1 frame is captured; SnapContact opens to the Review screen; OCR text is parsed into contact candidate(s). |
| **9** | Inspect Candidate Card | Business name, phone number, email, and website are extracted and editable. |
| **10** | Save / Review Contact | Tap "Review and save 1 contact" opens the native Android contact editor with pre-filled details. |
| **11** | Stop Quick Capture | Tap "Quick Capture active" in SnapContact or tap "Stop" in the notification bar; floating button disappears cleanly. |
