# Commute demand: prototype assumptions

## Why we need this

The simulation studies the westbound 505 segment from Broadview to TMU. A neighbourhood transit share percentage does not tell us how many trips use this route, direction, or time window. Its definition and source still need checking: a share of commuters is not automatically a share of all trips.

Whole-route daily boarding totals cannot establish demand for our specific segment and hours. Transportation Tomorrow Survey (TTS) records routes used, but detailed access requires approval, which may not arrive before the hackathon.

## Proposed simplification

Use employment locations to create a small set of weighted workplace destination zones. Apply the same destination distribution to commuters from every existing housing cluster and new development. More employment in a zone means a greater chance of assigning it as a destination.

For this prototype, **assume 60% of generated commute trips in the study window are westward-oriented**, with 40% assigned to other journeys. Weight destinations within each group by employment. This 60% is an uncalibrated modelling assumption; employment concentrations alone do not establish residents' commuting directions. It is not 60% of all residents, and it is not the share boarding the 505.

The 60% split replaces the earlier idea of using Downtown's employment share to determine direction. Do not multiply the two percentages together or apply the directional split again after assigning destinations.

## The 750 m rule

Choose the workplace destination first, then apply these proposed rules using walking-route distance:

1. If the workplace is within **750 m** of home, walk directly to work.
2. Otherwise, if a useful Line 1 station is within **750 m** of home, walk to that station and continue by subway. The station must help reach the assigned workplace.
3. Otherwise, for a journey served by our westbound 505 segment, walk to an accessible stop and take the streetcar. Get off at a stop within 750 m walking distance of work, or transfer to Line 1 at TMU when that serves the destination.

Keep journeys that do not fit these options outside this simplified routing model (implicitly treating them as driving, cycling, or using other unmodelled routes) rather than forcing every remaining commuter onto the 505.

Because this reachability filter already screens out trips whose workplaces are not easily served by the 505 or Line 1, **do not also multiply generated trips by `transit_share`**. While some commuters with a feasible 505 route would choose another mode in reality, this model also omits multi-transfer trips (such as Line 2 or north–south surface bus connections) that would feed the 505. Treating all 750 m-feasible 505 trips as riders is an intentional prototype simplification rather than a calibrated mode-choice model. The 750 m cutoff itself is an assumed walking tolerance and does not compare total travel or waiting times.

## Parallel streetcar catchment split (Dundas vs. College and Queen)

Because the 500 m building inventory extends north toward the **506 College/Carlton** corridor (~580 m north of Dundas) and south toward the **501 Queen** corridor (~450 m south of Dundas), each building's north–south distance from the nearest 505 Dundas stop is expressed as a percentage of the distance to the adjacent corridor (`corridor_505_share` in `backend/simulation/commute.py`, where 50% is midway between Dundas and College or Dundas and Queen):

- **`< 40%` of the way to College or Queen:** **100%** of generated commuters use the 505 filter.
- **`40%–60%` of the way (midway buffer zone):** **50%** of generated commuters use the 505 filter, and the remaining **50%** are assumed to use the parallel 501 Queen or 506 College streetcar (ignored in this single-corridor simulation).
- **`> 60%` of the way:** **0%** use the 505 (assumed to use the closer parallel streetcar, ignored).

## What the employment data supports

The **2025 Toronto Employment Survey** reports 664,650 jobs in the City's official Downtown area out of 1,623,710 citywide: **40.9% inside Downtown and approximately 959,060 jobs (59.1%) elsewhere in Toronto**. These figures exclude surrounding municipalities and are not a count for a custom sample boundary.

Outside Downtown does not mean travelling away from our segment: someone working farther north or west could still use the 505 and transfer. Excluding such journeys can undercount demand.

Public **2021 Census workplace-tract data** can supply destination weights, with its age and pandemic-era conditions noted. Workplace weights do not establish where these particular residents work. The prototype therefore produces conditional scenarios, not a validated ridership forecast. This approach covers work commutes; school and other trips remain outside this demand model.

## Sources

The imported JSON data, quality checks and remaining implementation work are documented in [workplace-data-handoff.md](workplace-data-handoff.md).

- [Toronto Employment Survey 2025, Table 7 and page 18](https://www.toronto.ca/wp-content/uploads/2025/11/89a7-CityPlanning-Toronto-Employment-Survey-Bulletin-2025.pdf)
- [2021 Census: workers by census tract of work, Table 98-10-0492-01](https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=9810049201)
- [TTS 2022 data guide](https://dmg.utoronto.ca/wp-content/uploads/2024/12/2022TTS_Data_Guide-1.pdf) and [access registration](https://dmg.utoronto.ca/drs-access/)
