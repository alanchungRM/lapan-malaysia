# Unreleased changes

Owner policy (27 October 2026): deploy routine fixes without changing the visible app version or publishing release notes. Only create a new numbered public release when Alan explicitly authorizes it.

- Add optional on-screen and voice alerts within 600 metres along the selected route of mapped OSM fixed speed cameras, with slow-down prompts only where a numeric, unconditional mapped speed limit is available. Country-wide OSM data is cached for 24 hours; no GPS coordinates are sent to Overpass. Coverage/direction can be incomplete; this is not a verified AES registry or a community-reporting system. Data failure is shown explicitly.
- Detect deviations using two GPS fixes and an accuracy-adjusted 40 m floor (previously 80 m); reduce the reroute cooldown from 10 to 4 seconds and GPS cache age to 1 second. Silence old instructions while off route/replanning and reject an obsolete response when the driver has moved far from its new route.
- Open Statistics in a reusable panel so returning to the map preserves its instance, chosen route and navigation runtime.
- Keep v1.0.25 and the public release history unchanged.

- Move the Statistics panel’s Back to map button to the right and hide the duplicate embedded-page return link. The standalone Statistics page retains its own return link.

- Replace the Statistics panel return button with a top-right circular × matching the toll calculator; retain an accessible Close statistics label.

- Remove the outer Statistics × and restore its header Back to map link. Intercept embedded home/return navigation in the parent and prevent the main map from loading inside the Statistics frame; provide top-level navigation fallback.

- Add a server-side TomTom business/address search fallback when Photon returns no matches or the user explicitly selects Search more places. Restrict it to Malaysia, require confirmation of secondary results, display provider credit, keep the key server-side, and handle unavailable/quota-limited service without guessing a location. No secondary requests are made on every keystroke. Existing TomTom service access and usage allowances apply.


- Improve reviewed place coverage and match common spelling, ligature and punctuation variants. Individual place names are intentionally omitted from release notes. The secondary search service currently requires Search API access for the existing credentials.

- Add collapsed automatic Class 1 route toll estimates for matched LDP/KESAS plazas and unambiguous selected PLUS pairs. Match actual route geometry, toll sections, highway identity and known one-way toll directions; retrieve PLUS fares server-side with a bounded deadline. Always label this initial coverage as partial, never show an unknown route as RM 0, and retain source/check dates. Recalculate on planning/rerouting and preserve the independent PLUS calculator. No new paid service or runtime secret is required. Standard fares exclude temporary discounts; road matching and data coverage remain limited.

- Fix missing PLUS route charges: expand curated PLUS plaza mapping, remove similarly named non-PLUS/duplicate plaza matches, and accommodate toll-section boundaries located on access ramps rather than directly at booths. Keep narrow geometry checks, require unambiguous ordered pairs, add retrieved PLUS fares to other operators' known subtotal, and explicitly flag an unresolved PLUS component. Preserve the version and public release log.
