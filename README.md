# Lapan — Malaysia road navigation

Mobile-friendly Malaysian road navigation and toll planning.

Live app: https://lapan-malaysia.com

## Features

- TomTom live route planning and alternative routes using current traffic and reported closures. Basic OSRM routing is available only as an explicit fallback when the live service is unavailable.
- Place and address search using Photon, automatic typed-location resolution, clearer match selection, and a map pin picker for starting points and destinations. Recent places stay in the browser.
- Full-screen navigation, a tilted MapLibre driving view, directional vehicle marker, smooth position transitions, and 2D fallback.
- Device speech synthesis with a female voice preference, voice selection, test and mute controls.
- Separate PLUS Class 1 fare calculator with manually chosen entry and exit plazas, independent of navigation.
- Collapsible planning and toll controls designed for phones.

## Run locally

Requires Node.js 22 or newer. The standard build needs no application dependencies. The optional regional directory preparation also needs Python 3 and the free overturemaps package.

```sh
npm run build
npm test
npm run dev
```

Open http://localhost:5173. Localhost is supported for browser geolocation; deployed GPS requires HTTPS. Allow location access when prompted.

## Deployment

The build produces `dist/server/index.js`, a self-contained Cloudflare Worker containing the web assets and a same-origin PLUS fare endpoint. A sample `wrangler.jsonc` is included for deployment to your own Cloudflare account. The repository contains no production domain settings or hosting credentials.

```sh
npm run build
npx wrangler deploy
```

Wrangler requires authentication to your own Cloudflare account. Add a custom domain using your hosting account's domain settings. Check current hosting and upstream service limits before deploying a busy public service.

## Project structure

- `web/`: application HTML, CSS, browser scripts and bundled MapLibre assets.
- `worker/api.js`: validated PLUS fare lookup with a short-lived in-memory cache.
- `scripts/build.mjs`: embeds the assets and API into the Worker.
- `scripts/dev.mjs`: local HTTP adapter for the built Worker.
- `tests/`: navigation state, smoothing, toll API, voice selection and recent-place checks.

The current hosted application is JavaScript, HTML and CSS. It does not contain the earlier Rust prototype.

## Coverage and limitations

This is an early navigation application. Road-test it carefully before relying on it.

- Live route planning requires the server-only `TOMTOM_API_KEY`. Traffic and closure coverage depend on the provider. Closures are checked at planning/replanning time, not continuously. Newly blocked or unreported roads may be missing. OSRM basic fallback does not check closures.
- Toll amounts cover the selected PLUS Class 1 plaza pair only. They are not a complete total for routes using other operators. Check suggested plazas and current official fares before departure.
- 3D requires WebGL and accessible map tiles. Building detail varies by location. A 2D fallback is available.
- Female voices depend on voices installed on the user's device. Browser background audio, GPS and in-app browser restrictions can affect guidance.
- Recent places and voice preferences are stored in browser localStorage. They are not shared between users or synced between devices. No continuous GPS trail is stored.
- Search text is sent to Photon. Starting/current and destination coordinates go to TomTom for live planning and replanning. Selected route coordinates go to TomTom for ETA refreshes. OSRM receives route coordinates only after explicit basic-routing fallback. Map providers receive tile requests. PLUS receives only plaza codes. Keys are never sent to client assets.
- Location history on the original app address does not automatically transfer to a different custom domain because browser storage is origin-specific.

## External services and third-party notices

Lapan is independent of the services below; no affiliation is implied.

- [OpenStreetMap](https://www.openstreetmap.org/copyright): geographic data, ODbL.
- [OSRM](https://project-osrm.org/): routing engine and public demonstration routing service.
- [Photon](https://photon.komoot.io/): place search.
- [Leaflet](https://leafletjs.com/): 2D map library, BSD-2-Clause; bundled version 1.9.4 (`web/leaflet.js`, `web/leaflet.css`, unmodified from the npm package; licence in `THIRD_PARTY_LICENSES/Leaflet-BSD-2-Clause.txt`).
- [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js): bundled version 5.6.0, BSD-3-Clause. Preserve its copyright and license notices.
- [OpenFreeMap](https://openfreemap.org/): driving vector basemap; preserve map attribution.
- [Esri](https://www.esri.com/): planning raster basemap; preserve map attribution and comply with provider terms.
- [PLUS Malaysia](https://www.plus.com.my/): fare data. The public calculator's service is an upstream dependency, not a guaranteed or contracted integration.

Third-party data and services retain their respective licenses and terms. Public source visibility does not grant rights to redistribute upstream data or evade usage limits.

## Contributions and licensing

Issues and suggested improvements are welcome. Do not submit API keys, location history, personal travel logs or other sensitive information.

No license grant for the original Lapan source is specified in this repository yet. Public visibility alone does not grant a general license to reuse or redistribute it. Third-party components retain their own licenses. The project owner may choose an explicit source license later.

## Release history

Read [What’s new in Lapan](https://lapan-malaysia.com/changelog) or [CHANGELOG.md](CHANGELOG.md) for feature updates, fixes, limitations and public commit references.

Before a new release, add reviewed notes for the next patch version to `web/changelog.json`, then run `npm run release` once. It increments the version, generates `CHANGELOG.md` and builds the site. Use `npm run build` for rebuilds or deployment retries. Release notes must not contain credentials, keys, private configuration or personal journey data.

## Anonymous visitor statistics

`/statistics` shows aggregate navigation-page views, active browser tabs and broad device/browser categories. It does not identify people. Tracking starts with v1.0.18 and respects browser privacy signals and a local opt-out.

Hosting requires a Cloudflare D1 binding named `DB`. Apply the schema in `drizzle/0000_visitor_statistics.sql` before serving analytics requests. On Sites, declare `"d1": "DB"` in the private hosting manifest; Sites applies packaged migrations at deploy time. No database or hosting credential belongs in the public repository.

## Speed limits and speed-camera alerts

`web/speed.js` shows the mapped speed limit on the driving screen, turns the speedometer amber at your chosen margin (3, 5 or 10 km/h over, default 3) and red seven km/h beyond it, warns before a limit drop of 10 km/h or more, and gives a spoken warning after about 4 seconds of sustained speeding with a 45 second cooldown. Speed-camera alerts in `web/cameras.js` use the mapped road limit when the camera itself has none. Where OpenStreetMap has no `maxspeed`, Lapan shows no limit and never guesses one.

The data is `web/speed-limits.json`, generated from the Geofabrik Malaysia, Singapore and Brunei extract and licensed ODbL. It is loaded only when navigation starts. Regenerate it with:

```sh
python3 -m venv .venv && . .venv/bin/activate
python3 -m pip install osmium
python3 scripts/extract-speed-limits.py /path/to/malaysia-singapore-brunei.osm.pbf
npm run build
```

The script prints how much of each road class has a mapped limit. Without the file the build still works and no limits are shown.

Camera alerts use `web/speed-cameras.json`, generated the same way with `python3 scripts/extract-speed-cameras.py /path/to/malaysia-singapore-brunei.osm.pbf`. It holds only cameras that OpenStreetMap contributors have mapped. On the 2026-10-31 extract that is 293 (244 speed cameras, 49 red-light cameras, 205 with a mapped limit), which is a small share of real enforcement points. Mobile cameras and police traps are not included. The app says so next to the toggle and never claims full coverage. Re-run the script when you refresh the extract, and the build embeds the result.

Measured on the 2026-10-31 extract, by road length with a mapped limit: motorway 83.5%, trunk 41.9%, primary 27.6%, secondary 14.5%, tertiary 7.3%. Local roads (residential, unclassified, living street) are left out because under 3% of them have a mapped limit. Expect limits on expressways and main roads, and a blank sign space on most other streets.

## Languages: English and Bahasa Malaysia

Every screen is available in English and Bahasa Malaysia, with an **EN | BM** switch in the header (and a button under More while driving, so you can change language mid-trip). The first visit follows the first of your phone's languages that Lapan offers (Malay or English); your own choice is then remembered.

How it works: the English text in the page is the key. `web/i18n-ms.js` maps each English string to its Malay one, and `web/i18n.js` swaps text, labels and tooltips in place (no reload, so a trip is never interrupted). The Malay file is downloaded only by people who use Malay. Turn instructions are built from the structured manoeuvre in either language, so TomTom's English sentence is not used in Malay. Spoken text is translated only when the device has a Malay voice; otherwise Lapan keeps speaking English, so the voice stays understandable.

**Adding or changing any screen text means adding its Bahasa Malaysia in `web/i18n-ms.js` in the same PR.** `npm test` fails if page text has no Malay entry, if a placeholder like `{n}` or a tag is lost, or if a translation is long enough to overflow a button. For text built in a script, use `LapanI18n.t('English text {n}', {n: 5})`, or keep a whole sentence as one string so it reads naturally. Terms follow everyday Malaysian usage (laluan, had laju, km/j, lebuh raya, Skrin Utama). A native speaker should review new wording. Not translated yet: the public changelog and the visitor statistics page.

## Toll prices

Each route card shows a toll tag in the style of Waze: **Toll ~RM 8.50** (estimate), **Toll RM 4.20+** (at least; some tolls could not be priced) or **No toll**. Prices come from `worker/toll-rates.json`, built into the Worker from the Lapan toll dataset, and TomTom's toll sections decide where the route is on toll road. How it works, its limits and how to refresh it: `TOLL_ESTIMATES.md`.

## Optional edge rate limiting

Request limits inside each handler are per Worker isolate, so they are only a best-effort backstop. For a public deployment, add a [Workers Rate Limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) binding named `RATE_LIMITER`; `/api/route`, `/api/place-search`, `/api/traffic-eta`, `/api/visit` and `/api/nearby` are then limited per client IP and path across the location. Without the binding nothing changes, and a limiter outage fails open.

```jsonc
// wrangler.jsonc
"ratelimits": [{"name": "RATE_LIMITER", "namespace_id": "1001", "simple": {"limit": 30, "period": 60}}]
```

Response headers (CSP, HSTS and others) are set in `worker/assets.js`. If you add a new third-party host for scripts, styles, images or data requests, add it to the Content-Security-Policy there.

## Live route planning

Set `TOMTOM_API_KEY` as a runtime secret with Routing API access. `/api/route` requests a fresh fastest car route with `traffic=true`, `departAt=now` and matching English turn instructions. It does not reconstruct an OSRM path. No usable live route means no silent fallback. Service unavailability offers an explicit basic-route choice marked closures NOT checked. Routes containing returned ROAD_CLOSURE sections are rejected.

## Optional regional POI directory

The live application supplements search with approximately 353,000 public place listings around Kuala Lumpur and Selangor from Overture Places release 2026-10-21.0. This is a regional snapshot, not nationwide or live business coverage. Check branches and accessible vehicle entrances.

The generated `worker/poi-data.json` is intentionally excluded from Git. Reproduce it from the anonymous public download:

```sh
python3 -m venv .venv
. .venv/bin/activate
python3 -m pip install overturemaps
npm run prepare:poi
npm run build
```

On Windows, activate the virtual environment using its Scripts directory and use your Python 3 command. An existing GeoJSON-sequence download can be passed with `python3 scripts/prepare-poi-directory.py --input places.geojsonseq`. The pinned download covers bounding box 100.70,2.55,102.00,3.85. Data preparation filters supported source licenses, removes unused contact fields and exact duplicates, rounds place coordinates, and creates compressed token-index and record shards. Source attribution and full applicable licenses are in `data/POI_NOTICES.txt` and `THIRD_PARTY_LICENSES/`.

Without a generated directory, the build still works with the existing providers. With the directory enabled, additional search checks it before TomTom and returns only matching results to phones. The index requires no AI calls or database writes. The data license is free; hosting usage remains subject to your provider's allowances. Check the larger Worker bundle size, memory and CPU limits before deploying.
