# Unreleased changes

Pending routine changes (not yet curated into a public release):

- Security headers on every response: Content-Security-Policy, HSTS, frame denial, referrer and permissions policies.
- Subresource Integrity on the Leaflet files loaded from unpkg; fonts now load through preconnected link tags instead of a CSS import.
- ETag validators with 304 responses for static files; longer caching for versioned map libraries and icons; decoded image bytes are reused between requests.
- Nearby-stop search has a per-client upstream limit; simultaneous speed-camera cache misses share one lookup.
- Speed limit sign and over-limit speedometer: the driving screen shows the mapped limit for your road, the speed chip turns amber then red when you exceed it, and Lapan speaks a spoken heads-up for limit drops and sustained speeding. Speed-camera alerts now also name the mapped road limit. Limits come from OpenStreetMap, are incomplete, and show nothing where unmapped. A Screen & navigation toggle switches the feature off.
- Optional Cloudflare `RATE_LIMITER` binding support for cross-isolate rate limiting (no effect when not configured).
