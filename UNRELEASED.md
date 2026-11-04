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
