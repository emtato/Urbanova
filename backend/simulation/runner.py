"""Run one simulation using the supplied scenario inputs."""

from .inputs import SimulationInput


def run_simulation(inputs: SimulationInput):
    """Runner stub; the event loop and result format will be defined together."""
    # 1. Create fresh run state and generate passengers from the housing inputs.
    # 2. Schedule passenger arrivals and streetcar entries using the input settings.
    # 3. Process events and collect results for metrics and replay.
