# FF-IVY

Tablet-first chameleon care diary: Arcadia Insectivore 8-feed cycle, care timers, and feeder-insect stock tracking.

## Stack

- Next.js (App Router) PWA
- Neon Postgres
- Shared-password login
- Deploy target: Vercel

## Local setup

1. Copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL`
   - `APP_PASSWORD`
   - `SESSION_SECRET`
2. Apply the schema in [`db/migrations/001_init.sql`](db/migrations/001_init.sql) to your Neon database.
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
