# Unreleased changes

No pending release notes. Prayer-place improvements published under v1.0.36 without a version increase.

Staging only: adapted @dandycrypto PR #17 and #23 (head 625e6d96b7af636bf1b021afe3040bb5e48a7aa9): mapped-limit sign, amber/red speedometer, approaching lower-limit and sustained-speed warnings, optional enable switch and saved 3/5/10 km/h warning margin. Retained EN/BM, current planner/driving controls, HOT FM and prayer stops. Refreshed Malaysia OSM main-road limits; excluded conditional and directional limits unsupported by this format. Weak/off-route GPS clears limit state. No stacked skipped PRs, production change, version bump or public release log.

Staging only: adapted @dandycrypto PR #24, bundled Malaysia camera data and camera-kind labels. Retained PR #17/#23 and EN/BM. Camera browser requests use a static file; legacy /api/cameras serves the same snapshot without cache access or upstream requests. Added a compact staging v1.0.36/applied-PR indicator. Production/version/public release log unchanged.

Staging only: OSRM routing and rerouting enabled directly; TomTom routing/traffic handlers blocked before caches/upstream calls with TOMTOM_ROUTING_DISABLED=true. Existing key retained for restoration. Status strip identifies OSRM ONLY; no production/version/public log changes.

Connect bundled OSM prayer-place search to both From/To fields, including typing, with cancellation, no paid provider and fallback isolation. Apply a reviewed local mosque name/address correction verified against the licensed regional directory and official listing, preserving the existing pin. No public release log or version change.
