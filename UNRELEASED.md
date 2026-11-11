# Pending website release notes

- give the speed limit, current speed and driving buttons separate space in landscape.

- use the nearer mapped U-turn on Persiaran Bayu Impian 2 when the planned car route detours past it.

- show closer results for short place searches, improve branch and address matching, and show clearer address and distance details.

- make spoken navigation more conversational with rounded distances, clearer turn and exit phrasing, and a representative voice preview.

- add Faster and Avoid Tolls route preferences, with toll avoidance preserved during rerouting.

- use TomTom's standard toll-avoidance request first and ask it to route around a reported obstruction when the returned routes cross one.

- Add the official Lapan Malaysia Facebook link and a collapsible driving disclaimer to More options.

- avoid a reported blocked divider crossing while keeping the adjacent turn lanes available.

The following items are recorded in GitHub CHANGELOG.md under v1.0.38, but are not yet included in the website release notes.

- Reduce scheduled traffic checks near arrival and use a twenty-minute clear-route interval, retaining ten minutes for congestion and unknown conditions.

- Prepare alternate routing-provider support, with provider-aware guidance, traffic refreshes and existing OSRM fallback.

- Staging: fix HERE motorway and U-turn instruction handling that rejected valid car/motorcycle routes, and show specific routing failures instead of hiding them behind a generic motorcycle error.

- Staging: accept HERE middle-branch guidance at forks and motorway entries and retain the branch in English/Malay directions and voice, with regression coverage for all documented vehicle instruction types.

- Staging: calculate HERE Car toll subtotals from existing local Class 1 fare data and HERE toll-road markers. Known prices remain partial; missing prices remain unavailable. No HERE toll-pricing or extra TomTom routing requests; motorcycle toll pricing remains unavailable.

- Promote the tested staging improvements to production with TomTom primary and OSRM secondary fallback for Car routes. Align the staging status and existing visible version with production; retain provider controls and the motorcycle fallback restriction.

- Simplify the Find my route button to text only, including after route planning finishes.
