# Ask PlatoVue v1 - Design Plan

## Overview

Ask PlatoVue is a new **top-level tab** that serves as the front door for executives and operators. It provides a conversational interface for querying recruiting data with two modes:

- **AI-OFF** (no BYOK): Guided Q&A using deterministic intent handlers over a pre-computed Fact Pack
- **AI-ON** (BYOK enabled): Free-form Q&A using the existing multi-provider AI integration, grounded in the same Fact Pack with mandatory citations

### Hard Constraints

1. **AI never computes metrics** - all numbers come from the pre-computed Fact Pack
2. **All outputs reference Fact Pack key paths** as evidence (dot notation: `kpis.median_ttf_days`)
3. **No candidate PII** in Fact Pack or AI payload
4. **Graceful degradation** when AI is not configured/unlocked
5. **Must support existing patterns**: Explain, View Evidence, Create Action, Deep Links

---

## 1. Fact Pack Schema

The Fact Pack is a deterministic snapshot computed from dashboard state. All values are pre-computed; the AI formats and explains but never calculates.

### TypeScript Type Definition

```typescript
/**
 * Complete Fact Pack structure for Ask PlatoVue
 * All keys are addressable via dot notation for citations
 */
interface AskFactPack {
  // ─────────────────────────────────────────────────────────────
  // META: Dataset metadata and capability flags
  // ─────────────────────────────────────────────────────────────
  meta: {
    generated_at: string;                    // ISO timestamp
    org_id: string;
    org_name: string;                        // Redacted if needed
    data_window: {
      start_date: string;                    // ISO date
      end_date: string;                      // ISO date
      days: number;                          // Window size
    };
    sample_sizes: {
      total_reqs: number;
      total_candidates: number;
      total_hires: number;
      total_offers: number;
      total_events: number;
    };
    capability_flags: {
      has_stage_timing: boolean;             // Can show stage durations
      has_source_data: boolean;              // Source effectiveness available
      has_hm_data: boolean;                  // HM latency data available
      has_forecast_data: boolean;            // Forecast model available
      has_quality_data: boolean;             // Quality metrics available
      ai_enabled: boolean;                   // BYOK key configured & unlocked
    };
    data_health_score: number;               // 0-100
  };

  // ─────────────────────────────────────────────────────────────
  // CONTROL_TOWER: KPIs with thresholds and sample sizes
  // ─────────────────────────────────────────────────────────────
  control_tower: {
    kpis: {
      median_ttf: KPIMetric;
      offer_count: KPIMetric;
      accept_rate: KPIMetric;
      stalled_reqs: KPIMetric;
      hm_latency: KPIMetric;
    };
    risk_summary: {
      total_at_risk: number;
      by_type: Record<RiskType, number>;     // zombie: 3, stalled: 5, etc.
    };
    action_summary: {
      total_open: number;
      p0_count: number;
      p1_count: number;
      p2_count: number;
    };
  };

  // ─────────────────────────────────────────────────────────────
  // EXPLAIN: Pre-computed explanations for core KPIs
  // ─────────────────────────────────────────────────────────────
  explain: {
    time_to_offer: ExplainSummary;
    hm_latency: ExplainSummary;
    accept_rate: ExplainSummary;
    pipeline_health: ExplainSummary;
    source_effectiveness: ExplainSummary;
  };

  // ─────────────────────────────────────────────────────────────
  // ACTIONS: Top actions from Unified Action Queue
  // ─────────────────────────────────────────────────────────────
  actions: {
    top_p0: ActionSummary[];                 // Max 5
    top_p1: ActionSummary[];                 // Max 5
    by_owner_type: {
      recruiter: number;
      hiring_manager: number;
      ta_ops: number;
    };
  };

  // ─────────────────────────────────────────────────────────────
  // RISKS: Top risks from Control Tower (pre-mortem view)
  // ─────────────────────────────────────────────────────────────
  risks: {
    top_risks: RiskSummary[];                // Max 10
    by_failure_mode: Record<RiskType, RiskSummary[]>;
  };

  // ─────────────────────────────────────────────────────────────
  // FORECAST: Pipeline-based predictions
  // ─────────────────────────────────────────────────────────────
  forecast: {
    expected_hires: number;
    pipeline_gap: number;                    // open_reqs - expected_hires
    confidence: 'high' | 'medium' | 'low';
    open_reqs: number;
    active_candidates: number;
    probability_weighted_pipeline: number;
  };

  // ─────────────────────────────────────────────────────────────
  // VELOCITY: Stage timing and funnel metrics
  // ─────────────────────────────────────────────────────────────
  velocity: {
    funnel: FunnelStage[];
    bottleneck_stage: string | null;
    avg_days_to_offer: number | null;
    avg_days_to_hire: number | null;
  };

  // ─────────────────────────────────────────────────────────────
  // SOURCES: Source effectiveness summary
  // ─────────────────────────────────────────────────────────────
  sources: {
    top_by_volume: SourceSummary[];          // Max 5
    top_by_conversion: SourceSummary[];      // Max 5
    total_sources: number;
  };

  // ─────────────────────────────────────────────────────────────
  // CAPACITY: Team capacity summary
  // ─────────────────────────────────────────────────────────────
  capacity: {
    total_recruiters: number;
    avg_req_load: number;
    overloaded_count: number;                // > 15 reqs
    underloaded_count: number;               // < 5 reqs
  };

  // ─────────────────────────────────────────────────────────────
  // GLOSSARY: Metric definitions for AI context
  // ─────────────────────────────────────────────────────────────
  glossary: GlossaryEntry[];
}

// ─────────────────────────────────────────────────────────────
// Supporting Types
// ─────────────────────────────────────────────────────────────

interface KPIMetric {
  value: number | null;
  unit: string;                              // 'days', '%', 'count'
  threshold: {
    green: number;
    yellow: number;
    red: number;
  };
  status: 'green' | 'yellow' | 'red';
  n: number;                                 // Sample size
  trend: 'up' | 'down' | 'flat' | null;
}

interface ExplainSummary {
  metric_name: string;
  value: number | null;
  unit: string;
  top_drivers: ExplainDriver[];              // Max 3
  exclusions: string[];                      // What was excluded from calc
  confidence: 'high' | 'medium' | 'low';
  n: number;
}

interface ExplainDriver {
  factor: string;                            // "HM Screen stage"
  impact: string;                            // "adds 4.2 days on average"
  evidence_key: string;                      // Fact Pack key path
}

interface ActionSummary {
  action_id: string;
  title: string;
  owner_type: 'RECRUITER' | 'HIRING_MANAGER' | 'TA_OPS';
  owner_label: string;                       // "Recruiter 3" (anonymized)
  priority: 'P0' | 'P1' | 'P2';
  action_type: string;
  due_in_days: number;
  req_id: string | null;
  req_title: string | null;                  // Redacted
}

interface RiskSummary {
  risk_id: string;
  req_id: string;
  req_title: string;                         // Redacted
  risk_type: RiskType;
  failure_mode: string;                      // Human-readable
  days_open: number;
  candidate_count: number;
  owner_label: string;                       // "Recruiter 2" (anonymized)
  top_driver: string;                        // Main cause
}

type RiskType = 'zombie' | 'stalled' | 'pipeline_gap' | 'hm_delay' | 'offer_risk' | 'at_risk';

interface FunnelStage {
  stage: string;                             // Canonical stage name
  candidate_count: number;
  conversion_rate: number | null;            // To next stage, 0-1
  avg_days: number | null;
  is_bottleneck: boolean;
}

interface SourceSummary {
  source_name: string;
  candidate_count: number;
  hire_count: number;
  conversion_rate: number | null;            // 0-1
  quality_score: number | null;              // 0-100
}

interface GlossaryEntry {
  term: string;
  definition: string;
  formula: string | null;
  example: string | null;
}
```

### Redaction Rules

| Data Type | Rule | Before | After |
|-----------|------|--------|-------|
| Recruiter names | Sequential anonymization | "Jane Smith" | "Recruiter 1" |
| HM names | Sequential anonymization | "Bob Jones" | "Manager 1" |
| Req titles | Strip possessive names | "Engineer - John's Team" | "Engineer" |
| Candidate names | Never included | N/A | N/A |
| Email addresses | Never included | N/A | N/A |
| Phone numbers | Never included | N/A | N/A |
| Internal user IDs | Map to sequential | "usr_abc123" | "R001" |
| Req IDs | Preserve (needed for deep links) | "REQ-123" | "REQ-123" |

### Redaction Implementation

```typescript
// File: src/productivity-dashboard/services/askFactPackService.ts

interface AnonymizationMaps {
  recruiters: Map<string, string>;    // original_id -> "R001"
  hms: Map<string, string>;           // original_id -> "HM001"
  reverse: Map<string, string>;       // "R001" -> original_id (for deep links)
}

function buildAnonymizationMaps(state: DashboardState): AnonymizationMaps {
  const recruiters = new Map<string, string>();
  const hms = new Map<string, string>();
  const reverse = new Map<string, string>();

  // Sort for deterministic ordering
  const sortedRecruiters = [...state.users].sort((a, b) => a.id.localeCompare(b.id));
  sortedRecruiters.forEach((r, i) => {
    const anon = `R${String(i + 1).padStart(3, '0')}`;
    recruiters.set(r.id, anon);
    reverse.set(anon, r.id);
  });

  // Similar for HMs...
  return { recruiters, hms, reverse };
}

function redactReqTitle(title: string): string {
  // Remove possessive patterns: "John's", "for Sarah", etc.
  return title
    .replace(/\b\w+'s\b/gi, '')
    .replace(/\bfor\s+\w+\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
```

---

## 2. Intent Handlers (AI-OFF Mode)

When AI is disabled, Ask PlatoVue uses deterministic handlers matched by intent.

### Intent List (10 Intents)

| Intent ID | Trigger Patterns | Description |
|-----------|-----------------|-------------|
| `whats_on_fire` | "what's on fire", "urgent", "critical", "burning" | Top P0 actions + zombie/stalled reqs |
| `top_risks` | "risks", "at risk", "problems", "issues" | Top 5 risks with failure modes |
| `top_actions` | "actions", "tasks", "to do", "what should I do" | Top P0/P1 actions grouped by owner |
| `why_time_to_offer` | "time to offer", "tto", "slow offers", "offer speed" | Explain time-to-offer with drivers |
| `why_hm_latency` | "hm latency", "manager delays", "feedback time" | Explain HM latency with top offenders |
| `stalled_reqs` | "stalled", "stuck reqs", "no activity" | List stalled/zombie reqs with owners |
| `forecast_gap` | "forecast", "will we hit goal", "pipeline gap" | Forecast summary with confidence |
| `velocity_summary` | "velocity", "funnel", "conversion", "stage times" | Funnel stages with bottleneck |
| `source_mix_summary` | "sources", "where from", "channels" | Top sources by volume and conversion |
| `capacity_summary` | "capacity", "workload", "recruiter load" | Team capacity and load distribution |

### Handler Specification

```typescript
// File: src/productivity-dashboard/services/askIntentService.ts

interface IntentHandler {
  intent_id: string;
  patterns: RegExp[];
  keywords: string[];
  handler: (factPack: AskFactPack) => IntentResponse;
  fact_keys_used: string[];  // Documentation of which keys this handler reads
}

interface IntentResponse {
  answer_markdown: string;
  citations: FactCitation[];
  deep_links: DeepLinkSpec[];
  suggested_questions: string[];
}

interface FactCitation {
  ref: string;                    // "[1]", "[2]", etc.
  key_path: string;               // "control_tower.kpis.median_ttf"
  label: string;                  // "Median TTF: 42 days"
  value: string | number | null;  // The actual value being cited
}

interface DeepLinkSpec {
  label: string;
  tab: string;
  params: Record<string, string>;
  highlight?: string;
}
```

### Handler Implementations

#### `whats_on_fire`

```typescript
const whatsOnFireHandler: IntentHandler = {
  intent_id: 'whats_on_fire',
  patterns: [
    /what('s| is) on fire/i,
    /\b(urgent|critical|burning|emergency)\b/i,
  ],
  keywords: ['fire', 'urgent', 'critical', 'burning', 'emergency'],
  fact_keys_used: [
    'actions.top_p0',
    'risks.top_risks',
    'control_tower.kpis.stalled_reqs',
  ],
  handler: (fp: AskFactPack): IntentResponse => {
    const p0Actions = fp.actions.top_p0;
    const zombieCount = fp.control_tower.risk_summary.by_type.zombie || 0;
    const stalledCount = fp.control_tower.kpis.stalled_reqs.value || 0;

    let md = `## 🔥 What's On Fire\n\n`;

    if (p0Actions.length === 0 && zombieCount === 0 && stalledCount === 0) {
      md += `**Good news!** Nothing critical requires immediate attention.\n`;
      return {
        answer_markdown: md,
        citations: [],
        deep_links: [{ label: 'View Control Tower', tab: 'control-tower', params: {} }],
        suggested_questions: ['Show me risks', 'What should I work on?'],
      };
    }

    // P0 Actions
    if (p0Actions.length > 0) {
      md += `### Critical Actions (${p0Actions.length})\n\n`;
      p0Actions.forEach((a, i) => {
        md += `${i + 1}. **${a.title}** - ${a.owner_label} [${i + 1}]\n`;
      });
      md += `\n`;
    }

    // Zombie/Stalled
    if (zombieCount > 0 || stalledCount > 0) {
      md += `### At-Risk Requisitions\n\n`;
      if (zombieCount > 0) md += `- 🧟 ${zombieCount} zombie reqs (no activity 30+ days)\n`;
      if (stalledCount > 0) md += `- ⏸️ ${stalledCount} stalled reqs (no activity 14+ days)\n`;
    }

    const citations: FactCitation[] = p0Actions.map((a, i) => ({
      ref: `[${i + 1}]`,
      key_path: `actions.top_p0[${i}]`,
      label: a.title,
      value: a.priority,
    }));

    return {
      answer_markdown: md,
      citations,
      deep_links: [
        { label: 'View all actions', tab: 'control-tower', params: { view: 'actions' } },
        { label: 'View stalled reqs', tab: 'control-tower', params: { filter: 'stalled' } },
      ],
      suggested_questions: [
        'Why is time to offer high?',
        'Show me top risks',
        'Who has the most overdue actions?',
      ],
    };
  },
};
```

#### `why_time_to_offer`

```typescript
const whyTimeToOfferHandler: IntentHandler = {
  intent_id: 'why_time_to_offer',
  patterns: [
    /\b(time to offer|tto)\b/i,
    /why.*(offer|slow)/i,
    /offer.*(speed|time|slow)/i,
  ],
  keywords: ['time to offer', 'tto', 'offer speed', 'slow offers'],
  fact_keys_used: [
    'explain.time_to_offer',
    'velocity.funnel',
    'velocity.bottleneck_stage',
    'control_tower.kpis.median_ttf',
  ],
  handler: (fp: AskFactPack): IntentResponse => {
    const explain = fp.explain.time_to_offer;
    const funnel = fp.velocity.funnel;
    const bottleneck = fp.velocity.bottleneck_stage;

    let md = `## ⏱️ Time to Offer Analysis\n\n`;
    md += `**Current value:** ${explain.value} ${explain.unit} [1]\n`;
    md += `**Sample size:** n=${explain.n}\n`;
    md += `**Confidence:** ${explain.confidence}\n\n`;

    if (explain.top_drivers.length > 0) {
      md += `### Top Drivers\n\n`;
      explain.top_drivers.forEach((d, i) => {
        md += `${i + 1}. **${d.factor}** - ${d.impact} [${i + 2}]\n`;
      });
      md += `\n`;
    }

    if (bottleneck) {
      md += `### Bottleneck\n\n`;
      md += `The **${bottleneck}** stage is your biggest bottleneck.\n`;
    }

    if (explain.exclusions.length > 0) {
      md += `\n_Excluded from calculation: ${explain.exclusions.join(', ')}_\n`;
    }

    const citations: FactCitation[] = [
      {
        ref: '[1]',
        key_path: 'explain.time_to_offer.value',
        label: `Time to Offer: ${explain.value} ${explain.unit}`,
        value: explain.value,
      },
      ...explain.top_drivers.map((d, i) => ({
        ref: `[${i + 2}]`,
        key_path: d.evidence_key,
        label: d.factor,
        value: d.impact,
      })),
    ];

    return {
      answer_markdown: md,
      citations,
      deep_links: [
        { label: 'View velocity details', tab: 'velocity-insights', params: {} },
        { label: 'View stage breakdown', tab: 'velocity-insights', params: { view: 'funnel' } },
      ],
      suggested_questions: [
        'Which HMs are slowest?',
        'Show me stalled reqs',
        'What are my top actions?',
      ],
    };
  },
};
```

### Intent Matching Logic

```typescript
function matchIntent(query: string, handlers: IntentHandler[]): IntentHandler | null {
  const normalized = query.toLowerCase().trim();

  // Phase 1: Exact pattern match (highest confidence)
  for (const h of handlers) {
    for (const pattern of h.patterns) {
      if (pattern.test(normalized)) {
        return h;
      }
    }
  }

  // Phase 2: Keyword scoring
  let bestMatch: IntentHandler | null = null;
  let bestScore = 0;

  for (const h of handlers) {
    const score = calculateKeywordScore(normalized, h.keywords);
    if (score > bestScore && score >= 0.4) {  // 40% threshold
      bestScore = score;
      bestMatch = h;
    }
  }

  return bestMatch;
}

function calculateKeywordScore(query: string, keywords: string[]): number {
  const queryWords = query.split(/\s+/);
  let matches = 0;

  for (const kw of keywords) {
    if (query.includes(kw.toLowerCase())) {
      matches++;
    }
  }

  return matches / keywords.length;
}
```

---

## 3. AI-ON Mode: LLM Integration

### System Prompt

```
You are Ask PlatoVue, an AI assistant for a recruiting analytics dashboard.

CRITICAL RULES - VIOLATIONS WILL CAUSE REJECTION:
1. You CANNOT compute metrics. All numbers MUST come from the Fact Pack.
2. You MUST cite sources using Fact Pack key paths (e.g., "control_tower.kpis.median_ttf").
3. Every number you mention MUST have a citation.
4. If data is missing, say "Data not available" - NEVER guess or compute.
5. You MUST respond in the exact JSON schema provided.

AVAILABLE DATA (reference via key paths):
- meta.* - Dataset metadata, date range, sample sizes, capability flags
- control_tower.kpis.* - KPIs with values, thresholds, status, sample sizes
- explain.* - Pre-computed explanations with drivers
- actions.* - Top actions by priority
- risks.* - Top risks with failure modes
- forecast.* - Pipeline predictions
- velocity.* - Funnel stages and timing
- sources.* - Source effectiveness
- capacity.* - Team workload
- glossary - Metric definitions

RESPONSE GUIDELINES:
- Be concise and actionable
- Always cite your sources with exact key paths
- Suggest follow-up questions
- If asked about something not in the data, explain what IS available
```

### User Prompt Template

```
## Fact Pack (current data snapshot)

```json
{FACT_PACK_JSON}
```

## User Query

{USER_QUERY}

## Response Format

Respond with valid JSON matching this exact schema:
{
  "answer_markdown": "string - your response with [1], [2] citation refs",
  "citations": [
    {
      "ref": "[1]",
      "key_path": "exact.fact.pack.key.path",
      "label": "human-readable label",
      "value": "the cited value"
    }
  ],
  "suggested_questions": ["max 3 follow-up questions"],
  "deep_links": [
    {
      "label": "string",
      "tab": "tab-name",
      "params": {}
    }
  ]
}
```

### Response JSON Schema

```typescript
interface AskAIResponse {
  answer_markdown: string;           // Markdown with [N] citation refs
  citations: AICitation[];           // REQUIRED - at least 1
  suggested_questions: string[];     // Max 3
  deep_links: AIDeepLink[];          // Navigation suggestions
}

interface AICitation {
  ref: string;                       // "[1]", "[2]", etc.
  key_path: string;                  // Exact Fact Pack path
  label: string;                     // Human description
  value: string | number | null;     // The cited value
}

interface AIDeepLink {
  label: string;
  tab: string;
  params: Record<string, string>;
}
```

### Citation Validation Rules

```typescript
// File: src/productivity-dashboard/services/askValidationService.ts

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  fallback_triggered: boolean;
}

interface ValidationError {
  type: 'MISSING_CITATIONS' | 'INVALID_KEY_PATH' | 'VALUE_MISMATCH' | 'HALLUCINATED_NUMBER';
  message: string;
  citation_ref?: string;
}

function validateAIResponse(
  response: AskAIResponse,
  factPack: AskFactPack,
  originalQuery: string
): ValidationResult {
  const errors: ValidationError[] = [];

  // Rule 1: Must have at least one citation
  if (!response.citations || response.citations.length === 0) {
    errors.push({
      type: 'MISSING_CITATIONS',
      message: 'Response must include at least one citation',
    });
  }

  // Rule 2: All key_paths must resolve to real Fact Pack values
  for (const citation of response.citations || []) {
    const resolved = resolveKeyPath(factPack, citation.key_path);
    if (resolved === undefined) {
      errors.push({
        type: 'INVALID_KEY_PATH',
        message: `Key path "${citation.key_path}" not found in Fact Pack`,
        citation_ref: citation.ref,
      });
    }
  }

  // Rule 3: Cited values must match Fact Pack values
  for (const citation of response.citations || []) {
    const resolved = resolveKeyPath(factPack, citation.key_path);
    if (resolved !== undefined && citation.value !== null) {
      if (String(resolved) !== String(citation.value)) {
        errors.push({
          type: 'VALUE_MISMATCH',
          message: `Citation ${citation.ref} value "${citation.value}" doesn't match Fact Pack value "${resolved}"`,
          citation_ref: citation.ref,
        });
      }
    }
  }

  // Rule 4: Check for numbers in answer that aren't cited
  const numbersInAnswer = extractNumbers(response.answer_markdown);
  const citedNumbers = new Set(response.citations?.map(c => String(c.value)) || []);

  for (const num of numbersInAnswer) {
    if (!citedNumbers.has(num) && !isCommonNumber(num)) {
      errors.push({
        type: 'HALLUCINATED_NUMBER',
        message: `Number "${num}" appears in answer but is not cited`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    fallback_triggered: errors.length > 0,
  };
}

function resolveKeyPath(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    // Handle array indexing: "top_p0[0]"
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      current = current?.[arrayMatch[1]]?.[parseInt(arrayMatch[2])];
    } else {
      current = current?.[part];
    }
    if (current === undefined) return undefined;
  }

  return current;
}

function extractNumbers(text: string): string[] {
  const matches = text.match(/\d+\.?\d*/g) || [];
  return [...new Set(matches)];
}

function isCommonNumber(num: string): boolean {
  // Numbers that don't need citations
  const common = ['1', '2', '3', '4', '5', '10', '100'];
  return common.includes(num);
}
```

### Fallback Behavior

```typescript
// When AI response validation fails, fall back to deterministic mode

async function handleAskQuery(
  query: string,
  factPack: AskFactPack,
  aiEnabled: boolean
): Promise<IntentResponse> {
  // Try intent matching first (works in both modes)
  const matchedIntent = matchIntent(query, ALL_HANDLERS);

  if (matchedIntent) {
    // Use deterministic handler
    return matchedIntent.handler(factPack);
  }

  if (!aiEnabled) {
    // No AI and no intent match - show help
    return generateHelpResponse(factPack);
  }

  // Try AI
  try {
    const aiResponse = await callAI(query, factPack);
    const validation = validateAIResponse(aiResponse, factPack, query);

    if (validation.valid) {
      return convertAIResponseToIntentResponse(aiResponse);
    }

    // AI failed validation - log and fall back
    console.warn('[AskPlatoVue] AI response failed validation:', validation.errors);

    // Return a graceful fallback
    return {
      answer_markdown: `I wasn't able to fully answer that question with verified data.\n\n` +
        `**Try one of these instead:**\n` +
        ALL_HANDLERS.map(h => `- "${h.keywords[0]}"`).join('\n'),
      citations: [],
      deep_links: [],
      suggested_questions: ['What\'s on fire?', 'Show me top risks', 'Why is TTF high?'],
    };
  } catch (error) {
    console.error('[AskPlatoVue] AI call failed:', error);
    return generateHelpResponse(factPack);
  }
}
```

---

## 4. Deep Link Strategy

### Citation Key Path → Route Mapping

| Key Path Pattern | Tab | URL Params | Highlight |
|------------------|-----|------------|-----------|
| `control_tower.kpis.*` | `control-tower` | `highlight={kpi_name}` | KPI card |
| `explain.*` | `velocity-insights` | `explain={metric}` | Explain drawer |
| `actions.top_p0[N]` | `control-tower` | `action={action_id}` | Action row |
| `risks.top_risks[N]` | `control-tower` | `req={req_id}` | Risk row |
| `forecast.*` | `forecasting` | - | Forecast panel |
| `velocity.funnel[N]` | `velocity-insights` | `stage={stage_name}` | Stage row |
| `sources.*` | `source-effectiveness` | `source={name}` | Source row |
| `capacity.*` | `hm-friction` | `view=capacity` | Capacity view |

### Deep Link Service

```typescript
// File: src/productivity-dashboard/services/askDeepLinkService.ts

interface DeepLinkResult {
  url: string;
  tab: string;
  params: Record<string, string>;
  highlightSelector?: string;
}

function keyPathToDeepLink(
  keyPath: string,
  factPack: AskFactPack,
  reverseMap: Map<string, string>
): DeepLinkResult {
  const parts = keyPath.split('.');

  // control_tower.kpis.median_ttf
  if (parts[0] === 'control_tower' && parts[1] === 'kpis') {
    return {
      url: `/?tab=control-tower&highlight=${parts[2]}`,
      tab: 'control-tower',
      params: { highlight: parts[2] },
      highlightSelector: `[data-kpi="${parts[2]}"]`,
    };
  }

  // explain.time_to_offer
  if (parts[0] === 'explain') {
    return {
      url: `/?tab=velocity-insights&explain=${parts[1]}`,
      tab: 'velocity-insights',
      params: { explain: parts[1] },
    };
  }

  // actions.top_p0[0]
  if (parts[0] === 'actions') {
    const match = parts[1].match(/top_p(\d)\[(\d+)\]/);
    if (match) {
      const action = factPack.actions[`top_p${match[1]}`]?.[parseInt(match[2])];
      return {
        url: `/?tab=control-tower&action=${action?.action_id}`,
        tab: 'control-tower',
        params: { action: action?.action_id || '' },
      };
    }
  }

  // risks.top_risks[0]
  if (parts[0] === 'risks' && parts[1].startsWith('top_risks')) {
    const match = parts[1].match(/top_risks\[(\d+)\]/);
    if (match) {
      const risk = factPack.risks.top_risks[parseInt(match[1])];
      return {
        url: `/?tab=control-tower&req=${risk?.req_id}`,
        tab: 'control-tower',
        params: { req: risk?.req_id || '' },
      };
    }
  }

  // Default fallback
  return {
    url: '/?tab=control-tower',
    tab: 'control-tower',
    params: {},
  };
}
```

---

## 5. UI Component Layout

Ask PlatoVue is a **top-level tab**, not a drawer.

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Logo] PlatoVue                                      [Settings] [User] │
├─────────────────────────────────────────────────────────────────────────┤
│ [Ask] [Control Tower] [Velocity] [HM Friction] [Sources] [Forecasting] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────┐  ┌─────────────────────────────────────────┐ │
│  │  Suggested Questions │  │                                         │ │
│  │  ─────────────────── │  │  💬 Ask PlatoVue                        │ │
│  │                      │  │                                         │ │
│  │  🔥 What's on fire?  │  │  ┌─────────────────────────────────────┐│ │
│  │  ⚠️ Top risks        │  │  │ Ask a question about your data...   ││ │
│  │  ✅ Top actions      │  │  │                              [Send] ││ │
│  │  ⏱️ Why is TTF high? │  │  └─────────────────────────────────────┘│ │
│  │  👥 HM delays        │  │                                         │ │
│  │  📊 Pipeline status  │  │  ─────────────────────────────────────  │ │
│  │  📈 Forecast         │  │                                         │ │
│  │                      │  │  ## 🔥 What's On Fire                   │ │
│  │  ─────────────────── │  │                                         │ │
│  │  Follow-ups:         │  │  ### Critical Actions (3)               │ │
│  │  • Show stalled reqs │  │                                         │ │
│  │  • Who's overloaded? │  │  1. **Follow up with HM** - Recruiter 3 │ │
│  │                      │  │     [1] → View action                   │ │
│  │  ─────────────────── │  │                                         │ │
│  │  [AI: ON 🟢]         │  │  2. **Source candidates** - Recruiter 1 │ │
│  │                      │  │     [2] → View action                   │ │
│  │                      │  │                                         │ │
│  └──────────────────────┘  │  ### At-Risk Requisitions               │ │
│                            │                                         │ │
│                            │  - 🧟 3 zombie reqs [3]                 │ │
│                            │  - ⏸️ 5 stalled reqs [4]                │ │
│                            │                                         │ │
│                            │  ─────────────────────────────────────  │ │
│                            │                                         │ │
│                            │  **Citations:**                         │ │
│                            │  [1] actions.top_p0[0] → View           │ │
│                            │  [2] actions.top_p0[1] → View           │ │
│                            │  [3] control_tower.risk_summary...      │ │
│                            │  [4] control_tower.kpis.stalled_reqs    │ │
│                            │                                         │ │
│                            │  ─────────────────────────────────────  │ │
│                            │                                         │ │
│                            │  [Copy] [View Evidence] [Create Action] │ │
│                            │                                         │ │
│                            └─────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
AskPlatoVueTab (top-level tab component)
├── AskLeftRail
│   ├── SuggestedQuestions (clickable chips)
│   ├── FollowUpQuestions (dynamic based on last answer)
│   └── AIStatusIndicator (ON/OFF with status)
│
└── AskMainPanel
    ├── AskInput
    │   ├── TextArea
    │   └── SendButton
    │
    └── AskResponse
        ├── AnswerMarkdown (rendered markdown)
        ├── CitationsList
        │   └── CitationItem (clickable deep link)
        │
        └── ActionBar
            ├── CopyButton
            ├── ViewEvidenceButton (opens Explain drawer)
            └── CreateActionButton (shows modal)
```

### File Paths

```
src/productivity-dashboard/components/ask-platovue/
├── AskPlatoVueTab.tsx           # Main tab container
├── AskLeftRail.tsx              # Sidebar with questions
├── AskMainPanel.tsx             # Right panel with input/response
├── AskInput.tsx                 # Query input
├── AskResponse.tsx              # Response display
├── AskCitationsList.tsx         # Citations with deep links
├── AskActionBar.tsx             # Copy, View Evidence, Create Action
├── AskSuggestedQuestion.tsx     # Clickable question chip
├── AskAIStatus.tsx              # AI ON/OFF indicator
├── index.ts                     # Barrel exports
└── ask-platovue.css             # Component styles
```

---

## 6. Implementation Steps (Small Commits)

### Phase 1: Foundation (5 commits)

```
Commit 1: Add Fact Pack types
- Create src/productivity-dashboard/types/askTypes.ts
- Define AskFactPack, KPIMetric, ExplainSummary, etc.
- Export from types/index.ts

Commit 2: Implement Fact Pack builder
- Create src/productivity-dashboard/services/askFactPackService.ts
- buildFactPack(state: DashboardState): AskFactPack
- buildAnonymizationMaps()
- redactReqTitle()
- Unit tests

Commit 3: Add intent matching
- Create src/productivity-dashboard/services/askIntentService.ts
- matchIntent() function
- Intent patterns and keywords
- Unit tests for all 10 intents

Commit 4: Implement first 5 intent handlers
- whats_on_fire, top_risks, top_actions, why_time_to_offer, why_hm_latency
- Unit tests

Commit 5: Implement remaining 5 intent handlers
- stalled_reqs, forecast_gap, velocity_summary, source_mix_summary, capacity_summary
- Unit tests
```

### Phase 2: UI Shell (4 commits)

```
Commit 6: Create tab structure
- Create AskPlatoVueTab.tsx
- Add to ProductivityDashboard tab list
- Basic layout with left rail and main panel
- CSS styles

Commit 7: Build AskLeftRail
- SuggestedQuestions component
- FollowUpQuestions component
- AIStatusIndicator component
- Click handlers to populate input

Commit 8: Build AskMainPanel
- AskInput with textarea and send button
- AskResponse with markdown rendering
- Basic state management

Commit 9: Wire up intent handlers to UI
- useAskPlatoVue hook
- Connect input to intent matching
- Display responses in AskResponse
- AI-OFF mode fully functional
```

### Phase 3: Citations & Deep Links (3 commits)

```
Commit 10: Add citations display
- AskCitationsList component
- CitationItem with key path display
- Click handler stub

Commit 11: Implement deep link service
- askDeepLinkService.ts
- keyPathToDeepLink()
- Navigation on citation click
- Highlight target element

Commit 12: Add action bar
- Copy button (clipboard API)
- View Evidence button (opens Explain drawer)
- Create Action button (stub)
```

### Phase 4: AI Integration (3 commits)

```
Commit 13: Add AI response validation
- askValidationService.ts
- validateAIResponse()
- resolveKeyPath()
- Unit tests for validation rules

Commit 14: Integrate with aiService
- Add task_type='ask_platovue'
- System prompt and user prompt templates
- Call AI and parse response
- Fallback on validation failure

Commit 15: End-to-end AI flow
- AI-ON mode UI indicator
- Toggle based on BYOK status
- Error handling and fallback UI
- Integration tests
```

### Phase 5: Actions & Polish (3 commits)

```
Commit 16: Implement action creation
- askActionService.ts
- checkActionDuplicate()
- createActionFromSuggestion()
- Confirmation modal

Commit 17: Add polish
- Loading states
- Error states
- Empty states
- Responsive adjustments

Commit 18: Final tests and documentation
- E2E tests for AI-OFF and AI-ON
- Update CLAUDE.md with Ask tab docs
- Remove debug logging
```

---

## 7. Test Plan

### 7.1 Fact Pack Builder Tests

```typescript
// File: src/productivity-dashboard/services/__tests__/askFactPackService.test.ts

describe('buildFactPack', () => {
  const mockState = createMockDashboardState();

  it('includes all required sections', () => {
    const fp = buildFactPack(mockState);
    expect(fp.meta).toBeDefined();
    expect(fp.control_tower).toBeDefined();
    expect(fp.explain).toBeDefined();
    expect(fp.actions).toBeDefined();
    expect(fp.risks).toBeDefined();
    expect(fp.forecast).toBeDefined();
    expect(fp.velocity).toBeDefined();
    expect(fp.sources).toBeDefined();
    expect(fp.capacity).toBeDefined();
    expect(fp.glossary).toBeDefined();
  });

  it('sets capability flags correctly', () => {
    const fpWithStages = buildFactPack({ ...mockState, hasStageTimingData: true });
    expect(fpWithStages.meta.capability_flags.has_stage_timing).toBe(true);

    const fpWithoutStages = buildFactPack({ ...mockState, hasStageTimingData: false });
    expect(fpWithoutStages.meta.capability_flags.has_stage_timing).toBe(false);
  });

  it('limits top_p0 actions to 5', () => {
    const stateWithManyActions = createMockStateWithActions(20);
    const fp = buildFactPack(stateWithManyActions);
    expect(fp.actions.top_p0.length).toBeLessThanOrEqual(5);
  });

  it('anonymizes recruiter names', () => {
    const fp = buildFactPack(mockState);
    fp.actions.top_p0.forEach(a => {
      expect(a.owner_label).toMatch(/^(Recruiter|Manager) \d+$/);
    });
  });

  it('redacts PII from req titles', () => {
    const stateWithPII = createMockStateWithReqTitle("Engineer for John's team");
    const fp = buildFactPack(stateWithPII);
    expect(fp.risks.top_risks[0].req_title).not.toContain("John");
  });

  it('never includes email addresses', () => {
    const fp = buildFactPack(mockState);
    const json = JSON.stringify(fp);
    expect(json).not.toMatch(/[\w.-]+@[\w.-]+\.\w+/);
  });

  it('never includes phone numbers', () => {
    const fp = buildFactPack(mockState);
    const json = JSON.stringify(fp);
    expect(json).not.toMatch(/\d{3}[-.]?\d{3}[-.]?\d{4}/);
  });
});
```

### 7.2 Intent Handler Tests

```typescript
// File: src/productivity-dashboard/services/__tests__/askIntentService.test.ts

describe('matchIntent', () => {
  it.each([
    ["what's on fire", 'whats_on_fire'],
    ['urgent issues', 'whats_on_fire'],
    ['show me risks', 'top_risks'],
    ['what are the problems', 'top_risks'],
    ['my actions', 'top_actions'],
    ['what should I do', 'top_actions'],
    ['why is time to offer high', 'why_time_to_offer'],
    ['tto analysis', 'why_time_to_offer'],
    ['hm latency', 'why_hm_latency'],
    ['manager delays', 'why_hm_latency'],
    ['stalled reqs', 'stalled_reqs'],
    ['stuck requisitions', 'stalled_reqs'],
    ['forecast gap', 'forecast_gap'],
    ['will we hit goal', 'forecast_gap'],
    ['velocity summary', 'velocity_summary'],
    ['funnel status', 'velocity_summary'],
    ['source mix', 'source_mix_summary'],
    ['where are candidates from', 'source_mix_summary'],
    ['capacity', 'capacity_summary'],
    ['recruiter workload', 'capacity_summary'],
  ])('matches "%s" to %s', (query, expectedIntent) => {
    const result = matchIntent(query, ALL_HANDLERS);
    expect(result?.intent_id).toBe(expectedIntent);
  });

  it('returns null for unrelated queries', () => {
    expect(matchIntent('what is the weather', ALL_HANDLERS)).toBeNull();
    expect(matchIntent('hello world', ALL_HANDLERS)).toBeNull();
  });
});

describe('intent handlers', () => {
  const mockFactPack = createMockFactPack();

  describe('whats_on_fire', () => {
    it('returns markdown with P0 actions', () => {
      const response = whatsOnFireHandler.handler(mockFactPack);
      expect(response.answer_markdown).toContain('On Fire');
      expect(response.citations.length).toBeGreaterThan(0);
    });

    it('returns empty-state when nothing critical', () => {
      const calmPack = { ...mockFactPack, actions: { top_p0: [], top_p1: [] } };
      const response = whatsOnFireHandler.handler(calmPack);
      expect(response.answer_markdown).toContain('Good news');
    });

    it('includes valid key paths in citations', () => {
      const response = whatsOnFireHandler.handler(mockFactPack);
      response.citations.forEach(c => {
        const resolved = resolveKeyPath(mockFactPack, c.key_path);
        expect(resolved).not.toBeUndefined();
      });
    });
  });

  // Similar tests for other handlers...
});
```

### 7.3 AI Response Validation Tests

```typescript
// File: src/productivity-dashboard/services/__tests__/askValidationService.test.ts

describe('validateAIResponse', () => {
  const mockFactPack = createMockFactPack();

  it('rejects response with no citations', () => {
    const response = {
      answer_markdown: 'The TTF is 42 days',
      citations: [],
      suggested_questions: [],
      deep_links: [],
    };
    const result = validateAIResponse(response, mockFactPack, 'test');
    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('MISSING_CITATIONS');
  });

  it('rejects response with invalid key path', () => {
    const response = {
      answer_markdown: 'The TTF is 42 days [1]',
      citations: [{
        ref: '[1]',
        key_path: 'invalid.path.here',
        label: 'TTF',
        value: 42,
      }],
      suggested_questions: [],
      deep_links: [],
    };
    const result = validateAIResponse(response, mockFactPack, 'test');
    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('INVALID_KEY_PATH');
  });

  it('rejects response with mismatched value', () => {
    const response = {
      answer_markdown: 'The TTF is 42 days [1]',
      citations: [{
        ref: '[1]',
        key_path: 'control_tower.kpis.median_ttf.value',
        label: 'TTF',
        value: 99,  // Wrong value
      }],
      suggested_questions: [],
      deep_links: [],
    };
    // Mock fact pack has median_ttf.value = 42
    const result = validateAIResponse(response, mockFactPack, 'test');
    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('VALUE_MISMATCH');
  });

  it('rejects response with uncited numbers', () => {
    const response = {
      answer_markdown: 'You have 15 stalled reqs and 8 zombies',
      citations: [{
        ref: '[1]',
        key_path: 'control_tower.kpis.stalled_reqs.value',
        label: 'Stalled',
        value: 15,
      }],  // Missing citation for "8"
      suggested_questions: [],
      deep_links: [],
    };
    const result = validateAIResponse(response, mockFactPack, 'test');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.type === 'HALLUCINATED_NUMBER')).toBe(true);
  });

  it('accepts valid response', () => {
    const response = {
      answer_markdown: 'The median TTF is 42 days [1]',
      citations: [{
        ref: '[1]',
        key_path: 'control_tower.kpis.median_ttf.value',
        label: 'Median TTF',
        value: 42,
      }],
      suggested_questions: ['Why is TTF high?'],
      deep_links: [],
    };
    const result = validateAIResponse(response, mockFactPack, 'test');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('resolveKeyPath', () => {
  const obj = {
    control_tower: {
      kpis: {
        median_ttf: { value: 42 }
      }
    },
    actions: {
      top_p0: [{ action_id: 'a1' }, { action_id: 'a2' }]
    }
  };

  it('resolves nested paths', () => {
    expect(resolveKeyPath(obj, 'control_tower.kpis.median_ttf.value')).toBe(42);
  });

  it('resolves array indices', () => {
    expect(resolveKeyPath(obj, 'actions.top_p0[0].action_id')).toBe('a1');
    expect(resolveKeyPath(obj, 'actions.top_p0[1].action_id')).toBe('a2');
  });

  it('returns undefined for invalid paths', () => {
    expect(resolveKeyPath(obj, 'invalid.path')).toBeUndefined();
    expect(resolveKeyPath(obj, 'actions.top_p0[99]')).toBeUndefined();
  });
});
```

### 7.4 UI Smoke Tests

```typescript
// File: src/productivity-dashboard/components/ask-platovue/__tests__/AskPlatoVueTab.test.tsx

describe('AskPlatoVueTab', () => {
  describe('AI-OFF mode', () => {
    beforeEach(() => {
      mockAIContext({ enabled: false });
    });

    it('renders suggested questions', () => {
      render(<AskPlatoVueTab />);
      expect(screen.getByText(/What's on fire/i)).toBeInTheDocument();
      expect(screen.getByText(/Top risks/i)).toBeInTheDocument();
    });

    it('shows AI-OFF indicator', () => {
      render(<AskPlatoVueTab />);
      expect(screen.getByText(/AI: OFF/i)).toBeInTheDocument();
    });

    it('handles suggested question click', async () => {
      render(<AskPlatoVueTab />);
      fireEvent.click(screen.getByText(/What's on fire/i));

      await waitFor(() => {
        expect(screen.getByText(/Critical Actions/i)).toBeInTheDocument();
      });
    });

    it('handles text input query', async () => {
      render(<AskPlatoVueTab />);

      const input = screen.getByPlaceholderText(/Ask a question/i);
      fireEvent.change(input, { target: { value: 'show me risks' } });
      fireEvent.click(screen.getByRole('button', { name: /Send/i }));

      await waitFor(() => {
        expect(screen.getByText(/Top Risks/i)).toBeInTheDocument();
      });
    });

    it('displays citations with key paths', async () => {
      render(<AskPlatoVueTab />);
      fireEvent.click(screen.getByText(/What's on fire/i));

      await waitFor(() => {
        expect(screen.getByText(/actions\.top_p0/i)).toBeInTheDocument();
      });
    });

    it('enables deep link navigation', async () => {
      const navigate = jest.fn();
      mockNavigation(navigate);

      render(<AskPlatoVueTab />);
      fireEvent.click(screen.getByText(/What's on fire/i));

      await waitFor(() => {
        fireEvent.click(screen.getByText(/View action/i));
        expect(navigate).toHaveBeenCalledWith(expect.stringContaining('tab=control-tower'));
      });
    });
  });

  describe('AI-ON mode', () => {
    beforeEach(() => {
      mockAIContext({ enabled: true });
    });

    it('shows AI-ON indicator', () => {
      render(<AskPlatoVueTab />);
      expect(screen.getByText(/AI: ON/i)).toBeInTheDocument();
    });

    it('falls back to deterministic on validation failure', async () => {
      mockAIResponse({ valid: false });

      render(<AskPlatoVueTab />);
      const input = screen.getByPlaceholderText(/Ask a question/i);
      fireEvent.change(input, { target: { value: 'complex question' } });
      fireEvent.click(screen.getByRole('button', { name: /Send/i }));

      await waitFor(() => {
        expect(screen.getByText(/Try one of these instead/i)).toBeInTheDocument();
      });
    });

    it('displays AI response with citations', async () => {
      mockAIResponse({
        valid: true,
        response: {
          answer_markdown: 'The TTF is 42 days [1]',
          citations: [{ ref: '[1]', key_path: 'control_tower.kpis.median_ttf.value', label: 'TTF', value: 42 }],
          suggested_questions: [],
          deep_links: [],
        },
      });

      render(<AskPlatoVueTab />);
      const input = screen.getByPlaceholderText(/Ask a question/i);
      fireEvent.change(input, { target: { value: 'what is our TTF' } });
      fireEvent.click(screen.getByRole('button', { name: /Send/i }));

      await waitFor(() => {
        expect(screen.getByText(/42 days/i)).toBeInTheDocument();
        expect(screen.getByText(/control_tower\.kpis\.median_ttf/i)).toBeInTheDocument();
      });
    });
  });
});
```

---

## 8. Non-Goals for V1

| Non-Goal | Rationale |
|----------|-----------|
| AI computes metrics | All metrics pre-computed. Prevents hallucination. |
| PII in AI payload | Legal/privacy compliance. Names anonymized. |
| Auto-create actions | User must click. Prevents unintended side effects. |
| Multi-turn conversation | Single Q&A per interaction. Simplifies validation. |
| Voice input | Text only for V1. |
| Conversation history | No persistence across sessions. |
| Custom metric definitions | Only query existing metrics. |
| Real-time streaming | Full response, no streaming chunks. |
| Proactive notifications | Response-only, no alerts. |
| Export/share | No clipboard beyond "Copy" button. |
| Comparison queries | "Compare Q1 vs Q2" out of scope. |
| Drill-down in response | Use deep links to navigate to detail views. |

---

## Appendix A: Glossary Entries

```typescript
const GLOSSARY: GlossaryEntry[] = [
  {
    term: 'TTF',
    definition: 'Time to Fill - days from req open to candidate hired',
    formula: 'hired_at - opened_at',
    example: 'A TTF of 45 days means it takes 45 days on average to fill a role',
  },
  {
    term: 'TTO',
    definition: 'Time to Offer - days from application to offer extended',
    formula: 'offer_extended_at - applied_at',
    example: null,
  },
  {
    term: 'Stalled Req',
    definition: 'Requisition with no candidate activity for 14-30 days',
    formula: 'days_since_last_activity >= 14 AND < 30',
    example: null,
  },
  {
    term: 'Zombie Req',
    definition: 'Requisition with no candidate activity for 30+ days',
    formula: 'days_since_last_activity >= 30',
    example: null,
  },
  {
    term: 'HM Latency',
    definition: 'Average days for hiring manager to provide feedback',
    formula: 'avg(feedback_received_at - feedback_requested_at)',
    example: null,
  },
  {
    term: 'Accept Rate',
    definition: 'Percentage of offers that are accepted',
    formula: 'offers_accepted / offers_extended',
    example: 'An 85% accept rate means 85 of 100 offers were accepted',
  },
  {
    term: 'Pipeline Gap',
    definition: 'Difference between open reqs and expected hires',
    formula: 'open_reqs - probability_weighted_pipeline',
    example: 'A gap of 5 means you may fall 5 hires short of goal',
  },
];
```

---

*Plan Version: 2.0*
*Created: 2026-01-15*
*Last Updated: 2026-01-15*
