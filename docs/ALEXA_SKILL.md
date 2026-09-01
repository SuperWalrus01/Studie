# Coventry Buses — Alexa skill

Ask an Echo the questions the app answers by tapping:

> "Alexa, ask Coventry buses when the next **11** is at **St Johns Church**"
> "Alexa, ask Coventry buses when the next **twelve X** is at **Rail Station Bridge**"
> "Alexa, ask Coventry buses for the **fastest way to campus**"
> "Alexa, ask Coventry buses if the **12X is running late**"

Route and stop coverage is in [ROUTES.md](./ROUTES.md).

---

## 1. How the mechanism works

Four hops, each with one job:

```
 ┌──────────────┐
 │ Echo / phone │  "when's the next 11 at St Johns Church"
 └──────┬───────┘
        │ audio
        ▼
 ┌──────────────────────────────────────────────┐
 │ Alexa Skills Kit (Amazon)                    │
 │  • speech → text                             │
 │  • matches text to a sample utterance        │
 │  • resolves slots via custom slot types:     │
 │      "eleven"      → route = 11              │
 │      "saint johns" → place = stjohns         │
 │  • signs the request                         │
 └──────┬───────────────────────────────────────┘
        │ JSON IntentRequest
        ▼
 ┌──────────────────────────────────────────────┐
 │ Alexa-hosted Lambda  (alexa/lambda)          │
 │  • Amazon has already verified the signature │
 │  • slot → query string                       │
 │  • elicits a missing slot instead of guessing│
 │  • HTTPS GET to the app, 6.5s timeout        │
 │  • reads back the `speech` field verbatim    │
 └──────┬───────────────────────────────────────┘
        │ GET /api/alexa/... + x-alexa-proxy-key
        ▼
 ┌──────────────────────────────────────────────┐
 │ Next.js app on Vercel  (app/api/alexa)       │
 │  • lib/voice.ts     words → stop ids, routes │
 │  • lib/stopTimes.ts GTFS + live delays       │
 │  • lib/compare.ts   fastest journey          │
 │  • lib/routeStatus.ts punctuality            │
 │  • returns { speech, cardTitle, ...data }    │
 └──────┬───────────────────────────────────────┘
        │
        ▼
   TfWM GTFS (bundled) + GTFS-RT trip_updates (live)
```

**The load-bearing design decision:** the Lambda holds no bus logic. It maps
slots to a query string and speaks whatever `speech` comes back. Every timetable
rule — bay grouping, service calendars, live delays, journey chaining — stays in
`lib/`, shared with the web app. Change a walk time once and both surfaces agree.

### Why a Lambda rather than pointing Alexa at Vercel

Alexa will POST to any HTTPS endpoint, but a skill that owns its endpoint must
verify the `Signature-256` and `SignatureCertChainUrl` headers itself: fetch the
cert chain, validate the SAN, check the chain to a trusted root, verify the
signature, and reject stale timestamps. Get it wrong and the skill either fails
certification or accepts forged requests. Alexa-hosted Lambda does all of that
before your code runs, and costs nothing.

---

## 2. Intent → endpoint map

| Intent | Utterance | Slots | Endpoint |
|---|---|---|---|
| `NextRouteAtStopIntent` | "when's the next 11 at St Johns Church" | `route`, `place`, `direction?` | `GET /api/alexa/next?route=&place=&direction=` |
| `NextBusAtStopIntent` | "what's leaving Pool Meadow" | `place`, `direction?` | `GET /api/alexa/next?place=` |
| `RouteStatusIntent` | "is the 12X running late" | `route` | `GET /api/alexa/delay?route=` |
| `FastestJourneyIntent` | "fastest way to campus" | `direction` | `GET /api/alexa/fastest?direction=` |

Every endpoint returns the same envelope, so the Lambda never branches on intent:

```json
{
  "resolved": true,
  "speech": "The next 11 from St Johns Church leaves in 20 minutes, at 5:05 PM, heading to Warwick Uni. Then 5:25 PM, and 5:45 PM.",
  "cardTitle": "11 at St Johns Church",
  "departures": [ … ]
}
```

Failures return the same shape with a spoken apology in `speech`, so a 500 still
produces a sentence rather than Alexa's generic error tone.

---

## 3. How words become stop IDs

Resolution happens **twice**, on purpose.

**Stage 1 — Alexa (`alexa/skill-package/interactionModels/custom/en-GB.json`).**
Custom slot types `BUS_ROUTE`, `BUS_PLACE` and `TRIP_DIRECTION` list every spoken
form with synonyms. A match hands the Lambda a canonical id (`12X`, `railstation`).

**Stage 2 — the app (`lib/voice.ts`).** `normalizeRoute()` and `resolvePlace()`
re-parse whatever arrives. This is what saves the skill when Alexa's slot
resolution misses — an unresolved `"twelve ex"` still becomes `12X`, and
`"the train station"` still becomes Rail Station Bridge.

```
normalizeRoute("twelve ex")  → "12X"      resolvePlace("the train station") → railstation
normalizeRoute("eighty seven") → "87"     resolvePlace("saint john's church") → stjohns
```

Three details worth knowing:

- **Bay grouping.** "St Johns Church" is four NaPTAN bays (CS1–CS4); Pool Meadow
  is three. `VOICE_PLACES` lists them and `getDeparturesForStops()` merges the
  lot, so the caller never has to know which bay a route uses.
- **Route families.** Saying "the 21" answers with 21, 21A and 21S — they run the
  same corridor. Saying "21A" stays exact. See `ROUTE_FAMILIES`.
- **Trip collapsing.** One physical bus produces an edge per tracked destination,
  so an 11 out of St Johns appears three times in the raw data. The voice
  endpoints pass `collapseByTrip: true` to keep the furthest-reaching edge only.
  Without it Alexa says "then 5:05 PM, and 5:05 PM". The web departure boards are
  left on the old behaviour.

### Direction

Bay groups span both sides of the road, so "the next 12X at Rail Station Bridge"
is genuinely ambiguous — one side goes to campus, the other into town. The
optional `direction` slot filters on the destination the app already labels:

| Direction | Keeps departures heading to |
|---|---|
| `campus` | Warwick Uni, Scarman Rd |
| `city` | St Johns Church, New Union St, Pool Meadow, Rail Station |

With no direction, the soonest bus wins and the spoken heading disambiguates it.
If a filter would leave nothing, the unfiltered list is used rather than
answering with silence.

---

## 4. Setup

### 4a. Deploy the API (already in this repo)

The endpoints ship with the app. Set one extra environment variable in Vercel so
they aren't a free, unauthenticated read of your TfWM quota:

```
ALEXA_PROXY_KEY = <a long random string>
```

Generate one with `openssl rand -hex 32`. If the variable is unset the endpoints
stay open, which is fine locally and wrong in production. The same key must go on
the Lambda in step 4d — the two have to match or every request gets a 403.

**Set the variable before you push.** Vercel deploys on push, and an unset key
means `/api/alexa/*` goes live unauthenticated until the next deploy. Order:

1. Vercel dashboard → **Settings → Environment Variables** → add `ALEXA_PROXY_KEY`
   for **Production**
2. `git push` (or **Redeploy** if the code is already up)

Then check:

```bash
curl "https://studie-eight.vercel.app/api/alexa/next?place=stjohns&route=11" \
  -H "x-alexa-proxy-key: <the key>"
```

### 4b. Create the skill

1. [developer.amazon.com/alexa/console/ask](https://developer.amazon.com/alexa/console/ask) → **Create Skill**
2. Name **Coventry Buses**, primary locale **English (UK)**
3. Model: **Custom** · Hosting: **Alexa-hosted (Node.js)**
4. Template: **Start from Scratch**

### 4c. Upload the interaction model

**Build → JSON Editor**, paste
`alexa/skill-package/interactionModels/custom/en-GB.json`, **Save**, then
**Build Model** (about a minute).

### 4d. Upload the Lambda

**Alexa-hosted skills cannot set custom environment variables.** The console
exposes only Amazon's own (`S3_PERSISTENCE_BUCKET`, `AWS_REGION`, …) and gives you
no AWS Lambda console to add more. Configuration therefore lives in `config.js`.

On the **Code** tab, replace the generated files with the three in
`alexa/lambda/`:

| File | Notes |
|---|---|
| `index.js` | the handler, unchanged |
| `package.json` | no dependencies |
| `config.js` | **fill in both values here** |

Then edit `config.js` *in the console*:

```js
module.exports = {
  BUSAPP_BASE_URL: "https://studie-eight.vercel.app",
  ALEXA_PROXY_KEY: "<the same key you set in Vercel>",
};
```

**Save** → **Deploy**.

> Fill `config.js` in the console, **not** in this repo. The copy here is
> committed with empty placeholders so the key never reaches GitHub. Your
> hosted skill's code lives in a private CodeCommit repo tied to your Amazon
> account, so the key is not public there.

> `process.env` still takes precedence over `config.js`. If you ever move to a
> self-managed Lambda, set real environment variables and the file becomes dead
> weight — no code change needed.

> The handler is CommonJS, dependency-free, and uses the global `fetch` in
> Node 18+, so there is nothing to `npm install`.

If every request comes back with *"I didn't get an answer from the timetable"*,
the two keys disagree. **Code → Logs** (CloudWatch) will show
`busapp returned 403 … ALEXA_PROXY_KEY mismatch?`.

### 4e. Test

**Test** tab, set to **Development**, then type or say:

```
open coventry buses
ask coventry buses when the next 11 is at st johns church
ask coventry buses when the next twelve x is at rail station bridge
ask coventry buses for the fastest way to campus
ask coventry buses if the 12x is running late
```

A skill in Development already works on any Echo signed into the same Amazon
account. For a personal skill there is nothing to publish or certify.

---

## 5. Testing locally

Run the app and hit the endpoints directly — no Alexa involved:

```bash
npm run dev
K=$(grep ALEXA_PROXY_KEY .env.local | cut -d= -f2)
curl -H "x-alexa-proxy-key: $K" "http://localhost:3000/api/alexa/next?place=stjohns&route=eleven"
curl -H "x-alexa-proxy-key: $K" "http://localhost:3000/api/alexa/next?place=railstation&route=twelve%20x&direction=campus"
curl -H "x-alexa-proxy-key: $K" "http://localhost:3000/api/alexa/delay?route=11"
curl -H "x-alexa-proxy-key: $K" "http://localhost:3000/api/alexa/fastest?direction=home"
```

`ALEXA_PROXY_KEY` is set in `.env.local`, so the header is required locally too.
Drop the variable from `.env.local` if you'd rather curl these without it. Note
the guard covers `/api/alexa/*` **only** — `/api/stop-times`, `/api/options` and
the rest stay open, because the browser app calls them and cannot hold a secret.

To exercise the Lambda without deploying, point it at the dev server and hand it
a synthetic `IntentRequest`:

```js
process.env.BUSAPP_BASE_URL = "http://localhost:3000";
process.env.ALEXA_PROXY_KEY = "<your key>"; // or fill alexa/lambda/config.js
const { handler } = require("./alexa/lambda/index.js");

const res = await handler({
  request: {
    type: "IntentRequest",
    intent: {
      name: "NextRouteAtStopIntent",
      slots: {
        route: { name: "route", value: "twelve x" },
        place: { name: "place", value: "rail station bridge" },
      },
    },
  },
});
console.log(res.response.outputSpeech.text);
```

Omitting `resolutions` here is deliberate: it proves the Stage 2 fallback works
when Alexa's own slot resolution misses.

---

## 6. Known limits

- **Only the corridor.** `data/gtfs-subset.json` holds edges between the stops in
  `lib/stops.constants.mjs` and nothing else. Asking about a stop outside it gets
  the "I don't know a stop called…" reply, by design.
- **Two-hour horizon.** Departures beyond 120 minutes are not returned, so a
  late-night "when's the first bus tomorrow" gets nothing useful.
- **Stale bundle.** The timetable is committed to the repo. Rerun
  `npm run bundle-gtfs`, then `npm run route-stats`, and redeploy when TfWM
  publishes a new schedule — otherwise the skill confidently reads out an old
  timetable.
- **Live delays are sparse.** GTFS-RT only covers some trips; "running to
  schedule" means *no operator has reported a delay*, not that the bus is on time.
- **One region, one locale.** en-GB only.

## 7. Worth adding next

- **`AMAZON.SearchQuery` free-form fallback** for stop names outside the slot list.
- **Device address → nearest stop**, so "when's my next bus" needs no stop name.
- **Progressive response** ("checking…") if the TfWM cold start ever gets slow.
- **Persistent attributes** to remember a default stop per user.
- **APL card** on screen devices showing the next three departures.
