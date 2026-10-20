# SnapContact

Working-name, offline-first iOS/Android utility for turning explicitly imported or shared images into reviewed contacts using native system UI.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

- Keep capture processing on device. No mandatory login, scraping, background monitoring of other apps, or cloud uploads of contacts/screenshots.
- Initial release is free. No payments now; future lifetime purchases must use storefront-localized pricing, not the selected phone-number country.
- Native OCR and share reception require a compiled build; never describe the browser/Expo Go preview as proof that native capabilities or store signing work.
- Real-device verification and release steps: `artifacts/snapcontact/docs/RELEASE-AND-DEVICE-TESTING.md`.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Do not present a React Native Modal while native contact editors are opening: it competes for iOS presentation. Show results after the queue finishes.
- Android contacts apps can return no reliable save confirmation. Stop the queue and report an unconfirmed save rather than inventing success.
- The iOS Share Extension queues one private image; the user returns to the host app manually. No unsupported automatic extension-to-host launch.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
