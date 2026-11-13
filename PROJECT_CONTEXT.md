# Lapan Malaysia project context

Updated 12 November 2026. The public repository and [live app](https://lapan-malaysia.com) are at **v1.0.41**.

## What Lapan does

Lapan is a mobile-first browser navigation app for Malaysia. It combines 2D route planning, a 3D driving view, GPS guidance in English and Bahasa Malaysia, and automatic car toll estimates where matching fare data is available. Drivers can choose **Faster** or **Avoid Tolls**. Toll and map coverage vary by route.

The planning map uses Leaflet and OpenFreeMap. The driving view uses MapLibre GL JS. The app is written in HTML, CSS and JavaScript and runs on a Cloudflare Worker. TomTom is the default routing provider. Valhalla is the secondary routing provider. OSRM provides basic routing for eligible car routes when both services are unavailable.

## Current features

- **Anonymous road reports** cover crashes, stopped vehicles, objects on the road, flooding, potholes and police presence. Choose a category and confirm to submit. Tap a pin to see the remaining time or vote **Still there** or **Cleared**. Reports expire eight hours after submission.
- **Share this place** creates a short destination link. **Share my drive** can include an estimated arrival time in the message. The link opens the shared destination.
- **End navigation** is available near arrival and on the arrival screen in the live app. The driving footer aligns it with **Details** in portrait and landscape.

Thanks to [Dandy (@dandycrypto)](https://github.com/dandycrypto) for the original road report and sharing contributions in [PR #30](https://github.com/alanchungRM/lapan-malaysia/pull/30) and [PR #32](https://github.com/alanchungRM/lapan-malaysia/pull/32), integrated through [PR #40](https://github.com/alanchungRM/lapan-malaysia/pull/40).

## Working in this repository

| Area | Location |
| --- | --- |
| Planning, GPS and driving guidance | `web/app.js` |
| Client routing and ETA | `web/routing.js`, `web/eta.js` |
| Road reports and sharing | `web/reports.js`, `web/share.js`, `worker/reports.js`, `worker/share.js` |
| Build and tests | `scripts/build.mjs`, `scripts/test.mjs` |
| Release history | `CHANGELOG.md`, `web/changelog.json` |

Read [AGENTS.md](AGENTS.md) before editing. Use `npm run build` to build and `npm test` to run the test suite. Check the target branch before starting work. Use [the live changelog](https://lapan-malaysia.com/changelog) to verify what is deployed and [the repository changelog](CHANGELOG.md) to verify what is recorded in source.
