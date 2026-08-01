# FF-IVY

Tablet-first chameleon care diary: Arcadia Insectivore 8-feed cycle, care timers, feeder-insect stock tracking, and Microclimate environment status.

## Stack

- Next.js (App Router) PWA
- Neon Postgres
- Shared-password login
- Blynk webhooks from Microclimate Evo Connected Pro
- Deploy target: Vercel

## Local setup

1. Copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL`
   - `APP_PASSWORD`
   - `SESSION_SECRET`
   - `MICROCLIMATE_WEBHOOK_SECRET`
2. Apply the schemas in [`db/migrations/`](db/migrations/) to your Neon database.
3. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with `APP_PASSWORD`, then install from Chrome on an Android tablet (Add to Home screen).

## Features

- Advance-on-log feeding cycle (feeds 1–8) with history-only calendar
- Care tasks with days-since colour nudges (red at 7+ days)
- Insect check-in/out; gut-load and clean timers for crickets, locusts, dubia
- Touch buttons and Chrome Web Speech voice commands with undo toasts
- Live Microclimate Yellow/Red temperature and Blue humidity status + 24h charts

## Blynk / Microclimate webhook

Point your Blynk/Microclimate webhook at:

`https://ff-ivy.vercel.app/api/microclimate?secret=YOUR_MICROCLIMATE_WEBHOOK_SECRET`

(Microclimate often cannot send custom headers, so put the shared secret in the query string.)

You can keep other query params (e.g. `ivy_enclosure=97498`):

`https://ff-ivy.vercel.app/api/microclimate?secret=YOUR_SECRET&ivy_enclosure=97498`

- Method: **POST**
- Optional header (if your UI supports it): `X-Webhook-Secret` = same secret
- Custom JSON body (no auth token):

```json
{
  "device_id": "{device_id}",
  "device_name": "{device_name}",
  "device_productName": "{device_productName}",
  "device_pin": "{device_pin}",
  "device_dataStreamId": "{device_dataStreamId}",
  "device_dataStreamName": "{device_dataStreamName}",
  "device_dataStreamAlias": "{device_dataStreamAlias}",
  "device_pinValue": "{device_pinValue}",
  "timestamp_unix": "{timestamp_unix}",
  "timestamp_iso8601": "{timestamp_iso8601}"
}
```

Datastream can stay **Any**; the API stores status for known pins and graphs `v0` / `v1` / `v2` only.
