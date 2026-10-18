# Corridor decision: TTC 505 Dundas
Phase 01 feasibility scope: source-verified corridor, with a documented analysis-window assumption.
User-confirmed endpoints: Dundas East/Broadview Avenue and TMU Station at Yonge/Dundas. The segment starts at the intersection and does not continue to Broadview Station.

## Selected service
| Field | Decision/evidence |
| --- | --- |
| Mode and route | Streetcar; TTC 505 Dundas; GTFS route_id 505 and route_type 0 |
| Direction | **Westbound** (toward downtown); GTFS direction_id 1 |
| Service date | Friday, 2026-10-16; active services resolved from calendar and calendar_dates |
| Analysis window | 07:00–09:00 America/Toronto, selected as a reproducible AM-window assumption |
| Feed | S1000542; valid 2026-09-30 through 2026-10-31 |
| Shape used for display/length | shp-505-60 |
| Stops and links | 9 consecutive stops, 8 links |
| Segment length | 2,513.03 m, derived from the GTFS shape in EPSG:26917 |
| Scheduled entries in the window | 17 trips |
| Median scheduled headway at Broadview | 360 s (6 min) |
| Median scheduled Broadview-to-TMU time | 904 s (15 min 4 s) |

**Why westbound.** In the AM peak, riders from the new housing near River St, Regent Park Blvd and Parliament St board westbound toward downtown. They board upstream of Ontario, Sherbourne and Jarvis, so crowding they add reaches existing riders further along. Eastbound in the AM runs away from downtown and reaches the developments at the end of the segment, which cannot show that effect.

The user extended the endpoint from Jarvis to TMU Station. The nine consecutive stops include Church and Yonge/Dundas, providing the Line 1 transfer within the modelled segment.
The AM window is a modelling choice; westbound is chosen for the effect it shows, not from observed demand.
GTFS provides schedules, not observed running times, passenger counts or dwell measurements. Interpolated stop times are retained with their timepoint flags.

## Ordered stops
| seq (zero based) | GTFS stop_id | Stop |
| --- | --- | --- |
| 0 | 1756 | Broadview Ave at Dundas St East |
| 1 | 2127 | Dundas St East at River St |
| 2 | 15873 | Dundas St East at Regent Park Blvd |
| 3 | 2125 | Dundas St East at Parliament St |
| 4 | 2123 | Dundas St East at Ontario St |
| 5 | 2131 | Dundas St East at Sherbourne St |
| 6 | 2119 | Dundas St East at Jarvis St |
| 7 | 2117 | Dundas St East at Church St |
| 8 | 2136 | Dundas St East at Yonge St - TMU Station |

Westbound stops are on the opposite side of the street from the eastbound ones, so their GTFS IDs differ (for example, Jarvis is 2119 westbound and 2118 eastbound).
TTC currently calls stop 2136 [TMU Station](https://www.ttc.ca/routes-and-schedules/505/1/2136). The dated GTFS still names it Dundas Station; raw names are preserved and the stop ID anchors the transfer.
Canonical stop IDs prefix the GTFS ID with ttc-stop-. GTFS IDs remain strings.
Metric calculations use NAD83 / UTM zone 17N (EPSG:26917); display coordinates are WGS84 longitude/latitude (EPSG:4326).
The extractor rejects reversed endpoints, ambiguous segment stop patterns and stops inconsistent with the selected shape, and supports GTFS times after 24:00.
Direction and endpoints live in `data/reviewed/project_selection.json` → `corridor`, not in code.

## Boundaries and unresolved inputs
- Only westbound 505 trips serving both confirmed endpoints are included; opposite-direction and non-covering short-turn trips are excluded.
- Excluded on that rule: about 5 weekday trips per day that start at River St (shape shp-505-61), which add capacity from River St onward. 4 of them fall in the window. Include them if the simulator should see that capacity.
- Shared stops: the 504 King also serves Broadview Ave at Dundas St East, and the 506 Carlton serves Ontario, Sherbourne and Jarvis. Only the 505 is modelled, which overstates crowding at those stops.
- scheduled_trips contains entries in the selected window. Warm-up service and a clearance horizon must be added when building the production simulator.
- Incoming occupancy at Broadview Ave at Dundas St East is unknown and stored as null, not assumed to be zero.
- Riders with destinations beyond TMU Station (St Patrick and further west) must remain accounted for as beyond-segment riders; this is not a full-route simulation.
- Streetcar capacity, dwell behaviour, demand and intervention effects still require sourced values or labelled assumption ranges.
- No RapidTO bus effect has been presented as a measured 505 streetcar effect.
- The full API/simulation contract is not frozen by this feasibility work.

## Artifacts and sources
- [Reviewed corridor and dated timetable](../data/reviewed/corridor.json)
- [Ordered stop CSV](../data/reviewed/stops.csv)
- [Clipped display geometry](../data/reviewed/corridor.geojson)
- [Whole 505 route, both directions, for reference](../data/reviewed/route_505.json); rebuild with `python -m backend.scripts.export_route`
- [Source URLs, versions, retrieval times and checksums](../data/reviewed/sources.json)
- [Official TTC merged GTFS catalogue](https://open.toronto.ca/dataset/merged-gtfs-ttc-routes-and-schedules/)
