# Simulation data handoff

The data bundle now supplies every field in the teammate's current SimulationInput, using her field names without modifying backend/simulation/. The study segment is **505 westbound, Broadview/Dundas to TMU Station at Yonge/Dundas**, with nine stops. The adapter also matches her newly added clock-boundary and travel-time-variation fields.

## Load it

```python
from data.simulation_input import load_simulation_input

inputs = load_simulation_input()
# inputs is the teammate's SimulationInput, containing her Stop,
# ExistingResidences and Development objects, with fresh empty Stop queues.
```

This loads local files, with no network, database, Gemini or contract-fixture dependency. It does not run the simulator. Top-level scenario choices can be changed explicitly, for example load_simulation_input(overrides={"streetcar_capacity": 130}). Housing overrides must supply the complete replacement collection. Record overrides alongside results; the loader does not rewrite the provenance of the checked-in default bundle.

## Files

| File under data/reviewed/ | Contents |
| --- | --- |
| simulation_input.json | Full inputs plus field metadata, assumptions, evidence and unresolved limits |
| existing_residences.csv | Expanded published/estimated residential records, coordinates and input values; original 58 rentals retained |
| building_unit_inventory.json / .csv | Every mapped footprint, posted/estimated counts, ranges, methods, source links and unknowns |
| building_unit_summary.json / building_unit_calibration.json | Coverage totals and local estimation anchors |
| registered_rental_input.json | Original narrow rental baseline preserved for audit/rebuild |
| existing_housing_audit.json | Registry IDs, unit fields, official address matches, inclusion/exclusion and neighbourhoods |
| housing_context_2021.json | Neighbourhood household sizes and occupied household totals, for context only |
| travel_context_2022.json | Ward 13 resident-trip survey counts and derived shares/rates |
| simulation_walking_routes.geojson | Mapped walking routes, up to two accessible stops per included building/development |
| simulation_sources.json | Source URLs, retrieval dates, versions, licences and SHA-256 checksums |

The original corridor/development evidence remains intact. simulation_selection.json under data/sources/ records explicit scenario and development-revision decisions. Raw source documents, address queries and OSM tiles stay in ignored data/cache/.

## Values and their meaning

| Required input | Supplied value/evidence | Status |
| --- | --- | --- |
| stops | Nine GTFS stops in westbound order, Broadview 1756 to TMU 2136 | Sourced |
| existing_residences.total_units | Published counts and explicit residential estimates; 58 rentals / 6,269 units preserved as a subset | Mixed evidence; per-building status and ranges in building_unit_inventory.json |
| existing_residences.occupied_share | 0.97 | Assumed transfer of 1 minus the 2025 Toronto CMA purpose-built rental vacancy rate of 3%; not measured building occupancy |
| developments.occupied_share | 1.0 | Assumed future fully occupied scenario; no completion dates or present occupancy claim |
| residents_per_occupied_unit | Matching neighbourhood's 2021 Census mean, e.g. 1.6 in Moss Park and 2.1 in Regent Park | Neighbourhood measure transferred to buildings and future housing as an assumption |
| transit_share | 0.2980894172 | TTS 2022 Ward 13 resident AM trips by public transit, including GO-only and joint GO/transit, divided by all resident AM trips; assumed local/window transfer |
| trips_per_resident_in_window | 0.2310568468 | 41,558 AM resident trips / 119,907 residents, multiplied by 2/3 to transfer the survey's 06:00-09:00 window to 07:00-09:00 under a uniform-rate assumption |
| streetcar_capacity | 251: 70 seats plus 181 standing | TTC physical maximum; historical planned loading of 130 is a separate service quantity, not the physical limit |
| headway_s | 419.8125 seconds | Arithmetic mean of adjacent entries in the dated GTFS window; scheduled median remains 360 seconds |
| link_travel_times_s | Eight scheduled link medians | Schedule proxies may include dwell; they are not observed movement-only travel times |
| rush_hour_duration_s | 7,200 seconds | User-selected 07:00-09:00 arrival window, not the final clearance horizon |
| start_time_s / end_time_s | 25,200 / 32,400 | User-selected service-day clock bounds, 07:00 / 09:00. The current reporting cap equals the end of arrivals; later cars/riders can remain unresolved. Extend explicitly if the owner chooses a clearance horizon. |
| headway_randomness_s / commuter_distribution / seed | 0 / [1.0] / 0 | Explicit regular-service/uniform-arrival assumptions and internal seed |
| link_travel_time_variation_share | 0 | User-selected fixed-time scenario, not calibrated road variability |

TTS estimates trips by surveyed residents aged five and older. The rate above uses the published all-resident population denominator, so it is expressed per resident across all ages; it does not invent trips for children under five. Several CSV AM labels contain an 8:59 pm typo; the adjacent AM transit row explicitly specifies 08:59 am. The raw label is preserved in travel_context_2022.json's caveat. This is not an observed two-hour trip profile.

TTC's [charter capacity](https://www.ttc.ca/en/doing-business-with-the-ttc/chartering-ttc-vehicles/charter-rates) supports 251. The [carrying-capacity section](https://www.ttc.ca/transparency-and-accountability/Operating-Statistics/Operating-Statistics---2025/Conventional-System) is explicitly historical 2019 material on a 2025 statistics page and lists planned loading of 130. [CMHC's 2025 release](https://www.cmhc-schl.gc.ca/media-newsroom/news-releases/2025/canadas-vacancy-rate-rises-amid-historically-high-rental-construction) supplies the regional vacancy context. [TTS ward CSVs](https://dmg.utoronto.ca/download-tts-data/) and the City's [2021 profiles](https://open.toronto.ca/dataset/neighbourhood-profiles/) supply the demographic/travel context.

## Net-added units: preserve the revision differences

- **239-255 Dundas East: 624 adopted net units.** The internally consistent [May 2024 City decision report](https://www.toronto.ca/legdocs/mmis/2024/te/bgrd/backgroundfile-246156.pdf), pages 1-2, has 632 total units and eight existing rental homes removed. Thus 632 - 8 = 624. The October 2026 pipeline snapshot instead says 630 proposed units. Both values remain recorded. Do not silently combine that revision with the report or claim the built development's final count is verified.
- **500 Dundas East: 413 derived net units.** The [June 2026 report](https://www.toronto.ca/legdocs/mmis/2026/te/bgrd/backgroundfile-288439.pdf), pages 1 and 4-5, describes 413 proposed homes on a current sales-centre/parking site. Zero current homes is derived from that site description. Earlier demolished homes across Regent Park as a whole are not subtracted again from this present-day baseline.
- **761 Dundas East: 1,197 provisional net units.** The [official consultation](https://haveyoursay.toronto.ca/city-planning-development-review-community-consultations/761-dundas-street-east) confirms proposed units but not the existing-home count. Zero removed homes is explicitly an assumption. Historical report downloads returned 404; no replacement count is claimed to be verified from them.

## Coverage and walking review

The original registered-apartment subset is preserved, and the default handoff now expands to mapped condos and smaller homes. See [building-units.md](building-units.md) for the complete inventory, source extraction, count conflicts and estimation method. Unknown-use buildings remain conditional and excluded from demand; this is not a full observed catchment housing census. Counts are assigned once per unique registration RSN. Census neighbourhood household totals are context and are never added on top of building counts. The housing audit records exclusions rather than silently geocoding ambiguous addresses. Registry counts and coordinates do not prove current occupancy.

Candidate buildings are screened within 500 m of a corridor stop, then routed on the merged OSM pedestrian network. Motorways, construction/proposed ways and explicitly private/no-foot-access paths are excluded. Original rental origins use official municipal address points; added footprints use geometry representative points. Neither establishes a confirmed entrance. Access requires a network route plus estimated endpoint connectors totalling at most 500 m, with each connector at most 75 m. Up to two stop options are supplied; no stop is assigned solely because it is close in a straight line.

Every route has manual_review=pending. Before calling it verified, review the actual building entrance, parcel-to-sidewalk connector, legal crossing to the westbound stop, service-lane permissions, accessibility and current closures. A mapped road intersection does not prove a legal or accessible pedestrian crossing. The GeoJSON provides inspectable paths; no field inspection has been claimed.

## Observed demand and model boundaries

TTC reports **32,100 average weekday boardings for the whole 505 route in November 2025** in its [official boarding table](https://www.ttc.ca/transparency-and-accountability/Operating-Statistics/Operating-Statistics---2025/2025-Boardings). That includes both directions and the full day. It is recorded as observed route-level context, never added to the household-generated baseline or divided arbitrarily into this segment.

Observed stop-level westbound 07:00-09:00 arrivals, destinations and incoming vehicle load remain unavailable in this handoff; those fields are null, not fabricated. transit_share means all public transit, not the probability of using the 505. The simulator owner still needs corridor/direction/destination assignment, incoming loads, movement/dwell separation and a clearance rule. Buildings using the final stop can have beyond-segment trips and must not be silently lost. Do not present this partial residential scenario as a calibrated ridership forecast.

## Rebuild and check

```sh
python -m backend.scripts.build_simulation_data
python -m pytest backend/tests/data/test_simulation_data.py -q
```

The first build downloads official source documents and small OSM tiles. Later builds verify checksums and reuse caches. --refresh deliberately replaces snapshots and may require reviewing manual fact extraction and address matches. building_unit_summary.json records the expanded snapshot totals; registered_rental_input.json preserves the original 58-building subset. Counts are snapshot results, not promised future coverage.

Contains information licensed under the Open Government Licence - Toronto. Map data copyright OpenStreetMap contributors, ODbL. Other numeric extracts are attributed to TTC, CMHC and the University of Toronto Data Management Group; consult their linked terms for reuse.
