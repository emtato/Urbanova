// Generated from data/fixtures/sample_comparison.json; do not edit.
import type { Comparison } from "./types"

export const sampleComparison = {
  "contract_version": "2.0.0",
  "comparison_id": "fixture-505-jarvis-broadview",
  "fixture": true,
  "product_label": "scenario experiment",
  "scenario": {
    "scenario_id": "fixture-505",
    "version": 1,
    "developments": [
      {
        "id": "fixture-development-1",
        "name": "Fixture development 1",
        "latitude": 43.65822,
        "longitude": -79.371303,
        "net_added_units": 100,
        "occupied_share": 0.5,
        "residents_per_occupied_unit": 2.0,
        "transit_share": 0.5,
        "accessible_stop_ids": [
          "ttc-stop-2130"
        ]
      },
      {
        "id": "fixture-development-2",
        "name": "Fixture development 2",
        "latitude": 43.660247,
        "longitude": -79.361966,
        "net_added_units": 100,
        "occupied_share": 0.5,
        "residents_per_occupied_unit": 2.0,
        "transit_share": 0.5,
        "accessible_stop_ids": [
          "ttc-stop-15872"
        ]
      },
      {
        "id": "fixture-development-3",
        "name": "Fixture development 3",
        "latitude": 43.661097,
        "longitude": -79.358272,
        "net_added_units": 100,
        "occupied_share": 0.5,
        "residents_per_occupied_unit": 2.0,
        "transit_share": 0.5,
        "accessible_stop_ids": [
          "ttc-stop-2126"
        ]
      }
    ],
    "phases": [
      {
        "phase_id": "phase-1",
        "year": 2030,
        "development_ids": [
          "fixture-development-1",
          "fixture-development-2",
          "fixture-development-3"
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
    "corridor_id": "ttc-505-east-jarvis-broadview",
    "route_pattern": "505:0:shp-505-09",
    "mode": "streetcar",
    "direction": "eastbound",
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
        "id": "ttc-stop-2118",
        "name": "Dundas St East at Jarvis St",
        "sequence": 0,
        "latitude": 43.656947,
        "longitude": -79.374706,
        "waiting_passenger_ids": [],
        "serving_streetcar_id": null
      },
      {
        "id": "ttc-stop-2130",
        "name": "Dundas St East at Sherbourne St",
        "sequence": 1,
        "latitude": 43.65822,
        "longitude": -79.371303,
        "waiting_passenger_ids": [],
        "serving_streetcar_id": null
      },
      {
        "id": "ttc-stop-2122",
        "name": "Dundas St East at Ontario St",
        "sequence": 2,
        "latitude": 43.658752,
        "longitude": -79.368653,
        "waiting_passenger_ids": [],
        "serving_streetcar_id": null
      },
      {
        "id": "ttc-stop-2124",
        "name": "Dundas St East at Parliament St",
        "sequence": 3,
        "latitude": 43.659283,
        "longitude": -79.366291,
        "waiting_passenger_ids": [],
        "serving_streetcar_id": null
      },
      {
        "id": "ttc-stop-15872",
        "name": "Dundas St East at Regent Park Blvd",
        "sequence": 4,
        "latitude": 43.660247,
        "longitude": -79.361966,
        "waiting_passenger_ids": [],
        "serving_streetcar_id": null
      },
      {
        "id": "ttc-stop-2126",
        "name": "Dundas St East at River St",
        "sequence": 5,
        "latitude": 43.661097,
        "longitude": -79.358272,
        "waiting_passenger_ids": [],
        "serving_streetcar_id": null
      },
      {
        "id": "ttc-stop-2115",
        "name": "Dundas St East at Broadview Ave",
        "sequence": 6,
        "latitude": 43.662249,
        "longitude": -79.351814,
        "waiting_passenger_ids": [],
        "serving_streetcar_id": null
      }
    ],
    "links": [
      {
        "link_id": "ttc-505-east-link-1",
        "from_stop": "ttc-stop-2118",
        "to_stop": "ttc-stop-2130",
        "length_m": 329.76,
        "base_time_s": 150,
        "source_ids": [
          "ttc-gtfs"
        ]
      },
      {
        "link_id": "ttc-505-east-link-2",
        "from_stop": "ttc-stop-2130",
        "to_stop": "ttc-stop-2122",
        "length_m": 222.32,
        "base_time_s": 100,
        "source_ids": [
          "ttc-gtfs"
        ]
      },
      {
        "link_id": "ttc-505-east-link-3",
        "from_stop": "ttc-stop-2122",
        "to_stop": "ttc-stop-2124",
        "length_m": 201.42,
        "base_time_s": 91,
        "source_ids": [
          "ttc-gtfs"
        ]
      },
      {
        "link_id": "ttc-505-east-link-4",
        "from_stop": "ttc-stop-2124",
        "to_stop": "ttc-stop-15872",
        "length_m": 364.93,
        "base_time_s": 130,
        "source_ids": [
          "ttc-gtfs"
        ]
      },
      {
        "link_id": "ttc-505-east-link-5",
        "from_stop": "ttc-stop-15872",
        "to_stop": "ttc-stop-2126",
        "length_m": 312.67,
        "base_time_s": 106,
        "source_ids": [
          "ttc-gtfs"
        ]
      },
      {
        "link_id": "ttc-505-east-link-6",
        "from_stop": "ttc-stop-2126",
        "to_stop": "ttc-stop-2115",
        "length_m": 539.44,
        "base_time_s": 183,
        "source_ids": [
          "ttc-gtfs"
        ]
      }
    ],
    "berths_per_stop": {
      "ttc-stop-2118": 1,
      "ttc-stop-2130": 1,
      "ttc-stop-2122": 1,
      "ttc-stop-2124": 1,
      "ttc-stop-15872": 1,
      "ttc-stop-2126": 1,
      "ttc-stop-2115": 1
    },
    "source_ids": [
      "ttc-gtfs"
    ],
    "incoming_load": {
      "key": "incoming_load",
      "unit": "passengers/vehicle",
      "meaning": "Fixture cars enter empty; actual Jarvis occupancy is unknown.",
      "low": 0,
      "central": 0,
      "high": 0,
      "allowed_range": {
        "low": 0,
        "high": 300
      },
      "status": "assumed",
      "source_ids": []
    }
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
          "stop_id": "ttc-stop-2118",
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
          "stop_id": "ttc-stop-2118",
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
          "stop_id": "ttc-stop-2130",
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
          "stop_id": "ttc-stop-2130",
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
          "stop_id": "ttc-stop-2122",
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
          "stop_id": "ttc-stop-2122",
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
          "stop_id": "ttc-stop-2124",
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
          "stop_id": "ttc-stop-2124",
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
          "stop_id": "ttc-stop-15872",
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
          "stop_id": "ttc-stop-15872",
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
          "stop_id": "ttc-stop-2126",
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
          "stop_id": "ttc-stop-2126",
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
          "stop_id": "ttc-stop-2115",
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
          "stop_id": "ttc-stop-2115",
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
          "data_version": "ttc-S1000542-pipeline-20261008",
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
          "stop_id": "ttc-stop-2118",
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
          "stop_id": "ttc-stop-2118",
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
          "stop_id": "ttc-stop-2130",
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
          "stop_id": "ttc-stop-2130",
          "rider_group": "new",
          "passengers": 5,
          "completed_passengers": 3,
          "mean_wait_s": 210,
          "p95_wait_s": 210,
          "denied_at_least_once_share": 1,
          "remaining_queue": 2,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2122",
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
          "stop_id": "ttc-stop-2122",
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
          "stop_id": "ttc-stop-2124",
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
          "stop_id": "ttc-stop-2124",
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
          "stop_id": "ttc-stop-15872",
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
          "stop_id": "ttc-stop-15872",
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
          "stop_id": "ttc-stop-2126",
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
          "stop_id": "ttc-stop-2126",
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
          "stop_id": "ttc-stop-2115",
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
          "stop_id": "ttc-stop-2115",
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
          "data_version": "ttc-S1000542-pipeline-20261008",
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
        86.25
      ],
      "per_run_p95_wait_s": [
        210
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
          "stop_id": "ttc-stop-2118",
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
          "stop_id": "ttc-stop-2118",
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
          "stop_id": "ttc-stop-2130",
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
          "stop_id": "ttc-stop-2130",
          "rider_group": "new",
          "passengers": 5,
          "completed_passengers": 5,
          "mean_wait_s": 192.0,
          "p95_wait_s": 210,
          "denied_at_least_once_share": 1,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2122",
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
          "stop_id": "ttc-stop-2122",
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
          "stop_id": "ttc-stop-2124",
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
          "stop_id": "ttc-stop-2124",
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
          "stop_id": "ttc-stop-15872",
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
          "stop_id": "ttc-stop-15872",
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
          "stop_id": "ttc-stop-2126",
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
          "stop_id": "ttc-stop-2126",
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
          "stop_id": "ttc-stop-2115",
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
          "stop_id": "ttc-stop-2115",
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
          "data_version": "ttc-S1000542-pipeline-20261008",
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
        99.0
      ],
      "per_run_p95_wait_s": [
        210
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
          "stop_id": "ttc-stop-2118",
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
          "stop_id": "ttc-stop-2118",
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
          "stop_id": "ttc-stop-2130",
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
          "stop_id": "ttc-stop-2130",
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
          "stop_id": "ttc-stop-2122",
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
          "stop_id": "ttc-stop-2122",
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
          "stop_id": "ttc-stop-2124",
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
          "stop_id": "ttc-stop-2124",
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
          "stop_id": "ttc-stop-15872",
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
          "stop_id": "ttc-stop-15872",
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
          "stop_id": "ttc-stop-2126",
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
          "stop_id": "ttc-stop-2126",
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
          "stop_id": "ttc-stop-2115",
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
          "stop_id": "ttc-stop-2115",
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
          "data_version": "ttc-S1000542-pipeline-20261008",
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
          "stop_id": "ttc-stop-2118",
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
          "stop_id": "ttc-stop-2118",
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
          "stop_id": "ttc-stop-2130",
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
          "stop_id": "ttc-stop-2130",
          "rider_group": "new",
          "passengers": 3,
          "completed_passengers": 3,
          "mean_wait_s": 210,
          "p95_wait_s": 210,
          "denied_at_least_once_share": 1,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2122",
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
          "stop_id": "ttc-stop-2122",
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
          "stop_id": "ttc-stop-2124",
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
          "stop_id": "ttc-stop-2124",
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
          "stop_id": "ttc-stop-15872",
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
          "stop_id": "ttc-stop-15872",
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
          "stop_id": "ttc-stop-2126",
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
          "stop_id": "ttc-stop-2126",
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
          "stop_id": "ttc-stop-2115",
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
          "stop_id": "ttc-stop-2115",
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
          "data_version": "ttc-S1000542-pipeline-20261008",
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
        86.25
      ],
      "per_run_p95_wait_s": [
        210
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
          "stop_id": "ttc-stop-2118",
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
          "stop_id": "ttc-stop-2118",
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
          "stop_id": "ttc-stop-2130",
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
          "stop_id": "ttc-stop-2130",
          "rider_group": "new",
          "passengers": 3,
          "completed_passengers": 3,
          "mean_wait_s": 180.0,
          "p95_wait_s": 180,
          "denied_at_least_once_share": 1,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2122",
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
          "stop_id": "ttc-stop-2122",
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
          "stop_id": "ttc-stop-2124",
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
          "stop_id": "ttc-stop-2124",
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
          "stop_id": "ttc-stop-15872",
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
          "stop_id": "ttc-stop-15872",
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
          "stop_id": "ttc-stop-2126",
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
          "stop_id": "ttc-stop-2126",
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
          "stop_id": "ttc-stop-2115",
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
          "stop_id": "ttc-stop-2115",
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
          "data_version": "ttc-S1000542-pipeline-20261008",
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
        71.25
      ],
      "per_run_p95_wait_s": [
        180
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
          "stop_id": "ttc-stop-2118",
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
          "stop_id": "ttc-stop-2118",
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
          "stop_id": "ttc-stop-2130",
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
          "stop_id": "ttc-stop-2130",
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
          "stop_id": "ttc-stop-2122",
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
          "stop_id": "ttc-stop-2122",
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
          "stop_id": "ttc-stop-2124",
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
          "stop_id": "ttc-stop-2124",
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
          "stop_id": "ttc-stop-15872",
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
          "stop_id": "ttc-stop-15872",
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
          "stop_id": "ttc-stop-2126",
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
          "stop_id": "ttc-stop-2126",
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
          "stop_id": "ttc-stop-2115",
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
          "stop_id": "ttc-stop-2115",
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
          "data_version": "ttc-S1000542-pipeline-20261008",
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
          "stop_id": "ttc-stop-2118",
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
          "stop_id": "ttc-stop-2118",
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
          "stop_id": "ttc-stop-2130",
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
          "stop_id": "ttc-stop-2130",
          "rider_group": "new",
          "passengers": 7,
          "completed_passengers": 3,
          "mean_wait_s": 210,
          "p95_wait_s": 210,
          "denied_at_least_once_share": 1,
          "remaining_queue": 4,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2122",
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
          "stop_id": "ttc-stop-2122",
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
          "stop_id": "ttc-stop-2124",
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
          "stop_id": "ttc-stop-2124",
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
          "stop_id": "ttc-stop-15872",
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
          "stop_id": "ttc-stop-15872",
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
          "stop_id": "ttc-stop-2126",
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
          "stop_id": "ttc-stop-2126",
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
          "stop_id": "ttc-stop-2115",
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
          "stop_id": "ttc-stop-2115",
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
          "data_version": "ttc-S1000542-pipeline-20261008",
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
        86.25
      ],
      "per_run_p95_wait_s": [
        210
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
          "stop_id": "ttc-stop-2118",
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
          "stop_id": "ttc-stop-2118",
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
          "stop_id": "ttc-stop-2130",
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
          "stop_id": "ttc-stop-2130",
          "rider_group": "new",
          "passengers": 7,
          "completed_passengers": 7,
          "mean_wait_s": 197.14285714285714,
          "p95_wait_s": 210,
          "denied_at_least_once_share": 1,
          "remaining_queue": 0,
          "headway_cv": 0
        },
        {
          "stop_id": "ttc-stop-2122",
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
          "stop_id": "ttc-stop-2122",
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
          "stop_id": "ttc-stop-2124",
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
          "stop_id": "ttc-stop-2124",
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
          "stop_id": "ttc-stop-15872",
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
          "stop_id": "ttc-stop-15872",
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
          "stop_id": "ttc-stop-2126",
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
          "stop_id": "ttc-stop-2126",
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
          "stop_id": "ttc-stop-2115",
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
          "stop_id": "ttc-stop-2115",
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
          "data_version": "ttc-S1000542-pipeline-20261008",
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
        117.5
      ],
      "per_run_p95_wait_s": [
        210
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
      "meaning": "Fixture cars enter empty; actual Jarvis occupancy is unknown.",
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
      "meaning": "Five existing riders at Jarvis, waiting from zero; no observed ridership claim.",
      "low": 5,
      "central": 5,
      "high": 5,
      "allowed_range": {
        "low": 0,
        "high": 20
      },
      "status": "assumed",
      "source_ids": []
    },
    {
      "key": "net_added_units",
      "unit": "homes/development",
      "meaning": "Each synthetic fixture development adds 100 homes; not a claim about any real proposal.",
      "low": 100,
      "central": 100,
      "high": 100,
      "allowed_range": {
        "low": 0,
        "high": 2000
      },
      "status": "assumed",
      "source_ids": []
    },
    {
      "key": "residents_per_occupied_unit",
      "unit": "residents/home",
      "meaning": "Synthetic fixture household size; not measured occupancy.",
      "low": 2,
      "central": 2,
      "high": 2,
      "allowed_range": {
        "low": 0,
        "high": 10
      },
      "status": "assumed",
      "source_ids": []
    },
    {
      "key": "transit_share",
      "unit": "share",
      "meaning": "Synthetic fraction of trips using transit; fixture rider counts are still hand-authored.",
      "low": 0.5,
      "central": 0.5,
      "high": 0.5,
      "allowed_range": {
        "low": 0,
        "high": 1
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
    }
  ],
  "warnings": [
    "FIXTURE: synthetic passengers, costs, service, budgets and results; not a real 505 forecast.",
    "Historical eastbound GTFS geometry does not validate fixture demand. The current sourced study corridor is westbound.",
    "Housing IDs, net added units, occupancy, household size and transit share are synthetic. Locations coincide with fixture stops; accessible stops are illustrative, not reviewed walking access. Housing totals are identical across packages.",
    "Wait statistics include completed riders only; unresolved riders are separately reported. P95 uses nearest rank.",
    "Fixture time starts at zero, representing 07:00 local; two illustrative dispatches do not represent the full AM service.",
    "Zero dwell, empty incoming vehicles, four-place capacity and fleet-cycle feasibility are fixture assumptions."
  ],
  "replay": {
    "run_id": "fixture-run-growth",
    "horizon_s": 820,
    "vehicle_capacity": {
      "fixture-car-1": 4,
      "fixture-car-2": 4
    },
    "initial_queues": [
      {
        "stop_id": "ttc-stop-2118",
        "rider_group": "existing",
        "count": 5
      },
      {
        "stop_id": "ttc-stop-2130",
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
        "stop_id": "ttc-stop-2118",
        "count": 0,
        "load_after": 0,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 0,
        "kind": "arrive",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2118",
        "count": 0,
        "load_after": 0,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 0,
        "kind": "board",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2118",
        "count": 4,
        "load_after": 4,
        "rider_group": "existing"
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 0,
        "kind": "deny",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2118",
        "count": 1,
        "load_after": 4,
        "rider_group": "existing"
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 0,
        "kind": "depart",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2118",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 60,
        "kind": "dispatch",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2118",
        "count": 0,
        "load_after": 0,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 60,
        "kind": "arrive",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2118",
        "count": 0,
        "load_after": 0,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 60,
        "kind": "board",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2118",
        "count": 1,
        "load_after": 1,
        "rider_group": "existing"
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 60,
        "kind": "depart",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2118",
        "count": 0,
        "load_after": 1,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 150,
        "kind": "arrive",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2130",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 150,
        "kind": "deny",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2130",
        "count": 5,
        "load_after": 4,
        "rider_group": "new"
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 150,
        "kind": "depart",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2130",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 210,
        "kind": "arrive",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2130",
        "count": 0,
        "load_after": 1,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 210,
        "kind": "board",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2130",
        "count": 3,
        "load_after": 4,
        "rider_group": "new"
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 210,
        "kind": "deny",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2130",
        "count": 2,
        "load_after": 4,
        "rider_group": "new"
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 210,
        "kind": "depart",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2130",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 250,
        "kind": "arrive",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2122",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 250,
        "kind": "depart",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2122",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 310,
        "kind": "arrive",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2122",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 310,
        "kind": "depart",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2122",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 341,
        "kind": "arrive",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2124",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 341,
        "kind": "depart",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2124",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 401,
        "kind": "arrive",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2124",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 401,
        "kind": "depart",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2124",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 471,
        "kind": "arrive",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-15872",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 471,
        "kind": "depart",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-15872",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 531,
        "kind": "arrive",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-15872",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 531,
        "kind": "depart",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-15872",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 577,
        "kind": "arrive",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2126",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 577,
        "kind": "depart",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2126",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 637,
        "kind": "arrive",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2126",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 637,
        "kind": "depart",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2126",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 760,
        "kind": "arrive",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2115",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 760,
        "kind": "alight",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2115",
        "count": 4,
        "load_after": 0,
        "rider_group": "existing"
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 760,
        "kind": "depart",
        "vehicle_id": "fixture-car-1",
        "stop_id": "ttc-stop-2115",
        "count": 0,
        "load_after": 0,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 820,
        "kind": "arrive",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2115",
        "count": 0,
        "load_after": 4,
        "rider_group": null
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 820,
        "kind": "alight",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2115",
        "count": 1,
        "load_after": 3,
        "rider_group": "existing"
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 820,
        "kind": "alight",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2115",
        "count": 3,
        "load_after": 0,
        "rider_group": "new"
      },
      {
        "run_id": "fixture-run-growth",
        "t_s": 820,
        "kind": "depart",
        "vehicle_id": "fixture-car-2",
        "stop_id": "ttc-stop-2115",
        "count": 0,
        "load_after": 0,
        "rider_group": null
      }
    ]
  }
} satisfies Comparison
