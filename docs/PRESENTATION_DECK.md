# PlatoVue: Recruiting Intelligence Platform
## Executive Presentation Guide

---

# Section 1: The Problem

## TA Teams Are Flying Blind

### Current State Pain Points

| Challenge | Impact |
|-----------|--------|
| **Spreadsheet Hell** | TA leaders spend 4-8 hours/week building reports manually from ATS exports |
| **Stale Data** | By the time reports are built, the data is already outdated |
| **No Early Warning System** | Problems surface when it's too late (missed hiring goals, blown timelines) |
| **HM Accountability Gap** | No visibility into which hiring managers are slowing down the process |
| **Vanity Metrics** | Standard ATS reports show activity, not outcomes or bottlenecks |
| **Data Quality Issues** | Garbage in, garbage out - but nobody knows what's garbage |

### The Real Cost

- **Missed hires**: Reqs stay open longer than necessary due to invisible bottlenecks
- **Wasted effort**: Recruiters work reqs that should have been closed months ago
- **Lost credibility**: TA can't answer basic questions like "Why did that take so long?"
- **Reactive firefighting**: No time for strategic work when constantly putting out fires

---

# Section 2: The Solution

## PlatoVue: Decision-Grade Recruiting Analytics

### Core Value Proposition

> **Turn raw ATS data into actionable intelligence in minutes, not days.**

### How It Works (30-Second Version)

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  CSV Export │ ──▶ │  Smart Parsing   │ ──▶ │  Clean Metrics  │
│  from ATS   │     │  & Normalization │     │  & Insights     │
└─────────────┘     └──────────────────┘     └─────────────────┘
                            │
                            ▼
                    ┌──────────────────┐
                    │ • Stage mapping  │
                    │ • Data hygiene   │
                    │ • Metric engine  │
                    │ • Risk detection │
                    └──────────────────┘
```

### Key Differentiators

| Traditional Reporting | PlatoVue |
|----------------------|----------|
| Shows what happened | Shows what to do next |
| Historical snapshots | Real-time risk alerts |
| Activity metrics | Outcome metrics |
| Blame-oriented | Action-oriented |
| IT/analyst dependency | Self-service |

---

# Section 3: Feature Deep-Dive

## 3.1 Control Tower (Command Center)

### What It Does
Executive dashboard showing the 5 most critical KPIs with red/yellow/green status, top risks, and a unified action queue.

### Why It Matters
> "As a TA Leader, I need to know in 30 seconds if we're on track or if something needs my attention."

### The Intelligence Behind It

**Health KPIs Calculated:**

| KPI | Calculation | Target | Why This Matters |
|-----|-------------|--------|------------------|
| **Median TTF** | Median days from req open to hire (excluding zombies) | <45 days | Industry benchmark; longer = higher cost-per-hire |
| **Offers** | Count of candidates reaching offer stage in period | Varies | Leading indicator of upcoming hires |
| **Accept Rate** | Offers accepted ÷ Offers extended | >80% | Low rate = comp issues or candidate experience problems |
| **Stalled Reqs** | Reqs with no candidate activity 14-30 days | 0 | Early warning before reqs become zombies |
| **HM Latency** | Avg days for HM feedback after interview | <2 days | #1 controllable factor in candidate drop-off |

**Risk Detection Logic:**

```
Risk Priority Rules:
├── P0 (Critical): Blocking hiring or losing candidates now
│   ├── Offer pending >7 days (candidate will accept elsewhere)
│   ├── HM feedback overdue >5 days (candidate ghosting risk)
│   └── Zero pipeline on priority req
│
├── P1 (High): Will become critical within 1-2 weeks
│   ├── Stalled req (14-30 days no activity)
│   ├── HM feedback overdue 2-5 days
│   └── Req open >90 days with <5 candidates
│
└── P2 (Medium): Optimization opportunities
    ├── Source channel underperforming
    ├── Stage conversion below benchmark
    └── Recruiter capacity imbalance
```

---

## 3.2 HM Friction Analysis

### What It Does
Identifies which hiring managers are creating bottlenecks by measuring feedback latency at each stage.

### Why It Matters
> "80% of preventable candidate drop-off happens while waiting for hiring manager feedback."

### The Intelligence Behind It

**Latency Calculation:**

```
For each HM action (resume review, interview feedback, decision):

Latency = Date action completed - Date action was due

Due dates derived from:
├── Resume submitted → Review due in 2 business days
├── Interview completed → Feedback due in 1 business day
└── Final round done → Decision due in 2 business days
```

**HM Scorecard Metrics:**

| Metric | Formula | What It Reveals |
|--------|---------|-----------------|
| **Avg Feedback Time** | Sum(feedback_latency) ÷ Count(feedback_requests) | Responsiveness |
| **Overdue Rate** | Count(late_feedback) ÷ Total_feedback_requests | Reliability |
| **Candidate Drop Rate** | Withdrawals during HM stages ÷ Total in HM stages | Impact of delays |
| **Offer Velocity** | Days from final interview to offer | Decision speed |

**Why This Data Didn't Exist Before:**
- ATS tracks when things happen, not when they should have happened
- PlatoVue infers SLAs from stage transitions and flags violations
- Aggregates by HM to show patterns, not one-off incidents

---

## 3.3 Data Health Engine

### What It Does
Automatically identifies data quality issues that corrupt your metrics, then calculates "true" metrics excluding bad data.

### Why It Matters
> "Your TTF looks like 65 days, but 30% of your reqs are zombies. True TTF is actually 41 days."

### The Intelligence Behind It

**Zombie Req Detection:**

```
Zombie = Req marked "Open" but:
├── No new candidates in 30+ days, AND
├── No stage transitions in 30+ days, AND
└── Not explicitly paused/on-hold

Impact: Zombies inflate TTF and hide real performance
Action: Close or actively source - don't let them rot
```

**Ghost Candidate Detection:**

```
Ghost = Candidate in active stage but:
├── No activity in 10+ days (Stagnant), OR
├── No activity in 30+ days (Abandoned)

Impact: Inflates pipeline counts, creates false confidence
Action: Disposition or re-engage
```

**True TTF vs Raw TTF:**

| Metric | Calculation | Use Case |
|--------|-------------|----------|
| **Raw TTF** | All closed reqs: close_date - open_date | Audit/compliance |
| **True TTF** | Excluding zombies, backfills, evergreen | Performance benchmarking |
| **Hire TTF** | Only filled reqs (not cancelled) | Recruiter performance |

---

## 3.4 Ask PlatoVue (Conversational Interface)

### What It Does
Natural language interface to query your recruiting data. Ask questions in plain English, get instant answers with citations.

### Why It Matters
> "Why did Q3 hiring take so long?" shouldn't require a data analyst and 2 weeks.

### The Intelligence Behind It

**Two Modes:**

| Mode | How It Works | Best For |
|------|--------------|----------|
| **Deterministic (AI-OFF)** | Pattern matching against 10 pre-built intent handlers | Fast, consistent answers to common questions |
| **AI-Powered (BYOK)** | Your API key, strict JSON schema, citation validation | Complex/novel questions |

**Pre-Built Intent Handlers:**

```
Intent: "What's on fire?"
→ Returns: Top P0 risks, stalled reqs, overdue HM actions

Intent: "Why is time-to-offer high?"
→ Returns: Stage-by-stage breakdown, bottleneck identification

Intent: "Show me forecast gap"
→ Returns: Expected hires vs open reqs, confidence score

Intent: "Which sources are working?"
→ Returns: Source mix by volume, conversion rates, cost efficiency
```

**Citation Requirement:**
Every number in a response must cite its source in the Fact Pack. No hallucinated metrics.

---

## 3.5 Velocity Insights

### What It Does
Analyzes your hiring funnel to identify where candidates drop off and how long each stage takes.

### Why It Matters
> "We're sourcing enough candidates. We're losing them at HM Screen - that's our bottleneck."

### The Intelligence Behind It

**Funnel Analysis:**

```
Stage Conversion Rates:
┌─────────────────┬────────┬─────────────────────────────┐
│ Stage           │ Rate   │ Benchmark                   │
├─────────────────┼────────┼─────────────────────────────┤
│ Applied → Screen│ 45%    │ 30-50% typical              │
│ Screen → HM     │ 62%    │ 50-70% typical              │
│ HM → Onsite     │ 38%    │ 30-50% typical (bottleneck?)│
│ Onsite → Offer  │ 71%    │ 60-80% typical              │
│ Offer → Hire    │ 85%    │ 80-95% typical              │
└─────────────────┴────────┴─────────────────────────────┘
```

**Stage Duration Analysis:**

```
Median Days in Stage:
├── Screen: 3 days ✓
├── HM Review: 8 days ⚠️ (target: 3 days)
├── Onsite Scheduling: 12 days ⚠️ (target: 7 days)
├── Offer Prep: 4 days ✓
└── Total: 27 days
```

**Minimum Sample Thresholds:**
- Won't show conversion rates with <5 candidates in denominator
- Won't show stage durations with <10 data points
- Displays confidence badges (High/Med/Low) based on sample size

---

## 3.6 Forecasting

### What It Does
Predicts expected hires based on current pipeline, historical conversion rates, and stage velocity.

### Why It Matters
> "We have 15 open reqs. How many will we actually fill this quarter?"

### The Intelligence Behind It

**Probability-Weighted Pipeline:**

```
For each candidate in pipeline:

Expected Hires += Stage_Probability × Time_Decay_Factor

Where:
├── Stage_Probability = Historical conversion rate from current stage to hire
│   ├── Screen: 12%
│   ├── HM Review: 18%
│   ├── Onsite: 35%
│   ├── Final: 55%
│   └── Offer: 85%
│
└── Time_Decay_Factor = Adjustment for time already in stage
    └── Candidates in stage >2x median duration get 50% weight reduction
```

**Gap Analysis:**

```
┌──────────────────────────────────────────────────────┐
│ Open Reqs:        25                                 │
│ Expected Hires:   18.3 (probability-weighted)        │
│ Gap to Goal:      6.7 reqs at risk                   │
│ Confidence:       Medium (based on data quality)     │
│                                                      │
│ Recommendation: Source more for 7 highest-priority   │
│ reqs to close the gap                                │
└──────────────────────────────────────────────────────┘
```

---

## 3.7 AI Copilot (BYOK)

### What It Does
Bring-your-own-key AI integration for summaries, explanations, and draft communications.

### Why It Matters
> "Explain this chart to me" or "Draft an update email for the hiring manager" - without leaving the tool.

### The Intelligence Behind It

**Zero-Knowledge Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│ Your API Key → Encrypted client-side with your passphrase  │
│             → Stored encrypted in Supabase                  │
│             → Server NEVER sees plaintext key               │
│             → Decrypted only in your browser                │
└─────────────────────────────────────────────────────────────┘
```

**PII Protection:**
- Candidate names replaced with "Candidate 1", "Candidate 2"
- Recruiter names anonymized in AI prompts
- Req titles scrubbed of identifying info
- Only aggregated metrics sent to AI, never raw records

**Supported Providers:**
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude)
- Google (Gemini)
- OpenAI-compatible endpoints (Azure, local models)

---

# Section 4: Data Pipeline Deep-Dive

## How CSV Becomes Intelligence

### Stage 1: Smart Parsing

```
Raw CSV Input:
┌────────────────────────────────────────────────────────────┐
│ Req ID, Title, Status, Candidate, Stage, Date...          │
│ REQ-001, Software Eng, Open, John Doe, Phone Screen, ...  │
└────────────────────────────────────────────────────────────┘
                           │
                           ▼
Column Detection:
├── Fuzzy matching against known ATS column patterns
├── Supports: iCIMS, Greenhouse, Lever, Workday, generic
├── Maps synonyms: "Job ID" = "Req ID" = "Requisition Number"
└── Detects report type: submittal, requisition, activity
```

### Stage 2: Stage Normalization

```
Problem: Every company names stages differently

Your ATS                    Canonical Stage
─────────────────────────────────────────────
"Phone Screen"          →   SCREEN
"Recruiter Phone"       →   SCREEN
"Initial Call"          →   SCREEN
"HM Interview"          →   HM_SCREEN
"Hiring Manager Review" →   HM_SCREEN
"Onsite Loop"           →   ONSITE
"Virtual Onsite"        →   ONSITE
"Offer Extended"        →   OFFER
"Offer Accepted"        →   HIRED
```

**Why This Matters:**
- Enables cross-company benchmarking
- Makes funnel analysis possible
- Allows historical trend comparison even if you renamed stages

### Stage 3: Data Hygiene

```
Raw Records: 10,000 candidates across 500 reqs
                           │
                           ▼
Hygiene Filters Applied:
├── Zombie reqs identified: 47 (excluded from TTF)
├── Ghost candidates flagged: 312 (pipeline adjustment)
├── Duplicate candidates merged: 23
├── Invalid dates corrected: 156
└── Missing stages inferred: 89
                           │
                           ▼
Clean Records: 9,688 candidates, 453 active reqs
Data Quality Score: 87/100
```

### Stage 4: Metric Computation

```
Clean Data → Metric Engine
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   Recruiter           HM Metrics        Org Metrics
   Metrics
├── Req load        ├── Feedback time   ├── TTF (median)
├── Candidates/req  ├── Overdue count   ├── Offer volume
├── Stage velocity  ├── Drop rate       ├── Accept rate
├── Conversion rate ├── Decision speed  ├── Source mix
└── Fill rate       └── Bottleneck ID   └── Forecast
```

### Stage 5: Risk Detection

```
Metric Engine Output → Risk Analyzer
                           │
                           ▼
For each req, candidate, HM:
├── Check against thresholds
├── Assign risk category
├── Calculate priority score
├── Generate recommended action
└── Link to evidence (drilldown)
                           │
                           ▼
Unified Action Queue:
┌────────────────────────────────────────────────────────┐
│ P0: "Offer pending 8 days - Sarah Chen, REQ-1234"     │
│     Action: Follow up with candidate today             │
│     Evidence: Offer extended 1/8, no response          │
├────────────────────────────────────────────────────────┤
│ P1: "HM feedback overdue - Mike Johnson, 3 candidates" │
│     Action: Escalate to HM or their manager            │
│     Evidence: Interviews 1/5, 1/6, 1/7 - no feedback   │
└────────────────────────────────────────────────────────┘
```

---

# Section 5: Sample Insights

## Real Examples of What PlatoVue Reveals

### Example 1: The Hidden Bottleneck

**Before PlatoVue:**
> "Our TTF is 52 days. Industry average is 45. We need to source faster."

**After PlatoVue:**
> "Your sourcing is fine - candidates reach HM review in 8 days (good). But HM review takes 18 days average. Mike Johnson and Sarah Lee are 3x slower than other HMs. Fix that, TTF drops to 38 days."

### Example 2: The Zombie Problem

**Before PlatoVue:**
> "We have 120 open reqs but keep missing hiring goals."

**After PlatoVue:**
> "34 of those 120 reqs are zombies - no activity in 45+ days. Real open reqs: 86. Close the zombies, focus the team, hit your goals."

### Example 3: The Offer Bleed

**Before PlatoVue:**
> "We're making enough offers but not hitting hire targets."

**After PlatoVue:**
> "Your accept rate dropped from 88% to 71% over 3 months. Candidates are declining due to 'other offer accepted' (competing faster) and 'compensation' (market moved). Time to offer is 6 days - cut to 3 and revisit comp bands."

---

# Section 6: Implementation

## Getting Started

### Data Requirements

| Data Type | Required Columns | Nice to Have |
|-----------|------------------|--------------|
| **Requisitions** | Req ID, Title, Status, Open Date | Department, HM, Location, Target Date |
| **Candidates** | Candidate ID, Name, Current Stage | Source, Applied Date, Email |
| **Events** | Candidate ID, Stage, Date | Event Type, Performed By |

### Supported ATS Exports

- iCIMS (Submittal Report, Requisition Report)
- Greenhouse (Candidate Export, Job Export)
- Lever (Opportunity Export)
- Workday (Candidate Pipeline)
- Generic CSV (with column mapping)

### Time to Value

| Milestone | Timeline |
|-----------|----------|
| First data import | 5 minutes |
| Initial insights visible | Immediate |
| Full dashboard populated | Same day |
| Team onboarded | 1 week |
| Process improvements measurable | 30 days |

---

# Section 7: Security & Compliance

## Data Protection

| Concern | How PlatoVue Addresses It |
|---------|---------------------------|
| **Data storage** | Supabase (SOC2 compliant), encrypted at rest |
| **Access control** | Row-level security, org isolation |
| **AI keys** | Zero-knowledge encryption, never stored in plaintext |
| **PII handling** | Anonymized before AI processing |
| **Data retention** | Customer-controlled, delete anytime |

---

# Appendix: Glossary

| Term | Definition |
|------|------------|
| **TTF (Time to Fill)** | Days from req opened to candidate hired |
| **TTO (Time to Offer)** | Days from application to offer extended |
| **Zombie Req** | Open req with no activity 30+ days |
| **Ghost Candidate** | Candidate stuck in stage 10+ days with no action |
| **HM Latency** | Time for hiring manager to provide feedback |
| **Stage Conversion** | % of candidates advancing from one stage to next |
| **Pipeline Gap** | Open reqs minus probability-weighted expected hires |
| **Canonical Stage** | Standardized stage name mapped from ATS-specific names |

---

# Appendix: Metric Formulas

## Core Metrics

```
Median TTF = MEDIAN(hire_date - open_date)
             WHERE status = 'Filled'
             AND is_zombie = false

Accept Rate = COUNT(offers WHERE accepted = true)
            ÷ COUNT(offers WHERE decision_made = true)

HM Latency = AVG(feedback_date - interview_date)
             GROUP BY hiring_manager

Stage Conversion = COUNT(candidates entering next stage)
                 ÷ COUNT(candidates entering this stage)

Expected Hires = SUM(stage_probability × time_decay_factor)
                 FOR EACH candidate in active pipeline
```

## Risk Scoring

```
Risk Priority Score =
  (Days Overdue × 10)
  + (Business Impact Weight × 5)
  + (Candidate Value Score × 3)

Where:
- Days Overdue: How late vs SLA
- Business Impact: Priority of req (P1/P2/P3)
- Candidate Value: Stage progression (further = higher value)
```
