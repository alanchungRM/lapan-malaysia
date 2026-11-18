# Pending website release notes

- Add the official Lapan Malaysia Facebook link above the version and release history.

- Preserve production homepage and changelog indexability with canonical URLs, crawlable robots and sitemap, and SEO regression checks.
- Show report confirmation within 300 m with a visible 15-second countdown and automatic dismissal.
- Match additional-place selection and close controls to the active skin.
- Improve three-digit speedometer spacing and allow clearing the starting point independently.
- Use English Kokoro Heart by default while preserving saved voice choices, and improve routing restriction and U-turn guidance.




- Staging: record upstream Valhalla failures without route details.

The following items are recorded in GitHub CHANGELOG.md under v1.0.38, but are not yet included in the website release notes.

- Prepare alternate routing-provider support, with provider-aware guidance, traffic refreshes and existing OSRM fallback.

- fix HERE motorway and U-turn instruction handling that rejected valid car/motorcycle routes, and show specific routing failures instead of hiding them behind a generic motorcycle error.

- accept HERE middle-branch guidance at forks and motorway entries and retain the branch in English/Malay directions and voice, with regression coverage for all documented vehicle instruction types.

- calculate HERE Car toll subtotals from existing local Class 1 fare data and HERE toll-road markers. Known prices remain partial; missing prices remain unavailable. No HERE toll-pricing or extra TomTom routing requests; motorcycle toll pricing remains unavailable.

- Historical promotion baseline before Valhalla became the fallback. Retain provider controls and the motorcycle fallback restriction.


## Next public release scope

Owner approved the road-report countdown, themed place picker, clear starting point, speedometer spacing and default English voice notes. Omit routing fixes and search-indexing maintenance from the next public release announcement. Keep the expanded staging POI data and external storage/report changes excluded from production and public source. Do not increase the visible version or publish new release entries until authorized.
