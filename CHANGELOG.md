# Lapan changelog

Public feature updates and fixes. Dates use Malaysia time.

## [1.0.23] — 2026-10-27

Reliable end navigation

### Fixed

- End navigation closes the driving screen before releasing browser services, so a map, speech or screen-awake cleanup error cannot leave guidance stuck open.
- Ending guidance cancels pending rerouting and ignores late location or route callbacks.
- Arrival invalidates queued GPS callbacks so finished guidance is not restarted by an old location update.

[GitHub history](https://github.com/alanchungRM/lapan-malaysia/commits/main/)

## [1.0.22] — 2026-10-27

Find typed places and choose locations on the map

### Improved

- Find my route now resolves typed starting points and destinations instead of requiring a suggestion to be selected first.
- Matching places show fuller address details, with a confirmation list when several locations match.
- Search distinguishes no matches from service failures and ignores outdated responses after edits.

### Added

- Choose a starting point or destination by tapping the map or dragging a pin, then confirm the location.

> Place coverage still depends on the search data. Map pins may route to a nearby accessible road; check the entrance before starting.

[GitHub history](https://github.com/alanchungRM/lapan-malaysia/commits/main/)

## [1.0.21] — 2026-10-26

Uncluttered map credits in landscape

### Improved

- Map credits collapse to a small information control when the driving map loads or the phone rotates.
- The credit control sits away from the speed and navigation buttons, with provider links still available on tap.

[GitHub history](https://github.com/alanchungRM/lapan-malaysia/commits/main/)

## [1.0.20] — 2026-10-26

Clear speed display and navigation controls

### Fixed

- Speed and recenter controls now share one layout, preventing them from overlapping.
- Control spacing follows the actual height of the ETA panel, including wrapped text and phone safe areas.

### Improved

- The speed readout appears first in the control stack. A compact grid keeps controls accessible in short landscape views.

[GitHub history](https://github.com/alanchungRM/lapan-malaysia/commits/main/)

## [1.0.19] — 2026-10-26

Live route planning with reported closures

### Improved

- TomTom now chooses the road path using current traffic and reported closures, rather than only estimating the arrival time on an OSRM route.
- Off-route automatic replanning also uses live routing and matching turn instructions.
- Route labels show the provider and when closures were checked at planning time.

### Added

- Explicit basic-routing fallback when the live service is unavailable, labelled road closures NOT checked.

> Coverage depends on the provider. Newly blocked or unreported roads may be missing. Closures are checked when planning or replanning; this release does not add continuous closure monitoring or a manual road-block avoidance button.
>
> A route rejected by live routing is not silently replaced with a basic route. API keys remain server-side.

[GitHub history](https://github.com/alanchungRM/lapan-malaysia/commits/main/)

## [1.0.18] — 2026-10-25

Anonymous visitor statistics

### Added

- A public Lapan in numbers page showing map-page visits, estimated active tabs, recent daily counts, and broad device/browser totals.
- A browser-local tracking opt-out and support for Do Not Track / Global Privacy Control.

> Counts start with this release and are approximate page visits, not unique people. No names, IP addresses, GPS coordinates, destinations or routes are stored by the visitor counter.

[GitHub history](https://github.com/alanchungRM/lapan-malaysia/commits/main/)

## [1.0.17] — 2026-10-25

Road numbers and exit signs in directions

### Improved

- Turn instructions include road references, signed exit numbers and signposted destinations when supplied by the routing data.
- The same information appears in navigation, the directions list and spoken guidance.
- Clearer instructions for motorway exits, entry ramps and forks; roundabout exit counts remain separate from signed highway exit numbers.

> Coverage depends on the routing map. Missing exit references are not guessed; an example exit number is not treated as verified road data.

[GitHub history](https://github.com/alanchungRM/lapan-malaysia/commits/main/)

## [1.0.16] — 2026-10-25

Add Lapan to your Home Screen

### Added

- An English illustrated guide for adding Lapan to an iPhone or Android Home Screen.
- iPhone Safari steps, Android Chrome install instructions, and a Create shortcut fallback.
- Branded Home Screen icons and a web app manifest for supported browsers.

> A shortcut may open in the browser. Internet access is still required for navigation services; there is no offline map download.

[GitHub history](https://github.com/alanchungRM/lapan-malaysia/commits/main/)

## [1.0.15] — 2026-10-25

Voice guidance your way

### Added

- Voice & sound settings with Normal, Less chatty, Alerts only and Off modes.
- Open settings before a trip or from the speaker button during navigation.
- Voice mode and navigator voice are saved only in your own browser and restored on your next visit.

### Improved

- Less chatty skips distant turn reminders and speaks within 200 metres. Alerts only announces route updates and arrival.
- Manual repeat remains available in enabled modes; Off cancels automatic speech.

> Alerts only does not provide live road-hazard alerts. Device voice availability varies, and browser storage must be available to remember preferences.

[GitHub history](https://github.com/alanchungRM/lapan-malaysia/commits/main/)

## [1.0.14] — 2026-10-25

Larger, clearer arrival estimates

### Improved

- Larger, high-contrast ETA and remaining journey time during navigation.
- Arrival estimates on route cards are easier to read.
- Navigation actions sit below the journey information on a compact card so they do not squeeze the ETA.

[GitHub history](https://github.com/alanchungRM/lapan-malaysia/commits/main/)

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
