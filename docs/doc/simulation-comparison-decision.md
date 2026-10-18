# Simulation comparisons: Today and custom configurations

Decision recorded: October 17, 2026.

## Decision

Each simulation represents one configuration: the housing, streetcar frequency, arrival variation, and other settings submitted for that run. Users change settings between simulations. Viewing a result must not imply that changing a dropdown reruns it or changes its configuration.

Replace the predefined **Today / New housing / Housing + transit** scenario choices with a comparison between a bundled **Today** baseline and up to **two saved custom simulations**. This applies to both the Station and Line tabs, including service reliability and the comparison table below it.

Status: implemented for the map inspector. The map starts from a bundled native Today baseline. Completed configurations are saved in browser IndexedDB; names and comparison selection are separate from result data.

## Why

“Improvements” is too vague and makes a judgment about the result. A configuration could increase frequency by 1% or 100%, introduce new housing, and also make service less consistent. The user defines those changes; the app should describe them accurately and show their effects.

New housing is a factual configuration change. Better transit performance is something the results must demonstrate.

## Today baseline

- Bundle a saved simulation result with the app, generated from the agreed existing housing and default streetcar settings.
- Keep its full input configuration and results together. Record the modeled service date, time window, corridor/direction, model and data versions, seeds, and run count.
- Label the baseline date and window. “Today” is a reference configuration, not a claim that the app has live or continuously updated ridership data.
- Replacing the bundled baseline creates a new version. Old saved runs retain their original metadata so differences remain explainable.
- Do not relabel the existing synthetic fixture as today's baseline. Fixture/demo results must remain distinguishable from the intended modeled baseline.

## User flow

1. The user chooses simulation settings and runs the simulation.
2. The completed result retains the submitted settings. Later edits to the form do not change that saved result.
3. Opening the results sidebar shows that simulation against Today. If its effective inputs match the baseline, label it **Today configuration**. Otherwise, default to **Custom configuration**.
4. The user can rename a saved simulation. Names such as “New housing” or “More frequent streetcars” are user choices, not automatic claims of improvement.
5. **Add comparison** opens a picker of completed saved simulations. Allow Today plus at most two distinct custom simulations at once. Disable adding another once both custom slots are filled; removing one frees a slot. Today stays visible.

Use compact factual summaries alongside names, for example: **3 developments · 5-minute service · higher arrival variation**. Renaming changes the display name, not the inputs or results.

## Sidebar behavior

Use the same selected simulations throughout the sidebar. Switching Station/Line changes the geographic scope, not the comparison selection.

| Section | Comparison behavior |
| --- | --- |
| Existing demand | Show existing-housing rider arrivals over the modeled window and average wait to board. These are not the people currently waiting on the platform. |
| Added housing demand | Show the custom configuration's housing and additional rider arrivals, with changes against Today. If multiple settings changed, describe the wait difference as a configuration effect, not an effect caused solely by housing. |
| Service reliability | Show Today's spacing score and the corresponding score for each selected custom simulation together. Remove the scenario dropdown. Keep the average streetcar gap visible so consistent but infrequent service cannot look sufficient on its own. |
| Line operations | Compare available corridor-wide journey, crowding, dispatch, and cutoff metrics for those same saved simulations. Clearly state that Line covers the modeled corridor, not the entire TTC route. |
| Comparison table | Use Today and the selected simulation names as vertical columns of soft squircle metric cards, keeping the same metric order across columns. Include average wait, denied boarding, and people physically waiting at simulation end. Avoid repeating a second set of predefined scenarios. |

Keep Today first and give each custom simulation a consistent visual identity across sections. Display direct values beside their changes from Today. Time changes use seconds/minutes; percentage changes must be labelled explicitly. A change in a share uses **percentage points** when showing an absolute difference.

## Metric and comparison rules

- **Matching configuration is not matching output.** An unchanged setup can produce different results because of random draws. “Today configuration” describes the inputs, not guaranteed numerical equality with the bundled result.
- Compare effective simulation inputs, not the simulation name. A changed title or seed alone does not make a new housing/service configuration. Retain seeds separately for reproducibility.
- For controlled comparisons, use matching seeds and run counts where supported. Otherwise, preserve and expose those differences; do not imply a configuration change alone explains all observed variation.
- Require a compatible corridor, direction, modeled window, metric definitions, and model/data versions for a direct comparison. Explain incompatibility instead of silently placing unrelated results together.
- **Average wait to board** means time from arriving at the stop until boarding. Riders still waiting at cutoff have an unfinished wait and are reported separately. Do not silently mix legacy completed-trip waits with native boarded-rider waits.
- **Still waiting** means the physical queue at simulation end. It is not a live queue and is not interchangeable with the native metric for riders still stranded after a capacity denial. Keep onboard/in-progress riders separate as defined by the API.
- Preserve the API's denied-boarding denominator. Missing metrics show **- / Not available**, not zero.
- Keep the shared custom spacing-score formula documented in `frontend/src/panels/transitMetrics.ts`; all compared runs use the same formula. It measures spacing consistency, not frequency or an official TTC service grade.

## Implementation notes

- The bundled baseline uses the reviewed simulation inputs with proposed developments excluded, seeds 42–44, and three trials. `backend/scripts/build_today_baseline.py` regenerates the bundle, including input and model digests. It is not inserted into user history.
- Both pickers use the same blue popover styling. **Add comparison** adds a sidebar column; **Past sims** loads a saved configuration's housing and results into the map. The latter also offers a return to Today.
- Completed frontend runs are saved locally with their completion timestamp. Imported API history retains user names; older API records without a timestamp display “Timestamp not recorded” rather than an invented creation date.
- Users can rename simulations inside either picker. Deleting a simulation through the run workspace removes the local saved copy too.
- A fresh simulation form starts without proposed housing selected, matching the baseline housing configuration. The map no longer automatically starts the old package comparison when opened.
- Saved batches map to a single result configuration. Backend package categories are not offered as user-authored scenarios in the inspector.
- Corridor and time-window compatibility are checked. New configured-batch responses now include optional `provenance` with model/data/orchestrator versions, source IDs, configuration ID and a server recording timestamp. Older batches without it remain unverified. Lane D still needs to consume this metadata when checking historical version compatibility; the backend addition alone does not make the inspector enforce it.

The central rule is simple: **compare the saved configurations the user actually ran, against a clearly defined Today baseline.**
