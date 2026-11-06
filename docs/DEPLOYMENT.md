# Deploying the SnapContact API (Render) and payments (Cashfree)

## Why pushes were not deploying

The repository had no `render.yaml`, so every deploy setting lives in the Render dashboard.
Pushes to `main` of `vijaytectra/WeeklyHastyRegisters` did not start a deploy, which means one of
these is true for the `snapcontact-backend` service (only the dashboard can show which):

1. **Auto-Deploy is off** — Settings → Build & Deploy → Auto-Deploy.
2. **It watches another branch** — Settings → Build & Deploy → Branch must be `main`.
3. **It is linked to a different repository** (for example a fork) or the Render GitHub app lost
   access — Settings → Build & Deploy → Repository; GitHub → Settings → Applications → Render.
4. **A build filter excludes the changed paths** — Settings → Build & Deploy → Build Filters.

## Fixing it

Either correct the four settings above on the existing service, or recreate it from the
blueprint: Render → Blueprints → New Blueprint Instance → this repository. `render.yaml` sets
branch `main`, auto-deploy on, the build and start commands, and the health check
`/api/healthz`.

Build: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @workspace/api-server run build`
Start: `node --enable-source-maps artifacts/api-server/dist/index.mjs`

After a deploy, check it is the new code:

```bash
curl -s https://snapcontact-backend.onrender.com/api/healthz
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://snapcontact-backend.onrender.com/api/auth/check-email -H 'content-type: application/json' -d '{}'
```

The second command prints `400` on current code and `404` on code older than the password sign-in.

## Environment variables (Render → Environment)

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | yes | `production`. Enables the startup checks below. |
| `DATABASE_URL` | yes | Postgres connection string. Tables and new columns are created on startup. |
| `TOKEN_SECRET` | yes | ≥ 32 random characters (`openssl rand -hex 32`). **The server will not start without it.** Changing it signs everyone out. |
| `PUBLIC_BASE_URL` | recommended | `https://snapcontact-backend.onrender.com`. Used for Cashfree return/webhook URLs; falls back to the request host. |
| `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV` | for payments | `CASHFREE_ENV` is `SANDBOX` or `PRODUCTION` and must match the keys. If any is missing, payments are disabled and the webhook rejects everything. |
| `BREVO_API_KEY` or `SMTP_*` | for sign-in emails | Render's free plan blocks SMTP ports; use Brevo there. |
| `GOOGLE_CLIENT_IDS` | for Google sign-in | Comma-separated OAuth client IDs. |
| `ADMIN_KEY` | optional | Enables `/api/admin/*` with the `x-admin-key` header (including trial resets). |

The previous server signed sessions with a built-in fallback secret when `TOKEN_SECRET` was not
set. The new server refuses to do that, and tokens now carry an issuer and audience, so **everyone
signs in once more after this deploy**.

## Cashfree setup

1. Cashfree dashboard → Developers → API Keys: copy the App ID and Secret Key into Render.
2. Developers → Webhooks: add `https://snapcontact-backend.onrender.com/api/webhooks/cashfree`
   for **Payment** events (success, failed, user dropped), API version 2023-08-01. Orders also send
   this URL as `notify_url`.
3. For production keys, Cashfree must whitelist the return domain
   `snapcontact-backend.onrender.com` (Developers → Whitelisting) before checkout works.
4. Test in `SANDBOX` with Cashfree's test cards/UPI before switching to `PRODUCTION`.

How a payment works: the app asks the API for an order (the API sets the price from its own plan
table and the user from the session), opens `/api/cashfree/checkout/<order>` which runs Cashfree's
official JS checkout, then asks the API to verify. The API asks Cashfree for the order and its
payments and activates the plan only for a successful payment of the exact amount and currency.
The signed webhook does the same check, so the plan activates even if the app is closed.

## App builds

`eas.json` sets `EXPO_PUBLIC_API_URL=https://snapcontact-backend.onrender.com/api` for the
`preview` and `production` profiles. Release builds refuse any non-https or private-network API
address. Local development uses `.env` (default `http://localhost:5001/api`); on a phone or
emulator, `localhost` is replaced with the computer running the Expo dev server.
