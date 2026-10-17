# Building unit inventory

The westbound 505 study catchment now has an entry for each complete, valid mapped OSM building footprint within 500 metres of a study stop. This is a map snapshot, not a guarantee that every physical building has been mapped. It records dwelling-unit capacity, not individual apartment listings, legal occupancy limits or current residents.

Start with `data/reviewed/building_unit_inventory.csv` (spreadsheet) or the matching JSON. Each row contains its OSM identity, available name/address, location, building type, footprint area, storeys, selected unit count, status, range, method, source IDs, direct source links, review flags and simulation inclusion. Missing addresses retain the stable OSM identity.

| Status | Meaning |
| --- | --- |
| published_city | Registered apartment count; official address or estimated geometry association is stated |
| published_developer | Public project count from a developer or its development investment partner; not proof of occupancy or final legal units |
| published_osm | Explicit crowdsourced building:flats value, where no stronger count was found |
| estimated_conflicting_published | A primary page gives conflicting counts; adopt their rounded midpoint and retain both endpoints |
| estimated | Residential use mapped, but no extracted posted count; estimate from footprint and storeys |
| unknown_use | Residential use is unconfirmed; provide a conditional residential estimate without adding it to simulation demand |
| not_identified_as_household_residential | Mapped shop, hotel, dormitory, campus or other use; no household-unit count assumed |
| covered_by_existing_record | Already represented by a registered property; do not add it again |

Public unit counts were extracted from City registrations and eight explicitly selected project pages: six cached HTML extractions and two manually reviewed primary-page facts (Aura and MAX). The latter are clearly marked in the manifest; their checksum covers the committed fact file, not downloaded upstream HTML. The scraper is reproducible; it does not claim to have searched every website for every property. The source manifest records URLs, retrieval dates and checksums. Additional reviewed pages can be added in `data/sources/posted_building_counts.json`; extraction fails for review if a page no longer contains the expected numeric fact. Refreshing manual facts requires explicit source review.

For example, [Grid's developer page](https://centrecourt.com/projects/grid/) posts 563 units. [Panda's page](https://lifetimedevelopments.com/project/panda/) posts both 555 and 560; the adopted 558 is explicitly estimated. [Dundas Square Gardens](https://www.guptagroup.ca/portfolio/dundas-square-gardens) posts both 968 and 1,012; its adopted 990 remains a conflict estimate. Published marketing pages can be stale, including construction status. They do not establish current occupancy. The public condominium registry forbids automated scraping, so it is not bulk scraped.

The committed snapshot has 2,444 footprints: 67 with City counts, six with non-conflicting developer/partner counts, two with conflicting posted counts, 977 residential area/storey estimates, 1,104 unknown-use records and 288 other-use records. The walking-screened handoff has 591 residential records / 30,663 modelled units, including 523 records whose adopted count is estimated. These are scenario totals, not observed housing or ridership totals.

## Estimates and uncertainty

The central estimate is `round(footprint_m2 * storeys / calibrated_gross_m2_per_unit)`, minimum one unit. Calibration uses the median area per unit from locally matched City registration counts and published storeys, excluding ambiguous shared-footprint matches and ratios outside an assumed 30–250 square metres per unit plausibility band. `building_unit_calibration.json` preserves all accepted anchors and exclusions count.

Missing storeys use the mapped local median for that building type (a two-storey fallback for small house types without samples). The assumed sensitivity range is half to twice the central estimate, rounded to whole units. It is not a statistical confidence interval. Uniform-height footprints can substantially overestimate mixed retail podiums and underestimate taller building parts. These estimates require review, especially large towers, conversions and semi-detached outlines. For unknown-use buildings this calculation is conditional on the building being residential; it is not a claim that housing exists there.

The 58 original registered rental records and their 6,269 units are preserved. Census household totals are never added on top. Registration IDs are counted once; relations replace member building ways. Geometry-to-registry matching within 50 m is an explicit approximation, not a parcel ownership join. Separate OSM outlines can still conceal shared sites or addresses; inspect flagged associations before treating the inventory as a census.

## Simulation handoff

`load_simulation_input()` automatically loads the expanded residential collection. A building enters the model only if a published/estimated residential count and a mapped walk of at most 500 m are available. Geometry representative points are estimated origins, not verified entrances. Large-building centroid connectors can cause exclusions; these remain visible in the inventory. Every entrance/crossing route still has `manual_review=pending`.

The existing occupancy, household-size and travel-share assumptions also apply to added homes. The 0.97 occupancy proxy comes from regional rental vacancy and does not measure condo or small-home occupancy. Unit-count uncertainty does not cover uncertainty in these demand assumptions. The simulation teammate retains ownership of variables and engine behaviour.

```sh
python -m backend.scripts.build_simulation_data
python -m pytest backend/tests/data -q
```

The first command rebuilds the rental baseline, then the inventory and expanded handoff. `--rental-only` explicitly restores the original narrow baseline. `python -m backend.scripts.build_building_inventory` expands the saved rental baseline without rebuilding it. Source refreshes require review. Downloads stay ignored in data/cache; reviewed numeric artifacts are committed. OSM-derived data is attributed to OpenStreetMap contributors under ODbL; City information uses the Open Government Licence – Toronto.
