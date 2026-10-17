// Generated from data/fixtures/sample_comparison.json; do not edit.
import type { Comparison } from "./types"

export const sampleComparison = {
  "contract_version": "1.0.0",
  "comparison_id": "fixture-505-broadview-tmu",
  "fixture": true,
  "product_label": "scenario experiment",
  "scenario": {
    "scenario_id": "fixture-505-west-tmu",
    "version": 1,
    "developments": [
      {
        "dev_id": "toronto-app-22-124214-ste-13-oz",
        "pipeline_ref": "22 124214 STE 13 OZ",
        "address": "239 DUNDAS ST E",
        "units": 630,
        "stage": "Active",
        "record_date": "2022-03-18",
        "kind": "proposal",
        "footprint": null,
        "footprint_status": "unavailable",
        "access": [
          {
            "stop_id": "ttc-stop-2119",
            "walk_m": 271.7,
            "status": "estimated",
            "source_ids": [
              "toronto-development-pipeline",
              "toronto-address-796104",
              "ttc-gtfs",
              "osm-walk-239"
            ]
          }
        ],
        "source_ids": [
          "toronto-development-pipeline",
          "toronto-address-796104",
          "ttc-gtfs",
          "osm-walk-239"
        ]
      },
      {
        "dev_id": "toronto-app-26-122451-ste-13-oz",
        "pipeline_ref": "26 122451 STE 13 OZ",
        "address": "500 DUNDAS ST E",
        "units": 413,
        "stage": "Under Review",
        "record_date": "2026-02-27",
        "kind": "proposal",
        "footprint": null,
        "footprint_status": "unavailable",
        "access": [
          {
            "stop_id": "ttc-stop-2125",
            "walk_m": 229.13,
            "status": "estimated",
            "source_ids": [
              "toronto-development-pipeline",
              "toronto-address-30009862",
              "ttc-gtfs",
              "osm-walk-500"
            ]
          }
        ],
        "source_ids": [
          "toronto-development-pipeline",
          "toronto-address-30009862",
          "ttc-gtfs",
          "osm-walk-500"
        ]
      },
      {
        "dev_id": "toronto-app-25-236949-ste-13-oz",
        "pipeline_ref": "25 236949 STE 13 OZ",
        "address": "761 DUNDAS ST E",
        "units": 1197,
        "stage": "Under Review",
        "record_date": "2025-10-08",
        "kind": "proposal",
        "footprint": null,
        "footprint_status": "unavailable",
        "access": [
          {
            "stop_id": "ttc-stop-2127",
            "walk_m": 269.63,
            "status": "estimated",
            "source_ids": [
              "toronto-development-pipeline",
              "toronto-address-7667205",
              "ttc-gtfs",
              "osm-walk-761"
            ]
          }
        ],
        "source_ids": [
          "toronto-development-pipeline",
          "toronto-address-7667205",
          "ttc-gtfs",
          "osm-walk-761"
        ]
      }
    ],
    "phases": [
      {
        "phase_id": "phase-1",
        "year": 2030,
        "development_ids": [
          "toronto-app-22-124214-ste-13-oz",
          "toronto-app-26-122451-ste-13-oz",
          "toronto-app-25-236949-ste-13-oz"
        ],
        "occupied_share": 0.5
      }
    ],
    "demand_case": "central",
    "interventions": [
      {
        "id": "fixture-extra-service",
        "type": "extra_service",
        "link_ids": [],
        "headway_s": 30,
        "capital_cost": {
          "low": 0,
          "central": 0,
          "high": 0,
          "currency": "CAD",
          "price_year": 2026,
          "scope": "Fixture assumes an existing spare vehicle; excludes vehicle purchase.",
          "unit": "CAD",
          "status": "assumed",
          "source_ids": []
        },
        "operating_cost": {
          "low": 80000,
          "central": 100000,
          "high": 120000,
          "currency": "CAD",
          "price_year": 2026,
          "scope": "Invented annual incremental operating cost for contract testing only.",
          "unit": "CAD/year",
          "status": "assumed",
          "source_ids": []
        },
        "extra_vehicles": 1,
        "earliest_phase": "phase-1",
        "effect": {
          "key": "extra_service_headway",
          "unit": "s",
          "meaning": "Fixture dispatches 0/30/60 instead of 0/60; no fleet-cycle feasibility claim.",
          "low": 30,
          "central": 30,
          "high": 60,
          "allowed_range": {
            "low": 1,
            "high": 1800
          },
          "status": "assumed",
          "source_ids": []
        }
      }
    ],
    "intervention_availability": {
      "fixture-extra-service": "phase-1"
    },
    "capital_budget_cad": 0,
    "annual_operating_budget_cad": 120000,
    "budget_price_year": 2026,
    "fleet_allowance": 1,
    "planning_criterion": {
      "max_p95_wait_s": 300,
      "max_denied_share": 0.65,
      "max_unresolved_passengers": 0,
      "meaning": "Illustrative criterion applied to every run; not a TTC service standard."
    }
  },
  "corridor": {
    "corridor_id": "ttc-505-west-broadview-tmu",
    "route_pattern": "505:1:shp-505-60",
    "mode": "streetcar",
    "direction": "westbound",
    "crs": "EPSG:4326",
    "metric_crs": "EPSG:26917",
    "peak_window": {
      "start_s": 25200,
      "end_s": 32400,
      "timezone": "America/Toronto",
      "service_date": "2026-10-16"
    },
    "stops": [
      {
        "stop_id": "ttc-stop-1756",
        "gtfs_stop_id": "1756",
        "name": "Broadview Ave at Dundas St East",
        "seq": 0,
        "lon": -79.351506,
        "lat": 43.6626,
        "source_ids": [
          "ttc-gtfs"
        ]
      },
      {
        "stop_id": "ttc-stop-2127",
        "gtfs_stop_id": "2127",
        "name": "Dundas St East at River St",
        "seq": 1,
        "lon": -79.358,
        "lat": 43.661284,
        "source_ids": [
          "ttc-gtfs"
        ]
      },
      {
        "stop_id": "ttc-stop-15873",
        "gtfs_stop_id": "15873",
        "name": "Dundas St East at Regent Park Blvd",
        "seq": 2,
        "lon": -79.361739,
        "lat": 43.66045,
        "source_ids": [
          "ttc-gtfs"
        ]
      },
      {
        "stop_id": "ttc-stop-2125",
        "gtfs_stop_id": "2125",
        "name": "Dundas St East at Parliament St",
        "seq": 3,
        "lon": -79.365882,
        "lat": 43.65951,
        "source_ids": [
          "ttc-gtfs"
        ]
      },
      {
        "stop_id": "ttc-stop-2123",
        "gtfs_stop_id": "2123",
        "name": "Dundas St East at Ontario St",
        "seq": 4,
        "lon": -79.368357,
        "lat": 43.658961,
        "source_ids": [
          "ttc-gtfs"
        ]
      },
      {
        "stop_id": "ttc-stop-2131",
        "gtfs_stop_id": "2131",
        "name": "Dundas St East at Sherbourne St",
        "seq": 5,
        "lon": -79.370878,
        "lat": 43.658406,
        "source_ids": [
          "ttc-gtfs"
        ]
      },
      {
        "stop_id": "ttc-stop-2119",
        "gtfs_stop_id": "2119",
        "name": "Dundas St East at Jarvis St",
        "seq": 6,
        "lon": -79.374377,
        "lat": 43.657162,
        "source_ids": [
          "ttc-gtfs"
        ]
      },
      {
        "stop_id": "ttc-stop-2117",
        "gtfs_stop_id": "2117",
        "name": "Dundas St East at Church St",
        "seq": 7,
        "lon": -79.376993,
        "lat": 43.656583,
        "source_ids": [
          "ttc-gtfs"
        ]
      },
      {
        "stop_id": "ttc-stop-2136",
        "gtfs_stop_id": "2136",
        "name": "Dundas St East at Yonge St - Dundas Station",
        "seq": 8,
        "lon": -79.380755,
        "lat": 43.656426,
        "source_ids": [
          "ttc-gtfs"
        ]
      }
    ],
    "links": [
      {
        "link_id": "ttc-505-west-broadview-tmu-link-1",
        "from_stop": "ttc-stop-1756",
        "to_stop": "ttc-stop-2127",
        "length_m": 551.76,
        "base_time_s": 175,
        "source_ids": [
          "ttc-gtfs"
        ]
      },
      {
        "link_id": "ttc-505-west-broadview-tmu-link-2",
        "from_stop": "ttc-stop-2127",
        "to_stop": "ttc-stop-15873",
        "length_m": 315.45,
        "base_time_s": 90,
        "source_ids": [
          "ttc-gtfs"
        ]
      },
      {
        "link_id": "ttc-505-west-broadview-tmu-link-3",
        "from_stop": "ttc-stop-15873",
        "to_stop": "ttc-stop-2125",
        "length_m": 350.06,
        "base_time_s": 104,
        "source_ids": [
          "ttc-gtfs"
        ]
      },
      {
        "link_id": "ttc-505-west-broadview-tmu-link-4",
        "from_stop": "ttc-stop-2125",
        "to_stop": "ttc-stop-2123",
        "length_m": 209.84,
        "base_time_s": 85,
        "source_ids": [
          "ttc-gtfs"
        ]
      },
      {
        "link_id": "ttc-505-west-broadview-tmu-link-5",
        "from_stop": "ttc-stop-2123",
        "to_stop": "ttc-stop-2131",
        "length_m": 213.47,
        "base_time_s": 85,
        "source_ids": [
          "ttc-gtfs"
        ]
      },
      {
        "link_id": "ttc-505-west-broadview-tmu-link-6",
        "from_stop": "ttc-stop-2131",
        "to_stop": "ttc-stop-2119",
        "length_m": 333.3,
        "base_time_s": 136,
        "source_ids": [
          "ttc-gtfs"
        ]
      },
      {
        "link_id": "ttc-505-west-broadview-tmu-link-7",
        "from_stop": "ttc-stop-2119",
        "to_stop": "ttc-stop-2117",
        "length_m": 221.49,
        "base_time_s": 89,
        "source_ids": [
          "ttc-gtfs"
        ]
      },
      {
        "link_id": "ttc-505-west-broadview-tmu-link-8",
        "from_stop": "ttc-stop-2117",
        "to_stop": "ttc-stop-2136",
        "length_m": 317.66,
        "base_time_s": 140,
        "source_ids": [
          "ttc-gtfs"
        ]
      }
    ],
    "berths_per_stop": {
      "ttc-stop-1756": 1,
      "ttc-stop-2127": 1,
      "ttc-stop-15873": 1,
      "ttc-stop-2125": 1,
      "ttc-stop-2123": 1,
      "ttc-stop-2131": 1,
      "ttc-stop-2119": 1,
      "ttc-stop-2117": 1,
      "ttc-stop-2136": 1
    },
    "incoming_load": {
      "key": "incoming_load",
      "unit": "passengers/vehicle",
      "meaning": "Fixture cars enter empty; actual Broadview occupancy is unknown.",
      "low": 0,
      "central": 0,
      "high": 0,
      "allowed_range": {
        "low": 0,
        "high": 300
      },
      "status": "assumed",
      "source_ids": []
    },
    "source_ids": [
      "ttc-gtfs"
    ]
  },
  "cases": [
    {
      "case_id": "fixture-current",
      "kind": "current",
      "package_id": "baseline",
      "phase_id": "phase-1",
      "demand_case": "central",
      "stops": [
        {
          "stop_id": "ttc-stop-1756",
          "rider_group": "existing",
          "passengers": 5,
          "completed_passengers": 5,
          "mean_wait_s": 12,
          "p95_wait_s": 60,
          "denied_at_least_once_share": 0.2,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-1756",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2127",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2127",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-15873",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-15873",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2125",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2125",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2123",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2123",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2131",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2131",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2119",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2119",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2117",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2117",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2136",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2136",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        }
      ],
      "runs": [
        {
          "run_id": "fixture-run-current",
          "scenario_version": 1,
          "package": "baseline",
          "model_version": "hand-fixture-v1",
          "data_version": "ttc-S1000542-505-west-tmu-pipeline-20261008",
          "seed_ids": [
            0
          ],
          "status": "completed",
          "diagnostics": {
            "passengers_created": 5,
            "passengers_arrived": 5,
            "passengers_waiting": 0,
            "passengers_onboard": 0,
            "conservation": true,
            "unresolved_passengers": 0,
            "runtime_s": 0
          }
        }
      ],
      "per_run_mean_wait_s": [
        12.0
      ],
      "per_run_p95_wait_s": [
        60
      ],
      "per_run_denied_share": [
        0.2
      ],
      "per_run_unresolved_passengers": [
        0
      ],
      "run_count": 1,
      "unresolved_passengers": 0
    },
    {
      "case_id": "fixture-growth",
      "kind": "growth",
      "package_id": "baseline",
      "phase_id": "phase-1",
      "demand_case": "central",
      "stops": [
        {
          "stop_id": "ttc-stop-1756",
          "rider_group": "existing",
          "passengers": 5,
          "completed_passengers": 5,
          "mean_wait_s": 12,
          "p95_wait_s": 60,
          "denied_at_least_once_share": 0.2,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-1756",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2127",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2127",
          "rider_group": "new",
          "passengers": 5,
          "completed_passengers": 3,
          "mean_wait_s": 235,
          "p95_wait_s": 235,
          "denied_at_least_once_share": 1,
          "remaining_queue": 2,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-15873",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-15873",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2125",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2125",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2123",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2123",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2131",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2131",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2119",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2119",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2117",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2117",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2136",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2136",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        }
      ],
      "runs": [
        {
          "run_id": "fixture-run-growth",
          "scenario_version": 1,
          "package": "baseline",
          "model_version": "hand-fixture-v1",
          "data_version": "ttc-S1000542-505-west-tmu-pipeline-20261008",
          "seed_ids": [
            0
          ],
          "status": "completed",
          "diagnostics": {
            "passengers_created": 10,
            "passengers_arrived": 8,
            "passengers_waiting": 2,
            "passengers_onboard": 0,
            "conservation": true,
            "unresolved_passengers": 2,
            "runtime_s": 0
          }
        }
      ],
      "per_run_mean_wait_s": [
        95.625
      ],
      "per_run_p95_wait_s": [
        235
      ],
      "per_run_denied_share": [
        0.6
      ],
      "per_run_unresolved_passengers": [
        2
      ],
      "run_count": 1,
      "unresolved_passengers": 2
    },
    {
      "case_id": "fixture-supported_growth",
      "kind": "supported_growth",
      "package_id": "extra-service",
      "phase_id": "phase-1",
      "demand_case": "central",
      "stops": [
        {
          "stop_id": "ttc-stop-1756",
          "rider_group": "existing",
          "passengers": 5,
          "completed_passengers": 5,
          "mean_wait_s": 6,
          "p95_wait_s": 30,
          "denied_at_least_once_share": 0.2,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-1756",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2127",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2127",
          "rider_group": "new",
          "passengers": 5,
          "completed_passengers": 5,
          "mean_wait_s": 217.0,
          "p95_wait_s": 235,
          "denied_at_least_once_share": 1,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-15873",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-15873",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2125",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2125",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2123",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2123",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2131",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2131",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2119",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2119",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2117",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2117",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2136",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2136",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        }
      ],
      "runs": [
        {
          "run_id": "fixture-run-supported_growth",
          "scenario_version": 1,
          "package": "extra-service",
          "model_version": "hand-fixture-v1",
          "data_version": "ttc-S1000542-505-west-tmu-pipeline-20261008",
          "seed_ids": [
            0
          ],
          "status": "completed",
          "diagnostics": {
            "passengers_created": 10,
            "passengers_arrived": 10,
            "passengers_waiting": 0,
            "passengers_onboard": 0,
            "conservation": true,
            "unresolved_passengers": 0,
            "runtime_s": 0
          }
        }
      ],
      "per_run_mean_wait_s": [
        111.5
      ],
      "per_run_p95_wait_s": [
        235
      ],
      "per_run_denied_share": [
        0.6
      ],
      "per_run_unresolved_passengers": [
        0
      ],
      "run_count": 1,
      "unresolved_passengers": 0
    },
    {
      "case_id": "fixture-current-low",
      "kind": "current",
      "package_id": "baseline",
      "phase_id": "phase-1",
      "demand_case": "low",
      "stops": [
        {
          "stop_id": "ttc-stop-1756",
          "rider_group": "existing",
          "passengers": 5,
          "completed_passengers": 5,
          "mean_wait_s": 12,
          "p95_wait_s": 60,
          "denied_at_least_once_share": 0.2,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-1756",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2127",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2127",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-15873",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-15873",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2125",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2125",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2123",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2123",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2131",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2131",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2119",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2119",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2117",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2117",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2136",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2136",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        }
      ],
      "runs": [
        {
          "run_id": "fixture-run-current-low",
          "scenario_version": 1,
          "package": "baseline",
          "model_version": "hand-fixture-v1",
          "data_version": "ttc-S1000542-505-west-tmu-pipeline-20261008",
          "seed_ids": [
            0
          ],
          "status": "completed",
          "diagnostics": {
            "passengers_created": 5,
            "passengers_arrived": 5,
            "passengers_waiting": 0,
            "passengers_onboard": 0,
            "conservation": true,
            "unresolved_passengers": 0,
            "runtime_s": 0
          }
        }
      ],
      "per_run_mean_wait_s": [
        12.0
      ],
      "per_run_p95_wait_s": [
        60
      ],
      "per_run_denied_share": [
        0.2
      ],
      "per_run_unresolved_passengers": [
        0
      ],
      "run_count": 1,
      "unresolved_passengers": 0
    },
    {
      "case_id": "fixture-growth-low",
      "kind": "growth",
      "package_id": "baseline",
      "phase_id": "phase-1",
      "demand_case": "low",
      "stops": [
        {
          "stop_id": "ttc-stop-1756",
          "rider_group": "existing",
          "passengers": 5,
          "completed_passengers": 5,
          "mean_wait_s": 12,
          "p95_wait_s": 60,
          "denied_at_least_once_share": 0.2,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-1756",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2127",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2127",
          "rider_group": "new",
          "passengers": 3,
          "completed_passengers": 3,
          "mean_wait_s": 235,
          "p95_wait_s": 235,
          "denied_at_least_once_share": 1,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-15873",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-15873",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2125",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2125",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2123",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2123",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2131",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2131",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2119",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2119",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2117",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2117",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2136",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2136",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        }
      ],
      "runs": [
        {
          "run_id": "fixture-run-growth-low",
          "scenario_version": 1,
          "package": "baseline",
          "model_version": "hand-fixture-v1",
          "data_version": "ttc-S1000542-505-west-tmu-pipeline-20261008",
          "seed_ids": [
            0
          ],
          "status": "completed",
          "diagnostics": {
            "passengers_created": 8,
            "passengers_arrived": 8,
            "passengers_waiting": 0,
            "passengers_onboard": 0,
            "conservation": true,
            "unresolved_passengers": 0,
            "runtime_s": 0
          }
        }
      ],
      "per_run_mean_wait_s": [
        95.625
      ],
      "per_run_p95_wait_s": [
        235
      ],
      "per_run_denied_share": [
        0.5
      ],
      "per_run_unresolved_passengers": [
        0
      ],
      "run_count": 1,
      "unresolved_passengers": 0
    },
    {
      "case_id": "fixture-supported_growth-low",
      "kind": "supported_growth",
      "package_id": "extra-service",
      "phase_id": "phase-1",
      "demand_case": "low",
      "stops": [
        {
          "stop_id": "ttc-stop-1756",
          "rider_group": "existing",
          "passengers": 5,
          "completed_passengers": 5,
          "mean_wait_s": 6,
          "p95_wait_s": 30,
          "denied_at_least_once_share": 0.2,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-1756",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2127",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2127",
          "rider_group": "new",
          "passengers": 3,
          "completed_passengers": 3,
          "mean_wait_s": 205.0,
          "p95_wait_s": 205,
          "denied_at_least_once_share": 1,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-15873",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-15873",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2125",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2125",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2123",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2123",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2131",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2131",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2119",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2119",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2117",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2117",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2136",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2136",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        }
      ],
      "runs": [
        {
          "run_id": "fixture-run-supported_growth-low",
          "scenario_version": 1,
          "package": "extra-service",
          "model_version": "hand-fixture-v1",
          "data_version": "ttc-S1000542-505-west-tmu-pipeline-20261008",
          "seed_ids": [
            0
          ],
          "status": "completed",
          "diagnostics": {
            "passengers_created": 8,
            "passengers_arrived": 8,
            "passengers_waiting": 0,
            "passengers_onboard": 0,
            "conservation": true,
            "unresolved_passengers": 0,
            "runtime_s": 0
          }
        }
      ],
      "per_run_mean_wait_s": [
        80.625
      ],
      "per_run_p95_wait_s": [
        205
      ],
      "per_run_denied_share": [
        0.5
      ],
      "per_run_unresolved_passengers": [
        0
      ],
      "run_count": 1,
      "unresolved_passengers": 0
    },
    {
      "case_id": "fixture-current-high",
      "kind": "current",
      "package_id": "baseline",
      "phase_id": "phase-1",
      "demand_case": "high",
      "stops": [
        {
          "stop_id": "ttc-stop-1756",
          "rider_group": "existing",
          "passengers": 5,
          "completed_passengers": 5,
          "mean_wait_s": 12,
          "p95_wait_s": 60,
          "denied_at_least_once_share": 0.2,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-1756",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2127",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2127",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-15873",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-15873",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2125",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2125",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2123",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2123",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2131",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2131",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2119",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2119",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2117",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2117",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2136",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2136",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        }
      ],
      "runs": [
        {
          "run_id": "fixture-run-current-high",
          "scenario_version": 1,
          "package": "baseline",
          "model_version": "hand-fixture-v1",
          "data_version": "ttc-S1000542-505-west-tmu-pipeline-20261008",
          "seed_ids": [
            0
          ],
          "status": "completed",
          "diagnostics": {
            "passengers_created": 5,
            "passengers_arrived": 5,
            "passengers_waiting": 0,
            "passengers_onboard": 0,
            "conservation": true,
            "unresolved_passengers": 0,
            "runtime_s": 0
          }
        }
      ],
      "per_run_mean_wait_s": [
        12.0
      ],
      "per_run_p95_wait_s": [
        60
      ],
      "per_run_denied_share": [
        0.2
      ],
      "per_run_unresolved_passengers": [
        0
      ],
      "run_count": 1,
      "unresolved_passengers": 0
    },
    {
      "case_id": "fixture-growth-high",
      "kind": "growth",
      "package_id": "baseline",
      "phase_id": "phase-1",
      "demand_case": "high",
      "stops": [
        {
          "stop_id": "ttc-stop-1756",
          "rider_group": "existing",
          "passengers": 5,
          "completed_passengers": 5,
          "mean_wait_s": 12,
          "p95_wait_s": 60,
          "denied_at_least_once_share": 0.2,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-1756",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2127",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2127",
          "rider_group": "new",
          "passengers": 7,
          "completed_passengers": 3,
          "mean_wait_s": 235,
          "p95_wait_s": 235,
          "denied_at_least_once_share": 1,
          "remaining_queue": 4,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-15873",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-15873",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2125",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2125",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2123",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2123",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2131",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2131",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2119",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2119",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2117",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2117",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2136",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2136",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        }
      ],
      "runs": [
        {
          "run_id": "fixture-run-growth-high",
          "scenario_version": 1,
          "package": "baseline",
          "model_version": "hand-fixture-v1",
          "data_version": "ttc-S1000542-505-west-tmu-pipeline-20261008",
          "seed_ids": [
            0
          ],
          "status": "completed",
          "diagnostics": {
            "passengers_created": 12,
            "passengers_arrived": 8,
            "passengers_waiting": 4,
            "passengers_onboard": 0,
            "conservation": true,
            "unresolved_passengers": 4,
            "runtime_s": 0
          }
        }
      ],
      "per_run_mean_wait_s": [
        95.625
      ],
      "per_run_p95_wait_s": [
        235
      ],
      "per_run_denied_share": [
        0.6666666666666666
      ],
      "per_run_unresolved_passengers": [
        4
      ],
      "run_count": 1,
      "unresolved_passengers": 4
    },
    {
      "case_id": "fixture-supported_growth-high",
      "kind": "supported_growth",
      "package_id": "extra-service",
      "phase_id": "phase-1",
      "demand_case": "high",
      "stops": [
        {
          "stop_id": "ttc-stop-1756",
          "rider_group": "existing",
          "passengers": 5,
          "completed_passengers": 5,
          "mean_wait_s": 6,
          "p95_wait_s": 30,
          "denied_at_least_once_share": 0.2,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-1756",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2127",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2127",
          "rider_group": "new",
          "passengers": 7,
          "completed_passengers": 7,
          "mean_wait_s": 222.14285714285714,
          "p95_wait_s": 235,
          "denied_at_least_once_share": 1,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-15873",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-15873",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2125",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2125",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2123",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2123",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2131",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2131",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2119",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2119",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2117",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2117",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2136",
          "rider_group": "existing",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2136",
          "rider_group": "new",
          "passengers": 0,
          "completed_passengers": 0,
          "mean_wait_s": null,
          "p95_wait_s": null,
          "denied_at_least_once_share": null,
          "remaining_queue": 0,
          "headway_cv": 0
        }
      ],
      "runs": [
        {
          "run_id": "fixture-run-supported_growth-high",
          "scenario_version": 1,
          "package": "extra-service",
          "model_version": "hand-fixture-v1",
          "data_version": "ttc-S1000542-505-west-tmu-pipeline-20261008",
          "seed_ids": [
            0
          ],
          "status": "completed",
          "diagnostics": {
            "passengers_created": 12,
            "passengers_arrived": 12,
            "passengers_waiting": 0,
            "passengers_onboard": 0,
            "conservation": true,
            "unresolved_passengers": 0,
            "runtime_s": 0
          }
        }
      ],
      "per_run_mean_wait_s": [
        132.08333333333334
      ],
      "per_run_p95_wait_s": [
        235
      ],
      "per_run_denied_share": [
        0.6666666666666666
      ],
      "per_run_unresolved_passengers": [
        0
      ],
      "run_count": 1,
      "unresolved_passengers": 0
    }
  ],
  "packages": [
    {
      "package_id": "baseline",
      "label": "No additional service",
      "intervention_ids": [],
      "evaluations": [
        {
          "phase_id": "phase-1",
          "demand_case": "central",
          "case_id": "fixture-growth",
          "feasible": true,
          "feasibility_reasons": [
            "Fixture high-bound costs fit the budgets; availability and fleet allowance fit."
          ],
          "criterion_met": false,
          "criterion_reasons": [
            "Fixture unresolved or denied-share limit exceeded."
          ]
        },
        {
          "phase_id": "phase-1",
          "demand_case": "low",
          "case_id": "fixture-growth-low",
          "feasible": true,
          "feasibility_reasons": [
            "Fixture high-bound costs fit the budgets; availability and fleet allowance fit."
          ],
          "criterion_met": true,
          "criterion_reasons": [
            "All fixture limits pass."
          ]
        },
        {
          "phase_id": "phase-1",
          "demand_case": "high",
          "case_id": "fixture-growth-high",
          "feasible": true,
          "feasibility_reasons": [
            "Fixture high-bound costs fit the budgets; availability and fleet allowance fit."
          ],
          "criterion_met": false,
          "criterion_reasons": [
            "Fixture unresolved or denied-share limit exceeded."
          ]
        }
      ]
    },
    {
      "package_id": "extra-service",
      "label": "Illustrative extra streetcar",
      "intervention_ids": [
        "fixture-extra-service"
      ],
      "evaluations": [
        {
          "phase_id": "phase-1",
          "demand_case": "central",
          "case_id": "fixture-supported_growth",
          "feasible": true,
          "feasibility_reasons": [
            "Fixture high-bound costs fit the budgets; availability and fleet allowance fit."
          ],
          "criterion_met": true,
          "criterion_reasons": [
            "All fixture limits pass."
          ]
        },
        {
          "phase_id": "phase-1",
          "demand_case": "low",
          "case_id": "fixture-supported_growth-low",
          "feasible": true,
          "feasibility_reasons": [
            "Fixture high-bound costs fit the budgets; availability and fleet allowance fit."
          ],
          "criterion_met": true,
          "criterion_reasons": [
            "All fixture limits pass."
          ]
        },
        {
          "phase_id": "phase-1",
          "demand_case": "high",
          "case_id": "fixture-supported_growth-high",
          "feasible": true,
          "feasibility_reasons": [
            "Fixture high-bound costs fit the budgets; availability and fleet allowance fit."
          ],
          "criterion_met": false,
          "criterion_reasons": [
            "Fixture unresolved or denied-share limit exceeded."
          ]
        }
      ]
    }
  ],
  "sensitivity": [
    {
      "assumption_key": "vehicle_capacity",
      "case_id": "fixture-growth",
      "tested_values": [
        4,
        5,
        6
      ],
      "metric": "unresolved_passengers",
      "outcomes": [
        2,
        0,
        0
      ],
      "status": "fixture",
      "interpretation": "Hand arithmetic only, holding demand fixed. Not a fleet recommendation."
    }
  ],
  "assumptions": [
    {
      "key": "incoming_load",
      "unit": "passengers/vehicle",
      "meaning": "Fixture cars enter empty; actual Broadview occupancy is unknown.",
      "low": 0,
      "central": 0,
      "high": 0,
      "allowed_range": {
        "low": 0,
        "high": 300
      },
      "status": "assumed",
      "source_ids": []
    },
    {
      "key": "vehicle_capacity",
      "unit": "passengers/vehicle",
      "meaning": "FOUR places for hand arithmetic only; not a TTC streetcar capacity.",
      "low": 4,
      "central": 4,
      "high": 6,
      "allowed_range": {
        "low": 1,
        "high": 300
      },
      "status": "assumed",
      "source_ids": []
    },
    {
      "key": "baseline_headway",
      "unit": "s",
      "meaning": "Synthetic two-car dispatch separation; not the observed or scheduled 505 headway.",
      "low": 60,
      "central": 60,
      "high": 60,
      "allowed_range": {
        "low": 1,
        "high": 1800
      },
      "status": "assumed",
      "source_ids": []
    },
    {
      "key": "dwell",
      "unit": "s/stop",
      "meaning": "Zero-dwell arithmetic fixture, not a calibrated boarding model.",
      "low": 0,
      "central": 0,
      "high": 0,
      "allowed_range": {
        "low": 0,
        "high": 300
      },
      "status": "assumed",
      "source_ids": []
    },
    {
      "key": "berths",
      "unit": "vehicles/stop",
      "meaning": "One berth per stop; fixture arrivals never overlap at a stop.",
      "low": 1,
      "central": 1,
      "high": 1,
      "allowed_range": {
        "low": 1,
        "high": 4
      },
      "status": "assumed",
      "source_ids": []
    },
    {
      "key": "occupied_share",
      "unit": "share",
      "meaning": "Illustrative future occupied share; no observed completion dates.",
      "low": 0.25,
      "central": 0.5,
      "high": 0.75,
      "allowed_range": {
        "low": 0,
        "high": 1
      },
      "status": "assumed",
      "source_ids": []
    },
    {
      "key": "extra_service_headway",
      "unit": "s",
      "meaning": "Fixture dispatches 0/30/60 instead of 0/60; no fleet-cycle feasibility claim.",
      "low": 30,
      "central": 30,
      "high": 60,
      "allowed_range": {
        "low": 1,
        "high": 1800
      },
      "status": "assumed",
      "source_ids": []
    },
    {
      "key": "new_arrivals",
      "unit": "passengers/window",
      "meaning": "Synthetic new-rider counts for low/central/high demand; not derived from proposed units.",
      "low": 3,
      "central": 5,
      "high": 7,
      "allowed_range": {
        "low": 0,
        "high": 20
      },
      "status": "assumed",
      "source_ids": []
    },
    {
      "key": "existing_arrivals",
      "unit": "passengers/window",
      "meaning": "Five existing riders at Broadview, waiting from zero; no observed ridership claim.",
      "low": 5,
      "central": 5,
      "high": 5,
      "allowed_range": {
        "low": 0,
        "high": 20
      },
      "status": "assumed",
      "source_ids": []
    }
  ],
  "sources": [
    {
      "source_id": "ttc-gtfs",
      "title": "Merged GTFS - TTC Routes and Schedules",
      "url": "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/b811ead4-6eaf-4adb-8408-d389fb5a069c/resource/c920e221-7a1c-488b-8c5b-6d8cd4e85eaf/download/completegtfs.zip",
      "publisher": "Toronto Transit Commission / City of Toronto",
      "version": "S1000542",
      "licence": "https://open.toronto.ca/open-data-licence/",
      "retrieved_at": "2026-10-17T06:36:33.015052+00:00"
    },
    {
      "source_id": "toronto-development-pipeline",
      "title": "Development Pipeline",
      "url": "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/a7a327c5-4e25-4881-816d-c8b145e02832/resource/dc28845a-299f-4562-b605-27b6fefc17e0/download/development-pipeline.csv",
      "publisher": "City of Toronto / City Planning",
      "version": "2026-10-08T07:24:47.445084",
      "licence": "https://open.toronto.ca/open-data-licence/",
      "retrieved_at": "2026-10-17T06:36:34.968042+00:00"
    },
    {
      "source_id": "toronto-address-796104",
      "title": "Toronto One Address Repository: 239 Dundas St E",
      "url": "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search?resource_id=0b3756af-9caf-4f0f-ac28-9c6617adede4&filters=%7B%22ADDRESS_FULL%22%3A+%22239+Dundas+St+E%22%7D&limit=100",
      "publisher": "City of Toronto",
      "version": "retrieved snapshot",
      "licence": "https://open.toronto.ca/open-data-licence/",
      "retrieved_at": "2026-10-17T06:38:16.078288+00:00"
    },
    {
      "source_id": "toronto-address-30009862",
      "title": "Toronto One Address Repository: 500 Dundas St E",
      "url": "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search?resource_id=0b3756af-9caf-4f0f-ac28-9c6617adede4&filters=%7B%22ADDRESS_FULL%22%3A+%22500+Dundas+St+E%22%7D&limit=100",
      "publisher": "City of Toronto",
      "version": "retrieved snapshot",
      "licence": "https://open.toronto.ca/open-data-licence/",
      "retrieved_at": "2026-10-17T06:38:20.211229+00:00"
    },
    {
      "source_id": "toronto-address-7667205",
      "title": "Toronto One Address Repository: 761 Dundas St E",
      "url": "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search?resource_id=0b3756af-9caf-4f0f-ac28-9c6617adede4&filters=%7B%22ADDRESS_FULL%22%3A+%22761+Dundas+St+E%22%7D&limit=100",
      "publisher": "City of Toronto",
      "version": "retrieved snapshot",
      "licence": "https://open.toronto.ca/open-data-licence/",
      "retrieved_at": "2026-10-17T06:38:21.663662+00:00"
    },
    {
      "source_id": "toronto-address-7650832",
      "title": "Toronto One Address Repository: 401 Dundas St E",
      "url": "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search?resource_id=0b3756af-9caf-4f0f-ac28-9c6617adede4&filters=%7B%22ADDRESS_FULL%22%3A+%22401+Dundas+St+E%22%7D&limit=100",
      "publisher": "City of Toronto",
      "version": "retrieved snapshot",
      "licence": "https://open.toronto.ca/open-data-licence/",
      "retrieved_at": "2026-10-17T06:38:22.462487+00:00"
    },
    {
      "source_id": "toronto-address-796099",
      "title": "Toronto One Address Repository: 218 Dundas St E",
      "url": "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search?resource_id=0b3756af-9caf-4f0f-ac28-9c6617adede4&filters=%7B%22ADDRESS_FULL%22%3A+%22218+Dundas+St+E%22%7D&limit=100",
      "publisher": "City of Toronto",
      "version": "retrieved snapshot",
      "licence": "https://open.toronto.ca/open-data-licence/",
      "retrieved_at": "2026-10-17T06:38:23.357595+00:00"
    },
    {
      "source_id": "osm-walk-239",
      "title": "OpenStreetMap pedestrian map around 239 DUNDAS ST E",
      "url": "https://api.openstreetmap.org/api/0.6/map?bbox=-79.375,43.6565,-79.3705,43.659",
      "publisher": "OpenStreetMap contributors",
      "version": "retrieved snapshot",
      "licence": "https://www.openstreetmap.org/copyright",
      "retrieved_at": "2026-10-17T06:49:48.203776+00:00"
    },
    {
      "source_id": "osm-walk-500",
      "title": "OpenStreetMap pedestrian map around 500 DUNDAS ST E",
      "url": "https://api.openstreetmap.org/api/0.6/map?bbox=-79.3675,43.658,-79.3615,43.662",
      "publisher": "OpenStreetMap contributors",
      "version": "retrieved snapshot",
      "licence": "https://www.openstreetmap.org/copyright",
      "retrieved_at": "2026-10-17T06:52:29.237546+00:00"
    },
    {
      "source_id": "osm-walk-761",
      "title": "OpenStreetMap pedestrian map around 761 DUNDAS ST E",
      "url": "https://api.openstreetmap.org/api/0.6/map?bbox=-79.361,43.6595,-79.354,43.663",
      "publisher": "OpenStreetMap contributors",
      "version": "retrieved snapshot",
      "licence": "https://www.openstreetmap.org/copyright",
      "retrieved_at": "2026-10-17T06:52:31.884378+00:00"
    }
  ],
  "warnings": [
    "FIXTURE: synthetic passengers, costs, service, budgets and results; not a real 505 forecast.",
    "Real GTFS geometry and proposed units do not validate the fixture demand. Housing totals are identical across packages.",
    "Walking entrances/crossings need manual review; footprints unavailable, not invented.",
    "Wait statistics include completed riders only; unresolved riders are separately reported. P95 uses nearest rank.",
    "Fixture time starts at zero, representing 07:00 local; two illustrative dispatches do not represent the full AM service.",
    "Zero dwell, empty incoming vehicles, four-place capacity and fleet-cycle feasibility are fixture assumptions."
  ],
  "replay": {
    "run_id": "fixture-run-growth",
    "horizon_s": 964,
    "vehicle_capacity": {
      "fixture-car-1": 4,
      "fixture-car-2": 4
    },
    "initial_queues": [
      {
        "stop_id": "ttc-stop-1756",
        "rider_group": "existing",
        "count": 5
      },
      {
        "stop_id": "ttc-stop-2127",
        "rider_group": "new",
        "count": 5
      }
    ],
    "events": [
      {
        "run_id": "fixture-run-growth",
        "t_s": 0,
        "kind": "dispatch",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-1756",
        "count": 0,
        "load_after": 0,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 0,
        "kind": "arrive",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-1756",
        "count": 0,
        "load_after": 0,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 0,
        "kind": "board",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-1756",
        "count": 4,
        "load_after": 4,
        "rider_group": "existing"
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 0,
        "kind": "deny",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-1756",
        "count": 1,
        "load_after": 4,
        "rider_group": "existing"
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 0,
        "kind": "depart",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-1756",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 60,
        "kind": "dispatch",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-1756",
        "count": 0,
        "load_after": 0,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 60,
        "kind": "arrive",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-1756",
        "count": 0,
        "load_after": 0,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 60,
        "kind": "board",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-1756",
        "count": 1,
        "load_after": 1,
        "rider_group": "existing"
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 60,
        "kind": "depart",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-1756",
        "count": 0,
        "load_after": 1,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 175,
        "kind": "arrive",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2127",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 175,
        "kind": "deny",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2127",
        "count": 5,
        "load_after": 4,
        "rider_group": "new"
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 175,
        "kind": "depart",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2127",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 235,
        "kind": "arrive",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2127",
        "count": 0,
        "load_after": 1,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 235,
        "kind": "board",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2127",
        "count": 3,
        "load_after": 4,
        "rider_group": "new"
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 235,
        "kind": "deny",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2127",
        "count": 2,
        "load_after": 4,
        "rider_group": "new"
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 235,
        "kind": "depart",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2127",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 265,
        "kind": "arrive",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-15873",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 265,
        "kind": "depart",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-15873",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 325,
        "kind": "arrive",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-15873",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 325,
        "kind": "depart",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-15873",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 369,
        "kind": "arrive",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2125",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 369,
        "kind": "depart",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2125",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 429,
        "kind": "arrive",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2125",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 429,
        "kind": "depart",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2125",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 454,
        "kind": "arrive",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2123",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 454,
        "kind": "depart",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2123",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 514,
        "kind": "arrive",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2123",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 514,
        "kind": "depart",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2123",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 539,
        "kind": "arrive",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2131",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 539,
        "kind": "depart",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2131",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 599,
        "kind": "arrive",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2131",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 599,
        "kind": "depart",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2131",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 675,
        "kind": "arrive",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2119",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 675,
        "kind": "depart",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2119",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 735,
        "kind": "arrive",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2119",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 735,
        "kind": "depart",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2119",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 764,
        "kind": "arrive",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2117",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 764,
        "kind": "depart",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2117",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 824,
        "kind": "arrive",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2117",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 824,
        "kind": "depart",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2117",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 904,
        "kind": "arrive",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2136",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 904,
        "kind": "alight",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2136",
        "count": 4,
        "load_after": 0,
        "rider_group": "existing"
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 904,
        "kind": "depart",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2136",
        "count": 0,
        "load_after": 0,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 964,
        "kind": "arrive",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2136",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 964,
        "kind": "alight",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2136",
        "count": 1,
        "load_after": 3,
        "rider_group": "existing"
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 964,
        "kind": "alight",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2136",
        "count": 3,
        "load_after": 0,
        "rider_group": "new"
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 964,
        "kind": "depart",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2136",
        "count": 0,
        "load_after": 0,
        "rider_group": null
      }
    ]
  }
} satisfies Comparison
