# Pending website release notes

- Show saved Home and Work pins on the planning map and allow sharing from their place cards.

- Staging: match the navigation voice list to the app language and keep the current voice pinned during active guidance.

- Staging: add an optional Bahasa Melayu navigation voice, downloaded before guidance and used for both directions and alerts.

- Staging: offer Kokoro Heart as an optional English navigation voice. Prepare its audio before guidance and play each instruction as one continuous audio buffer.

- Keep driving controls in place and responsive when approaching or reaching a destination.

- Make Report and Share location directly accessible as icon buttons stacked below and sized to match the recenter control.

- Correct guidance and route geometry at a confirmed median U-turn opening.

- Staging: add Valhalla Car and Motorcycle routing with mapped toll avoidance and partial Class 1 toll estimates from the existing fare data. Fix Valhalla requests on staging and record upstream failures without route details.

- Add the official Lapan Malaysia Facebook link and a collapsible driving disclaimer to More options.

The following items are recorded in GitHub CHANGELOG.md under v1.0.38, but are not yet included in the website release notes.

- Reduce scheduled traffic checks near arrival and use a twenty-minute clear-route interval, retaining ten minutes for congestion and unknown conditions.

- Prepare alternate routing-provider support, with provider-aware guidance, traffic refreshes and existing OSRM fallback.

- fix HERE motorway and U-turn instruction handling that rejected valid car/motorcycle routes, and show specific routing failures instead of hiding them behind a generic motorcycle error.

- accept HERE middle-branch guidance at forks and motorway entries and retain the branch in English/Malay directions and voice, with regression coverage for all documented vehicle instruction types.

- calculate HERE Car toll subtotals from existing local Class 1 fare data and HERE toll-road markers. Known prices remain partial; missing prices remain unavailable. No HERE toll-pricing or extra TomTom routing requests; motorcycle toll pricing remains unavailable.

- Promote the tested staging improvements to production with TomTom primary and OSRM secondary fallback for Car routes. Align the staging status and existing visible version with production; retain provider controls and the motorcycle fallback restriction.

- Private admin report: add HERE daily request attempts and planning/rerouting/traffic-refresh totals alongside TomTom, with Malaysia date filters, separate environment counts, explicit tracking coverage and billing limitations.

- Simplify the Find my route button to text only, including after route planning finishes.

- Staging owner portal shows anonymous daily road-report and confirmation counts.

- Use Valhalla as the secondary routing provider when TomTom is unavailable.
