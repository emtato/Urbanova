# Urbanova: Project Vision & Big Picture

> **See what new housing could change in your neighbourhood.**

## 1. Mission: What Problem Are We Solving?

Urbanova helps Toronto residents picture and understand how proposed residential developments could affect their community: the buildings they see, the sunlight in places they use, and the transit they depend on.

Transit simulation remains the core of the product. Residents should be able to understand how their commute could change, test service improvements and use the results to advocate for transit that keeps pace with new housing.

A planning application might describe a 33-storey tower and hundreds of new homes. Those numbers are difficult to connect to everyday experience. Residents need to understand what a proposal could mean from their street, in their park, or at their usual streetcar stop.

**Our central question:**

> How could this development change my commute and neighbourhood, and what improvements would help accommodate that growth?

Existing residents are the primary audience. Community groups, prospective residents, journalists and planners can use the same evidence to explore questions and discuss tradeoffs.

The aim is to support informed participation in neighbourhood change. The experience should show benefits, pressures and possible improvements together, including additional homes, seasonal shade and better transit service.

---

## 2. Three Connected Ways to Explore Change

### A. Street-Level View: What Would It Look Like?

Residents explore a navigable 3D neighbourhood from eye level, moving around a proposal and onto neighbouring streets. Proposed towers appear as distinguishable, translucent building masses within the existing surroundings.

Users can toggle the proposal to understand its scale, height and relationship to familiar places. Street-level and aerial perspectives share the same scene and development scenario.

Building heights and footprints should come from proposal evidence where available. Simplified or assumed geometry must be labelled clearly.

### B. Sunlight and Shadows: What Changes Where I Stand?

Residents select a location and adjust the date and time to see how the proposed buildings could change direct sunlight there.

The comparison shows existing conditions and the additional shadow introduced by the proposal. A resident might explore a park bench, pavement, courtyard or nearby building at different times of year.

The goal is to make seasonal changes understandable, including both lost sunlight and useful summer shade. This feature models sunlight and shadows; temperature and thermal comfort require additional modelling.

### C. Aerial View and Transit: What Happens to My Trip?

An aerial 3D view connects the developments to nearby stops and the streetcar corridor. Residents can inspect their usual stop and follow a simulated commute: crowding at stops and stations, the passenger load inside individual streetcars, waiting times, journey times and the chance of being unable to board a full vehicle.

This is the main interactive simulation experience. It shows how new demand affects existing and future riders, including how fuller vehicles upstream can leave people waiting farther along the route. Residents can then test whether more frequent or reliable service improves their trip.

Building scale and sunlight extend this core into a broader view of neighbourhood change. The same proposal and occupancy scenario connects the views, so a user can move from looking at a building to inspecting their stop without losing the comparison.

---

## 3. The Resident Experience

A typical demonstration follows one resident's questions:

1. **Find a familiar place.** Open the neighbourhood and select a real proposal near home, a park or a regular stop.
2. **See the change.** Toggle the proposed buildings and explore their scale from street level and above.
3. **Explore sunlight.** Choose a location, date and time; compare shadows with and without the development.
4. **Inspect the commute.** Compare current conditions with a future housing scenario at the usual stop: queues, streetcar crowding, boarding chances, waiting and journey times.
5. **Test a response.** Adjust service frequency and reliability, compare transit improvements and inspect the assumptions, costs and constraints behind their effects.
6. **Use the evidence.** Save a readable comparison with sources and uncertainties to discuss neighbourhood change or advocate for more frequent service.

The experience should connect personal questions to inspectable evidence. Text summaries, keyboard controls and a map/list alternative keep the essential information accessible beyond the 3D view.

---

## 4. Core Transit Simulation and AI Research

The transit model connects housing to passenger demand through net added homes, occupancy, residents per occupied home, trip rates, transit share and walking access to stops. Existing riders and riders from new developments remain distinguishable.

The intended simulation covers passenger arrivals, streetcar movement, boarding, alighting, capacity limits, dwell, travel-time variation and persistent queues. Results show crowding both at stops and inside vehicles, denied boarding, waiting, journey times and reliability. Repeated runs and low/central/high demand scenarios help show how outcomes depend on uncertain inputs.

Residents can adjust housing occupancy, demand assumptions, service frequency/headway and service variability. They can compare today's baseline, growth with unchanged service, and growth with extra service, transit priority or both. Future service comparisons hold housing and passenger assumptions fixed so the effect of each improvement is understandable.

Service packages account for available fleet, capital and annual operating costs, and delivery timing, including upgrades that arrive after residents move in. These comparisons help residents explore a concrete request, such as how much more frequent service might be needed to improve boarding at their stop.

The planned Gemini/Papiers research layer supports questions such as: **“Why does my stop get worse even though the new building is farther up the route?”** It uses source material and computed results to propose an explanation, run a bounded comparison, evaluate it and choose a follow-up question. Human feedback can redirect the investigation.

Its explanations must distinguish evidence from assumptions. It can investigate effects within the model; it cannot establish unseen real-world causes or invent observations.

The backend produces timestamped activity records and results for the frontend to replay. Saved inputs, sources, seeds and model versions make comparisons inspectable and reproducible.

---

## 5. Initial Scope and Current Status

**Study area: TTC 505 Dundas, westbound, Broadview → TMU Station at Yonge/Dundas.**

The reviewed corridor contains nine stops and three selected proposals: 239 Dundas Street East, 500 Dundas Street East and 761 Dundas Street East. A [simulation data handoff](../simulation-data.md) now supplies the input dataclasses with an expanded mapped-building residential inventory with published counts and explicit unit estimates, adopted development-revision counts, household/travel context and explicit occupancy/demand assumptions. This is not complete catchment coverage or observed stop-level demand; the 761 replacement count and walking field review remain unresolved.

The intended prototype centres on an adjustable transit simulation along this corridor, connected to a bounded neighbourhood scene, proposal toggles and date/time shadow exploration. Two occupancy phases, demand ranges and repeated simulation runs remain transit goals. Comparing alternative routes is a future improvement beyond the initial single-corridor model. A focused, connected demonstration takes priority over expanding geographic coverage.

This document describes the product vision. The current frontend displays a hand-authored fixture, while the simulation runner currently handles empty streetcar movement, variable link times and activity logging. Passenger simulation, integration with the frontend, the proposed 3D experience and shadow analysis remain work to complete.

---

## 6. Intended Distinction and Challenge Fit

3D proposal visualisation, public planning tools and shadow analysis already exist, including in [VU.CITY](https://www.vu.city/planners) and [ArcGIS Urban](https://learn.arcgis.com/en/projects/explore-an-urban-model/). We should describe our contribution through the working resident experience rather than claim these individual capabilities are new.

**Urbanova's intended distinction is a resident-centred transit simulation connected to real Toronto housing proposals, familiar places and seasonal sunlight changes, with adjustable scenarios that help people understand their commute and explore improvements.**

The School of Cities challenge is the clearest fit: help people understand a concrete Toronto urban issue using meaningful local data. Originality matters alongside usefulness, execution, accessibility and responsible interpretation. AI for Social Impact fits when the research and explanations help residents understand evidence and challenge assumptions. Climate and sustainability claims should be limited to what the prototype actually evaluates.

---

## 7. Evidence and Responsible Interpretation

Urbanova is an exploratory scenario tool. Its visuals and simulations must make their assumptions visible:

- Distinguish proposed designs, simplified masses and hypothetical changes.
- Compare new shadows with the existing surroundings at the same date and time.
- Identify scheduled transit data, measured observations and user-selected assumptions separately.
- Preserve uncertainty in demand, occupancy, service reliability and building geometry.
- Present transit outcomes as conditional scenarios, with benefits and pressures shown together.
- Support informed community discussion without implying that the prototype determines planning approval or predicts future conditions precisely.

**The value proposition:** Help residents see how new housing could change their commute and neighbourhood, test what better transit could achieve, and bring understandable evidence into community discussions.
