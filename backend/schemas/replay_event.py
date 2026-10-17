from typing import Literal

from .base import ContractModel, Count, Identifier, NonNegative

RiderGroup = Literal["existing", "new"]


class ReplayEvent(ContractModel):
    run_id: Identifier
    t_s: NonNegative
    kind: Literal["dispatch", "arrive", "alight", "board", "deny", "depart"]
    vehicle_id: Identifier
    stop_id: Identifier
    count: Count
    load_after: Count
    rider_group: RiderGroup | None
