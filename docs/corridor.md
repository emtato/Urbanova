# Corridor decision: TTC 505 Dundas
Phase 01 feasibility scope: source-verified corridor, with a documented analysis-window assumption.
User-confirmed endpoints: Jarvis Street to Dundas East/Broadview Avenue. The segment ends at the intersection and does not continue to Broadview Station.

## Selected service
| Field | Decision/evidence |
| --- | --- |
| Mode and route | Streetcar; TTC 505 Dundas; GTFS route_id 505 and route_type 0 |
| Direction | Eastbound; GTFS direction_id 0 |
| Service date | Friday, 2026-10-16; active services resolved from calendar and calendar_dates |
| Analysis window | 07:00–09:00 America/Toronto, selected as a reproducible AM-window assumption |
| Feed | S1000542; valid 2026-09-30 through 2026-10-31 |
| Shape used for display/length | shp-505-09 |
| Stops and links | 7 consecutive stops, 6 links |
| Segment length | 1,970.54 m, derived from the GTFS shape in EPSG:26917 |
| Scheduled entries in the window | 15 trips |
| Median scheduled headway at Jarvis | 420 s (7 min) |
| Median scheduled Jarvis-to-Broadview time | 760 s (12 min 40 s) |

The confirmed endpoints produce seven stops. This deliberately replaces the original generic 8–12-stop target; the corridor was not extended to fit that target.
The AM window is a modelling choice, not evidence that eastbound is the highest-demand direction.
GTFS provides schedules, not observed running times, passenger counts or dwell measurements. Interpolated stop times are retained with their timepoint flags.

## Ordered stops
| seq (zero based) | GTFS stop_id | Stop |
| --- | --- | --- |
| 0 | 2118 | Dundas St East at Jarvis St |
| 1 | 2130 | Dundas St East at Sherbourne St |
| 2 | 2122 | Dundas St East at Ontario St |
| 3 | 2124 | Dundas St East at Parliament St |
| 4 | 15872 | Dundas St East at Regent Park Blvd |
| 5 | 2126 | Dundas St East at River St |
| 6 | 2115 | Dundas St East at Broadview Ave |

Canonical stop IDs prefix the GTFS ID with ttc-stop-. GTFS IDs remain strings.
Metric calculations use NAD83 / UTM zone 17N (EPSG:26917); display coordinates are WGS84 longitude/latitude (EPSG:4326).
The extractor rejects reversed endpoints, ambiguous segment stop patterns and stops inconsistent with the selected shape, and supports GTFS times after 24:00.

## Boundaries and unresolved inputs
- Only eastbound 505 trips serving both confirmed endpoints are included; opposite-direction and non-covering short-turn trips are excluded.
- scheduled_trips contains entries in the selected window. Warm-up service and a clearance horizon must be added when building the production simulator.
- Incoming occupancy at Jarvis is unknown and stored as null, not assumed to be zero.
- Riders with destinations beyond Broadview must remain accounted for as beyond-segment riders; this is not a full-route simulation.
- Streetcar capacity, dwell behaviour, demand and intervention effects still require sourced values or labelled assumption ranges.
- No RapidTO bus effect has been presented as a measured 505 streetcar effect.
- The full API/simulation contract is not frozen by this feasibility work.

## Artifacts and sources
- [Reviewed corridor and dated timetable](../data/reviewed/corridor.json)
- [Ordered stop CSV](../data/reviewed/stops.csv)
- [Clipped display geometry](../data/reviewed/corridor.geojson)
- [Source URLs, versions, retrieval times and checksums](../data/reviewed/sources.json)
- [Official TTC merged GTFS catalogue](https://open.toronto.ca/dataset/merged-gtfs-ttc-routes-and-schedules/)

The separate [Lawrence East study](feasibility-lawrence-east.md) is preserved for reference; this handoff follows the confirmed 505 endpoints.
