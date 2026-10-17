"""Hand-worked three-stop reference case: two streetcars, ten passengers.

Stops A -> B -> C have 30 s travel time per link and zero dwell (test assumptions).
Two capacity-four cars enter A at t=0 and t=60. Five passengers wait at A and five
at B from t=0; all travel to C. FIFO boarding, alight before boarding.
Car 1 boards four at A (t=0), denies all five at B (t=30), unloads at C (t=60).
Car 2 boards the last A passenger (t=60), boards three at B (t=90), unloads at C
(t=120). Two B passengers remain unresolved at the t=120 cap.
Expected: 8 arrived, 2 waiting, 6 denied at least once, mean completed wait
(4*0 + 1*60 + 3*90)/8 = 41.25 s. Both cars finish empty. The two unresolved waits
are at least 120 s; they are not silently excluded from the outcome report.
This is a reference fixture, not the calibrated 505 simulator.
"""
import heapq
import json
from collections import deque


def run_tiny_case() -> dict:
    passengers = {
        f"{origin}{index}": {
            "origin": origin, "status": "waiting", "boarded_at_s": None,
            "denied_once": False,
        }
        for origin in ("A", "B") for index in range(1, 6)
    }
    queues = {origin: deque(f"{origin}{index}" for index in range(1, 6)) for origin in ("A", "B")}
    onboard = {vehicle: [] for vehicle in ("car-1", "car-2")}
    events = [(0, 0, "car-1", "A"), (60, 1, "car-2", "A")]
    heapq.heapify(events)
    trace = []
    serial = 2
    while events:
        time_s, _, vehicle, stop = heapq.heappop(events)
        if stop == "C":
            count = len(onboard[vehicle])
            for passenger_id in onboard[vehicle]:
                passengers[passenger_id]["status"] = "arrived"
            onboard[vehicle].clear()
            trace.append({"t_s": time_s, "vehicle_id": vehicle, "stop_id": stop, "board": 0, "alight": count, "load_after": 0})
            continue
        boarded = 0
        while queues[stop] and len(onboard[vehicle]) < 4:
            passenger_id = queues[stop].popleft()
            passengers[passenger_id].update(status="onboard", boarded_at_s=time_s)
            onboard[vehicle].append(passenger_id)
            boarded += 1
        for passenger_id in queues[stop]:
            passengers[passenger_id]["denied_once"] = True
        trace.append({
            "t_s": time_s, "vehicle_id": vehicle, "stop_id": stop,
            "board": boarded, "alight": 0, "load_after": len(onboard[vehicle]),
            "remaining_queue": len(queues[stop]),
        })
        next_stop = "B" if stop == "A" else "C"
        heapq.heappush(events, (time_s + 30, serial, vehicle, next_stop))
        serial += 1
    completed_waits = [p["boarded_at_s"] for p in passengers.values() if p["status"] == "arrived"]
    return {
        "fixture": True, "arrived": sum(p["status"] == "arrived" for p in passengers.values()),
        "waiting": sum(len(q) for q in queues.values()), "onboard": sum(map(len, onboard.values())),
        "denied_at_least_once": sum(p["denied_once"] for p in passengers.values()),
        "mean_completed_wait_s": sum(completed_waits) / len(completed_waits),
        "unresolved_wait_lower_bounds_s": [120 for p in passengers.values() if p["status"] == "waiting"],
        "passengers": passengers, "events": trace,
    }


def verify_tiny_case() -> dict:
    result = run_tiny_case()
    assert (result["arrived"], result["waiting"], result["onboard"]) == (8, 2, 0)
    assert result["arrived"] + result["waiting"] + result["onboard"] == 10
    assert result["denied_at_least_once"] == 6
    assert result["mean_completed_wait_s"] == 41.25
    assert all(0 <= event["load_after"] <= 4 for event in result["events"])
    assert result["unresolved_wait_lower_bounds_s"] == [120, 120]
    return result


if __name__ == "__main__":
    print(json.dumps(verify_tiny_case(), indent=2))
