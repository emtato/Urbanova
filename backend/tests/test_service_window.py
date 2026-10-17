"""Integration checks for sourced entry schedules and explicit post-window service."""
from dataclasses import replace
from backend.simulation.inputs import SimulationInput
from backend.simulation.objects import Stop,Passenger
from backend.simulation.runner import run_simulation
from backend.simulation.streetcars import streetcar_entry_times
import pytest


def baseline(**changes):
    value=SimulationInput(stops=tuple(Stop(id=s,name=s,sequence=i,latitude=43.65,longitude=-79.3-i*.001) for i,s in enumerate(('A','B'))),existing_residences=(),developments=(),link_travel_times_s=(10,),streetcar_capacity=1,headway_s=30,rush_hour_duration_s=31,trips_per_resident_in_window=0,start_time_s=0,end_time_s=31,stop_dwell_range_s=(0,0),entry_schedule_s=(5,))
    return replace(value,**changes)


def test_baseline_timetable_is_preserved_and_extensions_are_explicit():
    assert list(streetcar_entry_times(baseline()))==[5]
    assert list(streetcar_entry_times(baseline(clearance_s=60),start_offset_s=-30))==[-30,5,35,65]


def test_late_measured_rider_boards_during_clearance():
    passenger=Passenger(id='late',origin_stop_id='A',destination_stop_id='B',get_to_stop_time=25,rider_group='new')
    run=run_simulation(baseline(clearance_s=60),{'late':passenger})
    assert run['summary']['overview']['conservation_valid']
    assert run['passengers'][0]['boarding_time_s']==35
    # The owner's tick engine departs a newly dispatched car on the next tick.
    assert run['passengers'][0]['exit_time_s']==46
    assert run['inputs']['end_time_s']==91
    assert run['inputs']['analysis_window_elapsed_s']==[0,31]


def test_owner_warmup_keeps_replay_nonnegative():
    run=run_simulation(baseline(warmup_duration_s=30))
    assert len(run['streetcars'])==2
    assert all(e['time_s']>=0 for e in run['sim_log'])
    assert run['summary']['overview']['conservation_valid']


def test_three_stops_two_cars_ten_riders_by_hand():
    # Whole-second owner engine, zero dwell: car 1 boards five at A=0,
    # departs 1, arrives B=11, departs 12, arrives C=22. Car 2 boards
    # three at A=30, departs 31, boards two at B=41, departs 42, C=52.
    # Wait sum = 5*0 + 3*30 + 2*41 = 172; five denied once, all complete.
    inputs=baseline(stops=tuple(Stop(id=s,name=s,sequence=i,latitude=43.65,longitude=-79.3-i*.001) for i,s in enumerate(('A','B','C'))),link_travel_times_s=(10,10),streetcar_capacity=5,end_time_s=80,entry_schedule_s=(0,30))
    riders={f'p{i}':Passenger(id=f'p{i}',origin_stop_id='A' if i<8 else 'B',destination_stop_id='C',get_to_stop_time=0,rider_group='new' if 5<=i<8 else 'existing') for i in range(10)}
    run=run_simulation(inputs,riders)
    overview=run['summary']['overview']
    assert overview['completed_corridor_passengers']==10
    assert overview['mean_wait_s']==pytest.approx(17.2)
    assert overview['p95_wait_s']==41
    assert overview['denied_boarding_count']==5
    assert overview['conservation_valid']
    assert [e['time_s'] for e in run['sim_log'] if e['action']=='arrive' and e['stop_id']=='C']==[22,52]
