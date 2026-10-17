"""Report baseline schedule residuals without tuning growth or inventing observations."""
import json
from dataclasses import replace
from pathlib import Path
from statistics import mean
from backend.simulation.runner import run_simulation
from data.simulation_input import load_simulation_input


def report():
    inputs = replace(load_simulation_input(), developments=(), seed=42, warmup_duration_s=600, clearance_s=1800)
    run = run_simulation(inputs)
    entered = {e['streetcar']['id']: e['time_s'] for e in run['sim_log'] if e['action'] == 'generate'}
    completed = [e['time_s']-entered[e['streetcar']['id']] for e in run['sim_log'] if e['action'] == 'arrive' and e['stop_id'] == inputs.stops[-1].id and e['streetcar']['id'] in entered]
    scheduled = sum(inputs.link_travel_times_s)
    overview = run['summary']['overview']
    return dict(format_version='baseline-consistency-v1', seed=42, growth_tuned=False,
                schedule=dict(status='schedule_consistency_only', source_ids=['ttc-gtfs'], scheduled_link_sum_s=scheduled,
                              completed_vehicles=len(completed), model_mean_segment_s=mean(completed) if completed else None,
                              mean_residual_s=mean(completed)-scheduled if completed else None,
                              caveat='Link schedule times may already include dwell; bounded stop dwell adds time. Passenger-dependent dwell is intentionally omitted by the simulation owner. This is a residual, not an observed accuracy estimate.'),
                demand=dict(status='not_calibrated', route_weekday_boardings=32100, source_ids=['ttc-505-observed-boardings'],
                            modeled_segment_boarding_events=sum(e['count'] for e in run['sim_log'] if e['action']=='board'),
                            segment_observation=None, residual=None,
                            caveat='Whole-route, both-direction, all-day November 2025 boardings cannot validate a westbound two-hour segment. Modeled event total also includes warm-up and clearance.'),
                held_out_headways=dict(status='unavailable', residual=None, caveat='No held-out weekday vehicle observations were supplied; GTFS is scheduled service.'),
                conservation_valid=overview['conservation_valid'], limitations=['No stop-level demand or incoming-occupancy calibration.', 'No growth-case tuning.'])


if __name__ == '__main__':
    value=report()
    target=Path('data/reviewed/baseline_consistency.json')
    target.write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(value))
