# Pending website release notes

The following items are recorded in GitHub CHANGELOG.md under v1.0.38, but are not yet included in the website release notes.

- Home and Work setup: add an explicit Search more places action using the existing extended place search, with cancellation safeguards and EN/BM labels.

- Reduce scheduled traffic checks near arrival and use a twenty-minute clear-route interval, retaining ten minutes for congestion and unknown conditions.

- Prepare alternate routing-provider support, with provider-aware guidance, traffic refreshes and existing OSRM fallback.

- Staging: rename vehicle option to Car and add Motorcycle routing with TomTom/HERE, separate caches and traffic refresh modes, no car-only OSRM fallback or Class 1 toll estimates. HERE motorcycles allow highways with a 110 km/h speed cap; dedicated-lane/restriction coverage remains incomplete.

- Staging: fix HERE motorway and U-turn instruction handling that rejected valid car/motorcycle routes, and show specific routing failures instead of hiding them behind a generic motorcycle error.

- Staging: accept HERE middle-branch guidance at forks and motorway entries and retain the branch in English/Malay directions and voice, with regression coverage for all documented vehicle instruction types.
