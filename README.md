# Bus Compare

**Repository:** [github.com/SuperWalrus01/Studie](https://github.com/SuperWalrus01/Studie)

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

## Deploy on Vercel

This is a **Next.js** app — do not set Output Directory to `dist`.

1. Import the repo on [vercel.com](https://vercel.com)
2. Framework preset: **Next.js** (auto-detected if `vercel.json` is present)
3. Add environment variables from `.env.example`:
   - `TFWM_APP_ID`, `TFWM_APP_KEY`, `BODS_API_KEY`
4. Add **all three** environment variables for **Production** (and Preview if you use preview URLs):
   - `TFWM_APP_ID`, `TFWM_APP_KEY`, `BODS_API_KEY`
5. Deploy

If you see “No Output Directory named dist”, open **Project Settings → Build & Development** and clear **Output Directory** (leave blank for Next.js).

### Why it works locally but not on Vercel

| Local | Vercel production |
|-------|-------------------|
| `.env.local` is always loaded | Env vars must be set in the Vercel dashboard |
| GTFS cache persists in `.cache/` for days | Each serverless instance starts with an **empty** `/tmp` — no saved timetable |
| First load downloads GTFS once | Without a build-time bundle, every cold start tries to download the full TfWM zip (~30–60s) and often **times out** (HTML error page → “Unexpected token `<`”) |

**Fix:** `npm run build` runs `scripts/prebuild-gtfs.mjs`, which downloads GTFS **during deploy** (when Vercel has your API keys) and ships `data/gtfs-subset.json` with the app. Timetables then load in milliseconds.

**Check production:** open `https://your-app.vercel.app/api/health` — you want `"ok": true` and `"bundledSubset": true`.

If `bundledSubset` is false, redeploy after adding `TFWM_APP_ID` and `TFWM_APP_KEY` to Vercel **Environment Variables** (Production), then trigger a new deployment.

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

## Install as app (PWA)

**iPhone:** Safari → Share → **Add to Home Screen**

**Android:** Chrome menu → **Install app** or **Add to Home screen**

The app works offline for the shell only; bus times still need internet.
