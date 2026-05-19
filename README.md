# Bus Compare

A simple mobile-friendly web app to compare Coventry buses for regular trips:

- **To Warwick** from City Village (St Johns Church) or New Union Street
- **To Lynchgate** from City Village
- **Going home** to City Village or New Union Street from Warwick or Lynchgate

Shows upcoming departures sorted by **fastest arrival**, using TfWM schedules and live delays.

## Setup

1. Copy `.env.example` to `.env.local` and add your [TfWM API](https://api-portal.tfwm.org.uk/) credentials:

```bash
cp .env.example .env.local
```

```env
TFWM_APP_ID=your_app_id
TFWM_APP_KEY=your_app_key
BODS_API_KEY=your_bods_api_key
```

Get a free **BODS** key from [bus-data.dft.gov.uk](https://data.bus-data.dft.gov.uk/) (Account → API key) for the live bus map.

2. Install and run:

```bash
npm install
npm run dev
```

**Restart `npm run dev` after creating or editing `.env.local`** — Next.js only reads env vars at startup.

Open [http://localhost:3000](http://localhost:3000) on your phone (same Wi‑Fi) or desktop.

**Live map** (`/map`) shows real-time bus positions from BODS (updates every ~10s).

If you see an authentication error, log in at [api-portal.tfwm.org.uk](https://api-portal.tfwm.org.uk/) and confirm your application has access to the **GTFS** and **GTFS-RT** products. Use the **Application Id** and **Key** exactly as shown there.

The first request downloads GTFS data (~30s); later requests use a 24h cache in `.cache/`.

If **17 / 21 connector buses** (New Union → St Johns) are missing, rebuild the cache:

```bash
npm run rebuild-cache
```

No dev-server restart needed after rebuild (cache reloads automatically).

## Verify stops

After the first GTFS download:

```bash
node --env-file=.env.local scripts/verify-stops.mjs
```

Lists which configured stop pairs have timetable data.

## Add to home screen (iPhone)

Open in Safari → Share → **Add to Home Screen**.
