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
- [Leaflet](https://leafletjs.com/): 2D map library, BSD-2-Clause; loaded from unpkg.
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
