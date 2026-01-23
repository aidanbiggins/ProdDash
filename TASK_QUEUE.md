# TASK_QUEUE (PlatoVue / ProdDash)

## Rules
- Do tasks top to bottom.
- Mark DONE or BLOCKED.
- Do not add tasks unless the runbook says so.

---

## 1) Command Center Visual Primitives (ONE per section)
Status: DONE
Goal:
- Add one small visual per section (except What-If).
- Pure CSS/TSX primitives.
- Must degrade gracefully with partial data.
Acceptance:
- npm test -- --watchAll=false passes
- npm run build passes
- Visuals render correctly with Ultimate Demo and partial data

---

## 2) Command Center CTA deep links sanity check
Status: DONE
Goal:
- Verify every primary CTA routes somewhere useful.
- If target view missing, open drilldown drawer fallback.
Acceptance:
- No dead clicks in Ultimate Demo
- Tests verify non-empty destinations

---

## 3) Attention tiles show top offender line
Status: TODO
Goal:
- Each attention bucket tile shows top offender summary line (if available).
Examples:
- Top HM: HM 7 (6 overdue)
- Top recruiter: Recruiter 2 (14 reqs)
Acceptance:
- No PII
- Degrades gracefully when offender unavailable

---

## 4) Scenario cards show 2–3 deltas
Status: TODO
Goal:
- Add 2–3 small outcome deltas per scenario card if data supports it.
Examples:
- +8 days, -12% probability, +3 reqs stranded
Acceptance:
- No invented numbers
- Limited/blocked states handled

---

## 5) Exec Brief generation works without BYOK
Status: TODO
Goal:
- Verify Exec Brief generates the 6-section brief without AI enabled.
Acceptance:
- Deterministic brief output
- No errors

---

## Log
(Claude updates this file as it progresses.)