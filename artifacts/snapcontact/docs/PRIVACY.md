# SnapContact privacy statement — implementation draft

This document describes the app's current behavior. The eventual publisher must
add their real legal identity, support contact, policy URL and effective date
before store submission; it is not a substitute for that release requirement.

## Private processing

SnapContact has no account and does not upload your screenshots, photos, OCR text
or contact data to a developer server. It does not read other apps in the
background, scan your photo library automatically, scrape social networks, or
read your address book. Images are processed only after you select, photograph
or explicitly share them.

Apple Vision performs OCR on iOS. Android uses bundled ML Kit recognizers, not a
cloud OCR endpoint or first-use model download. These are best-effort tools:
you should review every phone number and business-name suggestion.

## Storage and deletion

- Only your default country and onboarding completion are persisted as app
  preferences.
- Current text, candidate numbers and outcomes are held in memory, not history.
- Selected images use private temporary files. Tap **Discard** to remove the
  current app-owned cache copies and clear current text/results.
- An iOS image explicitly shared to the extension is queued in private shared
  App Group storage until the host consumes it, you replace it with another
  share, clear it through Discard, or uninstall. It is excluded from backup.
  It is not automatically deleted on a timer while the app is closed.
- The OS may retain its photo picker/camera caches and your original photo
  remains in Photos. SnapContact never deletes your original library image.
- App-owned Android backups are disabled. iOS shared images are marked excluded
  from backup; ordinary caches are not long-term app storage.
- Uninstall removes app-owned storage. Contacts you saved remain in your
  contacts account and must be deleted there if desired.

## Permissions and deliberate handoffs

- Photo import uses the system photo picker for the image you select.
- Camera access is requested only when you tap Take a photo; audio is not used.
- Contact creation opens the operating system's editor. Nothing is saved until
  you confirm it there. SnapContact does not need broad address-book read access.
- Saved contacts may sync to iCloud/Google/another account according to your OS
  contacts settings. That is distinct from uploading data to SnapContact.
- Copy places the reviewed number on your system clipboard; other apps may
  access it under your operating system's rules.
- Call hands the number to the dialer. WhatsApp hands the number to the installed
  WhatsApp app. These external apps' privacy policies apply. SnapContact does
  not automatically place calls or send messages.

## No tracking or monetization

The initial release is free. No advertising, analytics/tracking SDK, cloud
contact sync, payments, or purchase tracking is implemented. Development tooling
may connect to the development server; check release binaries, not Metro
development traffic, when verifying product network behavior.
