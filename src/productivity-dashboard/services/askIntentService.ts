// Ask Intent Service
// Deterministic intent matching and handlers for AI-OFF mode

import {
  AskFactPack,
  IntentHandler,
  IntentResponse,
  FactCitation,
  DeepLinkSpec,
  FilterContext,
} from '../types/askTypes';

// ─────────────────────────────────────────────────────────────
// Filter Preservation Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Build deep link params from filter context to preserve filters when navigating
 */
function buildFilterParams(filterContext: FilterContext | undefined): Record<string, string> {
  const params: Record<string, string> = {};

  if (!filterContext) return params;

  if (filterContext.recruiter_ids?.length > 0) {
    params.recruiterIds = filterContext.recruiter_ids.join(',');
  }
  if (filterContext.date_range_start) {
    params.dateStart = filterContext.date_range_start;
  }
  if (filterContext.date_range_end) {
    params.dateEnd = filterContext.date_range_end;
  }
  if (filterContext.date_range_preset) {
    params.datePreset = filterContext.date_range_preset;
  }
  if (filterContext.functions?.length > 0) {
    params.functions = filterContext.functions.join(',');
  }
  if (filterContext.regions?.length > 0) {
    params.regions = filterContext.regions.join(',');
  }

  return params;
}

/**
 * Build a deep link spec with filter context preserved
 */
function buildDeepLink(
  label: string,
  tab: string,
  factPack: AskFactPack,
  additionalParams: Record<string, string> = {}
): DeepLinkSpec {
  return {
    label,
    tab,
    params: {
      ...buildFilterParams(factPack.meta.filter_context),
      ...additionalParams,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Intent Matching
// ─────────────────────────────────────────────────────────────

/**
 * Match a user query to the best intent handler
 */
export function matchIntent(query: string, handlers: IntentHandler[]): IntentHandler | null {
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

/**
 * Calculate keyword match score
 */
function calculateKeywordScore(query: string, keywords: string[]): number {
  if (keywords.length === 0) return 0;

  let matches = 0;
  for (const kw of keywords) {
    if (query.includes(kw.toLowerCase())) {
      matches++;
    }
  }

  return matches / keywords.length;
}

// ─────────────────────────────────────────────────────────────
// Handler: What's On Fire
// ─────────────────────────────────────────────────────────────

export const whatsOnFireHandler: IntentHandler = {
  intent_id: 'whats_on_fire',
  patterns: [
    /what('s| is) on fire/i,
    /\b(urgent|critical|burning|emergency)\b/i,
  ],
  keywords: ['fire', 'urgent', 'critical', 'burning', 'emergency'],
  fact_keys_used: [
    'actions.top_p0',
    'control_tower.risk_summary.by_type.zombie',
    'control_tower.kpis.stalled_reqs',
  ],
  handler: (fp: AskFactPack): IntentResponse => {
    const p0Actions = fp.actions.top_p0;
    const zombieCount = fp.control_tower.risk_summary.by_type.zombie || 0;
    const stalledCount = fp.control_tower.kpis.stalled_reqs.value || 0;

    let md = `## What's On Fire\n\n`;

    if (p0Actions.length === 0 && zombieCount === 0 && stalledCount === 0) {
      md += `**Good news!** Nothing critical requires immediate attention.\n`;
      return {
        answer_markdown: md,
        citations: [],
        deep_links: [buildDeepLink('View Control Tower', 'control-tower', fp)],
        suggested_questions: ['Show me risks', 'What should I work on?'],
      };
    }

    const citations: FactCitation[] = [];
    let citationIndex = 1;

    // P0 Actions
    if (p0Actions.length > 0) {
      md += `### Critical Actions (${p0Actions.length})\n\n`;
      p0Actions.forEach((a, i) => {
        md += `${i + 1}. **${a.title}** - ${a.owner_label} [${citationIndex}]\n`;
        citations.push({
          ref: `[${citationIndex}]`,
          key_path: `actions.top_p0[${i}]`,
          label: a.title,
          value: a.priority,
        });
        citationIndex++;
      });
      md += `\n`;
    }

    // Zombie/Stalled
    if (zombieCount > 0 || stalledCount > 0) {
      md += `### At-Risk Requisitions\n\n`;
      if (zombieCount > 0) {
        md += `- ${zombieCount} zombie reqs (no activity 30+ days) [${citationIndex}]\n`;
        citations.push({
          ref: `[${citationIndex}]`,
          key_path: 'control_tower.risk_summary.by_type.zombie',
          label: 'Zombie Reqs',
          value: zombieCount,
        });
        citationIndex++;
      }
      if (stalledCount > 0) {
        md += `- ${stalledCount} stalled reqs (no activity 14+ days) [${citationIndex}]\n`;
        citations.push({
          ref: `[${citationIndex}]`,
          key_path: 'control_tower.kpis.stalled_reqs.value',
          label: 'Stalled Reqs',
          value: stalledCount,
        });
      }
    }

    return {
      answer_markdown: md,
      citations,
      deep_links: [
        buildDeepLink('View all actions', 'control-tower', fp, { view: 'actions' }),
        buildDeepLink('View stalled reqs', 'control-tower', fp, { filter: 'stalled' }),
      ],
      suggested_questions: [
        'Why is time to offer high?',
        'Show me top risks',
        'Who has the most overdue actions?',
      ],
    };
  },
};

// ─────────────────────────────────────────────────────────────
// Handler: Top Risks
// ─────────────────────────────────────────────────────────────

export const topRisksHandler: IntentHandler = {
  intent_id: 'top_risks',
  patterns: [
    /\b(risks?|at risk|problems?|issues?)\b/i,
    /what.*(risk|problem|issue)/i,
  ],
  keywords: ['risk', 'risks', 'at risk', 'problems', 'issues'],
  fact_keys_used: [
    'risks.top_risks',
    'control_tower.risk_summary',
  ],
  handler: (fp: AskFactPack): IntentResponse => {
    const topRisks = fp.risks.top_risks;
    const riskSummary = fp.control_tower.risk_summary;

    let md = `## Top Risks\n\n`;

    if (topRisks.length === 0) {
      md += `**Good news!** No high-risk requisitions detected.\n`;
      md += `\nTotal at-risk reqs: ${riskSummary.total_at_risk}\n`;
      return {
        answer_markdown: md,
        citations: [{
          ref: '[1]',
          key_path: 'control_tower.risk_summary.total_at_risk',
          label: 'Total At Risk',
          value: riskSummary.total_at_risk,
        }],
        deep_links: [buildDeepLink('View Control Tower', 'control-tower', fp)],
        suggested_questions: ['What actions should I take?', 'Show me forecast'],
      };
    }

    const citations: FactCitation[] = [];

    md += `**${riskSummary.total_at_risk} requisitions at risk** [1]\n\n`;
    citations.push({
      ref: '[1]',
      key_path: 'control_tower.risk_summary.total_at_risk',
      label: 'Total At Risk',
      value: riskSummary.total_at_risk,
    });

    md += `### Risk Breakdown\n`;
    const riskTypes = Object.entries(riskSummary.by_type).filter(([_, count]) => count && count > 0);
    riskTypes.forEach(([type, count]) => {
      md += `- ${type}: ${count}\n`;
    });
    md += `\n`;

    md += `### Top At-Risk Reqs\n\n`;
    topRisks.slice(0, 5).forEach((r, i) => {
      md += `${i + 1}. **${r.req_title}** - ${r.failure_mode} (${r.days_open}d open) [${i + 2}]\n`;
      md += `   - ${r.top_driver}\n`;
      citations.push({
        ref: `[${i + 2}]`,
        key_path: `risks.top_risks[${i}]`,
        label: r.req_title,
        value: r.risk_type,
      });
    });

    return {
      answer_markdown: md,
      citations,
      deep_links: [
        buildDeepLink('View all risks', 'control-tower', fp, { view: 'risks' }),
        buildDeepLink('View forecasting', 'forecasting', fp),
      ],
      suggested_questions: [
        'What actions should I take?',
        'Why is HM latency high?',
        'Show me stalled reqs',
      ],
    };
  },
};

// ─────────────────────────────────────────────────────────────
// Handler: Top Actions
// ─────────────────────────────────────────────────────────────

export const topActionsHandler: IntentHandler = {
  intent_id: 'top_actions',
  patterns: [
    /\b(actions?|tasks?|to do|todo)\b/i,
    /what should (i|we) do/i,
    /what.*(work on|focus)/i,
  ],
  keywords: ['actions', 'tasks', 'to do', 'what should I do', 'work on'],
  fact_keys_used: [
    'actions.top_p0',
    'actions.top_p1',
    'control_tower.action_summary',
  ],
  handler: (fp: AskFactPack): IntentResponse => {
    const { top_p0, top_p1, by_owner_type } = fp.actions;
    const summary = fp.control_tower.action_summary;

    let md = `## Top Actions\n\n`;
    const citations: FactCitation[] = [];
    let citationIndex = 1;

    md += `**${summary.total_open} open actions** (P0: ${summary.p0_count}, P1: ${summary.p1_count}, P2: ${summary.p2_count}) [${citationIndex}]\n\n`;
    citations.push({
      ref: `[${citationIndex}]`,
      key_path: 'control_tower.action_summary.total_open',
      label: 'Total Open Actions',
      value: summary.total_open,
    });
    citationIndex++;

    if (top_p0.length > 0) {
      md += `### Critical (P0)\n\n`;
      top_p0.forEach((a, i) => {
        md += `- **${a.title}** - ${a.owner_label} [${citationIndex}]\n`;
        if (a.req_title) md += `  _${a.req_title}_\n`;
        citations.push({
          ref: `[${citationIndex}]`,
          key_path: `actions.top_p0[${i}]`,
          label: a.title,
          value: a.priority,
        });
        citationIndex++;
      });
      md += `\n`;
    }

    if (top_p1.length > 0) {
      md += `### High Priority (P1)\n\n`;
      top_p1.slice(0, 3).forEach((a, i) => {
        md += `- **${a.title}** - ${a.owner_label} [${citationIndex}]\n`;
        citations.push({
          ref: `[${citationIndex}]`,
          key_path: `actions.top_p1[${i}]`,
          label: a.title,
          value: a.priority,
        });
        citationIndex++;
      });
      md += `\n`;
    }

    md += `### By Owner\n`;
    md += `- Recruiter: ${by_owner_type.recruiter}\n`;
    md += `- Hiring Manager: ${by_owner_type.hiring_manager}\n`;
    md += `- TA Ops: ${by_owner_type.ta_ops}\n`;

    return {
      answer_markdown: md,
      citations,
      deep_links: [
        buildDeepLink('View all actions', 'control-tower', fp, { view: 'actions' }),
      ],
      suggested_questions: [
        'What\'s on fire?',
        'Show me HM delays',
        'Why is time to offer high?',
      ],
    };
  },
};

// ─────────────────────────────────────────────────────────────
// Handler: Why Time to Offer
// ─────────────────────────────────────────────────────────────

export const whyTimeToOfferHandler: IntentHandler = {
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
    const bottleneck = fp.velocity.bottleneck_stage;
    const medianTtf = fp.control_tower.kpis.median_ttf;

    let md = `## Time to Offer Analysis\n\n`;
    const citations: FactCitation[] = [];

    if (explain.value !== null) {
      md += `**Current value:** ${explain.value} ${explain.unit} [1]\n`;
      citations.push({
        ref: '[1]',
        key_path: 'explain.time_to_offer.value',
        label: `Time to Offer: ${explain.value} ${explain.unit}`,
        value: explain.value,
      });
    }

    md += `**Sample size:** n=${explain.n}\n`;
    md += `**Confidence:** ${explain.confidence}\n\n`;

    if (explain.top_drivers.length > 0) {
      md += `### Top Drivers\n\n`;
      explain.top_drivers.forEach((d, i) => {
        md += `${i + 1}. **${d.factor}** - ${d.impact} [${i + 2}]\n`;
        citations.push({
          ref: `[${i + 2}]`,
          key_path: d.evidence_key,
          label: d.factor,
          value: d.impact,
        });
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

    return {
      answer_markdown: md,
      citations,
      deep_links: [
        buildDeepLink('View velocity details', 'velocity', fp),
        buildDeepLink('View stage breakdown', 'velocity', fp, { view: 'funnel' }),
      ],
      suggested_questions: [
        'Which HMs are slowest?',
        'Show me stalled reqs',
        'What are my top actions?',
      ],
    };
  },
};

// ─────────────────────────────────────────────────────────────
// Handler: Why HM Latency
// ─────────────────────────────────────────────────────────────

export const whyHMLatencyHandler: IntentHandler = {
  intent_id: 'why_hm_latency',
  patterns: [
    /\b(hm|hiring manager) (latency|delay)/i,
    /manager.*(delays?|slow|waiting)/i,
    /feedback.*(time|delay|waiting)/i,
  ],
  keywords: ['hm latency', 'manager delays', 'feedback time', 'hiring manager'],
  fact_keys_used: [
    'explain.hm_latency',
    'control_tower.kpis.hm_latency',
    'actions.by_owner_type.hiring_manager',
  ],
  handler: (fp: AskFactPack): IntentResponse => {
    const explain = fp.explain.hm_latency;
    const kpi = fp.control_tower.kpis.hm_latency;
    const hmActions = fp.actions.by_owner_type.hiring_manager;

    let md = `## HM Latency Analysis\n\n`;
    const citations: FactCitation[] = [];

    if (kpi.value !== null) {
      md += `**Average HM response time:** ${kpi.value} ${kpi.unit} [1]\n`;
      md += `**Status:** ${kpi.status === 'green' ? 'On track' : kpi.status === 'yellow' ? 'Needs attention' : 'Critical'}\n`;
      citations.push({
        ref: '[1]',
        key_path: 'control_tower.kpis.hm_latency.value',
        label: `HM Latency: ${kpi.value} ${kpi.unit}`,
        value: kpi.value,
      });
    } else {
      md += `**HM latency data not available**\n`;
    }

    md += `**Sample size:** n=${kpi.n}\n\n`;

    md += `### Target Thresholds\n`;
    md += `- Green: <= ${kpi.threshold.green} days\n`;
    md += `- Yellow: <= ${kpi.threshold.yellow} days\n`;
    md += `- Red: > ${kpi.threshold.red} days\n\n`;

    md += `### Pending HM Actions\n`;
    md += `${hmActions} actions awaiting HM response [2]\n`;
    citations.push({
      ref: '[2]',
      key_path: 'actions.by_owner_type.hiring_manager',
      label: 'Pending HM Actions',
      value: hmActions,
    });

    if (explain.top_drivers.length > 0) {
      md += `\n### Top Drivers\n\n`;
      explain.top_drivers.forEach((d, i) => {
        md += `${i + 1}. **${d.factor}** - ${d.impact}\n`;
      });
    }

    return {
      answer_markdown: md,
      citations,
      deep_links: [
        buildDeepLink('View HM queue', 'hm-friction', fp),
        buildDeepLink('View pending actions', 'control-tower', fp, { filter: 'HIRING_MANAGER' }),
      ],
      suggested_questions: [
        'What actions are blocking?',
        'Show me stalled reqs',
        'What\'s on fire?',
      ],
    };
  },
};

// ─────────────────────────────────────────────────────────────
// Handler: Stalled Reqs
// ─────────────────────────────────────────────────────────────

export const stalledReqsHandler: IntentHandler = {
  intent_id: 'stalled_reqs',
  patterns: [
    /\b(stalled|stuck|zombie)\s*(reqs?|requisitions?)/i,
    /no activity/i,
    /reqs?.*(stalled|stuck)/i,
  ],
  keywords: ['stalled', 'stuck reqs', 'no activity', 'zombie'],
  fact_keys_used: [
    'control_tower.kpis.stalled_reqs',
    'control_tower.risk_summary.by_type.zombie',
    'control_tower.risk_summary.by_type.stalled',
    'risks.top_risks',
  ],
  handler: (fp: AskFactPack): IntentResponse => {
    const stalledKpi = fp.control_tower.kpis.stalled_reqs;
    const zombieCount = fp.control_tower.risk_summary.by_type.zombie || 0;
    const stalledByType = fp.control_tower.risk_summary.by_type.stalled || 0;

    let md = `## Stalled Requisitions\n\n`;
    const citations: FactCitation[] = [];

    md += `### Summary\n`;
    md += `- **Stalled (14-30 days):** ${stalledKpi.value || 0} [1]\n`;
    citations.push({
      ref: '[1]',
      key_path: 'control_tower.kpis.stalled_reqs.value',
      label: 'Stalled Reqs',
      value: stalledKpi.value,
    });

    md += `- **Zombie (30+ days):** ${zombieCount} [2]\n\n`;
    citations.push({
      ref: '[2]',
      key_path: 'control_tower.risk_summary.by_type.zombie',
      label: 'Zombie Reqs',
      value: zombieCount,
    });

    // Show stalled/zombie reqs from risks
    const stalledRisks = fp.risks.top_risks.filter(
      r => r.risk_type === 'zombie' || r.risk_type === 'stalled' || r.risk_type === 'pipeline_gap'
    );

    if (stalledRisks.length > 0) {
      md += `### Top Stalled/Zombie Reqs\n\n`;
      stalledRisks.slice(0, 5).forEach((r, i) => {
        md += `${i + 1}. **${r.req_title}** - ${r.days_open} days open [${i + 3}]\n`;
        md += `   - ${r.owner_label} | ${r.candidate_count} candidates\n`;
        md += `   - _${r.top_driver}_\n`;
        citations.push({
          ref: `[${i + 3}]`,
          key_path: `risks.top_risks[${fp.risks.top_risks.indexOf(r)}]`,
          label: r.req_title,
          value: r.risk_type,
        });
      });
    }

    md += `\n### Recommended Actions\n`;
    md += `- Review zombie reqs for close or revive decision\n`;
    md += `- Source new candidates for stalled reqs with thin pipelines\n`;
    md += `- Escalate to HM if feedback is blocking\n`;

    return {
      answer_markdown: md,
      citations,
      deep_links: [
        buildDeepLink('View stalled reqs', 'control-tower', fp, { filter: 'stalled' }),
        buildDeepLink('View data health', 'data-health', fp),
      ],
      suggested_questions: [
        'What actions should I take?',
        'Show me risks',
        'Why is HM latency high?',
      ],
    };
  },
};

// ─────────────────────────────────────────────────────────────
// Handler: Forecast Gap
// ─────────────────────────────────────────────────────────────

export const forecastGapHandler: IntentHandler = {
  intent_id: 'forecast_gap',
  patterns: [
    /\b(forecast|prediction|pipeline gap)\b/i,
    /will we (hit|meet|make).*(goal|target)/i,
    /hiring (forecast|prediction)/i,
  ],
  keywords: ['forecast', 'will we hit goal', 'pipeline gap', 'prediction'],
  fact_keys_used: [
    'forecast',
  ],
  handler: (fp: AskFactPack): IntentResponse => {
    const forecast = fp.forecast;

    let md = `## Hiring Forecast\n\n`;
    const citations: FactCitation[] = [];

    md += `### Pipeline Summary\n`;
    md += `- **Open Reqs:** ${forecast.open_reqs} [1]\n`;
    citations.push({
      ref: '[1]',
      key_path: 'forecast.open_reqs',
      label: 'Open Reqs',
      value: forecast.open_reqs,
    });

    md += `- **Active Candidates:** ${forecast.active_candidates} [2]\n`;
    citations.push({
      ref: '[2]',
      key_path: 'forecast.active_candidates',
      label: 'Active Candidates',
      value: forecast.active_candidates,
    });

    md += `\n### Forecast\n`;
    md += `- **Expected Hires:** ${forecast.expected_hires} [3]\n`;
    citations.push({
      ref: '[3]',
      key_path: 'forecast.expected_hires',
      label: 'Expected Hires',
      value: forecast.expected_hires,
    });

    md += `- **Pipeline Gap:** ${forecast.pipeline_gap} [4]\n`;
    citations.push({
      ref: '[4]',
      key_path: 'forecast.pipeline_gap',
      label: 'Pipeline Gap',
      value: forecast.pipeline_gap,
    });

    md += `- **Confidence:** ${forecast.confidence}\n\n`;

    if (forecast.pipeline_gap > 0) {
      md += `### Gap Analysis\n`;
      md += `You may fall **${forecast.pipeline_gap} hires short** of filling all open reqs.\n\n`;
      md += `**Recommendations:**\n`;
      md += `- Increase sourcing for high-priority reqs\n`;
      md += `- Review stalled candidates for re-engagement\n`;
      md += `- Consider closing low-priority reqs\n`;
    } else {
      md += `Pipeline looks healthy to fill open reqs.\n`;
    }

    return {
      answer_markdown: md,
      citations,
      deep_links: [
        buildDeepLink('View forecasting', 'forecasting', fp),
        buildDeepLink('View pipeline', 'control-tower', fp, { view: 'pipeline' }),
      ],
      suggested_questions: [
        'What\'s on fire?',
        'Show me top risks',
        'What actions should I take?',
      ],
    };
  },
};

// ─────────────────────────────────────────────────────────────
// Handler: Velocity Summary
// ─────────────────────────────────────────────────────────────

export const velocitySummaryHandler: IntentHandler = {
  intent_id: 'velocity_summary',
  patterns: [
    /\b(velocity|funnel|conversion|stage times?)\b/i,
    /how fast/i,
    /stage.*(time|conversion|velocity)/i,
  ],
  keywords: ['velocity', 'funnel', 'conversion', 'stage times'],
  fact_keys_used: [
    'velocity',
  ],
  handler: (fp: AskFactPack): IntentResponse => {
    const velocity = fp.velocity;

    let md = `## Velocity Summary\n\n`;
    const citations: FactCitation[] = [];

    if (velocity.avg_days_to_hire !== null) {
      md += `**Average days to hire:** ${velocity.avg_days_to_hire} days [1]\n\n`;
      citations.push({
        ref: '[1]',
        key_path: 'velocity.avg_days_to_hire',
        label: 'Avg Days to Hire',
        value: velocity.avg_days_to_hire,
      });
    }

    if (velocity.bottleneck_stage) {
      md += `**Bottleneck stage:** ${velocity.bottleneck_stage} [2]\n\n`;
      citations.push({
        ref: '[2]',
        key_path: 'velocity.bottleneck_stage',
        label: 'Bottleneck Stage',
        value: velocity.bottleneck_stage,
      });
    }

    md += `### Funnel\n\n`;
    md += `| Stage | Candidates | Conversion |\n`;
    md += `|-------|------------|------------|\n`;

    velocity.funnel.forEach((f, i) => {
      const convStr = f.conversion_rate !== null
        ? `${Math.round(f.conversion_rate * 100)}%`
        : '-';
      const marker = f.is_bottleneck ? ' **' : '';
      md += `| ${marker}${f.stage}${marker} | ${f.candidate_count} | ${convStr} |\n`;

      if (i === 0) {
        citations.push({
          ref: `[${citations.length + 1}]`,
          key_path: `velocity.funnel[${i}]`,
          label: f.stage,
          value: f.candidate_count,
        });
      }
    });

    return {
      answer_markdown: md,
      citations,
      deep_links: [
        buildDeepLink('View velocity details', 'velocity', fp),
      ],
      suggested_questions: [
        'Why is time to offer high?',
        'Show me HM latency',
        'What\'s the forecast?',
      ],
    };
  },
};

// ─────────────────────────────────────────────────────────────
// Handler: Source Mix Summary
// ─────────────────────────────────────────────────────────────

export const sourceMixSummaryHandler: IntentHandler = {
  intent_id: 'source_mix_summary',
  patterns: [
    /\b(source|sources|channels?|where from)\b/i,
    /candidate.*(sources?|from)/i,
  ],
  keywords: ['sources', 'where from', 'channels', 'source mix'],
  fact_keys_used: [
    'sources',
  ],
  handler: (fp: AskFactPack): IntentResponse => {
    const sources = fp.sources;

    let md = `## Source Mix Summary\n\n`;
    const citations: FactCitation[] = [];

    md += `**Total sources:** ${sources.total_sources} [1]\n\n`;
    citations.push({
      ref: '[1]',
      key_path: 'sources.total_sources',
      label: 'Total Sources',
      value: sources.total_sources,
    });

    md += `### Top Sources by Volume\n\n`;
    sources.top_by_volume.forEach((s, i) => {
      const convStr = s.conversion_rate !== null
        ? `(${Math.round(s.conversion_rate * 100)}% conversion)`
        : '';
      md += `${i + 1}. **${s.source_name}** - ${s.candidate_count} candidates ${convStr} [${i + 2}]\n`;
      citations.push({
        ref: `[${i + 2}]`,
        key_path: `sources.top_by_volume[${i}]`,
        label: s.source_name,
        value: s.candidate_count,
      });
    });

    if (sources.top_by_conversion.length > 0) {
      md += `\n### Top Sources by Conversion\n\n`;
      sources.top_by_conversion.forEach((s, i) => {
        const convStr = s.conversion_rate !== null
          ? `${Math.round(s.conversion_rate * 100)}%`
          : '-';
        md += `${i + 1}. **${s.source_name}** - ${convStr} conversion (${s.hire_count} hires)\n`;
      });
    }

    return {
      answer_markdown: md,
      citations,
      deep_links: [
        buildDeepLink('View source effectiveness', 'source-mix', fp),
      ],
      suggested_questions: [
        'What\'s the forecast?',
        'Show me velocity',
        'What actions should I take?',
      ],
    };
  },
};

// ─────────────────────────────────────────────────────────────
// Handler: Capacity Summary
// ─────────────────────────────────────────────────────────────

export const capacitySummaryHandler: IntentHandler = {
  intent_id: 'capacity_summary',
  patterns: [
    /\b(capacity|workload|recruiter load)\b/i,
    /team.*(capacity|load)/i,
  ],
  keywords: ['capacity', 'workload', 'recruiter load'],
  fact_keys_used: [
    'capacity',
  ],
  handler: (fp: AskFactPack): IntentResponse => {
    const capacity = fp.capacity;

    let md = `## Capacity Summary\n\n`;
    const citations: FactCitation[] = [];

    md += `### Team Overview\n`;
    md += `- **Total Recruiters:** ${capacity.total_recruiters} [1]\n`;
    citations.push({
      ref: '[1]',
      key_path: 'capacity.total_recruiters',
      label: 'Total Recruiters',
      value: capacity.total_recruiters,
    });

    md += `- **Average Req Load:** ${capacity.avg_req_load} reqs/recruiter [2]\n`;
    citations.push({
      ref: '[2]',
      key_path: 'capacity.avg_req_load',
      label: 'Avg Req Load',
      value: capacity.avg_req_load,
    });

    md += `\n### Load Distribution\n`;
    md += `- **Overloaded (>15 reqs):** ${capacity.overloaded_count} recruiters [3]\n`;
    citations.push({
      ref: '[3]',
      key_path: 'capacity.overloaded_count',
      label: 'Overloaded',
      value: capacity.overloaded_count,
    });

    md += `- **Underloaded (<5 reqs):** ${capacity.underloaded_count} recruiters [4]\n`;
    citations.push({
      ref: '[4]',
      key_path: 'capacity.underloaded_count',
      label: 'Underloaded',
      value: capacity.underloaded_count,
    });

    if (capacity.overloaded_count > 0) {
      md += `\n### Recommendations\n`;
      md += `- Consider redistributing reqs from overloaded recruiters\n`;
      md += `- Prioritize high-risk reqs for additional support\n`;
    }

    return {
      answer_markdown: md,
      citations,
      deep_links: [
        buildDeepLink('View HM friction', 'hm-friction', fp),
        buildDeepLink('View control tower', 'control-tower', fp),
      ],
      suggested_questions: [
        'What\'s on fire?',
        'Show me stalled reqs',
        'What actions should I take?',
      ],
    };
  },
};

// ─────────────────────────────────────────────────────────────
// Handler: Most Productive Recruiter
// ─────────────────────────────────────────────────────────────

export const mostProductiveRecruiterHandler: IntentHandler = {
  intent_id: 'most_productive_recruiter',
  patterns: [
    /\b(most|top|best)\s+(productive|performing|effective)\s+recruiter/i,
    /who.*(most|top|best).*(productive|performer|recruiter)/i,
    /\brecruiter\s+(leaderboard|ranking|performance)/i,
    /top recruiter/i,
    /best recruiter/i,
  ],
  keywords: ['most productive', 'top recruiter', 'best recruiter', 'recruiter performance', 'productive recruiter', 'top performer'],
  fact_keys_used: [
    'recruiter_performance.top_by_productivity',
    'recruiter_performance.top_by_hires',
    'recruiter_performance.team_avg_productivity',
    'recruiter_performance.available',
    'recruiter_performance.n',
    'recruiter_performance.confidence',
  ],
  handler: (fp: AskFactPack): IntentResponse => {
    const recruiterPerf = fp.recruiter_performance;
    const citations: FactCitation[] = [];

    // Check if data is available
    if (!recruiterPerf.available) {
      let md = `## Recruiter Productivity\n\n`;
      md += `**Data not available:** ${recruiterPerf.unavailable_reason || 'No recruiter data found.'}\n\n`;
      md += `To enable recruiter performance tracking:\n`;
      md += `- Ensure requisitions have the \`recruiter_id\` field populated\n`;
      md += `- Import data with recruiter assignments\n`;

      return {
        answer_markdown: md,
        citations: [{
          ref: '[1]',
          key_path: 'recruiter_performance.available',
          label: 'Data Availability',
          value: 'false',
        }],
        deep_links: [buildDeepLink('View Data Health', 'data-health', fp)],
        suggested_questions: [
          'What\'s on fire?',
          'Show me risks',
          'What\'s the forecast?',
        ],
      };
    }

    const topByProductivity = recruiterPerf.top_by_productivity;
    const topByHires = recruiterPerf.top_by_hires;
    const teamAvg = recruiterPerf.team_avg_productivity;

    let md = `## Most Productive Recruiter\n\n`;

    // Top performer by productivity score
    if (topByProductivity.length > 0) {
      const top = topByProductivity[0];
      md += `### Top Performer\n\n`;
      md += `**${top.anonymized_label}** leads the team with a productivity score of **${top.productivity_score}** [1]\n\n`;
      citations.push({
        ref: '[1]',
        key_path: 'recruiter_performance.top_by_productivity[0].productivity_score',
        label: `${top.anonymized_label} Productivity Score`,
        value: top.productivity_score,
      });

      md += `**Performance metrics:**\n`;
      md += `- Hires in period: **${top.hires_in_period}** [2]\n`;
      citations.push({
        ref: '[2]',
        key_path: 'recruiter_performance.top_by_productivity[0].hires_in_period',
        label: 'Hires',
        value: top.hires_in_period,
      });

      md += `- Offers in period: **${top.offers_in_period}** [3]\n`;
      citations.push({
        ref: '[3]',
        key_path: 'recruiter_performance.top_by_productivity[0].offers_in_period',
        label: 'Offers',
        value: top.offers_in_period,
      });

      md += `- Open reqs: ${top.open_reqs}\n`;
      md += `- Active candidates: ${top.active_candidates}\n`;
      if (top.avg_ttf !== null) {
        md += `- Avg TTF: ${top.avg_ttf} days\n`;
      }
      md += `\n`;
    }

    // Leaderboard
    if (topByProductivity.length > 1) {
      md += `### Recruiter Leaderboard (Top 5)\n\n`;
      md += `| Rank | Recruiter | Score | Hires | Offers |\n`;
      md += `|------|-----------|-------|-------|--------|\n`;

      topByProductivity.slice(0, 5).forEach((r, i) => {
        md += `| ${i + 1} | ${r.anonymized_label} | ${r.productivity_score ?? '-'} | ${r.hires_in_period} | ${r.offers_in_period} |\n`;
      });
      md += `\n`;
    }

    // Team average
    if (teamAvg !== null) {
      md += `**Team average productivity:** ${teamAvg} [4]\n`;
      citations.push({
        ref: '[4]',
        key_path: 'recruiter_performance.team_avg_productivity',
        label: 'Team Average',
        value: teamAvg,
      });
    }

    // Confidence indicator
    md += `\n_Based on ${recruiterPerf.n} recruiters with activity (${recruiterPerf.confidence} confidence)_\n`;

    return {
      answer_markdown: md,
      citations,
      deep_links: [
        buildDeepLink('View Recruiter Performance', 'recruiter', fp, {
          id: topByProductivity[0]?.anonymized_id || '',
        }),
        buildDeepLink('View Capacity Overview', 'capacity', fp),
      ],
      suggested_questions: [
        'What\'s on fire?',
        'Show me stalled reqs',
        'What\'s the forecast?',
      ],
    };
  },
};

// ─────────────────────────────────────────────────────────────
// Handler: HM with Most Open Reqs
// ─────────────────────────────────────────────────────────────

export const hmWithMostOpenReqsHandler: IntentHandler = {
  intent_id: 'hm_with_most_open_reqs',
  patterns: [
    /\b(which|who)\s+(hiring manager|hm|manager).*(most|highest|largest)\s+(open\s+)?(reqs?|requisitions?)/i,
    /\b(hiring manager|hm|manager).*(most|highest|largest)\s+(open\s+)?(reqs?|requisitions?)/i,
    /\bmost\s+(open\s+)?(reqs?|requisitions?)\s+by\s+(hiring manager|hm|manager)/i,
    /\b(hm|hiring manager|manager)\s+with\s+most\s+reqs/i,
    /\btop\s+(hiring manager|hm|manager)\s+by\s+(reqs?|requisitions?)/i,
  ],
  keywords: ['hiring manager', 'hm', 'manager', 'most reqs', 'most requisitions', 'open reqs', 'req ownership'],
  fact_keys_used: [
    'hiring_manager_ownership.available',
    'hiring_manager_ownership.open_reqs_by_hm',
    'hiring_manager_ownership.total_hiring_managers',
    'hiring_manager_ownership.n',
    'hiring_manager_ownership.confidence',
  ],
  handler: (fp: AskFactPack): IntentResponse => {
    const hmOwnership = fp.hiring_manager_ownership;
    const citations: FactCitation[] = [];

    // Check if data is available
    if (!hmOwnership.available) {
      let md = `## Hiring Manager Ownership\n\n`;
      md += `**Data not available:** ${hmOwnership.unavailable_reason || 'No hiring manager data found.'}\n\n`;
      md += `To enable HM ownership tracking:\n`;
      md += `- Ensure requisitions have the \`hiring_manager_id\` field populated\n`;
      md += `- Import data with hiring manager assignments\n`;

      return {
        answer_markdown: md,
        citations: [{
          ref: '[1]',
          key_path: 'hiring_manager_ownership.available',
          label: 'Data Availability',
          value: 'false',
        }],
        deep_links: [buildDeepLink('View Data Health', 'data-health', fp)],
        suggested_questions: [
          'What\'s on fire?',
          'Show me risks',
          'What\'s the forecast?',
        ],
      };
    }

    const topHMs = hmOwnership.open_reqs_by_hm;

    if (topHMs.length === 0) {
      return {
        answer_markdown: `## Hiring Manager Ownership\n\nNo hiring managers currently have open requisitions.`,
        citations: [{
          ref: '[1]',
          key_path: 'hiring_manager_ownership.n',
          label: 'HMs with Open Reqs',
          value: 0,
        }],
        deep_links: [buildDeepLink('View Hiring Managers', 'hiring-managers', fp)],
        suggested_questions: [
          'What\'s on fire?',
          'Show me risks',
          'What\'s the forecast?',
        ],
      };
    }

    const topHM = topHMs[0];
    let md = `## Hiring Manager with Most Open Reqs\n\n`;

    md += `### Top HM by Open Requisitions\n\n`;
    md += `**${topHM.hm_label}** has the most open requisitions with **${topHM.open_req_count}** reqs [1]\n\n`;
    citations.push({
      ref: '[1]',
      key_path: 'hiring_manager_ownership.open_reqs_by_hm[0].open_req_count',
      label: `${topHM.hm_label} Open Reqs`,
      value: topHM.open_req_count,
    });

    // Show sample req IDs
    if (topHM.req_ids.length > 0) {
      md += `**Sample Req IDs:** ${topHM.req_ids.slice(0, 5).join(', ')}`;
      if (topHM.req_ids.length > 5) {
        md += ` and ${topHM.req_ids.length - 5} more`;
      }
      md += ` [2]\n`;
      citations.push({
        ref: '[2]',
        key_path: 'hiring_manager_ownership.open_reqs_by_hm[0].req_ids',
        label: 'Req IDs',
        value: topHM.req_ids.slice(0, 5).join(', '),
      });
    }

    // Show HM latency if available
    if (topHM.avg_hm_latency !== null && topHM.avg_hm_latency !== undefined) {
      md += `\n**Avg HM Latency:** ${topHM.avg_hm_latency} days [3]\n`;
      citations.push({
        ref: '[3]',
        key_path: 'hiring_manager_ownership.open_reqs_by_hm[0].avg_hm_latency',
        label: 'Avg HM Latency',
        value: topHM.avg_hm_latency,
      });
    }

    // Leaderboard
    if (topHMs.length > 1) {
      md += `\n### HM Leaderboard (Top 10 by Open Reqs)\n\n`;
      md += `| Rank | Hiring Manager | Open Reqs | Latency |\n`;
      md += `|------|----------------|-----------|----------|\n`;

      topHMs.slice(0, 10).forEach((hm, i) => {
        const latency = hm.avg_hm_latency !== null && hm.avg_hm_latency !== undefined
          ? `${hm.avg_hm_latency}d`
          : '-';
        md += `| ${i + 1} | ${hm.hm_label} | ${hm.open_req_count} | ${latency} |\n`;
      });
      md += `\n`;
    }

    // Summary stats
    md += `**Total hiring managers:** ${hmOwnership.total_hiring_managers} [${citations.length + 1}]\n`;
    citations.push({
      ref: `[${citations.length + 1}]`,
      key_path: 'hiring_manager_ownership.total_hiring_managers',
      label: 'Total HMs',
      value: hmOwnership.total_hiring_managers,
    });

    md += `**HMs with open reqs:** ${hmOwnership.n}\n`;

    // Confidence indicator
    md += `\n_${hmOwnership.confidence} confidence based on ${hmOwnership.n} hiring managers with open reqs_\n`;

    return {
      answer_markdown: md,
      citations,
      deep_links: [
        buildDeepLink('View Hiring Managers', 'hiring-managers', fp, {
          id: topHM.anonymized_id || '',
        }),
        buildDeepLink('View HM Friction', 'hm-friction', fp),
      ],
      suggested_questions: [
        'Show me HM latency',
        'What\'s on fire?',
        'What actions should I take?',
      ],
    };
  },
};

// ─────────────────────────────────────────────────────────────
// All Handlers
// ─────────────────────────────────────────────────────────────

export const ALL_HANDLERS: IntentHandler[] = [
  whatsOnFireHandler,
  topRisksHandler,
  topActionsHandler,
  whyTimeToOfferHandler,
  whyHMLatencyHandler,
  stalledReqsHandler,
  forecastGapHandler,
  velocitySummaryHandler,
  sourceMixSummaryHandler,
  capacitySummaryHandler,
  mostProductiveRecruiterHandler,
  hmWithMostOpenReqsHandler,
];

// ─────────────────────────────────────────────────────────────
// Help Response
// ─────────────────────────────────────────────────────────────

/**
 * Generate a help response when no intent matches
 */
export function generateHelpResponse(fp: AskFactPack): IntentResponse {
  let md = `## Ask ProdDash\n\n`;
  md += `I can help you understand your recruiting data. Try asking:\n\n`;
  md += `- **"What's on fire?"** - Critical issues needing attention\n`;
  md += `- **"Show me risks"** - At-risk requisitions\n`;
  md += `- **"What should I do?"** - Top actions to take\n`;
  md += `- **"Why is time to offer high?"** - Time to offer analysis\n`;
  md += `- **"Show HM latency"** - Hiring manager response times\n`;
  md += `- **"Stalled reqs"** - Requisitions with no activity\n`;
  md += `- **"Forecast"** - Pipeline and hiring predictions\n`;
  md += `- **"Velocity"** - Funnel and stage timing\n`;
  md += `- **"Sources"** - Candidate source effectiveness\n`;
  md += `- **"Capacity"** - Team workload distribution\n`;

  return {
    answer_markdown: md,
    citations: [],
    deep_links: [
      buildDeepLink('View Control Tower', 'control-tower', fp),
    ],
    suggested_questions: [
      'What\'s on fire?',
      'Show me top risks',
      'What should I work on?',
    ],
  };
}

// ─────────────────────────────────────────────────────────────
// Main Query Handler
// ─────────────────────────────────────────────────────────────

/**
 * Handle an Ask ProdDash query (deterministic mode)
 */
export function handleDeterministicQuery(
  query: string,
  factPack: AskFactPack
): IntentResponse {
  const matchedIntent = matchIntent(query, ALL_HANDLERS);

  if (matchedIntent) {
    return matchedIntent.handler(factPack);
  }

  return generateHelpResponse(factPack);
}
