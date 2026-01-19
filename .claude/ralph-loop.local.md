---
active: true
iteration: 1
max_iterations: 30
completion_promise: "COMPLETE"
started_at: "2026-01-19T18:50:26Z"
---

Implement [ORACLE_EXPLAINABILITY_FLIP_CARD_V1].

Requirements:
1) Add an info icon to the Oracle widget (top-right).
- Clicking toggles 'Explain mode'.
- The Oracle card flips (3D rotate) to reveal the back side.
- Respect prefers-reduced-motion (use fade instead of flip).

2) Back side content (deterministic, no AI):
- Section: Inputs used
  - pipeline counts by stage
  - stage pass rates (observed, prior, m, shrunk result) with sample sizes
  - stage duration model per stage (empirical/log-normal/global) with n
  - iterations + seed
  - confidence score + reasons (coverage + shrinkage reliance)
- Section: Calibration
  - last calibration score and bias (if available)
  - if unavailable, show 'Calibration not run' + CTA to run it (if supported)

3) Add safe what-if knobs (do not allow arbitrary edits):
- Slider: prior weight m (low/med/high presets)
- Slider: min_n threshold strictness (relaxed/standard/strict)
- Slider: iterations (1000–10000) with performance warning
- Any knob changes must:
  - re-run the simulation (worker)
  - update the front-side P10/P50/P90/probability values
  - label the front-side output as 'Adjusted assumptions' with a small chip

4) Caching + determinism
- With no knob changes, results must remain deterministic.
- Cache per (req_id/cohort, pipeline, seed, knob settings).

5) UI polish
- Back side uses the same deck-inspired production tokens.
- Data shown in compact tables/rows; no wall of text.

6) Tests
- Unit tests:
  - knob settings change the worker input payload
  - cache key includes knob settings
- UI tests:
  - info icon flips view
  - reduced motion uses non-flip fallback
  - changing a knob updates displayed values and shows 'Adjusted assumptions'

Success criteria:
- Flip card works smoothly and is readable.
- Calculations displayed match actual inputs used by the simulation.
- Sliders adjust assumptions safely and transparently.
- No regressions: npm test and npm run build pass.

Output <promise>COMPLETE</promise> when done.
