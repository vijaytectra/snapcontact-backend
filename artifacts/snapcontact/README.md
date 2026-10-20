# SnapContact

An offline-first native iOS and Android contact capture utility. SnapContact is a
working name, not a finalized brand.

Select or photograph an image, read numbers locally, review and edit suggested
names/international numbers, choose several, then confirm each one in the OS
contact editor. No account, scraping, cloud OCR, contact upload or payments.

- [Native builds, device acceptance tests and store releases](docs/RELEASE-AND-DEVICE-TESTING.md)
- [Privacy behavior and storage](docs/PRIVACY.md)

```sh
pnpm --filter @workspace/snapcontact run typecheck
pnpm --filter @workspace/snapcontact run test
```

The browser/Expo Go preview supports text extraction and review. Native OCR,
incoming OS image shares and contact-editor completion require compiling the
included local Expo module and share extension. A signed app binary has not
been generated or device-validated by the preview.
