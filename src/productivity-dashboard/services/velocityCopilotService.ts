/**
 * Velocity Copilot Service
 * Builds VelocityFactPack and handles AI/deterministic insight generation
 */

import { format } from 'date-fns';
import {
  VelocityFactPack,
  AICopilotInsight,
  AICopilotResponse,
  DeterministicSummary,
  DraftMessage,
  CitationValidationResult,
  VALID_FACT_PATHS
} from '../types/velocityCopilotTypes';
import {
  VelocityMetrics,
  Requisition,
  Candidate,
  Event,
  MetricFilters
} from '../types';
import { AiProviderConfig, AiMessage } from '../types/aiTypes';
import { sendAiRequest } from './aiService';
import {
  MIN_OFFERS_FOR_DECAY,
  MIN_HIRES_FOR_FAST_VS_SLOW,
  MIN_REQS_FOR_REQ_DECAY,
  detectStageTimingCapability
} from './velocityThresholds';

// ===== FACT PACK BUILDER =====

/**
 * Build a VelocityFactPack from velocity metrics and raw data
 * This is the single source of truth for AI and deterministic insights
 *
 * IMPORTANT: This function NEVER includes PII (names, emails, phones)
 */
export function buildVelocityFactPack(
  metrics: VelocityMetrics,
  requisitions: Requisition[],
  candidates: Candidate[],
  events: Event[],
  filters: MetricFilters
): VelocityFactPack {
  const now = new Date();
  const { candidateDecay, reqDecay, cohortComparison, insights } = metrics;

  // Detect stage timing capability
  const stageCapability = detectStageTimingCapability(
    events.map(e => ({ event_type: e.event_type, from_stage: e.from_stage, to_stage: e.to_stage, event_at: e.event_at })),
    candidates.map(c => ({ current_stage_entered_at: c.current_stage_entered_at }))
  );

  // Calculate data quality based on sample sizes
  const dataQuality = calculateDataQuality(candidateDecay.totalOffers, reqDecay.totalReqs, cohortComparison);

  // Get contributing req IDs (redacted - just IDs)
  const contributingReqs = getContributingReqIds(requisitions, events);

  // Get bottleneck stages from events
  const bottleneckStages = calculateBottleneckStages(events, candidates);

  const factPack: VelocityFactPack = {
    metadata: {
      generated_at: now.toISOString(),
      date_range: {
        start: filters.dateRange?.startDate?.toISOString() || now.toISOString(),
        end: filters.dateRange?.endDate?.toISOString() || now.toISOString()
      },
      data_quality: dataQuality
    },

    sample_sizes: {
      total_offers: candidateDecay.totalOffers,
      total_accepted: candidateDecay.totalAccepted,
      total_reqs: reqDecay.totalReqs,
      total_filled: reqDecay.totalFilled,
      total_hires: cohortComparison?.allHires?.count ?? 0,
      fast_hires_cohort: cohortComparison?.fastHires?.count ?? 0,
      slow_hires_cohort: cohortComparison?.slowHires?.count ?? 0
    },

    kpis: {
      median_ttf_days: reqDecay.medianDaysToFill,
      offer_accept_rate: candidateDecay.totalOffers > 0
        ? candidateDecay.overallAcceptanceRate
        : null,
      overall_fill_rate: reqDecay.totalReqs > 0
        ? reqDecay.overallFillRate
        : null,
      decay_rate_per_day: candidateDecay.decayRatePerDay,
      req_decay_rate_per_day: reqDecay.decayRatePerDay,
      decay_start_day: candidateDecay.decayStartDay
    },

    stage_timing: {
      capability: stageCapability.capability,
      can_show_duration: stageCapability.canShowStageDuration,
      reason: stageCapability.reason
    },

    candidate_decay: {
      available: candidateDecay.totalOffers >= MIN_OFFERS_FOR_DECAY,
      gating_reason: candidateDecay.totalOffers < MIN_OFFERS_FOR_DECAY
        ? `Need ${MIN_OFFERS_FOR_DECAY} offers, have ${candidateDecay.totalOffers}`
        : undefined,
      buckets: candidateDecay.dataPoints.map(dp => ({
        label: dp.bucket,
        count: dp.count,
        rate: dp.rate
      }))
    },

    req_decay: {
      available: reqDecay.totalReqs >= MIN_REQS_FOR_REQ_DECAY,
      gating_reason: reqDecay.totalReqs < MIN_REQS_FOR_REQ_DECAY
        ? `Need ${MIN_REQS_FOR_REQ_DECAY} reqs, have ${reqDecay.totalReqs}`
        : undefined,
      buckets: reqDecay.dataPoints.map(dp => ({
        label: dp.bucket,
        count: dp.count,
        rate: dp.rate
      }))
    },

    cohort_comparison: {
      available: cohortComparison !== null,
      gating_reason: cohortComparison === null
        ? `Need ${MIN_HIRES_FOR_FAST_VS_SLOW} hires for cohort analysis`
        : undefined,
      fast_hires: cohortComparison ? {
        count: cohortComparison.fastHires.count,
        avg_ttf: cohortComparison.fastHires.avgTimeToFill,
        median_ttf: cohortComparison.fastHires.medianTimeToFill,
        referral_percent: cohortComparison.fastHires.referralPercent,
        avg_pipeline_depth: cohortComparison.fastHires.avgPipelineDepth,
        avg_interviews_per_hire: cohortComparison.fastHires.avgInterviewsPerHire
      } : undefined,
      slow_hires: cohortComparison ? {
        count: cohortComparison.slowHires.count,
        avg_ttf: cohortComparison.slowHires.avgTimeToFill,
        median_ttf: cohortComparison.slowHires.medianTimeToFill,
        referral_percent: cohortComparison.slowHires.referralPercent,
        avg_pipeline_depth: cohortComparison.slowHires.avgPipelineDepth,
        avg_interviews_per_hire: cohortComparison.slowHires.avgInterviewsPerHire
      } : undefined,
      factors: cohortComparison?.factors.map(f => ({
        name: f.factor,
        fast_value: String(f.fastHiresValue),
        slow_value: String(f.slowHiresValue),
        delta: String(f.delta),
        impact: f.impactLevel
      }))
    },

    bottleneck_stages: bottleneckStages,

    contributing_reqs: contributingReqs,

    definitions: {
      median_ttf: 'Median time-to-fill in days for closed requisitions in the selected period',
      offer_accept_rate: 'Percentage of extended offers that were accepted by candidates',
      decay_rate: 'Percentage point drop in acceptance/fill rate per day after decay threshold',
      fast_hires: 'Bottom 25% of hires by time-to-fill (fastest closures)',
      slow_hires: 'Top 25% of hires by time-to-fill (slowest closures)'
    },

    deterministic_insights: insights.map(i => ({
      title: i.title,
      type: i.type,
      description: i.description,
      sample_size: i.sampleSize ?? 0,
      confidence: i.confidence ?? 'INSUFFICIENT',
      so_what: i.soWhat,
      next_step: i.nextStep
    }))
  };

  return factPack;
}

/**
 * Calculate overall data quality based on sample sizes
 */
function calculateDataQuality(
  totalOffers: number,
  totalReqs: number,
  cohortComparison: VelocityMetrics['cohortComparison']
): 'HIGH' | 'MED' | 'LOW' | 'INSUFFICIENT' {
  const hasOffers = totalOffers >= MIN_OFFERS_FOR_DECAY;
  const hasReqs = totalReqs >= MIN_REQS_FOR_REQ_DECAY;
  const hasCohorts = cohortComparison !== null;

  if (hasOffers && hasReqs && hasCohorts) return 'HIGH';
  if ((hasOffers && hasReqs) || (hasOffers && hasCohorts) || (hasReqs && hasCohorts)) return 'MED';
  if (hasOffers || hasReqs || hasCohorts) return 'LOW';
  return 'INSUFFICIENT';
}

/**
 * Get contributing req IDs (redacted - no titles or PII)
 */
function getContributingReqIds(
  requisitions: Requisition[],
  events: Event[]
): VelocityFactPack['contributing_reqs'] {
  const now = new Date();

  // Build a map of req_id -> last event date
  const reqLastActivity = new Map<string, Date>();
  events.forEach(e => {
    const existing = reqLastActivity.get(e.req_id);
    if (!existing || e.event_at > existing) {
      reqLastActivity.set(e.req_id, e.event_at);
    }
  });

  // Stalled: no activity 14-30 days
  const stalledReqs = requisitions
    .filter(r => {
      if (r.status !== 'Open') return false;
      const lastActivity = reqLastActivity.get(r.req_id) || r.opened_at;
      if (!lastActivity) return false;
      const daysSince = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
      return daysSince >= 14 && daysSince < 30;
    })
    .slice(0, 10)
    .map(r => r.req_id);

  // Zombie: no activity 30+ days
  const zombieReqs = requisitions
    .filter(r => {
      if (r.status !== 'Open') return false;
      const lastActivity = reqLastActivity.get(r.req_id) || r.opened_at;
      if (!lastActivity) return false;
      const daysSince = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
      return daysSince >= 30;
    })
    .slice(0, 10)
    .map(r => r.req_id);

  // Slow fill: closed reqs that took >60 days
  const slowFillReqs = requisitions
    .filter(r => {
      if (r.status !== 'Closed' || !r.opened_at || !r.closed_at) return false;
      const daysToFill = Math.floor((r.closed_at.getTime() - r.opened_at.getTime()) / (1000 * 60 * 60 * 24));
      return daysToFill > 60;
    })
    .slice(0, 10)
    .map(r => r.req_id);

  // Fast fill: closed reqs that took <30 days
  const fastFillReqs = requisitions
    .filter(r => {
      if (r.status !== 'Closed' || !r.opened_at || !r.closed_at) return false;
      const daysToFill = Math.floor((r.closed_at.getTime() - r.opened_at.getTime()) / (1000 * 60 * 60 * 24));
      return daysToFill <= 30;
    })
    .slice(0, 10)
    .map(r => r.req_id);

  return {
    stalled_req_ids: stalledReqs,
    zombie_req_ids: zombieReqs,
    slow_fill_req_ids: slowFillReqs,
    fast_fill_req_ids: fastFillReqs
  };
}

/**
 * Calculate bottleneck stages from events
 */
function calculateBottleneckStages(
  events: Event[],
  candidates: Candidate[]
): VelocityFactPack['bottleneck_stages'] {
  // Group by stage and calculate average time in stage
  const stageMap = new Map<string, { totalDays: number; count: number }>();

  // Use candidate stage data if available
  candidates.forEach(c => {
    if (c.current_stage && c.current_stage_entered_at) {
      const daysInStage = Math.floor(
        (new Date().getTime() - c.current_stage_entered_at.getTime()) / (1000 * 60 * 60 * 24)
      );
      const existing = stageMap.get(c.current_stage) || { totalDays: 0, count: 0 };
      stageMap.set(c.current_stage, {
        totalDays: existing.totalDays + daysInStage,
        count: existing.count + 1
      });
    }
  });

  // Convert to array and sort by average days (descending)
  const bottlenecks = Array.from(stageMap.entries())
    .map(([stage, data]) => ({
      stage,
      avg_days: Math.round(data.totalDays / data.count),
      count: data.count
    }))
    .filter(b => b.count >= 3)  // Only include stages with enough data
    .sort((a, b) => b.avg_days - a.avg_days)
    .slice(0, 5);  // Top 5 bottlenecks

  return bottlenecks;
}

// ===== AI INSIGHT GENERATION =====

/**
 * Generate AI insights using BYOK provider
 */
export async function generateAIInsights(
  factPack: VelocityFactPack,
  aiConfig: AiProviderConfig
): Promise<AICopilotResponse> {
  const startTime = Date.now();

  const systemPrompt = buildVelocityCopilotSystemPrompt();
  const userPrompt = buildVelocityCopilotUserPrompt(factPack);

  const messages: AiMessage[] = [
    { role: 'user', content: userPrompt }
  ];

  try {
    const response = await sendAiRequest(
      aiConfig,
      messages,
      {
        systemPrompt,
        taskType: 'velocity_copilot'
      }
    );

    if (response.error) {
      return {
        insights: [],
        model_used: aiConfig.model,
        generated_at: new Date().toISOString(),
        latency_ms: Date.now() - startTime,
        error: response.error.message
      };
    }

    // Parse and validate AI response
    const parsed = parseAIResponse(response.content, factPack);

    return {
      insights: parsed.insights,
      model_used: aiConfig.model,
      generated_at: new Date().toISOString(),
      latency_ms: response.latency_ms,
      tokens_used: response.usage.total_tokens
    };
  } catch (error) {
    return {
      insights: [],
      model_used: aiConfig.model,
      generated_at: new Date().toISOString(),
      latency_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Build system prompt for velocity copilot
 */
function buildVelocityCopilotSystemPrompt(): string {
  return `You are a recruiting analytics copilot. Your job is to analyze velocity metrics and generate actionable insights.

CRITICAL RULES:
1. ONLY use data from the VelocityFactPack provided. Do NOT invent or assume any numbers.
2. Every insight MUST include citations to exact fact paths (e.g., "kpis.median_ttf_days", "sample_sizes.total_offers").
3. If data is missing or unavailable, say "Not available" and cite the missing field.
4. Keep claims to 1 sentence. Keep why_now to 1 sentence.
5. Provide 1-3 actionable recommended steps per insight.
6. Never include candidate names, emails, or any PII.
7. Prioritize severity correctly: P0 for blocking issues, P1 for risks, P2 for optimizations.

OUTPUT FORMAT (JSON):
{
  "insights": [
    {
      "title": "Short title",
      "severity": "P0|P1|P2",
      "claim": "One sentence describing the finding.",
      "why_now": "One sentence explaining urgency or relevance.",
      "recommended_actions": ["Action 1", "Action 2"],
      "citations": ["kpis.median_ttf_days", "sample_sizes.total_offers"]
    }
  ]
}

Generate 3-7 insights maximum, focusing on the most impactful findings.`;
}

/**
 * Build user prompt with fact pack data
 */
function buildVelocityCopilotUserPrompt(factPack: VelocityFactPack): string {
  return `Analyze this VelocityFactPack and generate insights:

${JSON.stringify(factPack, null, 2)}

Generate insights based ONLY on the data above. Include citations for every claim.`;
}

/**
 * Parse and validate AI response
 */
function parseAIResponse(
  content: string,
  factPack: VelocityFactPack
): { insights: AICopilotInsight[]; validation: CitationValidationResult } {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        insights: [],
        validation: { valid: false, invalid_citations: [], missing_citations: true, error: 'No JSON found in response' }
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const rawInsights = parsed.insights || [];

    // Validate and transform insights
    const validatedInsights: AICopilotInsight[] = [];
    const allInvalidCitations: string[] = [];

    for (let i = 0; i < rawInsights.length; i++) {
      const insight = rawInsights[i];

      // Validate required fields
      if (!insight.title || !insight.severity || !insight.claim || !insight.citations) {
        continue;
      }

      // Validate citations
      const validation = validateCitations(insight.citations, factPack);
      if (!validation.valid) {
        allInvalidCitations.push(...validation.invalid_citations);
      }

      validatedInsights.push({
        id: `ai_insight_${Date.now()}_${i}`,
        title: insight.title,
        severity: insight.severity,
        claim: insight.claim,
        why_now: insight.why_now || 'Analysis based on current data.',
        recommended_actions: insight.recommended_actions || [],
        citations: insight.citations,
        deep_link_params: {
          insight_type: 'ai_generated',
          metric_key: insight.citations[0] || undefined
        }
      });
    }

    return {
      insights: validatedInsights,
      validation: {
        valid: allInvalidCitations.length === 0,
        invalid_citations: allInvalidCitations,
        missing_citations: validatedInsights.some(i => i.citations.length === 0)
      }
    };
  } catch (error) {
    return {
      insights: [],
      validation: {
        valid: false,
        invalid_citations: [],
        missing_citations: true,
        error: error instanceof Error ? error.message : 'Parse error'
      }
    };
  }
}

/**
 * Validate that citations exist in the fact pack
 */
export function validateCitations(
  citations: string[],
  factPack: VelocityFactPack
): CitationValidationResult {
  const invalidCitations: string[] = [];

  for (const citation of citations) {
    // Check if citation path is valid
    if (!isValidCitationPath(citation, factPack)) {
      invalidCitations.push(citation);
    }
  }

  return {
    valid: invalidCitations.length === 0,
    invalid_citations: invalidCitations,
    missing_citations: citations.length === 0
  };
}

/**
 * Check if a citation path exists in the fact pack
 */
function isValidCitationPath(path: string, factPack: VelocityFactPack): boolean {
  const parts = path.split('.');
  let current: unknown = factPack;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return false;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current !== undefined;
}

// ===== DETERMINISTIC SUMMARY =====

/**
 * Generate deterministic summary without AI (fallback)
 */
export function generateDeterministicSummary(
  factPack: VelocityFactPack
): DeterministicSummary {
  const insights: AICopilotInsight[] = [];

  // Insight 1: Median TTF if available
  if (factPack.kpis.median_ttf_days !== null) {
    const severity = factPack.kpis.median_ttf_days > 60 ? 'P1' : 'P2';
    insights.push({
      id: `det_ttf_${Date.now()}`,
      title: 'Time to Fill Analysis',
      severity,
      claim: `Median time-to-fill is ${factPack.kpis.median_ttf_days} days based on ${factPack.sample_sizes.total_filled} filled reqs.`,
      why_now: factPack.kpis.median_ttf_days > 45
        ? 'This exceeds the typical 45-day target.'
        : 'This is within acceptable range.',
      recommended_actions: factPack.kpis.median_ttf_days > 45
        ? ['Review stalled reqs for bottlenecks', 'Engage HMs on oldest open reqs']
        : ['Maintain current processes', 'Document what works well'],
      citations: ['kpis.median_ttf_days', 'sample_sizes.total_filled'],
      deep_link_params: { metric_key: 'kpis.median_ttf_days', sample_size: factPack.sample_sizes.total_filled }
    });
  }

  // Insight 2: Offer acceptance if available
  if (factPack.kpis.offer_accept_rate !== null && factPack.sample_sizes.total_offers >= 5) {
    const rate = Math.round(factPack.kpis.offer_accept_rate * 100);
    const severity = rate < 70 ? 'P1' : 'P2';
    insights.push({
      id: `det_accept_${Date.now()}`,
      title: 'Offer Acceptance Rate',
      severity,
      claim: `${rate}% offer acceptance rate from ${factPack.sample_sizes.total_offers} offers.`,
      why_now: rate < 80
        ? 'Declining offers represent lost recruiting effort.'
        : 'Strong acceptance indicates good candidate experience.',
      recommended_actions: rate < 80
        ? ['Review declined offer reasons', 'Speed up offer-to-start timeline', 'Benchmark compensation']
        : ['Continue strong candidate engagement', 'Document successful practices'],
      citations: ['kpis.offer_accept_rate', 'sample_sizes.total_offers'],
      deep_link_params: { metric_key: 'kpis.offer_accept_rate', sample_size: factPack.sample_sizes.total_offers }
    });
  }

  // Insight 3: Decay analysis if available
  if (factPack.candidate_decay.available && factPack.kpis.decay_start_day !== null) {
    insights.push({
      id: `det_decay_${Date.now()}`,
      title: 'Candidate Interest Decay',
      severity: 'P1',
      claim: `Candidate interest begins declining after day ${factPack.kpis.decay_start_day} in process.`,
      why_now: 'Candidates in process too long are less likely to accept offers.',
      recommended_actions: [
        `Target offers within ${factPack.kpis.decay_start_day} days`,
        'Prioritize candidates furthest along in process',
        'Remove unnecessary interview stages'
      ],
      citations: ['kpis.decay_start_day', 'candidate_decay.available'],
      deep_link_params: { metric_key: 'kpis.decay_start_day', sample_size: factPack.sample_sizes.total_hires }
    });
  }

  // Insight 4: Cohort comparison if available
  if (factPack.cohort_comparison.available && factPack.cohort_comparison.fast_hires && factPack.cohort_comparison.slow_hires) {
    const ttfGap = Math.round(
      factPack.cohort_comparison.slow_hires.avg_ttf - factPack.cohort_comparison.fast_hires.avg_ttf
    );
    const cohortSampleSize = factPack.cohort_comparison.fast_hires.count + factPack.cohort_comparison.slow_hires.count;
    insights.push({
      id: `det_cohort_${Date.now()}`,
      title: 'Fast vs Slow Hire Gap',
      severity: 'P2',
      claim: `${ttfGap} day gap between fast hires (${Math.round(factPack.cohort_comparison.fast_hires.avg_ttf)}d) and slow hires (${Math.round(factPack.cohort_comparison.slow_hires.avg_ttf)}d).`,
      why_now: 'Understanding fast hire patterns can improve overall velocity.',
      recommended_actions: [
        'Review factors table for high-impact differences',
        'Replicate fast hire practices',
        'Investigate slow hire bottlenecks'
      ],
      citations: ['cohort_comparison.fast_hires', 'cohort_comparison.slow_hires'],
      deep_link_params: { metric_key: 'cohort_comparison.factors', sample_size: cohortSampleSize }
    });
  }

  // Insight 5: Zombie reqs if any
  if (factPack.contributing_reqs.zombie_req_ids.length > 0) {
    insights.push({
      id: `det_zombie_${Date.now()}`,
      title: 'Zombie Requisitions',
      severity: 'P0',
      claim: `${factPack.contributing_reqs.zombie_req_ids.length} reqs have had no activity for 30+ days.`,
      why_now: 'Zombie reqs waste resources and distort metrics.',
      recommended_actions: [
        'Review each zombie req for viability',
        'Close or reassign stale reqs',
        'Engage HMs on priority'
      ],
      citations: ['contributing_reqs.zombie_req_ids'],
      deep_link_params: {
        insight_type: 'zombie_reqs',
        filter: { req_ids: factPack.contributing_reqs.zombie_req_ids },
        sample_size: factPack.contributing_reqs.zombie_req_ids.length
      }
    });
  }

  // Insight 6: Stage timing unavailable
  if (!factPack.stage_timing.can_show_duration) {
    insights.push({
      id: `det_stage_${Date.now()}`,
      title: 'Stage Timing Not Available',
      severity: 'P2',
      claim: `Stage duration analysis is unavailable: ${factPack.stage_timing.reason}`,
      why_now: 'Stage-level bottleneck detection requires snapshot data.',
      recommended_actions: [
        'Import daily ATS snapshots to unlock stage timing',
        'Enable stage change event tracking'
      ],
      citations: ['stage_timing.capability', 'stage_timing.reason'],
      deep_link_params: { metric_key: 'stage_timing' }
    });
  }

  // Limit to 7 insights max
  return {
    insights: insights.slice(0, 7),
    generated_at: new Date().toISOString()
  };
}

// ===== DRAFT MESSAGE =====

/**
 * Generate a draft message for an action owner using AI
 */
export async function generateDraftMessage(
  insight: AICopilotInsight,
  recipientRole: 'Hiring Manager' | 'Recruiter' | 'TA Ops',
  channel: 'slack' | 'email',
  aiConfig: AiProviderConfig
): Promise<DraftMessage> {
  const systemPrompt = `You are drafting a professional ${channel} message to a ${recipientRole}.
Keep it brief, actionable, and friendly. Do NOT include any candidate names or PII.
Focus on the action needed, not the analysis.`;

  const userPrompt = `Draft a ${channel} message about this insight:

Title: ${insight.title}
Issue: ${insight.claim}
Urgency: ${insight.why_now}
Suggested Actions: ${insight.recommended_actions.join(', ')}

Keep it under 100 words for Slack, 150 for email.`;

  try {
    const response = await sendAiRequest(
      aiConfig,
      [{ role: 'user', content: userPrompt }],
      { systemPrompt, taskType: 'velocity_copilot_draft' }
    );

    return {
      channel,
      recipient_role: recipientRole,
      subject: channel === 'email' ? `Action needed: ${insight.title}` : undefined,
      body: response.error ? `[Draft generation failed] ${insight.claim}` : response.content,
      insight_context: `${insight.title}: ${insight.claim}`
    };
  } catch (error) {
    return {
      channel,
      recipient_role: recipientRole,
      subject: channel === 'email' ? `Action needed: ${insight.title}` : undefined,
      body: `[Draft generation failed] ${insight.claim}`,
      insight_context: `${insight.title}: ${insight.claim}`
    };
  }
}

/**
 * Generate a deterministic draft message (no AI)
 */
export function generateDeterministicDraftMessage(
  insight: AICopilotInsight,
  recipientRole: 'Hiring Manager' | 'Recruiter' | 'TA Ops',
  channel: 'slack' | 'email'
): DraftMessage {
  const actions = insight.recommended_actions.slice(0, 2).join(' and ');

  const body = channel === 'slack'
    ? `Hi! Quick note on ${insight.title.toLowerCase()}: ${insight.claim} Could you ${actions}? Thanks!`
    : `Hi,\n\nI wanted to flag something for your attention regarding ${insight.title.toLowerCase()}.\n\n${insight.claim} ${insight.why_now}\n\nSuggested next steps:\n${insight.recommended_actions.map(a => `• ${a}`).join('\n')}\n\nLet me know if you have questions.\n\nThanks!`;

  return {
    channel,
    recipient_role: recipientRole,
    subject: channel === 'email' ? `Action needed: ${insight.title}` : undefined,
    body,
    insight_context: `${insight.title}: ${insight.claim}`
  };
}
