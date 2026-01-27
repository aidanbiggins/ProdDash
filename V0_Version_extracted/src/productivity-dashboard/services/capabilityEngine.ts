// Capability Engine - Single Source of Truth
// Evaluates what PlatoVue can do with the current dataset.
// All gating decisions flow from this engine. No scattered logic.

import { CoverageMetrics } from '../types/resilientImportTypes';
import {
  CapabilityStatus,
  ConfidenceLevel,
  CapabilityEvalResult,
  CapabilityEvidence,
  ThresholdCheck,
  CapabilityReportEntry,
  CapabilityReport,
  FeatureCoverageEntry,
  FeatureCoverageMap,
  RepairSuggestionEntry,
  CapabilityEngineResult,
  CapabilitySummary,
  DataCapabilityDef,
  FeatureDef,
  SerializableCapabilityEngineResult,
} from '../types/capabilityTypes';

// ============================================
// HELPER: Evaluate thresholds
// ============================================

function evalThreshold(field: string, required: number, actual: number): ThresholdCheck {
  return { field, required, actual, met: actual >= required };
}

function determineConfidence(
  sampleSize: number,
  threshold: number,
  coverage: number,
  coverageMin: number
): { level: ConfidenceLevel; reasons: string[] } {
  const reasons: string[] = [];

  if (sampleSize >= threshold * 2 && coverage >= 0.8) {
    reasons.push(`Sample size ${sampleSize} is ≥2× threshold (${threshold})`);
    reasons.push(`Field coverage ${(coverage * 100).toFixed(0)}% ≥ 80%`);
    return { level: 'HIGH', reasons };
  }

  if (sampleSize >= threshold && coverage >= coverageMin) {
    reasons.push(`Sample size ${sampleSize} meets threshold (${threshold})`);
    if (coverage < 0.8) reasons.push(`Coverage ${(coverage * 100).toFixed(0)}% below 80% (HIGH requires ≥80%)`);
    return { level: 'MED', reasons };
  }

  if (sampleSize >= threshold * 0.5 || coverage >= coverageMin * 0.5) {
    reasons.push(`Sample size ${sampleSize} is ≥50% of threshold (${threshold})`);
    return { level: 'LOW', reasons };
  }

  reasons.push(`Sample size ${sampleSize} below 50% of threshold (${threshold})`);
  return { level: 'LOW', reasons };
}

// ============================================
// 18 DATA CAPABILITIES
// ============================================

export const DATA_CAPABILITIES: DataCapabilityDef[] = [
  {
    key: 'cap_requisitions',
    displayName: 'Requisitions',
    description: 'Open/closed requisition records with basic fields',
    evaluate: (c) => {
      const count = c.counts.requisitions;
      const threshold = 1;
      const evidence: CapabilityEvidence = {
        field_coverages: { 'req.status': c.fieldCoverage['req.status'] ?? 0 },
        sample_sizes: { requisitions: count },
        flags_met: [],
        flags_missing: [],
        thresholds: [evalThreshold('requisitions', threshold, count)],
      };
      if (count < threshold) {
        return { status: 'BLOCKED', confidence: 'LOW', confidence_reasons: ['No requisitions found'], evidence };
      }
      const conf = determineConfidence(count, 10, c.fieldCoverage['req.status'] ?? 0, 0.3);
      return { status: 'ENABLED', confidence: conf.level, confidence_reasons: conf.reasons, evidence };
    },
  },
  {
    key: 'cap_candidates',
    displayName: 'Candidates',
    description: 'Candidate/application records',
    evaluate: (c) => {
      const count = c.counts.candidates;
      const evidence: CapabilityEvidence = {
        field_coverages: { 'cand.current_stage': c.fieldCoverage['cand.current_stage'] ?? 0 },
        sample_sizes: { candidates: count },
        flags_met: [],
        flags_missing: [],
        thresholds: [evalThreshold('candidates', 1, count)],
      };
      if (count < 1) {
        return { status: 'BLOCKED', confidence: 'LOW', confidence_reasons: ['No candidates found'], evidence };
      }
      const conf = determineConfidence(count, 30, c.fieldCoverage['cand.current_stage'] ?? 0, 0.5);
      return { status: 'ENABLED', confidence: conf.level, confidence_reasons: conf.reasons, evidence };
    },
  },
  {
    key: 'cap_stage_events',
    displayName: 'Stage Events',
    description: 'Workflow stage transition events (from→to)',
    evaluate: (c) => {
      const count = c.counts.events;
      const fromCov = c.fieldCoverage['event.from_stage'] ?? 0;
      const toCov = c.fieldCoverage['event.to_stage'] ?? 0;
      const hasFlag = c.flags.hasStageEvents;
      const evidence: CapabilityEvidence = {
        field_coverages: { 'event.from_stage': fromCov, 'event.to_stage': toCov },
        sample_sizes: { events: count },
        flags_met: hasFlag ? ['hasStageEvents'] : [],
        flags_missing: hasFlag ? [] : ['hasStageEvents'],
        thresholds: [
          evalThreshold('events', 50, count),
          evalThreshold('event.from_stage', 0.5, fromCov),
        ],
      };
      if (!hasFlag || count < 10) {
        return { status: 'BLOCKED', confidence: 'LOW', confidence_reasons: ['No stage events or too few'], evidence };
      }
      if (count < 50 || fromCov < 0.5) {
        const reasons = [];
        if (count < 50) reasons.push(`Only ${count} events (need 50+)`);
        if (fromCov < 0.5) reasons.push(`from_stage coverage ${(fromCov * 100).toFixed(0)}% < 50%`);
        return { status: 'LIMITED', confidence: 'LOW', confidence_reasons: reasons, evidence };
      }
      const conf = determineConfidence(count, 50, fromCov, 0.5);
      return { status: 'ENABLED', confidence: conf.level, confidence_reasons: conf.reasons, evidence };
    },
  },
  {
    key: 'cap_timestamps',
    displayName: 'Application Timestamps',
    description: 'Applied dates for candidates',
    evaluate: (c) => {
      const cov = c.fieldCoverage['cand.applied_at'] ?? 0;
      const count = c.counts.candidates;
      const hasFlag = c.flags.hasTimestamps;
      const evidence: CapabilityEvidence = {
        field_coverages: { 'cand.applied_at': cov },
        sample_sizes: { candidates: count },
        flags_met: hasFlag ? ['hasTimestamps'] : [],
        flags_missing: hasFlag ? [] : ['hasTimestamps'],
        thresholds: [evalThreshold('cand.applied_at', 0.5, cov)],
      };
      if (!hasFlag || cov < 0.1) {
        return { status: 'BLOCKED', confidence: 'LOW', confidence_reasons: ['No application timestamps'], evidence };
      }
      if (cov < 0.5) {
        return { status: 'LIMITED', confidence: 'LOW', confidence_reasons: [`Only ${(cov * 100).toFixed(0)}% coverage (need 50%+)`], evidence };
      }
      const conf = determineConfidence(count, 30, cov, 0.5);
      return { status: 'ENABLED', confidence: conf.level, confidence_reasons: conf.reasons, evidence };
    },
  },
  {
    key: 'cap_terminal_timestamps',
    displayName: 'Terminal Timestamps',
    description: 'Hire/reject/withdraw dates',
    evaluate: (c) => {
      const hireCov = c.fieldCoverage['cand.hired_at'] ?? 0;
      const rejCov = c.fieldCoverage['cand.rejected_at'] ?? 0;
      const hasFlag = c.flags.hasTerminalTimestamps;
      const evidence: CapabilityEvidence = {
        field_coverages: { 'cand.hired_at': hireCov, 'cand.rejected_at': rejCov },
        sample_sizes: { hires: c.sampleSizes.hires, rejections: c.sampleSizes.rejections },
        flags_met: hasFlag ? ['hasTerminalTimestamps'] : [],
        flags_missing: hasFlag ? [] : ['hasTerminalTimestamps'],
        thresholds: [evalThreshold('terminal_coverage', 0.1, Math.max(hireCov, rejCov))],
      };
      if (!hasFlag || Math.max(hireCov, rejCov) < 0.05) {
        return { status: 'BLOCKED', confidence: 'LOW', confidence_reasons: ['No terminal timestamps found'], evidence };
      }
      if (Math.max(hireCov, rejCov) < 0.1) {
        return { status: 'LIMITED', confidence: 'LOW', confidence_reasons: ['Terminal timestamp coverage below 10%'], evidence };
      }
      const conf = determineConfidence(c.sampleSizes.hires + c.sampleSizes.rejections, 10, Math.max(hireCov, rejCov), 0.1);
      return { status: 'ENABLED', confidence: conf.level, confidence_reasons: conf.reasons, evidence };
    },
  },
  {
    key: 'cap_recruiter_assignment',
    displayName: 'Recruiter Assignment',
    description: 'Recruiter ownership on requisitions',
    evaluate: (c) => {
      const cov = c.fieldCoverage['req.recruiter_id'] ?? 0;
      const hasFlag = c.flags.hasRecruiterAssignment;
      const evidence: CapabilityEvidence = {
        field_coverages: { 'req.recruiter_id': cov },
        sample_sizes: { requisitions: c.counts.requisitions },
        flags_met: hasFlag ? ['hasRecruiterAssignment'] : [],
        flags_missing: hasFlag ? [] : ['hasRecruiterAssignment'],
        thresholds: [evalThreshold('req.recruiter_id', 0.5, cov)],
      };
      if (!hasFlag || cov < 0.1) {
        return { status: 'BLOCKED', confidence: 'LOW', confidence_reasons: ['No recruiter assignments'], evidence };
      }
      if (cov < 0.5) {
        return { status: 'LIMITED', confidence: 'LOW', confidence_reasons: [`Recruiter assignment coverage ${(cov * 100).toFixed(0)}% < 50%`], evidence };
      }
      const conf = determineConfidence(c.counts.requisitions, 5, cov, 0.5);
      return { status: 'ENABLED', confidence: conf.level, confidence_reasons: conf.reasons, evidence };
    },
  },
  {
    key: 'cap_hm_assignment',
    displayName: 'HM Assignment',
    description: 'Hiring manager assignments on requisitions',
    evaluate: (c) => {
      const cov = c.fieldCoverage['req.hiring_manager_id'] ?? 0;
      const hasFlag = c.flags.hasHMAssignment;
      const evidence: CapabilityEvidence = {
        field_coverages: { 'req.hiring_manager_id': cov },
        sample_sizes: { requisitions: c.counts.requisitions },
        flags_met: hasFlag ? ['hasHMAssignment'] : [],
        flags_missing: hasFlag ? [] : ['hasHMAssignment'],
        thresholds: [evalThreshold('req.hiring_manager_id', 0.5, cov)],
      };
      if (!hasFlag || cov < 0.1) {
        return { status: 'BLOCKED', confidence: 'LOW', confidence_reasons: ['No HM assignments'], evidence };
      }
      if (cov < 0.5) {
        return { status: 'LIMITED', confidence: 'LOW', confidence_reasons: [`HM assignment coverage ${(cov * 100).toFixed(0)}% < 50%`], evidence };
      }
      const conf = determineConfidence(c.counts.requisitions, 5, cov, 0.5);
      return { status: 'ENABLED', confidence: conf.level, confidence_reasons: conf.reasons, evidence };
    },
  },
  {
    key: 'cap_source_data',
    displayName: 'Source Data',
    description: 'Candidate source/channel information',
    evaluate: (c) => {
      const cov = c.fieldCoverage['cand.source'] ?? 0;
      const hasFlag = c.flags.hasSourceData;
      const evidence: CapabilityEvidence = {
        field_coverages: { 'cand.source': cov },
        sample_sizes: { candidates: c.counts.candidates },
        flags_met: hasFlag ? ['hasSourceData'] : [],
        flags_missing: hasFlag ? [] : ['hasSourceData'],
        thresholds: [evalThreshold('cand.source', 0.3, cov)],
      };
      if (!hasFlag || cov < 0.1) {
        return { status: 'BLOCKED', confidence: 'LOW', confidence_reasons: ['No source data'], evidence };
      }
      if (cov < 0.3) {
        return { status: 'LIMITED', confidence: 'LOW', confidence_reasons: [`Source coverage ${(cov * 100).toFixed(0)}% < 30%`], evidence };
      }
      const conf = determineConfidence(c.counts.candidates, 20, cov, 0.3);
      return { status: 'ENABLED', confidence: conf.level, confidence_reasons: conf.reasons, evidence };
    },
  },
  {
    key: 'cap_snapshots',
    displayName: 'Multiple Snapshots',
    description: 'Two or more data snapshots for trend analysis',
    evaluate: (c) => {
      const count = c.counts.snapshots;
      const hasFlag = c.flags.hasMultipleSnapshots;
      const evidence: CapabilityEvidence = {
        field_coverages: {},
        sample_sizes: { snapshots: count },
        flags_met: hasFlag ? ['hasMultipleSnapshots'] : [],
        flags_missing: hasFlag ? [] : ['hasMultipleSnapshots'],
        thresholds: [evalThreshold('snapshots', 2, count)],
      };
      if (!hasFlag || count < 2) {
        return { status: 'BLOCKED', confidence: 'LOW', confidence_reasons: ['Need 2+ snapshots for trends'], evidence };
      }
      const conf = determineConfidence(count, 4, 1, 0.5);
      return { status: 'ENABLED', confidence: conf.level, confidence_reasons: conf.reasons, evidence };
    },
  },
  {
    key: 'cap_snapshot_dwell',
    displayName: 'Snapshot Dwell Times',
    description: '4+ snapshots spanning 21+ days for SLA analysis',
    evaluate: (c) => {
      const count = c.counts.snapshots;
      const evidence: CapabilityEvidence = {
        field_coverages: {},
        sample_sizes: { snapshots: count },
        flags_met: count >= 4 ? ['sufficient_snapshots'] : [],
        flags_missing: count < 4 ? ['sufficient_snapshots'] : [],
        thresholds: [evalThreshold('snapshots', 4, count)],
      };
      if (count < 2) {
        return { status: 'BLOCKED', confidence: 'LOW', confidence_reasons: ['Need 4+ snapshots for dwell times'], evidence };
      }
      if (count < 4) {
        return { status: 'LIMITED', confidence: 'LOW', confidence_reasons: [`Only ${count} snapshots (need 4+)`], evidence };
      }
      const conf = determineConfidence(count, 4, 1, 0.5);
      return { status: 'ENABLED', confidence: conf.level, confidence_reasons: conf.reasons, evidence };
    },
  },
  {
    key: 'cap_hires',
    displayName: 'Hire Outcomes',
    description: '5+ completed hires for outcome analysis',
    evaluate: (c) => {
      const hires = c.sampleSizes.hires;
      const evidence: CapabilityEvidence = {
        field_coverages: { 'cand.hired_at': c.fieldCoverage['cand.hired_at'] ?? 0 },
        sample_sizes: { hires },
        flags_met: hires >= 5 ? ['sufficient_hires'] : [],
        flags_missing: hires < 5 ? ['sufficient_hires'] : [],
        thresholds: [evalThreshold('hires', 5, hires)],
      };
      if (hires < 1) {
        return { status: 'BLOCKED', confidence: 'LOW', confidence_reasons: ['No hires found'], evidence };
      }
      if (hires < 5) {
        return { status: 'LIMITED', confidence: 'LOW', confidence_reasons: [`Only ${hires} hires (need 5+)`], evidence };
      }
      const conf = determineConfidence(hires, 5, c.fieldCoverage['cand.hired_at'] ?? 0, 0.1);
      return { status: 'ENABLED', confidence: conf.level, confidence_reasons: conf.reasons, evidence };
    },
  },
  {
    key: 'cap_offers',
    displayName: 'Offer Data',
    description: '5+ offers for accept rate and decay analysis',
    evaluate: (c) => {
      const offers = c.sampleSizes.offers;
      const evidence: CapabilityEvidence = {
        field_coverages: {},
        sample_sizes: { offers },
        flags_met: offers >= 5 ? ['sufficient_offers'] : [],
        flags_missing: offers < 5 ? ['sufficient_offers'] : [],
        thresholds: [evalThreshold('offers', 5, offers)],
      };
      if (offers < 1) {
        return { status: 'BLOCKED', confidence: 'LOW', confidence_reasons: ['No offers found'], evidence };
      }
      if (offers < 5) {
        return { status: 'LIMITED', confidence: 'LOW', confidence_reasons: [`Only ${offers} offers (need 5+)`], evidence };
      }
      const conf = determineConfidence(offers, 5, 1, 0.5);
      return { status: 'ENABLED', confidence: conf.level, confidence_reasons: conf.reasons, evidence };
    },
  },
  {
    key: 'cap_sufficient_hires',
    displayName: 'Sufficient Hires (10+)',
    description: '10+ hires for statistical comparisons',
    evaluate: (c) => {
      const hires = c.sampleSizes.hires;
      const evidence: CapabilityEvidence = {
        field_coverages: {},
        sample_sizes: { hires },
        flags_met: hires >= 10 ? ['ten_plus_hires'] : [],
        flags_missing: hires < 10 ? ['ten_plus_hires'] : [],
        thresholds: [evalThreshold('hires', 10, hires)],
      };
      if (hires < 5) {
        return { status: 'BLOCKED', confidence: 'LOW', confidence_reasons: ['Need 10+ hires for cohort comparison'], evidence };
      }
      if (hires < 10) {
        return { status: 'LIMITED', confidence: 'LOW', confidence_reasons: [`Only ${hires} hires (need 10+)`], evidence };
      }
      const conf = determineConfidence(hires, 10, 1, 0.5);
      return { status: 'ENABLED', confidence: conf.level, confidence_reasons: conf.reasons, evidence };
    },
  },
  {
    key: 'cap_sufficient_offers',
    displayName: 'Sufficient Offers (10+)',
    description: '10+ offers for decay curve analysis',
    evaluate: (c) => {
      const offers = c.sampleSizes.offers;
      const evidence: CapabilityEvidence = {
        field_coverages: {},
        sample_sizes: { offers },
        flags_met: offers >= 10 ? ['ten_plus_offers'] : [],
        flags_missing: offers < 10 ? ['ten_plus_offers'] : [],
        thresholds: [evalThreshold('offers', 10, offers)],
      };
      if (offers < 5) {
        return { status: 'BLOCKED', confidence: 'LOW', confidence_reasons: ['Need 10+ offers for decay analysis'], evidence };
      }
      if (offers < 10) {
        return { status: 'LIMITED', confidence: 'LOW', confidence_reasons: [`Only ${offers} offers (need 10+)`], evidence };
      }
      const conf = determineConfidence(offers, 10, 1, 0.5);
      return { status: 'ENABLED', confidence: conf.level, confidence_reasons: conf.reasons, evidence };
    },
  },
  {
    key: 'cap_opened_dates',
    displayName: 'Req Open Dates',
    description: 'Requisition opened_at timestamps',
    evaluate: (c) => {
      const cov = c.fieldCoverage['req.opened_at'] ?? 0;
      const evidence: CapabilityEvidence = {
        field_coverages: { 'req.opened_at': cov },
        sample_sizes: { requisitions: c.counts.requisitions },
        flags_met: cov >= 0.3 ? ['has_opened_dates'] : [],
        flags_missing: cov < 0.3 ? ['has_opened_dates'] : [],
        thresholds: [evalThreshold('req.opened_at', 0.5, cov)],
      };
      if (cov < 0.1) {
        return { status: 'BLOCKED', confidence: 'LOW', confidence_reasons: ['No req open dates'], evidence };
      }
      if (cov < 0.5) {
        return { status: 'LIMITED', confidence: 'LOW', confidence_reasons: [`Open date coverage ${(cov * 100).toFixed(0)}% < 50%`], evidence };
      }
      const conf = determineConfidence(c.counts.requisitions, 5, cov, 0.5);
      return { status: 'ENABLED', confidence: conf.level, confidence_reasons: conf.reasons, evidence };
    },
  },
  {
    key: 'cap_capacity_history',
    displayName: 'Capacity History',
    description: '8+ weeks of recruiter throughput data',
    evaluate: (c) => {
      // Capacity requires recruiter assignment + enough timeline + explicit capacity data
      const recCov = c.fieldCoverage['req.recruiter_id'] ?? 0;
      const hasRec = c.flags.hasRecruiterAssignment;
      const hasCap = c.flags.hasCapacityHistory !== false; // undefined = true (real imports don't set this)
      const count = c.counts.requisitions;
      const evidence: CapabilityEvidence = {
        field_coverages: { 'req.recruiter_id': recCov },
        sample_sizes: { requisitions: count },
        flags_met: [
          ...(hasRec ? ['hasRecruiterAssignment'] : []),
          ...(hasCap ? ['hasCapacityHistory'] : []),
        ],
        flags_missing: [
          ...(hasRec ? [] : ['hasRecruiterAssignment']),
          ...(hasCap ? [] : ['hasCapacityHistory']),
        ],
        thresholds: [
          evalThreshold('req.recruiter_id', 0.5, recCov),
          evalThreshold('requisitions', 20, count),
        ],
      };
      if (!hasCap) {
        return { status: 'BLOCKED', confidence: 'LOW', confidence_reasons: ['Capacity history data not available'], evidence };
      }
      if (!hasRec || count < 10) {
        return { status: 'BLOCKED', confidence: 'LOW', confidence_reasons: ['Need recruiter assignments and 20+ reqs for capacity'], evidence };
      }
      if (count < 20 || recCov < 0.5) {
        return { status: 'LIMITED', confidence: 'LOW', confidence_reasons: ['Partial capacity data'], evidence };
      }
      const conf = determineConfidence(count, 20, recCov, 0.5);
      return { status: 'ENABLED', confidence: conf.level, confidence_reasons: conf.reasons, evidence };
    },
  },
  {
    key: 'cap_funnel_stages',
    displayName: 'Funnel Stages',
    description: 'Candidate stage data for funnel visualization',
    evaluate: (c) => {
      const cov = c.fieldCoverage['cand.current_stage'] ?? 0;
      const count = c.counts.candidates;
      const evidence: CapabilityEvidence = {
        field_coverages: { 'cand.current_stage': cov },
        sample_sizes: { candidates: count },
        flags_met: cov >= 0.5 ? ['has_stage_data'] : [],
        flags_missing: cov < 0.5 ? ['has_stage_data'] : [],
        thresholds: [evalThreshold('cand.current_stage', 0.8, cov)],
      };
      if (cov < 0.3 || count < 5) {
        return { status: 'BLOCKED', confidence: 'LOW', confidence_reasons: ['Insufficient stage data for funnel'], evidence };
      }
      if (cov < 0.8 || count < 10) {
        return { status: 'LIMITED', confidence: 'LOW', confidence_reasons: [`Stage coverage ${(cov * 100).toFixed(0)}% (need 80%+)`], evidence };
      }
      const conf = determineConfidence(count, 10, cov, 0.8);
      return { status: 'ENABLED', confidence: conf.level, confidence_reasons: conf.reasons, evidence };
    },
  },
  {
    key: 'cap_stage_velocity',
    displayName: 'Stage Velocity',
    description: 'Stage durations derivable from events or snapshots',
    evaluate: (c) => {
      const eventCount = c.counts.events;
      const fromCov = c.fieldCoverage['event.from_stage'] ?? 0;
      const snapCount = c.counts.snapshots;
      const evidence: CapabilityEvidence = {
        field_coverages: { 'event.from_stage': fromCov, 'event.to_stage': c.fieldCoverage['event.to_stage'] ?? 0 },
        sample_sizes: { events: eventCount, snapshots: snapCount },
        flags_met: [],
        flags_missing: [],
        thresholds: [
          evalThreshold('events_or_snapshots', 50, Math.max(eventCount, snapCount * 10)),
        ],
      };
      // Can derive from events (from→to) or snapshots (dwell)
      const hasEvents = eventCount >= 50 && fromCov >= 0.5;
      const hasSnapshots = snapCount >= 4;

      if (!hasEvents && !hasSnapshots) {
        return { status: 'BLOCKED', confidence: 'LOW', confidence_reasons: ['Need stage events or 4+ snapshots for velocity'], evidence };
      }
      if (hasEvents) {
        if (fromCov >= 0.5) evidence.flags_met.push('stage_events_sufficient');
      }
      if (hasSnapshots) {
        evidence.flags_met.push('snapshots_sufficient');
      }
      const conf = determineConfidence(
        hasEvents ? eventCount : snapCount * 10,
        50,
        hasEvents ? fromCov : 1,
        0.5
      );
      return { status: 'ENABLED', confidence: conf.level, confidence_reasons: conf.reasons, evidence };
    },
  },
];

// ============================================
// 39 FEATURES + DEPENDENCY MAP
// ============================================

export const FEATURE_REGISTRY: FeatureDef[] = [
  // Control Tower
  { key: 'ct_health_kpis', display_name: 'Health KPIs', description: 'TTF, Offers, Accept Rate, Stalled, HM Latency', area: 'control_tower', required_capabilities: ['cap_requisitions', 'cap_candidates'] },
  { key: 'ct_risks', display_name: 'Risk Detection', description: 'Top 10 at-risk requisitions', area: 'control_tower', required_capabilities: ['cap_requisitions', 'cap_candidates', 'cap_stage_events'] },
  { key: 'ct_actions', display_name: 'Action Queue', description: 'Unified action items', area: 'control_tower', required_capabilities: ['cap_requisitions', 'cap_recruiter_assignment'] },
  { key: 'ct_forecast', display_name: 'Pipeline Forecast', description: 'Expected hires and gap', area: 'control_tower', required_capabilities: ['cap_requisitions', 'cap_candidates', 'cap_hires'] },
  { key: 'ct_median_ttf', display_name: 'Median TTF KPI', description: 'Median time to fill', area: 'control_tower', required_capabilities: ['cap_timestamps', 'cap_hires'] },
  { key: 'ct_accept_rate', display_name: 'Accept Rate KPI', description: 'Offer acceptance rate', area: 'control_tower', required_capabilities: ['cap_offers'] },

  // Overview
  { key: 'ov_kpi_cards', display_name: 'Overview KPI Cards', description: 'High-level metric cards', area: 'overview', required_capabilities: ['cap_requisitions', 'cap_candidates'] },
  { key: 'ov_weekly_trends', display_name: 'Weekly Trends', description: 'Time-series charts', area: 'overview', required_capabilities: ['cap_timestamps', 'cap_opened_dates'] },
  { key: 'ov_funnel_chart', display_name: 'Pipeline Funnel', description: 'Stage conversion funnel', area: 'overview', required_capabilities: ['cap_funnel_stages'] },
  { key: 'ov_recruiter_table', display_name: 'Recruiter Leaderboard', description: 'Per-recruiter summary', area: 'overview', required_capabilities: ['cap_recruiter_assignment'] },

  // HM Friction
  { key: 'hm_kpi_tiles', display_name: 'HM Latency Tiles', description: 'HM response time KPIs', area: 'hm_friction', required_capabilities: ['cap_hm_assignment', 'cap_stage_events'] },
  { key: 'hm_latency_heatmap', display_name: 'Latency Heatmap', description: 'HM latency by stage', area: 'hm_friction', required_capabilities: ['cap_hm_assignment', 'cap_stage_velocity'] },
  { key: 'hm_decay_curve', display_name: 'HM Decay Curve', description: 'Offer decay by HM delay', area: 'hm_friction', required_capabilities: ['cap_hm_assignment', 'cap_offers'] },
  { key: 'hm_scorecard', display_name: 'HM Scorecard', description: 'Per-HM performance', area: 'hiring_managers', required_capabilities: ['cap_hm_assignment', 'cap_opened_dates'] },
  { key: 'hm_hiring_cycle', display_name: 'HM Hiring Cycle', description: 'Time per HM stage', area: 'hiring_managers', required_capabilities: ['cap_hm_assignment', 'cap_stage_events'] },

  // Quality
  { key: 'q_late_stage_fallout', display_name: 'Late-Stage Fallout', description: 'Drop-offs after interview', area: 'quality', required_capabilities: ['cap_candidates', 'cap_funnel_stages'] },
  { key: 'q_funnel_pass_through', display_name: 'Pass-Through Rates', description: 'Stage-by-stage conversion', area: 'quality', required_capabilities: ['cap_funnel_stages', 'cap_source_data'] },
  { key: 'q_acceptance_by_recruiter', display_name: 'Accept by Recruiter', description: 'Offer accept rate per recruiter', area: 'quality', required_capabilities: ['cap_offers', 'cap_recruiter_assignment'] },

  // Sources
  { key: 'src_volume_chart', display_name: 'Source Volume', description: 'Candidates by source', area: 'sources', required_capabilities: ['cap_source_data'] },
  { key: 'src_hire_rate', display_name: 'Source Hire Rate', description: 'Conversion by source', area: 'sources', required_capabilities: ['cap_source_data', 'cap_hires'] },
  { key: 'src_mirage_detection', display_name: 'Source Mirage', description: 'High-volume low-conversion sources', area: 'sources', required_capabilities: ['cap_source_data', 'cap_funnel_stages'] },

  // Velocity
  { key: 'vi_decay_candidate', display_name: 'Candidate Decay', description: 'Offer probability over time', area: 'velocity', required_capabilities: ['cap_timestamps', 'cap_sufficient_offers'] },
  { key: 'vi_fast_vs_slow', display_name: 'Fast vs Slow Cohorts', description: 'Speed impact on quality', area: 'velocity', required_capabilities: ['cap_timestamps', 'cap_sufficient_hires'] },
  { key: 'vi_decay_req', display_name: 'Req Decay', description: 'Req fill probability over time', area: 'velocity', required_capabilities: ['cap_opened_dates', 'cap_hires'] },
  { key: 'vi_pipeline_health', display_name: 'Pipeline Health', description: 'Active pipeline adequacy', area: 'velocity', required_capabilities: ['cap_funnel_stages'] },

  // Forecasting
  { key: 'fc_oracle', display_name: 'Oracle Forecast', description: 'ML-style fill predictions', area: 'forecasting', required_capabilities: ['cap_sufficient_hires', 'cap_stage_velocity'] },
  { key: 'fc_role_health', display_name: 'Role Health', description: 'Per-role pipeline status', area: 'forecasting', required_capabilities: ['cap_requisitions', 'cap_candidates', 'cap_stage_events'] },
  { key: 'fc_pre_mortem', display_name: 'Pre-Mortem', description: 'Risk prediction for open reqs', area: 'forecasting', required_capabilities: ['cap_stage_events', 'cap_requisitions'] },
  { key: 'fc_new_role_planner', display_name: 'New Role Planner', description: 'Timeline estimates for new reqs', area: 'forecasting', required_capabilities: ['cap_funnel_stages', 'cap_sufficient_hires'] },

  // Data Health
  { key: 'dh_hygiene_score', display_name: 'Hygiene Score', description: 'Overall data quality rating', area: 'data_health', required_capabilities: ['cap_requisitions'] },
  { key: 'dh_zombie_reqs', display_name: 'Zombie Reqs', description: '30+ day inactive reqs', area: 'data_health', required_capabilities: ['cap_requisitions', 'cap_stage_events'] },
  { key: 'dh_ghost_candidates', display_name: 'Ghost Candidates', description: 'Stuck/abandoned candidates', area: 'data_health', required_capabilities: ['cap_candidates', 'cap_timestamps'] },
  { key: 'dh_ttf_comparison', display_name: 'TTF Comparison', description: 'True vs Raw TTF', area: 'data_health', required_capabilities: ['cap_timestamps', 'cap_terminal_timestamps'] },

  // Capacity
  { key: 'cap_load_table', display_name: 'Load Table', description: 'Recruiter workload distribution', area: 'capacity', required_capabilities: ['cap_recruiter_assignment'] },
  { key: 'cap_fit_matrix', display_name: 'Fit Matrix', description: 'Skill-to-capacity matching', area: 'capacity', required_capabilities: ['cap_capacity_history'] },
  { key: 'cap_rebalance', display_name: 'Rebalance Suggestions', description: 'Workload redistribution', area: 'capacity', required_capabilities: ['cap_capacity_history'] },

  // Bottlenecks/SLA
  { key: 'sla_dwell_times', display_name: 'Stage Dwell Times', description: 'Time in each stage', area: 'bottlenecks', required_capabilities: ['cap_snapshot_dwell'] },
  { key: 'sla_breach_detection', display_name: 'SLA Breaches', description: 'Policy violations', area: 'bottlenecks', required_capabilities: ['cap_snapshot_dwell', 'cap_stage_velocity'] },
  { key: 'sla_owner_attribution', display_name: 'Owner Attribution', description: 'Who owns the delay', area: 'bottlenecks', required_capabilities: ['cap_snapshot_dwell', 'cap_recruiter_assignment', 'cap_hm_assignment'] },

  // Ask
  { key: 'ask_deterministic', display_name: 'Ask (Deterministic)', description: 'AI-off intent answers', area: 'ask', required_capabilities: ['cap_requisitions', 'cap_candidates'] },

  // Scenarios
  { key: 'sc_recruiter_leaves', display_name: 'Recruiter Leaves', description: 'Impact if recruiter leaves', area: 'scenarios', required_capabilities: ['cap_recruiter_assignment', 'cap_capacity_history'] },
  { key: 'sc_spin_up_team', display_name: 'Spin-Up Team', description: 'New team staffing plan', area: 'scenarios', required_capabilities: ['cap_capacity_history'] },

  // Exports
  { key: 'export_exec_brief', display_name: 'Exec Brief Export', description: 'PDF/email executive summary', area: 'exports', required_capabilities: ['cap_requisitions', 'cap_recruiter_assignment'] },

  // Engines
  { key: 'explain_ttf', display_name: 'Explain: TTF', description: 'Time to fill breakdown', area: 'engine', required_capabilities: ['cap_timestamps', 'cap_hires'] },
  { key: 'explain_tto', display_name: 'Explain: Time to Offer', description: 'Time to offer breakdown', area: 'engine', required_capabilities: ['cap_timestamps'] },
  { key: 'explain_hm_latency', display_name: 'Explain: HM Latency', description: 'HM response breakdown', area: 'engine', required_capabilities: ['cap_hm_assignment', 'cap_stage_events'] },
  { key: 'explain_accept_rate', display_name: 'Explain: Accept Rate', description: 'Acceptance rate drivers', area: 'engine', required_capabilities: ['cap_offers'] },
  { key: 'explain_stalled', display_name: 'Explain: Stalled', description: 'Why reqs stall', area: 'engine', required_capabilities: ['cap_stage_events', 'cap_requisitions'] },
];

// ============================================
// REPAIR SUGGESTIONS REGISTRY
// ============================================

export const REPAIR_SUGGESTIONS: Record<string, RepairSuggestionEntry> = {
  cap_requisitions: {
    capability_key: 'cap_requisitions',
    what_to_upload: 'Requisition export from your ATS (iCIMS, Greenhouse, Lever, etc.)',
    required_columns: ['Requisition ID', 'Title', 'Status'],
    column_aliases: ['Req ID', 'Job ID', 'Position ID', 'Posting ID'],
    why_it_matters: 'Requisitions are the foundation — every feature needs to know what roles exist',
    what_it_unlocks: ['Control Tower', 'Overview KPIs', 'Data Health', 'Forecasting'],
    ui_copy: {
      short_title: 'Import Requisitions',
      banner_message: 'Import requisition data to unlock dashboard features',
      blocked_message: 'This feature requires requisition data. Import a requisition export to get started.',
      cta_label: 'Import Requisitions',
      cta_action: 'import',
    },
  },
  cap_candidates: {
    capability_key: 'cap_candidates',
    what_to_upload: 'Candidate/Submittal export with application details',
    required_columns: ['Candidate ID', 'Requisition ID', 'Current Stage'],
    column_aliases: ['Applicant ID', 'Person ID', 'Submission ID', 'Application ID'],
    why_it_matters: 'Candidates flowing through your pipeline are how we measure recruiting performance',
    what_it_unlocks: ['Pipeline Funnel', 'Quality Metrics', 'Risk Detection', 'Forecasting'],
    ui_copy: {
      short_title: 'Import Candidates',
      banner_message: 'Import candidate data to see pipeline and quality metrics',
      blocked_message: 'This feature requires candidate data. Import a submittal or candidate export.',
      cta_label: 'Import Candidates',
      cta_action: 'import',
    },
  },
  cap_stage_events: {
    capability_key: 'cap_stage_events',
    what_to_upload: 'Workflow/Activity history export with stage transitions',
    required_columns: ['Candidate ID', 'From Stage', 'To Stage', 'Event Date'],
    column_aliases: ['Previous Status', 'New Status', 'Activity Date', 'Workflow Step From', 'Workflow Step To'],
    why_it_matters: 'Stage transitions reveal bottlenecks, HM delays, and process health',
    what_it_unlocks: ['HM Friction', 'Bottlenecks', 'Risk Detection', 'Velocity Insights'],
    ui_copy: {
      short_title: 'Import Activity History',
      banner_message: 'Import workflow activity to unlock bottleneck and HM analysis',
      blocked_message: 'This feature requires stage transition events. Import an activity or workflow history export.',
      cta_label: 'Import Activity Data',
      cta_action: 'import',
    },
  },
  cap_timestamps: {
    capability_key: 'cap_timestamps',
    what_to_upload: 'Candidate export with Applied Date column',
    required_columns: ['Applied Date'],
    column_aliases: ['Submission Date', 'Date Applied', 'Application Date', 'Date Submitted'],
    why_it_matters: 'Application dates are needed to calculate time-based metrics like TTF and velocity',
    what_it_unlocks: ['Median TTF', 'Weekly Trends', 'Velocity Insights', 'Ghost Candidates'],
    ui_copy: {
      short_title: 'Add Applied Dates',
      banner_message: 'Include Applied Date in your export to unlock time-based metrics',
      blocked_message: 'This feature requires application timestamps. Re-export with the Applied Date column.',
      cta_label: 'Re-Import with Dates',
      cta_action: 'import',
    },
  },
  cap_terminal_timestamps: {
    capability_key: 'cap_terminal_timestamps',
    what_to_upload: 'Candidate export with Hire Date and/or Rejection Date',
    required_columns: ['Hire/Rehire Date'],
    column_aliases: ['Date Hired', 'Start Date', 'Rejection Date', 'Date Rejected', 'Withdrawn Date'],
    why_it_matters: 'Terminal dates give accurate TTF and distinguish true hires from assumptions',
    what_it_unlocks: ['True TTF', 'TTF Comparison', 'Fast vs Slow Cohorts'],
    ui_copy: {
      short_title: 'Add Hire/Reject Dates',
      banner_message: 'Include hire/rejection dates for accurate time-to-fill metrics',
      blocked_message: 'This feature requires hire or rejection dates. Re-export with terminal timestamp columns.',
      cta_label: 'Re-Import with Dates',
      cta_action: 'import',
    },
  },
  cap_recruiter_assignment: {
    capability_key: 'cap_recruiter_assignment',
    what_to_upload: 'Requisition export with Recruiter/Owner column',
    required_columns: ['Recruiter', 'Requisition ID'],
    column_aliases: ['Assigned Recruiter', 'Primary Recruiter', 'Req Owner', 'Sourcer', 'Coordinator'],
    why_it_matters: 'Recruiter assignments enable individual performance tracking and capacity planning',
    what_it_unlocks: ['Recruiter Leaderboard', 'Action Queue', 'Capacity', 'Scenarios', 'Exec Brief'],
    ui_copy: {
      short_title: 'Add Recruiter Data',
      banner_message: 'Include recruiter assignments to unlock performance and capacity features',
      blocked_message: 'This feature requires recruiter assignments. Re-export with the Recruiter column.',
      cta_label: 'Re-Import with Recruiter',
      cta_action: 'import',
    },
  },
  cap_hm_assignment: {
    capability_key: 'cap_hm_assignment',
    what_to_upload: 'Requisition export with Hiring Manager column',
    required_columns: ['Hiring Manager', 'Requisition ID'],
    column_aliases: ['HM', 'Manager', 'Hiring Mgr', 'Approver', 'Department Head'],
    why_it_matters: 'HM assignments reveal friction, latency, and accountability gaps',
    what_it_unlocks: ['HM Friction', 'HM Scorecard', 'HM Latency KPI', 'Owner Attribution'],
    ui_copy: {
      short_title: 'Add HM Data',
      banner_message: 'Include hiring manager assignments to unlock HM analysis',
      blocked_message: 'This feature requires hiring manager assignments. Re-export with the Hiring Manager column.',
      cta_label: 'Re-Import with HM',
      cta_action: 'import',
    },
  },
  cap_source_data: {
    capability_key: 'cap_source_data',
    what_to_upload: 'Candidate export with Source/Channel column',
    required_columns: ['Source'],
    column_aliases: ['Referral Source', 'Channel', 'Origin', 'Candidate Source', 'Source Category'],
    why_it_matters: 'Source data shows which channels deliver quality candidates efficiently',
    what_it_unlocks: ['Source Effectiveness', 'Source Mirage Detection', 'Pass-Through Rates'],
    ui_copy: {
      short_title: 'Add Source Data',
      banner_message: 'Include source/channel data to unlock source effectiveness analysis',
      blocked_message: 'This feature requires candidate source data. Re-export with the Source column.',
      cta_label: 'Re-Import with Source',
      cta_action: 'import',
    },
  },
  cap_snapshots: {
    capability_key: 'cap_snapshots',
    what_to_upload: 'Import the same export again next week for trend comparison',
    required_columns: ['(same columns as previous import)'],
    column_aliases: [],
    why_it_matters: 'Multiple snapshots enable week-over-week trend analysis',
    what_it_unlocks: ['Historical Trends', 'SLA Tracking'],
    ui_copy: {
      short_title: 'Import Another Snapshot',
      banner_message: 'Import another week\'s data to unlock trend analysis',
      blocked_message: 'This feature requires multiple data snapshots over time. Import another week\'s export.',
      cta_label: 'Import New Snapshot',
      cta_action: 'import',
    },
  },
  cap_snapshot_dwell: {
    capability_key: 'cap_snapshot_dwell',
    what_to_upload: 'Import 4+ weekly snapshots spanning at least 21 days',
    required_columns: ['(same columns as previous import)'],
    column_aliases: [],
    why_it_matters: 'Dwell time analysis shows how long candidates sit in each stage',
    what_it_unlocks: ['Stage Dwell Times', 'SLA Breaches', 'Owner Attribution'],
    ui_copy: {
      short_title: 'More Snapshots Needed',
      banner_message: 'Import 4+ weekly snapshots to unlock SLA and dwell time analysis',
      blocked_message: 'This feature requires 4+ snapshots spanning 21+ days. Continue importing weekly.',
      cta_label: 'Import Snapshot',
      cta_action: 'import',
    },
  },
  cap_hires: {
    capability_key: 'cap_hires',
    what_to_upload: 'Candidate export including hired candidates (status: Hired)',
    required_columns: ['Candidate Status', 'Hire/Rehire Date'],
    column_aliases: ['Disposition', 'Final Status', 'Outcome', 'Start Date'],
    why_it_matters: 'Hire outcomes are essential for TTF, forecast accuracy, and conversion metrics',
    what_it_unlocks: ['Median TTF', 'Accept Rate', 'Forecast', 'Source Hire Rate'],
    ui_copy: {
      short_title: 'Include Hires',
      banner_message: 'Include hired candidates to unlock TTF and forecasting',
      blocked_message: 'This feature requires hire outcome data. Ensure your export includes hired candidates.',
      cta_label: 'Re-Import with Hires',
      cta_action: 'import',
    },
  },
  cap_offers: {
    capability_key: 'cap_offers',
    what_to_upload: 'Candidate export with offer stage candidates',
    required_columns: ['Candidate Stage (includes Offer)'],
    column_aliases: ['Offer Date', 'Offer Extended', 'Date Offered'],
    why_it_matters: 'Offer data reveals accept rates and where candidates fall out late in the process',
    what_it_unlocks: ['Accept Rate', 'HM Decay Curve', 'Acceptance by Recruiter'],
    ui_copy: {
      short_title: 'Include Offers',
      banner_message: 'Include offer-stage candidates to unlock accept rate analysis',
      blocked_message: 'This feature requires offer data. Ensure your export includes candidates in Offer stage.',
      cta_label: 'Re-Import with Offers',
      cta_action: 'import',
    },
  },
  cap_sufficient_hires: {
    capability_key: 'cap_sufficient_hires',
    what_to_upload: 'Broader candidate export with 10+ hires',
    required_columns: ['Candidate Status (Hired)', 'Hire/Rehire Date'],
    column_aliases: [],
    why_it_matters: '10+ hires enables statistical comparisons between fast and slow hires',
    what_it_unlocks: ['Fast vs Slow Cohorts', 'Oracle Forecast', 'New Role Planner'],
    ui_copy: {
      short_title: 'More Hires Needed',
      banner_message: 'Need 10+ hires for statistical analysis. Expand your date range.',
      blocked_message: 'This feature requires 10+ hires. Try expanding your export date range.',
      cta_label: 'Expand Date Range',
      cta_action: 'import',
    },
  },
  cap_sufficient_offers: {
    capability_key: 'cap_sufficient_offers',
    what_to_upload: 'Broader candidate export with 10+ offers',
    required_columns: ['Candidate Stage (includes Offer)'],
    column_aliases: [],
    why_it_matters: '10+ offers enables reliable decay curve and conversion analysis',
    what_it_unlocks: ['Candidate Decay Curve'],
    ui_copy: {
      short_title: 'More Offers Needed',
      banner_message: 'Need 10+ offers for decay analysis. Expand your date range.',
      blocked_message: 'This feature requires 10+ offers. Try expanding your export date range.',
      cta_label: 'Expand Date Range',
      cta_action: 'import',
    },
  },
  cap_opened_dates: {
    capability_key: 'cap_opened_dates',
    what_to_upload: 'Requisition export with Date Opened column',
    required_columns: ['Date Opened'],
    column_aliases: ['Open Date', 'Created Date', 'Posting Date', 'Req Open Date'],
    why_it_matters: 'Req open dates enable weekly trends and req aging analysis',
    what_it_unlocks: ['Weekly Trends', 'Req Decay', 'HM Scorecard'],
    ui_copy: {
      short_title: 'Add Open Dates',
      banner_message: 'Include Date Opened in your requisition export for trend analysis',
      blocked_message: 'This feature requires requisition open dates. Re-export with the Date Opened column.',
      cta_label: 'Re-Import with Dates',
      cta_action: 'import',
    },
  },
  cap_capacity_history: {
    capability_key: 'cap_capacity_history',
    what_to_upload: 'Requisition export with recruiter assignments spanning 8+ weeks',
    required_columns: ['Recruiter', 'Requisition ID', 'Date Opened'],
    column_aliases: [],
    why_it_matters: 'Historical workload data enables capacity planning and scenario modeling',
    what_it_unlocks: ['Fit Matrix', 'Rebalance Suggestions', 'Recruiter Leaves Scenario', 'Spin-Up Team'],
    ui_copy: {
      short_title: 'More History Needed',
      banner_message: 'Need 8+ weeks of recruiter workload history for capacity features',
      blocked_message: 'This feature requires extended history. Export a broader date range with recruiter assignments.',
      cta_label: 'Expand Date Range',
      cta_action: 'import',
    },
  },
  cap_funnel_stages: {
    capability_key: 'cap_funnel_stages',
    what_to_upload: 'Candidate export with Current Stage column',
    required_columns: ['Current Stage', 'Candidate Status'],
    column_aliases: ['Workflow Step', 'Pipeline Stage', 'Submission Status', 'Candidate Step'],
    why_it_matters: 'Stage data builds the recruiting funnel and shows where candidates drop off',
    what_it_unlocks: ['Pipeline Funnel', 'Pipeline Health', 'Pass-Through Rates', 'Late-Stage Fallout'],
    ui_copy: {
      short_title: 'Add Stage Data',
      banner_message: 'Include candidate stage data for funnel and pipeline analysis',
      blocked_message: 'This feature requires candidate stage information. Re-export with the Current Stage column.',
      cta_label: 'Re-Import with Stages',
      cta_action: 'import',
    },
  },
  cap_stage_velocity: {
    capability_key: 'cap_stage_velocity',
    what_to_upload: 'Activity history with stage transitions OR 4+ weekly snapshots',
    required_columns: ['From Stage', 'To Stage', 'Event Date'],
    column_aliases: ['Previous Status', 'New Status', 'Activity Date'],
    why_it_matters: 'Stage velocity reveals which steps take too long and where to optimize',
    what_it_unlocks: ['Latency Heatmap', 'Oracle Forecast', 'SLA Breaches'],
    ui_copy: {
      short_title: 'Add Stage Timing',
      banner_message: 'Import activity history or more snapshots to unlock velocity analysis',
      blocked_message: 'This feature requires stage timing data (activity history or 4+ snapshots).',
      cta_label: 'Import Activity Data',
      cta_action: 'import',
    },
  },
};

// ============================================
// ENGINE: EVALUATE
// ============================================

/**
 * Main entry point: evaluate all capabilities and features.
 * This is the SINGLE SOURCE OF TRUTH for what PlatoVue can do.
 */
export function evaluateCapabilities(coverage: CoverageMetrics): CapabilityEngineResult {
  // 1. Evaluate all 18 data capabilities
  const capability_report: CapabilityReport = new Map();

  for (const capDef of DATA_CAPABILITIES) {
    const result = capDef.evaluate(coverage);
    const repair = REPAIR_SUGGESTIONS[capDef.key];

    const entry: CapabilityReportEntry = {
      capability_key: capDef.key,
      display_name: capDef.displayName,
      description: capDef.description,
      status: result.status,
      confidence: result.confidence,
      confidence_reasons: result.confidence_reasons,
      evidence: result.evidence,
      repair_suggestions: result.status !== 'ENABLED' && repair ? [repair] : [],
    };
    capability_report.set(capDef.key, entry);
  }

  // 2. Evaluate all features based on capability statuses
  const feature_coverage: FeatureCoverageMap = new Map();

  for (const feat of FEATURE_REGISTRY) {
    const entry = evaluateFeature(feat, capability_report);
    feature_coverage.set(feat.key, entry);
  }

  // 3. Collect repair suggestions (deduplicated, prioritized)
  const repairSet = new Map<string, RepairSuggestionEntry>();
  for (const [, capEntry] of capability_report) {
    if (capEntry.status !== 'ENABLED') {
      for (const suggestion of capEntry.repair_suggestions) {
        repairSet.set(suggestion.capability_key, suggestion);
      }
    }
  }
  // Priority: BLOCKED capabilities that unlock the most features first
  const repair_suggestions = Array.from(repairSet.values()).sort((a, b) => {
    const aUnlocks = a.what_it_unlocks.length;
    const bUnlocks = b.what_it_unlocks.length;
    return bUnlocks - aUnlocks;
  });

  // 4. Build summary
  const summary = buildSummary(capability_report, feature_coverage);

  return {
    evaluated_at: new Date(),
    summary,
    capability_report,
    feature_coverage,
    repair_suggestions,
  };
}

function evaluateFeature(feat: FeatureDef, capReport: CapabilityReport): FeatureCoverageEntry {
  const blocked_by: string[] = [];
  const limited_by: string[] = [];
  const reasons: string[] = [];
  const allRepairs: RepairSuggestionEntry[] = [];

  for (const capKey of feat.required_capabilities) {
    const cap = capReport.get(capKey);
    if (!cap) {
      blocked_by.push(capKey);
      reasons.push(`Unknown capability: ${capKey}`);
      continue;
    }
    if (cap.status === 'BLOCKED') {
      blocked_by.push(capKey);
      reasons.push(`${cap.display_name}: ${cap.confidence_reasons[0] || 'blocked'}`);
      allRepairs.push(...cap.repair_suggestions);
    } else if (cap.status === 'LIMITED') {
      limited_by.push(capKey);
      reasons.push(`${cap.display_name}: ${cap.confidence_reasons[0] || 'limited data'}`);
      allRepairs.push(...cap.repair_suggestions);
    }
  }

  let status: CapabilityStatus;
  if (blocked_by.length > 0) {
    status = 'BLOCKED';
  } else if (limited_by.length > 0) {
    status = 'LIMITED';
  } else {
    status = 'ENABLED';
  }

  return {
    feature_key: feat.key,
    display_name: feat.display_name,
    description: feat.description,
    area: feat.area,
    status,
    required_capabilities: feat.required_capabilities,
    blocked_by,
    limited_by,
    reasons,
    repair_suggestions: dedupeRepairs(allRepairs),
    sections: [], // Can be populated per-feature if needed
  };
}

function dedupeRepairs(repairs: RepairSuggestionEntry[]): RepairSuggestionEntry[] {
  const seen = new Set<string>();
  return repairs.filter(r => {
    if (seen.has(r.capability_key)) return false;
    seen.add(r.capability_key);
    return true;
  });
}

function buildSummary(capReport: CapabilityReport, featureCoverage: FeatureCoverageMap): CapabilitySummary {
  let enabled = 0, limited = 0, blocked = 0;
  let featEnabled = 0, featLimited = 0, featBlocked = 0;
  let lowestConf: ConfidenceLevel = 'HIGH';

  for (const [, cap] of capReport) {
    if (cap.status === 'ENABLED') enabled++;
    else if (cap.status === 'LIMITED') limited++;
    else blocked++;

    if (cap.confidence === 'LOW') lowestConf = 'LOW';
    else if (cap.confidence === 'MED' && lowestConf === 'HIGH') lowestConf = 'MED';
  }

  for (const [, feat] of featureCoverage) {
    if (feat.status === 'ENABLED') featEnabled++;
    else if (feat.status === 'LIMITED') featLimited++;
    else featBlocked++;
  }

  let overall_status: 'full' | 'partial' | 'limited';
  if (blocked === 0 && limited === 0) overall_status = 'full';
  else if (blocked <= 3) overall_status = 'partial';
  else overall_status = 'limited';

  return {
    total_capabilities: capReport.size,
    enabled,
    limited,
    blocked,
    total_features: featureCoverage.size,
    features_enabled: featEnabled,
    features_limited: featLimited,
    features_blocked: featBlocked,
    overall_status,
    confidence_floor: lowestConf,
  };
}

// ============================================
// SERIALIZATION HELPERS
// ============================================

export function serializeResult(result: CapabilityEngineResult): SerializableCapabilityEngineResult {
  const capEntries: Record<string, CapabilityReportEntry> = {};
  for (const [key, entry] of result.capability_report) {
    capEntries[key] = entry;
  }
  const featEntries: Record<string, FeatureCoverageEntry> = {};
  for (const [key, entry] of result.feature_coverage) {
    featEntries[key] = entry;
  }
  return {
    evaluated_at: result.evaluated_at.toISOString(),
    summary: result.summary,
    capability_report: { entries: capEntries },
    feature_coverage: { entries: featEntries },
    repair_suggestions: result.repair_suggestions,
  };
}

export function deserializeResult(data: SerializableCapabilityEngineResult): CapabilityEngineResult {
  const capability_report: CapabilityReport = new Map(Object.entries(data.capability_report.entries));
  const feature_coverage: FeatureCoverageMap = new Map(Object.entries(data.feature_coverage.entries));
  return {
    evaluated_at: new Date(data.evaluated_at),
    summary: data.summary,
    capability_report,
    feature_coverage,
    repair_suggestions: data.repair_suggestions,
  };
}

// ============================================
// QUERY HELPERS
// ============================================

/**
 * Check if a specific feature is enabled. Use this in components.
 */
export function isFeatureEnabled(featureKey: string, result: CapabilityEngineResult): boolean {
  const feat = result.feature_coverage.get(featureKey);
  return feat?.status === 'ENABLED';
}

/**
 * Check if a feature is at least usable (ENABLED or LIMITED).
 */
export function isFeatureUsable(featureKey: string, result: CapabilityEngineResult): boolean {
  const feat = result.feature_coverage.get(featureKey);
  return feat?.status === 'ENABLED' || feat?.status === 'LIMITED';
}

/**
 * Get the status of a feature.
 */
export function getFeatureStatus(featureKey: string, result: CapabilityEngineResult): CapabilityStatus | null {
  return result.feature_coverage.get(featureKey)?.status ?? null;
}

/**
 * Get repair suggestions for a specific feature.
 */
export function getFeatureRepairs(featureKey: string, result: CapabilityEngineResult): RepairSuggestionEntry[] {
  return result.feature_coverage.get(featureKey)?.repair_suggestions ?? [];
}

/**
 * Get all features for a given area (tab).
 */
export function getFeaturesByArea(area: string, result: CapabilityEngineResult): FeatureCoverageEntry[] {
  const features: FeatureCoverageEntry[] = [];
  for (const [, feat] of result.feature_coverage) {
    if (feat.area === area) features.push(feat);
  }
  return features;
}

/**
 * Check if an entire area (tab) is blocked.
 */
export function isAreaBlocked(area: string, result: CapabilityEngineResult): boolean {
  const features = getFeaturesByArea(area, result);
  return features.length > 0 && features.every(f => f.status === 'BLOCKED');
}

/**
 * Get the worst status for an area (tab).
 */
export function getAreaStatus(area: string, result: CapabilityEngineResult): CapabilityStatus {
  const features = getFeaturesByArea(area, result);
  if (features.length === 0) return 'ENABLED';
  if (features.some(f => f.status === 'BLOCKED')) return 'BLOCKED';
  if (features.some(f => f.status === 'LIMITED')) return 'LIMITED';
  return 'ENABLED';
}
