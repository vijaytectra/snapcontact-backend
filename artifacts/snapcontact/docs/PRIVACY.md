# SnapContact privacy statement — implementation draft

This document describes the app's current behavior. The eventual publisher must
add their real legal identity, support contact, policy URL and effective date
before store submission; it is not a substitute for that release requirement.

## Private processing

SnapContact requires an account (email sign-in or Google). It does not upload your
screenshots, photos, OCR text or contact data to a developer server. It does not read other apps in the
background, scan your photo library automatically, scrape social networks, or
read your address book. Images are processed only after you select, photograph
or explicitly share them.

Apple Vision performs OCR on iOS. Android uses bundled ML Kit recognizers, not a
cloud OCR endpoint or first-use model download. These are best-effort tools:
you should review every phone number and business-name suggestion.

## Account data on our server

- Email address, name, a scrypt hash of your password (never the password), the
  dates of your free trial and paid plan, and your payment orders (amount, status,
  Cashfree order and payment references). This is what lets a plan follow you to a
  new phone or a reinstall.
- Sign-in codes and links are stored hashed and expire after 10 minutes.
- Payments are processed by Cashfree. Card, UPI and bank details are entered on
  Cashfree's checkout and never reach SnapContact. Cashfree receives your email and
  the mobile number you enter for the payment.

## Storage and deletion on your phone

- Your default country and onboarding completion are persisted as app preferences.
- Your profile, plan and sign-in session are kept on the phone (the session in
  secure storage) until you log out.
- Search History lists texts searched in the current session only; it is held in
  memory and cleared when the app closes.
- If the contact editor cannot open, the numbers you chose to save are kept in a
  retry list on the phone until they are saved.
- Current text, candidate numbers and outcomes are held in memory.
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

New accounts get a 7-day free trial; Annual Pro is a one-time ₹99 payment for 12
months through Cashfree and does not renew automatically. No advertising,
analytics/tracking SDK or cloud contact sync is implemented. Development tooling
may connect to the development server; check release binaries, not Metro
development traffic, when verifying product network behavior.
