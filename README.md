# Lapan — Malaysia road navigation

Mobile-friendly Malaysian road navigation and toll planning.

Live app: https://lapan-malaysia.com

## Features

- OpenStreetMap-based driving routes and alternative routes through OSRM.
- Place search using Photon, recent places saved in the browser, and GPS guidance.
- Full-screen navigation, a tilted MapLibre driving view, directional vehicle marker, smooth position transitions, and 2D fallback.
- Device speech synthesis with a female voice preference, voice selection, test and mute controls.
- PLUS Class 1 fare lookup by entry and exit plaza, with limited automatic plaza suggestions.
- Collapsible planning and toll controls designed for phones.

## Run locally

Requires Node.js 22 or newer. No dependency installation is needed.

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

- Routing durations exclude live traffic. OSRM and Photon public services can be unavailable or rate limited; there is no uptime guarantee.
- Toll amounts cover the selected PLUS Class 1 plaza pair only. They are not a complete total for routes using other operators. Check suggested plazas and current official fares before departure.
- 3D requires WebGL and accessible map tiles. Building detail varies by location. A 2D fallback is available.
- Female voices depend on voices installed on the user's device. Browser background audio, GPS and in-app browser restrictions can affect guidance.
- Recent places and voice preferences are stored in browser localStorage. They are not shared between users or synced between devices. No continuous GPS trail is stored.
- Search text is sent to Photon; route coordinates, including when replanning, are sent to OSRM. Map providers receive tile requests. PLUS receives only entry and exit plaza codes through the server endpoint.
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
