# Building heights, proposal masses, sun positions and shadows
Data for the 3D map and shadow views. Rebuild with `python -m backend.scripts.build_massing` after `build_building_inventory`, then `python -m backend.scripts.build_shadows`.

## Files
| File | Contents |
| --- | --- |
| `data/reviewed/buildings_3d.geojson` | 2,444 existing buildings (same `building_id` as `building_unit_inventory.json`) plus 4 proposal tower masses, as EPSG:4326 polygons with heights |
| `data/reviewed/sun_positions.json` | Sun altitude/azimuth every 15 minutes, 05:00–21:00 local, on the 21st of each month and the solstices/equinoxes |
| `data/reviewed/shadows.geojson` | Ground shadows today, plus shadow added and removed by the proposals, at 12 preset times (see Shadows) |

For MapLibre, use `buildings_3d.geojson` directly as a `fill-extrusion` source: `fill-extrusion-base` = `base_height_m`, `fill-extrusion-height` = `height_m`. Filter or style on `kind` (`existing` / `proposed`) and `on_proposal_site` to toggle a proposal on and off.

## Field reference: `buildings_3d.geojson`
A standard GeoJSON `FeatureCollection` with one extra top-level `metadata` object. Each building is one `Feature`, so every building can be looked up on its own.

```json
{
  "type": "FeatureCollection",
  "metadata": { "...": "summary, definitions and sources (below)" },
  "features": [
    {
      "type": "Feature",
      "geometry": {"type": "Polygon", "coordinates": [[[-79.379445, 43.653466], [-79.379543, 43.653415], "..."]]},
      "properties": {"building_id": "osm-way-104934501", "name": "Massey Tower", "height_m": 178.2, "...": "..."}
    }
  ]
}
```

### `geometry`: the building outline
The footprint seen from above, as a GeoJSON `Polygon` in EPSG:4326.

- Each point is `[longitude, latitude]`. **Longitude comes first**, the reverse of the "lat, lng" order Google Maps shows. Toronto is around longitude −79.4 (negative = west) and latitude 43.65.
- `coordinates` has three levels: a point `[lon, lat]`; a ring of points tracing the outline; and the list of rings. The first ring is the outer edge; any further rings are holes such as courtyards.
- The last point of each ring repeats the first, which closes the shape.
- Coordinates are rounded to 6 decimals, about 0.1 m.

To see the shapes, drag the file into [geojson.io](https://geojson.io).

### `properties` on existing buildings (`kind: "existing"`, 2,444 features)
| Field | Type | Meaning |
| --- | --- | --- |
| `building_id` | string | Stable OSM identity, `osm-way-<id>` or `osm-relation-<id>`. Same ID as `building_unit_inventory.json`, so unit counts and heights join on it. Always present. |
| `kind` | string | `existing` |
| `name` | string | OSM building name; `""` when unmapped (219 of 2,444 have one) |
| `address` | string | OSM address; `""` when unmapped (502 of 2,444 have one) |
| `building_type` | string | OSM `building` tag, e.g. `apartments`, `detached`, `retail`, `church`. `yes` means mapped as a building with no type (1,136). |
| `footprint_m2` | number | Footprint area in square metres |
| `storeys` | number | Storeys from the inventory, used only when no City height exists |
| `storeys_status` | string | `osm_posted` (tagged in OSM) or `assumed_local_type_median` (median for that building type nearby) |
| `height_m` | number | **Height to extrude.** Area-weighted average roof height above ground, in metres |
| `max_height_m` | number | Tallest roof of City massing parts that substantially overlap the footprint. Context only (see Heights) |
| `min_roof_height_m` | number or null | Lowest roof among those parts; null for estimated heights |
| `base_height_m` | number | Where the extrusion starts; always 0 |
| `height_status` | string | `measured_city_massing`, `partial_city_massing`, `estimated_from_osm_storeys` or `estimated_from_assumed_storeys` (see Heights) |
| `height_source` | string or null | How the City measured it: `Lidar-Derived`, `Site Plan`, `3D Model` or `Oblique Aerials`; null when estimated |
| `massing_coverage_share` | number | Share of the footprint covered by City massing, 0–1 |
| `shadow_at_solar_noon_m` | object | Flat-ground shadow length in metres at solar noon on `spring_equinox`, `summer_solstice` and `winter_solstice` |
| `on_proposal_site` | string or null | The `dev_id` of a proposal whose address point lies on this building; hide it when that proposal is shown |
| `included_in_simulation` | boolean | Whether the transit simulation counts this building's homes (589 do) |
| `source_ids` | list | `osm-housing` (outline) plus `toronto-3d-massing-2025` when the height is measured |
| `source_url` | string | The building's OpenStreetMap page |

### `properties` on proposal masses (`kind: "proposed"`, 4 features)
| Field | Type | Meaning |
| --- | --- | --- |
| `building_id` | string | `<dev_id>-tower-<n>`; 761 Dundas has towers 1 and 2 |
| `kind` | string | `proposed` |
| `dev_id` | string | Development ID, as in `developments.csv` |
| `application_number` | string | City application number |
| `address` | string | Application address |
| `storeys` | number | Storeys stated in the application description |
| `storeys_status` | string | `application_description` |
| `height_m`, `max_height_m` | number | Storeys × 3.0 m |
| `base_height_m` | number | 0 |
| `height_status` | string | `assumed_from_application_storeys` |
| `footprint_m2` | number | Assumed footprint area per tower |
| `footprint_status` | string | `assumed_square_from_total_gfa_per_storey` |
| `shadow_at_solar_noon_m` | object | As for existing buildings |
| `label` | string | Text to show next to the mass: simplified, not an approved design |
| `source_ids` | list | Development Pipeline, address point and related sources |
| `source_url` | string | City application page (AIC) |

Existing-only fields (`name`, `building_type`, `on_proposal_site` and so on) are absent from proposal features, and proposal-only fields are absent from existing ones.

### `metadata`
| Field | Meaning |
| --- | --- |
| `corridor_id` | Corridor the inventory was built around |
| `building_count`, `proposal_mass_count` | 2,444 and 4 |
| `height_status_counts` | Number of buildings per `height_status` |
| `storey_height_m`, `storey_height_status` | 3.0 m per storey, `assumed` |
| `coverage_thresholds` | City coverage needed for `measured` (0.5) and `partial` (0.2) |
| `height_definition`, `shadow_definition`, `interpretation` | Plain-language definitions to show alongside the data |
| `sources` | Source records (URL, retrieval time, checksum, licence) for the City massing and the OSM tiles |

## Field reference: `sun_positions.json`
The sun's position is effectively the same across the 2 km study area, so this file is shared by all buildings rather than stored per building.

```json
{
  "location": {"lat": 43.659284, "lon": -79.367188},
  "timezone": "America/Toronto",
  "days": [
    {
      "label": "2026-01-21", "date": "2026-01-21",
      "solar_noon_local": "12:28", "solar_noon_altitude_deg": 26.56,
      "positions": [
        {"local_time": "08:15", "utc_offset": "-0500", "altitude_deg": 4.02, "azimuth_deg": 122.48,
         "sun_up": true, "shadow_length_per_metre": 14.225}
      ]
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `location` | Point the positions are computed for (centre of the inventory) |
| `timezone`, `method`, `azimuth_convention`, `shadow_length_per_metre` | Text definitions |
| `days[]` | 16 days: the 21st of each month (`label` like `2026-01-21`) plus `spring_equinox`, `summer_solstice`, `autumn_equinox`, `winter_solstice` |
| `days[].date` | ISO date |
| `days[].solar_noon_local` | Local clock time when the sun is highest (daylight time applied) |
| `days[].solar_noon_altitude_deg` | Sun height at solar noon |
| `days[].positions[]` | 65 entries every 15 minutes from 05:00 to 21:00 local |
| `positions[].local_time`, `utc_offset` | Local clock time and its UTC offset (`-0400` in daylight time, `-0500` in standard time) |
| `positions[].altitude_deg` | Sun height above the horizon in degrees; negative means below it |
| `positions[].azimuth_deg` | Compass direction of the sun, clockwise from north (90 east, 180 south, 270 west) |
| `positions[].sun_up` | `altitude_deg > 0` |
| `positions[].shadow_length_per_metre` | Shadow length per metre of height; null when the sun is down |

### Worked example: one building's shadow at a given time
Massey Tower (`height_m` 178.2) on 21 January at 08:15:

- **Length:** 178.2 × 14.225 ≈ 2,535 m. Low morning sun makes very long shadows.
- **Direction:** 122.48 + 180 = 302.48°, which points west-northwest.

## Heights
| `height_status` | Count | Meaning |
| --- | --- | --- |
| `measured_city_massing` | 2,347 | City 3D Massing covers at least half the footprint |
| `partial_city_massing` | 10 | City massing covers 20–50% of the footprint |
| `estimated_from_osm_storeys` | 35 | No City coverage; OSM-posted storeys × 3.0 m |
| `estimated_from_assumed_storeys` | 52 | No City coverage; the inventory's assumed storeys × 3.0 m |

- `height_m` is the area-weighted average roof height above ground from the City parts that overlap the OSM footprint. Use it for extrusion.
- `max_height_m` is the tallest roof among City parts that substantially overlap the footprint. One City part can span a podium and a tower mapped as separate OSM buildings (for example Aura and 384 Yonge St), so treat it as context.
- City heights come from 2015 LiDAR, building-permit site plans or developer 3D models (`height_source`). Buildings finished after the data's vintage may be missing or estimated.
- 3.0 m per storey is an assumption. Where City heights and OSM-posted storeys both exist (295 buildings of 3+ storeys), the median is 3.13 m per storey, with a 10th–90th percentile range of 2.26–4.93 m.

## Proposal masses
Each proposal is a box, not a design. Storeys and tower counts come from the application description; the footprint is a square whose area is total GFA ÷ storeys ÷ towers, centred on the City address point. Height is storeys × 3.0 m.

| Application | Address | Storeys | Towers | Height | Footprint per tower |
| --- | --- | --- | --- | --- | --- |
| 22 124214 STE 13 OZ | 239 Dundas St E | 52 | 1 | 156 m | 707 m² |
| 26 122451 STE 13 OZ | 500 Dundas St E | 35 | 1 | 105 m | 804 m² |
| 25 236949 STE 13 OZ | 761 Dundas St E | 48 | 2 | 144 m | 784 m² |

The two 761 towers are placed side by side east–west, 20 m apart. Their real arrangement, podiums and setbacks are unknown. Existing buildings containing a proposal's address point carry `on_proposal_site` so the map can hide them when the proposal is shown.

## Sunlight
- Positions use the NOAA solar equations at the inventory's centre, in America/Toronto time (daylight time is applied). Refraction is ignored.
- Azimuth is clockwise from true north; a shadow points to azimuth + 180°. `shadow_length_per_metre` × building height gives the flat-ground shadow length.
- Each building also has `shadow_at_solar_noon_m` for the spring equinox, summer solstice and winter solstice. At winter solstice noon the sun is 22.9° high, so shadows are about 2.4 × the building height.
- These are flat-ground shadow lengths only. For the shaded areas themselves, use `shadows.geojson` below.

## Shadows: `shadows.geojson`
MapLibre's `fill-extrusion` lights building walls but does not cast shadows, so shadows are precomputed as flat polygons the map can draw as ordinary `fill` layers under the buildings.

**Method.** Each building is a flat-roofed prism at `height_m`. Its shadow is the footprint swept along the shadow direction (azimuth + 180°) for `height_m / tan(sun altitude)` metres, on flat ground. Shadows are merged, building footprints are removed (only open ground is shaded) and the result is clipped to the inventory's bounding box. The code is `data/sources/shadows.py`.

**Three layers per time**, in feature property `layer`:

| Layer | Meaning | Map styling idea |
| --- | --- | --- |
| `today` | Open ground shaded by existing buildings | Grey |
| `added` | Sunny today, shaded once the proposals are built | Orange: sunlight lost |
| `removed` | Shaded today, sunny once buildings on the proposal sites are cleared | Green: sunlight gained |

The view with the proposals is `today` + `added` − `removed`, so there is no separate layer for it. To show it, draw `today`, then `removed` in the sunny ground colour, then `added`. Ground under a building in either scenario is excluded from `added` and `removed`.

**Why these layers.** The comparison residents need is with versus without the proposals at the same date and time. `added` and `removed` answer it directly, so the map doesn't have to subtract polygons. Showing `removed` keeps gains alongside losses, as the product description asks.

**Times.** The spring equinox (20 March), summer solstice (21 June) and winter solstice (21 December), each at 09:00, 12:00, 15:00 and 18:00 local. On 21 December at 18:00 the sun is down, so that time has no features. Its entry in `metadata.times` has `sun_up: false`. For other times, run:

```sh
python -m backend.scripts.build_shadows --at 2026-12-21T15:30 2026-07-01T08:00
```

**Feature properties.**

| Field | Meaning |
| --- | --- |
| `layer` | `today`, `added` or `removed` |
| `label` | `spring_equinox`, `summer_solstice`, `winter_solstice` or `custom` |
| `local_time`, `utc_offset` | Toronto local time (`YYYY-MM-DDTHH:MM`) and its UTC offset |
| `sun_altitude_deg`, `sun_azimuth_deg` | Sun position used |
| `area_m2` | Area of this layer in square metres |

`metadata.times` lists every time with `today_m2`, `added_m2` and `removed_m2`, which are useful for a text summary. For example: at the winter solstice at 09:00, the proposals add about 32,800 m² of shadow on open ground across the area.

**File details.** Geometries are `MultiPolygon` in EPSG:4326, simplified by 0.5 m and snapped to 6 decimals, and all are valid. The file is written without indentation to stay small (about 7 MB; almost all of it is the `today` layer).

**Accuracy and limits.**
- Directions and lengths are geometrically correct for the stated heights and sun positions.
- Ground is treated as flat; slopes towards the Don River lengthen or shorten real shadows.
- Each building is one flat-roofed prism at its average roof height, so towers on podiums are approximated.
- Shadows falling on walls and roofs are not shown.
- Proposal masses are simplified boxes, so their shadows are indicative, not a design study.
- Trees and canopies are not modelled.
- Near the edges of the clip box, shadows from buildings outside the inventory are missing.

Good enough to show roughly which areas lose sun and when, with and without the proposals. Not precise enough for a single spot at an exact minute.

## Sources
- [City of Toronto 3D Massing](https://open.toronto.ca/dataset/3d-massing/), 2025 shapefile (DBF updated 2025-12-02), Open Government Licence – Toronto. Downloaded to ignored `data/raw/`.
- OpenStreetMap building footprints from the same cached tiles as the building inventory (ODbL).
- Proposal storeys and GFA: City Development Pipeline application records.
