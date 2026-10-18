# Urbanova

**See what new housing could change in your neighbourhood.**

Urbanova is a neighbourhood exploration and transit simulation prototype that helps Toronto residents understand how proposed buildings could affect the places they use every day: the view from their street, sunlight in a nearby park, and the streetcar they take to work or school.

It brings these questions together around a real development proposal, helping people picture the change, explore possible impacts and compare transit improvements that could support new homes.

## Why we built it

Hearing that a new building will have 30 storeys and hundreds of homes does not make it easy to imagine living beside it. Planning documents and architectural drawings can be difficult to connect to familiar surroundings.

Residents have practical questions: How will the skyline look from my street? Will a building block afternoon sunlight at the park? Will my usual streetcar become more crowded? What would help transit keep up as people move in?

These questions are connected. New housing changes both the shape of a neighbourhood and the number of people sharing its services. Urbanova aims to make those changes understandable so residents can take part in community discussions with clearer questions and evidence. It also makes room for benefits, including more homes, useful summer shade and improvements to transit.

## Who it is for

Urbanova is designed primarily for existing residents. Community groups, prospective residents, journalists and planners can also use it to explore proposals, question assumptions and discuss what a growing neighbourhood needs.

## What you can explore

### Buildings and the skyline

Explore a 3D neighbourhood from street level or above. Toggle proposed buildings to see their height, scale and relationship to existing surroundings. Proposals appear as simplified building shapes so residents can distinguish them from the existing neighbourhood.

### Sunlight and shadows

Compare shadows with and without a proposal at different dates and times. Explore where a new building could block direct sunlight or provide shade, and how that changes across seasons.

### Your streetcar commute

Transit simulation is the core of Urbanova. Explore how new residents could affect queues, waiting times, streetcar crowding and the chance of being unable to board a full vehicle. A building farther up the route can affect your stop if more people board before the streetcar reaches you.

Compare growth with unchanged service against more frequent streetcars, a transit priority lane, or both. The comparison considers costs, available vehicles and when improvements could be ready, alongside their potential benefits for riders.

## How it works

Urbanova connects real housing proposals, building and walking maps, and TTC schedules with explicit assumptions about occupancy and travel demand. The transit model follows passengers and streetcars along the corridor, including people left waiting when a vehicle fills up.

Testing different demand levels and repeating simulations helps explore how results change when uncertain inputs change. Housing stays the same across transit options, making it easier to understand what each service improvement contributes.

The Gemini/Papiers research partner extends this comparison with questions such as, “Why does my stop get worse when the new building is farther away?” It proposes an explanation, tests it through the simulator and explains what the results support. Residents can add context or constraints to guide the next investigation.

## A typical visit

1. **Find a familiar place.** Select a proposal near home, a park or your usual stop.
2. **Picture the change.** Toggle the proposed buildings and compare sunlight at a date and time you care about.
3. **Explore your commute.** Inspect how housing growth could change waiting and crowding at your stop.
4. **Compare improvements.** Test transit options and review their benefits, costs and assumptions.
5. **Bring evidence into the discussion.** Save a comparison brief with results, sources and uncertainties.

## Our starting neighbourhood

The initial study area follows the **westbound TTC 505 Dundas corridor from Broadview Avenue to TMU Station at Yonge and Dundas**. It covers nine stops and three selected proposals: **239, 500 and 761 Dundas Street East**.

This focused area lets us connect specific housing proposals to nearby places and a shared transit route. Urbanova was developed for **Hack the Valley 11**.

## Understanding the results

Urbanova is an exploratory prototype. Its results describe what could happen under selected assumptions. Observed stop-level passenger demand is incomplete, and occupancy, travel behaviour and service improvements contain uncertain inputs. The model does not establish a calibrated TTC forecast.

The 3D buildings are simplified representations, and the shadow comparison models sunlight on flat ground. It does not predict temperature or thermal comfort. The experience above describes the intended product workflow; integration and completion details are tracked in the project documentation.

## Team contributions

### Emilia

- Developed the core transit simulation, modelling passenger demand, streetcar frequency, delays and crowding, with passenger destinations informed by Toronto's workplace distribution.
- Designed the passenger, streetcar, input and event-log models, and helped align how the backend and frontend interpret simulation data.
- Built the full 3D simulation replay, including streetcar movement, passengers walking to stops, clickable passenger counts and colour-coded crowding indicators, all driven by recorded simulation events.
- Helped the frontend team resolve UI issues and improve presentation so the connection between housing growth and transit demand is clearer.

### Zain

- Built the interactive corridor map frontend, including the TypeScript types, the API client and the design-token system.
- Built the 3D map with Mapbox, showing extruded towers and accurate massing for the proposed buildings by development phase, along with their ground shadows and sunlight impact.
- Built the development panel, stop inspector, scenario controls and replay timeline, with walking catchments, Street View and links to City application records.
- Designed Urbanova's look and feel, and added the Gemini copilot that answers questions from the research while treating simulation results as the ground truth.

### Una

- Co-wrote the project design document and the backend stack decision, and researched corridor feasibility before moving the study area to the westbound 505 Dundas corridor.
- Built the 3D massing and sunlight data, covering 2,444 corridor buildings, simplified models of the three proposals, and ground shadows with and without the proposals across different seasons and times of day.
- Moved the simulation's key assumptions into validated inputs with sources, and built a costed catalogue of service improvements like more frequent streetcars and streetcar priority.
- Added the headway selector, cost card, panels and before/after impact card to the Run simulation page, fixed the transit metrics in the station panel, and polished the overall map experience.

### Matt

- Implemented the Express/TypeScript API with Zod validation, PostgreSQL persistence on Tiger Data, versioned result caching and Railway deployment.
- Integrated the Python simulator through background workers, preserving native outputs, seed IDs, replay events and simulation metrics.
- Built service-package feasibility checks, capital and operating budget constraints, matched-seed comparisons and demand sensitivity analysis.
- Developed the reviewed corridor data pipeline, including housing-unit inventories, source provenance, labelled estimates and walking-access inputs.
- Integrated Gemini structured outputs for validated scenario patches, grounded explanations and chat-triggered simulations.
- Implemented an assumption-auditing research loop with Papiers CLI reads, hypothesis evaluation, bounded Gemini experiment selection, human redirects and persisted investigation history.
- Added API, database, simulation-integration and AI validation tests, plus deployment checks and reproducible setup scripts.
  
## Running and exploring the project

The interface uses React and TypeScript, with a Python transit simulator and an Express API backed by PostgreSQL.

- [Run the backend](docs/lane-c.md#run) and follow the [frontend setup](frontend/README.md).
- Open `/analysis` in the frontend to run comparisons; see the [live analysis guide](docs/live-analysis.md).
- Read the [data sources and assumptions](docs/simulation-data.md), [completion checklist](docs/completion.md), or the full [Project Plan v2](docs/doc/Urbanova_Project_Plan_Ver2.pdf).
