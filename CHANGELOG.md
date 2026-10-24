# Lapan changelog

Public feature updates and fixes. Dates use Malaysia time.

## [1.0.13] — 2026-10-25

One consistent Lapan icon

### Improved

- The main app, changelog and browser tab use the same green Lapan icon with its white infinity symbol.
- Shared vector artwork keeps the logo consistent across fonts, devices and screen sizes.

[GitHub history](https://github.com/alanchungRM/lapan-malaysia/commits/main/)

## [1.0.12] — 2026-10-25

A separate toll calculator

### Improved

- Moved the PLUS toll calculator out of route planning into its own Toll calculator option.
- Choose entry and exit plazas without planning a route. Fare estimates are independent of navigation and do not change your journey.
- Removed toll estimates and automatic plaza suggestions from route cards and route selection.

> PLUS fares cover the chosen plazas for a Class 1 car. Other highways are not included; optional manual costs remain in the calculator.

[GitHub history](https://github.com/alanchungRM/lapan-malaysia/commits/main/)

## [1.0.11] — 2026-10-25

A public home for release notes

### Added

- A mobile-friendly changelog with version numbers, release dates and links to the public GitHub history.
- Open What’s new from the app header, version badge or About & privacy.

### Improved

- Every new release now requires a changelog entry alongside its version update.

> Release notes describe user-facing changes. They do not publish private configuration or credentials.

[GitHub history](https://github.com/alanchungRM/lapan-malaysia/commits/main/)

## [1.0.10] — 2026-10-25

Traffic-aware arrival estimates

### Added

- TomTom traffic-aware ETA for the selected route, including arrival time and remaining journey duration.
- Route matching checks help keep traffic estimates aligned with the road route shown on the map.

### Improved

- Traffic is reassessed at most once every two minutes during navigation.
- The selected route card updates its duration and arrival estimate when traffic data is available.
- Clear labels distinguish TomTom traffic from the baseline road estimate.

> If traffic data is unavailable, a provider limit is reached or the route cannot be matched, Lapan uses the road estimate.
>
> This release adds traffic-aware ETA; coloured live-congestion map overlays are not enabled.

[GitHub change 1](https://github.com/alanchungRM/lapan-malaysia/commit/2012ae2265b94ffb08f6d3d73415703519f2d908)

## [1.0.9] — 2026-10-24

Consistent release numbering

### Improved

- One application version is used across the header and About & privacy.
- New releases increment the patch version. Rebuilds and deployment retries keep the same release number.

[GitHub change 1](https://github.com/alanchungRM/lapan-malaysia/commit/44da086973f05243fa5355dd6c3c86fcf8cd5225)

## [1.0.8] — 2026-10-24

Clearer guidance, voice recovery and map details

### Added

- Mapped traffic-light locations in 2D and 3D views, with a toggle under Map details.
- Arrival clock time, remaining minutes and distance that update with GPS progress.
- A repeat-instruction button and reminders as you approach a turn.
- A visible application version.

### Fixed

- Voice announcements can finish before the next one starts; interrupted or stalled speech gets a bounded retry.
- Unmuting voice guidance triggers a fresh instruction.

### Improved

- Screen-awake starts automatically during navigation and attempts recovery after interruptions, with a compatibility fallback and visible status.

> Traffic-light icons indicate mapped locations only, not live red/green signal status. Coverage may be incomplete.
>
> Screen-awake and voice behaviour depend on browser and phone support. In this release, arrival estimates did not yet use live traffic.
>
> These updates were published under version 1.0.8 before per-release numbering was introduced.

[GitHub change 1](https://github.com/alanchungRM/lapan-malaysia/commit/e056b502d2a5a84368d3adc5c4a1c04cb7d3a917) · [GitHub change 2](https://github.com/alanchungRM/lapan-malaysia/commit/50d9527cc48ebef1ddc48773145038d8cc5fa9ed) · [GitHub change 3](https://github.com/alanchungRM/lapan-malaysia/commit/dc6a27debb811e240ca1d791b9e5768d0e8f9e1c) · [GitHub change 4](https://github.com/alanchungRM/lapan-malaysia/commit/bdd115c0733f47a491a2ebea13756c517bc26ab0)

## Early development — 2026-10-24

Early public development

### Added

- Public source code, tests and a deployment guide on GitHub.
- A compact Quick stops picker for nearby petrol stations, R&R stops and shopping centres.
- Recent locations saved in the browser, device voice selection and PLUS Class 1 toll-fare lookup.

### Improved

- Heading-following 2D navigation, a tilted 3D map, smooth vehicle movement and compact driving controls.
- Automatic rerouting keeps GPS active and retries when the routing connection fails.
- Toll-plaza choices and secondary options stay collapsed until opened.

> This section groups the early public commits; it does not assign version numbers retroactively.
>
> Nearby-stop distances are straight-line distances. Check road access and highway direction. PLUS fares do not include every highway operator.

[GitHub change 1](https://github.com/alanchungRM/lapan-malaysia/commit/2cf6086390019c93cab9a93a4c7fca6fe6d1ab35) · [GitHub change 2](https://github.com/alanchungRM/lapan-malaysia/commit/dccda3f5b9b09685fdad08fadd2020296c83bb78) · [GitHub change 3](https://github.com/alanchungRM/lapan-malaysia/commit/05c993e4e80729ab1e46baf8fa75686ba99bbb1c)
