# Automatic route toll estimates — initial coverage

Class 1 passenger cars only. Every amount is a **partial known subtotal**, never a guaranteed full journey total. Missing fares do not mean toll-free. Costs do not affect route selection.

## Current coverage

- LDP: RM 2.10 per matched plaza at Penchala, Petaling Jaya, Puchong Barat and Puchong Selatan.
- KESAS: RM 2.00 per matched charging plaza at Kemuning, Sunway and the direction-specific Awan Besar plazas.
- Curated PLUS mapping covers 63 plazas in the North–South, NKVE and ELITE network; the exact list is in `worker/toll-data.json`. This includes Seafield, USJ, Bandar Saujana Putra, Putra Heights and the Ebor plazas. Retrieve a fare only for one unambiguous ordered entry–exit pair within 1.5 km of opposite boundaries of the same reported toll section. Provider toll-section boundaries may be on access ramps, more than 1 km from the actual booths; an actual crossing within 35 m of the mapped PLUS booth is still required. Multiple or ambiguous pairs are omitted.

Fixed standard fares checked against official operator pages on 28 October 2026. Temporary discounts/exemptions are not applied. PLUS uses the existing official fare service with a shared 30-minute cache and a 6-second automatic lookup deadline. Failure leaves the fare unavailable and does not block navigation. No new paid toll service or API secret was added.

## Matching and interface

TomTom requests `sectionType=toll` alongside traffic. Matching requires a narrow actual polyline crossing, reported toll section, compatible highway identity for fixed fares, and known one-way charging direction. Reject coarse geometry and routes starting/ending at a plaza. Match selected PLUS pairs to the same section boundaries, not the nearest plaza to a user's endpoints. Repeated passes of a plaza are not fully supported.

Collapsed details show the selected route's itemised known subtotal and sources. Planning and automatic replanning replace the estimate; a replanned estimate concerns the remaining route and excludes tolls already paid. The standalone PLUS calculator remains independent. Unknown, unsupported or ambiguous routes show unavailable, never RM 0. If PLUS use is detected but cannot be priced, the breakdown and summary explicitly show the missing PLUS component. This is not nationwide coverage.

## Sources and maintenance

- [LDP official fares](https://litrak.com.my/our-highways/litrak/toll-fares/)
- [KESAS official fares](https://kesas.com.my/toll-lane/1000/)
- [PLUS calculator](https://www.plus.com.my/)
- [LLM public plaza GIS](https://gis02.llm.gov.my/llmsmpt/rest/services/GIS_LLM/PLAZA_TOL/MapServer)

Curated records/provenance: `worker/toll-data.json`. Review current layouts, charging directions and official rates before expanding. KESAS's published Awan Besar East latitude differs from LLM; this implementation uses LLM's point. GIS snapshots can be incomplete or outdated. Conservative matching may omit a real toll; test real routes against official calculators before relying on totals.

Tests: `tests/route-tolls.mjs` covers crossing, direction, unknown metadata, ordered pairing, service failure and Worker integration. `tests/route-costs.cjs` covers collapsed presentation, sources and route-change hooks. These do not replace physical driving tests.
