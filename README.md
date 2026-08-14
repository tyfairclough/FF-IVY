# FF-IVY

Tablet-first chameleon care diary: Arcadia Insectivore 8-feed cycle, care timers, feeder-insect stock tracking, and Microclimate environment status.

## Stack

- Next.js (App Router) PWA
- Neon Postgres
- Shared-password login
- Blynk Device HTTPS API poll (Microclimate Evo Connected Pro) via Vercel Cron
- Deploy target: Vercel

## Local setup

1. Copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL`
   - `APP_PASSWORD`
   - `SESSION_SECRET`
   - `BLYNK_SERVER_URL`, `BLYNK_DEVICE_TOKEN` (see below)
   - `CRON_SECRET`
   - `MICROCLIMATE_WEBHOOK_SECRET` (only if using the optional webhook fallback)
   - `OPENAI_API_KEY` (natural-language voice)
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
- Touch buttons and Chrome Web Speech + OpenAI natural-language voice (multi-intent logging, clarifications, “what does Ivy need”, last-done questions) with undo toasts
- Microclimate Yellow/Red temperature and Blue humidity status + 24h charts (polled once per minute)

## Microclimate / Blynk poll (primary)

FF-IVY pulls **only** these pins once per minute via Vercel Cron → `GET /api/microclimate/poll`:

| Pin | Stream |
|-----|--------|
| `v0` | Yellow Temperature |
| `v1` | Red Temperature |
| `v2` | Blue Humidity |

### Find Blynk credentials

1. Open the Microclimate/Blynk **web console** (same org as “Ivy enclosure”).
2. **Server host:** look at the bottom-right of the console UI (e.g. `blynk.cloud` or a regional/white-label host). Set:
   ```
   BLYNK_SERVER_URL=https://YOUR_HOST
   ```
   (https, no trailing slash.)
3. **Device token:** open the device → Device info / Auth token. Set:
   ```
   BLYNK_DEVICE_TOKEN=...
   ```
   Treat this like a password. (It is the same value that appeared as `device_authToken` in old webhook payloads.)
4. Optional: `BLYNK_DEVICE_NAME=Ivy enclosure` for the label stored with readings.

### Cron secret (Vercel)

Set `CRON_SECRET` in Vercel (Production). Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` to `/api/microclimate/poll` every minute (`vercel.json`).

Manual test:

```bash
curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://ff-ivy.vercel.app/api/microclimate/poll"
```

### Disable outbound webhooks (important)

High-volume Blynk webhooks have been linked to Microclimate UI/clock glitches. Keep webhooks **disabled**:

**Settings → Developers → Webhooks → Disable** (or delete) any FF-IVY webhook.

The thermostat only needs its normal cloud link; FF-IVY polls Blynk’s stored pin values.

## Optional webhook fallback

Prefer leaving this **off**. If you must re-enable it temporarily, the route only accepts `v0` / `v1` / `v2` and throttles writes to once per pin per 60 seconds. High fire rates can still stress the device/cloud path even when FF-IVY ignores extras.

URL:

`https://ff-ivy.vercel.app/api/microclimate?secret=YOUR_MICROCLIMATE_WEBHOOK_SECRET`

- Method: **POST**
- Prefer one webhook per pin (`v0`, `v1`, `v2`) — never **Any** / Time (`v27`) / outputs
- Custom JSON body (placeholders from Blynk dropdown):

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
