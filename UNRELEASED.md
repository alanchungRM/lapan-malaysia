# Unreleased changes

Pending routine changes (not yet curated into a public release):

- Security headers on every response: Content-Security-Policy, HSTS, frame denial, referrer and permissions policies.
- Subresource Integrity on the Leaflet files loaded from unpkg; fonts now load through preconnected link tags instead of a CSS import.
- ETag validators with 304 responses for static files; longer caching for versioned map libraries and icons; decoded image bytes are reused between requests.
- Nearby-stop search has a per-client upstream limit; simultaneous speed-camera cache misses share one lookup.
- Speed limit sign and over-limit speedometer: the driving screen shows the mapped limit for your road, the speed chip turns amber then red when you exceed it, and Lapan speaks a spoken heads-up for limit drops and sustained speeding. Speed-camera alerts now also name the mapped road limit. Limits come from OpenStreetMap, are incomplete, and show nothing where unmapped. A Screen & navigation toggle switches the feature off.
- Optional Cloudflare `RATE_LIMITER` binding support for cross-isolate rate limiting (no effect when not configured).
- Simpler planning screen: one From and To pair with Find my route directly under it, no pre-filled destination, a one-line no-login and no-GPS-trail note, and tools (toll calculator, what's new, vehicle, voice, screen and map options, install guide, about) grouped under a Menu button and a More options section. Recent places show inline once you have some.
- Calmer driving screen: voice, recentre and a More button stay on screen; 3D/2D, repeat, keep-awake and Stops appear when you tap More. A speed-camera alert replaces the limit-drop banner so only one banner shows at a time.
- Leaflet now ships with Lapan instead of loading from a public script CDN. The page no longer contacts unpkg.com, the content security policy no longer allows it, and a test checks the bundled files match the published 1.9.4 release.
- Lapan keeps opening when the network or server is struggling. A small service worker serves the last good copy of the app if the server does not answer within four seconds. Routes, traffic, search and counters are never cached, so they stay current or fail visibly.
- Help links: Report a problem opens a public GitHub issue form with only the app version filled in, and an Emergency shortcut opens your phone dialler with 999 ready (also under More while driving). Nothing is dialled until you press call, and no location is attached to a report.
- Choose how far over the limit before Lapan warns you: 3, 5 or 10 km/h (Menu, More options, Map details). The chip goes amber at your margin and red seven km/h beyond it. The choice is saved in this browser.
- Camera alerts no longer depend on a live request to a public map server. The mapped cameras ship with Lapan (293 from OpenStreetMap, refreshed when the data is regenerated), red-light cameras get their own wording, and the app states plainly that only a small share of enforcement points are mapped.
- Opt-in new look (beta): add ?ui=2 to the address, or tap Try the new look in the menu. Cleaner colours and type, accessibility-checked contrast, and day and night that switch automatically at sunrise and sunset where you are (Auto), or stay on Day or Night if you choose. The classic look stays the default and is unchanged.
- Bahasa Malaysia: an EN | BM switch in the header (and under More while driving) changes the whole app in place, including turn instructions, alerts and, when the phone has a Malay voice, spoken guidance. The first visit follows the phone's language and your choice is remembered.
- Traffic bar: each route card now shows a coloured bar of slow, heavy and stop-and-go stretches (with a pattern and plain words, never colour alone) and a one-line summary, and the selected route is coloured on the map. Shown only when live TomTom traffic data is present. English and Bahasa Malaysia.
