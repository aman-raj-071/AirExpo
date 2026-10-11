# AirExpo review and stability fixes — 11 October 2026

## Main finding

The document translator cached a text node's original value indefinitely. React reuses text nodes for changing locations, greetings, AQI and status text. On a subsequent MutationObserver pass, the translator restored the old value instead of accepting React's new value. In English, its bookkeeping could alternate between old and new text; in translated languages it could repeatedly restore and translate the same node. This explains visible text fluctuations without any actual GPS movement.

`src/services/i18n.ts` now tracks the source and the last rendered translation separately. A value changed by React becomes the new source. Translation writes only when the final output differs, so repeated observer passes settle.

## Other corrected findings

| Finding | Correction |
| --- | --- |
| Telemetry used nonexistent `current_time` for the Updated label | Use `current.time`, formatted in the selected location's timezone; show an unavailable label when absent. |
| Outdated requests continued consuming network and AI work | Abort location/refresh requests on cleanup; guard results by revision; pass cancellation through AI requests. |
| Starting GPS invalidated an in-flight telemetry request even if permission was denied | Separate location intent revisions from committed telemetry revisions. |
| Search, Analyze and GPS could race; successful Analyze invalidated its own finally block and left the spinner active | Reset selection state explicitly, invalidate obsolete search intents and ignore obsolete dropdown results. |
| Comparison selection did not update the search input; reselecting the same location object could clear data without refetching | Centralize input synchronization and commit a fresh location object. |
| Stored coordinates had no range validation; restoring a foreign location could inherit Delhi's timezone | Validate coordinate ranges and preserve only the stored location's timezone. Give the Delhi default an explicit timezone. |
| AI caches ignored coordinates and most environmental readings | Frontend and server cache keys include exact coordinates, AQI, pollutants and weather, preventing cross-location/stale-reading reuse. |
| Route layer redraws reset map view on AQI refresh or route selection | Update viewport only when coordinates/route geometry change. |
| Route refresh checkbox advertised a disabled timer | Restore the opt-in one-minute refresh, gated by page visibility. |
| Obsolete route responses could update intermediate results/errors/loading | Guard those updates by the current route revision. |
| Alert threshold was saved but never restored | Restore valid cloud or legacy thresholds before autosave. |
| Exposure advisor clock was frozen and used device time for distant locations | Share the dashboard clock and use the selected location's timezone with a fallback. |
| Suggested forecast windows included invented AQI values and times unrelated to the lowest forecast hour | Compare actual consecutive forecast hours and show their actual average and interval. Remove fabricated ventilation/afternoon values. |

## Validation

- `npm test`: 33 tests passed. Five new regression tests import the production translation, telemetry and AI services, with controlled DOM/network inputs.
- New cases cover React text updates, idempotent translation, language changes, correct provider timestamp/coordinates, cancellation, cache collisions and forecast-window averages.
- `npm run lint`: passed with normal filesystem access. Sandboxed execution could not resolve some pnpm junctions and produced misleading dependency errors. No dependency reinstall was needed.
- `npm run build`: passed.

## Review scope and limits

Reviewed dashboard state/effects, greeting and scenery, location search/GPS, translation, environmental and AI data services, route planning/map rendering, alert settings, and inspected the surrounding authentication, health/cloud and backend request paths. Existing uncommitted work was preserved.

Graphify returned HTTP 403: no repositories in its workspace are enabled for agents. Review therefore used the local working tree. No GitHub issue tracker was accessible through this Graphify connection.

The existing 28 AI optimization tests simulate implementations; they do not establish production backend or AWS integration correctness. The five new tests execute the imported production services with controlled dependencies. A signed-in browser session, real GPS permission flows, live Cognito/AWS/SNS operations and deployed behavior were not exercised. No SMS was sent and no deployment was performed. This review does not claim every possible defect has been eliminated.
