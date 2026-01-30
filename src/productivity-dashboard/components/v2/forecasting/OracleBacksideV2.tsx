/**
 * OracleBacksideV2 - Back face of the Oracle flip card
 * Shows simulation inputs, confidence reasoning, capacity analysis, and what-if knobs
 *
 * V2 version using Tailwind tokens and lucide-react icons.
 */

import React from 'react';
import { format } from 'date-fns';
import {
  X,
  SlidersHorizontal,
  Gauge,
  ArrowLeftRight,
  Filter,
  Database,
  Lightbulb,
  CheckCircle,
  AlertCircle,
  Info,
  Users,
  UserCircle,
  Briefcase,
  Hourglass,
  AlertTriangle,
} from 'lucide-react';
import {
  OracleExplainData,
  OracleKnobSettings,
  PriorWeightPreset,
  MinNPreset,
  PRIOR_WEIGHT_VALUES,
  MIN_N_VALUES,
  ITERATIONS_RANGE,
} from './oracleTypes';
import {
  ORACLE_CAPACITY_STAGE_LABELS,
  OracleCapacityRecommendation,
} from '../../../types/capacityTypes';

interface OracleBacksideV2Props {
  explainData: OracleExplainData;
  knobSettings: OracleKnobSettings;
  onKnobChange: (settings: OracleKnobSettings) => void;
  hasKnobChanges: boolean;
  onClose: () => void;
}

/** Helper function to get icon for recommendation types */
function getRecommendationIcon(type: OracleCapacityRecommendation['type']) {
  switch (type) {
    case 'increase_throughput':
      return <Gauge className="w-3 h-3 text-primary" />;
    case 'reassign_workload':
      return <ArrowLeftRight className="w-3 h-3 text-purple-500" />;
    case 'reduce_demand':
      return <Filter className="w-3 h-3 text-warn" />;
    case 'improve_data':
      return <Database className="w-3 h-3 text-good" />;
    default:
      return <Lightbulb className="w-3 h-3 text-good" />;
  }
}

const confidenceStyles: Record<string, string> = {
  HIGH: 'bg-good/20 text-good',
  MED: 'bg-warn/20 text-warn',
  MEDIUM: 'bg-warn/20 text-warn',
  LOW: 'bg-bad/20 text-bad',
};

export function OracleBacksideV2({
  explainData,
  knobSettings,
  onKnobChange,
  hasKnobChanges,
  onClose,
}: OracleBacksideV2Props) {
  const showPerfWarning = knobSettings.iterations >= ITERATIONS_RANGE.performanceWarningThreshold;

  return (
    <div className="p-3">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-foreground">Oracle Explained</span>
          {hasKnobChanges && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[0.55rem] bg-primary/20 text-primary">
              <SlidersHorizontal className="w-2.5 h-2.5" />
              Adjusted
            </span>
          )}
        </div>
        <button
          type="button"
          className="w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
          onClick={onClose}
          title="Back to forecast"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Section: Inputs Used */}
      <div className="mb-3 p-2 rounded-md bg-muted/30">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Inputs Used
        </div>

        {/* Pipeline Counts */}
        <div className="mb-2">
          <div className="text-muted-foreground mb-1 text-[0.65rem]">Pipeline by Stage</div>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-border">
              {explainData.pipelineCounts.map((pc) => (
                <tr key={pc.stage}>
                  <th className="py-1 text-left text-sm font-medium text-foreground">{pc.stageName}</th>
                  <td className="py-1 text-right font-mono text-foreground">{pc.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Stage Pass Rates */}
        <div className="mb-2">
          <div className="text-muted-foreground mb-1 text-[0.65rem]">Stage Pass Rates</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="py-1 text-left font-medium text-muted-foreground">Stage</th>
                <th className="py-1 text-center font-medium text-muted-foreground">Obs</th>
                <th className="py-1 text-center font-medium text-muted-foreground">Prior</th>
                <th className="py-1 text-center font-medium text-muted-foreground">→ Final</th>
                <th className="py-1 text-center font-medium text-muted-foreground">n</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {explainData.stageRates.map((sr) => (
                <tr key={sr.stage}>
                  <th className="py-1 text-left text-sm font-medium text-foreground">{sr.stageName}</th>
                  <td className="py-1 text-center font-mono text-foreground">
                    {(sr.observed * 100).toFixed(0)}%
                  </td>
                  <td className="py-1 text-center font-mono text-muted-foreground">
                    {(sr.prior * 100).toFixed(0)}%
                  </td>
                  <td className="py-1 text-center font-mono text-primary">
                    {(sr.shrunk * 100).toFixed(0)}%
                  </td>
                  <td className="py-1 text-center font-mono text-muted-foreground">{sr.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Stage Durations */}
        <div className="mb-2">
          <div className="text-muted-foreground mb-1 text-[0.65rem]">Stage Durations</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="py-1 text-left font-medium text-muted-foreground">Stage</th>
                <th className="py-1 text-center font-medium text-muted-foreground">Model</th>
                <th className="py-1 text-center font-medium text-muted-foreground">Median</th>
                <th className="py-1 text-center font-medium text-muted-foreground">n</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {explainData.stageDurations.map((sd) => (
                <tr key={sd.stage}>
                  <th className="py-1 text-left text-sm font-medium text-foreground">{sd.stageName}</th>
                  <td
                    className={`py-1 text-center font-mono ${
                      sd.model === 'lognormal' ? 'text-good' : 'text-muted-foreground'
                    }`}
                  >
                    {sd.model === 'lognormal'
                      ? 'Log-N'
                      : sd.model === 'constant'
                        ? 'Const'
                        : sd.model}
                  </td>
                  <td className="py-1 text-center font-mono text-foreground">{sd.medianDays}d</td>
                  <td className="py-1 text-center font-mono text-muted-foreground">{sd.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Simulation params */}
        <div className="flex gap-3 mt-2 text-[0.65rem]">
          <div>
            <span className="text-muted-foreground">Iterations: </span>
            <span className="font-mono text-foreground">
              {explainData.iterations.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Seed: </span>
            <span className="font-mono text-foreground text-[0.6rem]">
              {explainData.seed.length > 12
                ? explainData.seed.substring(0, 12) + '…'
                : explainData.seed}
            </span>
          </div>
        </div>
      </div>

      {/* Section: Confidence */}
      <div className="mb-3 p-2 rounded-md bg-muted/30">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Confidence Analysis
        </div>
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`inline-flex items-center rounded-full text-[0.6rem] px-2 py-0.5 ${confidenceStyles[explainData.confidenceLevel]}`}
          >
            {explainData.confidenceLevel}
          </span>
        </div>
        <div className="text-[0.65rem]">
          {explainData.confidenceReasons.map((reason, idx) => (
            <div key={idx} className="flex items-start gap-1 mb-1">
              {reason.impact === 'positive' ? (
                <CheckCircle className="w-3 h-3 text-good flex-shrink-0 mt-0.5" />
              ) : reason.impact === 'negative' ? (
                <AlertCircle className="w-3 h-3 text-warn flex-shrink-0 mt-0.5" />
              ) : (
                <Info className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
              )}
              <span className="text-muted-foreground">{reason.message}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Section: Capacity Analysis */}
      {explainData.capacity && (
        <div className="mb-3 p-2 rounded-md bg-muted/30">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            <span>Capacity Analysis</span>
            <span
              className={`inline-flex items-center rounded-full text-[0.5rem] px-1.5 py-0.5 ${
                explainData.capacity.isAvailable ? 'bg-good/20 text-good' : 'bg-muted text-muted-foreground'
              }`}
            >
              {explainData.capacity.isAvailable ? 'ACTIVE' : 'UNAVAILABLE'}
            </span>
          </div>

          {explainData.capacity.isAvailable && explainData.capacity.profile ? (
            <div className="text-[0.65rem]">
              {/* Inference Window */}
              {explainData.capacity.inferenceWindow && (
                <div className="text-muted-foreground mb-2 text-[0.6rem]">
                  Based on {format(explainData.capacity.inferenceWindow.start, 'MMM d')} –{' '}
                  {format(explainData.capacity.inferenceWindow.end, 'MMM d, yyyy')}
                </div>
              )}

              {/* Global Workload Context */}
              {explainData.capacity.globalDemand && (
                <div className="mb-2 p-2 rounded bg-primary/10 border border-primary/20">
                  <div className="flex items-center gap-1 mb-1">
                    <Users className="w-3 h-3 text-primary" />
                    <span className="font-semibold text-foreground">Workload Context</span>
                  </div>
                  <div className="flex gap-3 text-[0.6rem]">
                    <div>
                      <span className="text-muted-foreground">Recruiter: </span>
                      <span className="font-mono text-foreground">
                        {explainData.capacity.globalDemand.recruiter_context.open_req_count} reqs,{' '}
                        {explainData.capacity.globalDemand.recruiter_context.total_candidates_in_flight}{' '}
                        in-flight
                      </span>
                    </div>
                    {explainData.capacity.globalDemand.hm_context.hm_id && (
                      <div>
                        <span className="text-muted-foreground">HM: </span>
                        <span className="font-mono text-foreground">
                          {explainData.capacity.globalDemand.hm_context.open_req_count} reqs,{' '}
                          {explainData.capacity.globalDemand.hm_context.total_candidates_in_flight}{' '}
                          in-flight
                        </span>
                      </div>
                    )}
                  </div>
                  {explainData.capacity.globalDemand.demand_scope !== 'single_req' && (
                    <div className="text-muted-foreground mt-1 text-[0.55rem] italic">
                      Demand computed from{' '}
                      {explainData.capacity.globalDemand.demand_scope === 'global_by_recruiter'
                        ? "recruiter's"
                        : "HM's"}{' '}
                      full portfolio
                    </div>
                  )}
                </div>
              )}

              {/* Recruiter Capacity */}
              {explainData.capacity.profile.recruiter && (
                <div className="mb-2">
                  <div className="flex items-center gap-1 mb-1">
                    <UserCircle className="w-3 h-3 text-primary" />
                    <span className="font-semibold text-foreground">Recruiter Throughput</span>
                    <span
                      className={`inline-flex items-center rounded-full text-[0.5rem] px-1.5 py-0.5 ${
                        confidenceStyles[explainData.capacity.profile.recruiter.overall_confidence]
                      }`}
                    >
                      {explainData.capacity.profile.recruiter.overall_confidence}
                    </span>
                  </div>
                  <table className="w-full text-[0.65rem]">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-1 text-left font-medium text-muted-foreground">Stage</th>
                        <th className="py-1 text-center font-medium text-muted-foreground">/wk</th>
                        <th className="py-1 text-center font-medium text-muted-foreground">n</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr>
                        <th className="py-1 text-left text-sm font-medium text-foreground">Screen</th>
                        <td className="py-1 text-center font-mono text-foreground">
                          {explainData.capacity.profile.recruiter.screens_per_week.throughput_per_week.toFixed(
                            1
                          )}
                        </td>
                        <td className="py-1 text-center font-mono text-muted-foreground">
                          {explainData.capacity.profile.recruiter.screens_per_week.n_transitions}
                        </td>
                      </tr>
                      {explainData.capacity.profile.recruiter.hm_screens_per_week && (
                        <tr>
                          <th className="py-1 text-left text-sm font-medium text-foreground">HM Screen</th>
                          <td className="py-1 text-center font-mono text-foreground">
                            {explainData.capacity.profile.recruiter.hm_screens_per_week.throughput_per_week.toFixed(
                              1
                            )}
                          </td>
                          <td className="py-1 text-center font-mono text-muted-foreground">
                            {explainData.capacity.profile.recruiter.hm_screens_per_week.n_transitions}
                          </td>
                        </tr>
                      )}
                      {explainData.capacity.profile.recruiter.onsites_per_week && (
                        <tr>
                          <th className="py-1 text-left text-sm font-medium text-foreground">Onsite</th>
                          <td className="py-1 text-center font-mono text-foreground">
                            {explainData.capacity.profile.recruiter.onsites_per_week.throughput_per_week.toFixed(
                              1
                            )}
                          </td>
                          <td className="py-1 text-center font-mono text-muted-foreground">
                            {explainData.capacity.profile.recruiter.onsites_per_week.n_transitions}
                          </td>
                        </tr>
                      )}
                      {explainData.capacity.profile.recruiter.offers_per_week && (
                        <tr>
                          <th className="py-1 text-left text-sm font-medium text-foreground">Offer</th>
                          <td className="py-1 text-center font-mono text-foreground">
                            {explainData.capacity.profile.recruiter.offers_per_week.throughput_per_week.toFixed(
                              1
                            )}
                          </td>
                          <td className="py-1 text-center font-mono text-muted-foreground">
                            {explainData.capacity.profile.recruiter.offers_per_week.n_transitions}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* HM Capacity */}
              {explainData.capacity.profile.hm &&
                explainData.capacity.profile.hm.interviews_per_week && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1 mb-1">
                      <Briefcase className="w-3 h-3 text-purple-500" />
                      <span className="font-semibold text-foreground">HM Throughput</span>
                      <span
                        className={`inline-flex items-center rounded-full text-[0.5rem] px-1.5 py-0.5 ${
                          confidenceStyles[explainData.capacity.profile.hm.overall_confidence]
                        }`}
                      >
                        {explainData.capacity.profile.hm.overall_confidence}
                      </span>
                    </div>
                    <table className="w-full text-[0.65rem]">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="py-1 text-left font-medium text-muted-foreground">Stage</th>
                          <th className="py-1 text-center font-medium text-muted-foreground">/wk</th>
                          <th className="py-1 text-center font-medium text-muted-foreground">n</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        <tr>
                          <th className="py-1 text-left text-sm font-medium text-foreground">Interviews</th>
                          <td className="py-1 text-center font-mono text-foreground">
                            {explainData.capacity.profile.hm.interviews_per_week.throughput_per_week.toFixed(
                              1
                            )}
                          </td>
                          <td className="py-1 text-center font-mono text-muted-foreground">
                            {explainData.capacity.profile.hm.interviews_per_week.n_transitions}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

              {/* Queue Delays with Bottleneck Attribution */}
              {explainData.capacity.penaltyResultV11 &&
              explainData.capacity.penaltyResultV11.top_bottlenecks.length > 0 ? (
                <div className="mb-2">
                  <div className="flex items-center gap-1 mb-1">
                    <Hourglass className="w-3 h-3 text-warn" />
                    <span className="font-semibold text-foreground">Bottlenecks</span>
                  </div>
                  <table className="w-full text-[0.65rem]">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-1 text-left font-medium text-muted-foreground">Stage</th>
                        <th className="py-1 text-center font-medium text-muted-foreground">Owner</th>
                        <th className="py-1 text-center font-medium text-muted-foreground">Demand</th>
                        <th className="py-1 text-center font-medium text-muted-foreground">Delay</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {explainData.capacity.penaltyResultV11.top_bottlenecks.map((b) => (
                        <tr key={b.stage}>
                          <th className="py-1 text-left text-sm font-medium text-foreground">
                            {b.stage_name}
                          </th>
                          <td className="py-1 text-center">
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[0.5rem] font-medium ${
                                b.bottleneck_owner_type === 'hm'
                                  ? 'bg-purple-500/20 text-purple-500'
                                  : 'bg-primary/20 text-primary'
                              }`}
                            >
                              {b.bottleneck_owner_type === 'hm'
                                ? 'HM'
                                : b.bottleneck_owner_type === 'recruiter'
                                  ? 'RC'
                                  : 'Both'}
                            </span>
                          </td>
                          <td className="py-1 text-center font-mono text-foreground">{b.demand}</td>
                          <td className="py-1 text-center font-mono text-warn">
                            +{b.queue_delay_days.toFixed(1)}d
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex justify-between mt-1 font-semibold text-foreground">
                    <span>Total Queue Delay:</span>
                    <span className="text-warn">
                      +{explainData.capacity.totalQueueDelayDays.toFixed(1)}d
                    </span>
                  </div>
                </div>
              ) : explainData.capacity.penaltyResult &&
                explainData.capacity.penaltyResult.top_bottlenecks.length > 0 ? (
                /* Fallback to v1 display if v1.1 not available */
                <div className="mb-2">
                  <div className="flex items-center gap-1 mb-1">
                    <Hourglass className="w-3 h-3 text-warn" />
                    <span className="font-semibold text-foreground">Queue Delays</span>
                  </div>
                  <table className="w-full text-[0.65rem]">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-1 text-left font-medium text-muted-foreground">Stage</th>
                        <th className="py-1 text-center font-medium text-muted-foreground">Demand</th>
                        <th className="py-1 text-center font-medium text-muted-foreground">Rate</th>
                        <th className="py-1 text-center font-medium text-muted-foreground">Delay</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {explainData.capacity.penaltyResult.stage_diagnostics
                        .filter((d) => d.queue_delay_days > 0)
                        .sort((a, b) => b.queue_delay_days - a.queue_delay_days)
                        .slice(0, 4)
                        .map((d) => (
                          <tr key={d.stage}>
                            <th className="py-1 text-left text-sm font-medium text-foreground">
                              {d.stage_name}
                            </th>
                            <td className="py-1 text-center font-mono text-foreground">
                              {d.demand}
                            </td>
                            <td className="py-1 text-center font-mono text-foreground">
                              {d.service_rate.toFixed(1)}/wk
                            </td>
                            <td className="py-1 text-center font-mono text-warn">
                              +{d.queue_delay_days.toFixed(1)}d
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  <div className="flex justify-between mt-1 font-semibold text-foreground">
                    <span>Total Queue Delay:</span>
                    <span className="text-warn">
                      +{explainData.capacity.totalQueueDelayDays.toFixed(1)}d
                    </span>
                  </div>
                </div>
              ) : null}

              {/* Prescriptive Recommendations */}
              {explainData.capacity.recommendations &&
                explainData.capacity.recommendations.length > 0 && (
                  <div className="mb-2 p-2 rounded bg-good/10 border border-good/20">
                    <div className="flex items-center gap-1 mb-1">
                      <Lightbulb className="w-3 h-3 text-good" />
                      <span className="font-semibold text-foreground">To Improve</span>
                      <span
                        className={`inline-flex items-center rounded-full ml-1 text-[0.45rem] px-1 py-0.5 ${
                          confidenceStyles[explainData.capacity.profile?.overall_confidence || 'LOW']
                        }`}
                      >
                        {explainData.capacity.profile?.overall_confidence || 'LOW'}
                      </span>
                    </div>
                    <div className="text-[0.6rem]">
                      {explainData.capacity.recommendations.slice(0, 2).map((rec, idx) => (
                        <div key={idx} className="flex items-start gap-1 mb-1">
                          {getRecommendationIcon(rec.type)}
                          <div>
                            <span className="text-foreground">{rec.description}</span>
                            {rec.estimated_impact_days > 0 && (
                              <span className="text-good ml-1 italic">
                                (est. ~{rec.estimated_impact_days}d faster)
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Cohort Fallback Notice */}
              {explainData.capacity.profile.used_cohort_fallback && (
                <div className="mt-2 p-1 rounded bg-warn/10 text-[0.6rem] text-warn flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Using cohort averages (insufficient individual data)
                </div>
              )}

              {/* Confidence Reasons */}
              {(explainData.capacity.profile.confidence_reasons.length > 0 ||
                (explainData.capacity.globalDemand?.confidence_reasons.length ?? 0) > 0) && (
                <div className="mt-2 text-[0.6rem]">
                  {[
                    ...(explainData.capacity.globalDemand?.confidence_reasons || []),
                    ...explainData.capacity.profile.confidence_reasons,
                  ]
                    .slice(0, 3)
                    .map((r, i) => (
                      <div key={i} className="flex items-start gap-1 mb-1">
                        {r.impact === 'positive' ? (
                          <CheckCircle className="w-3 h-3 text-good flex-shrink-0 mt-0.5" />
                        ) : r.impact === 'negative' ? (
                          <AlertCircle className="w-3 h-3 text-warn flex-shrink-0 mt-0.5" />
                        ) : (
                          <Info className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                        )}
                        <span className="text-muted-foreground">{r.message}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-2 rounded bg-muted text-muted-foreground text-xs flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              {!explainData.capacity.profile
                ? 'Capacity data not available'
                : 'No capacity constraints detected'}
            </div>
          )}
        </div>
      )}

      {/* Section: What-If Knobs */}
      <div className="p-2 rounded-md bg-muted/30">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Assumptions (What-If)
        </div>

        {/* Prior Weight (m) */}
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-foreground">Prior Weight (m)</span>
            <span className="text-xs font-mono text-primary">
              {PRIOR_WEIGHT_VALUES[knobSettings.priorWeight]}
            </span>
          </div>
          <div className="flex gap-1">
            {(['low', 'medium', 'high'] as PriorWeightPreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                className={`flex-1 px-2 py-1 text-xs rounded min-h-[32px] transition-colors ${
                  knobSettings.priorWeight === preset
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
                onClick={() => onKnobChange({ ...knobSettings, priorWeight: preset })}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Min N Threshold */}
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-foreground">Sample Threshold</span>
            <span className="text-xs font-mono text-primary">
              n≥{MIN_N_VALUES[knobSettings.minNThreshold]}
            </span>
          </div>
          <div className="flex gap-1">
            {(['relaxed', 'standard', 'strict'] as MinNPreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                className={`flex-1 px-2 py-1 text-xs rounded min-h-[32px] transition-colors ${
                  knobSettings.minNThreshold === preset
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
                onClick={() => onKnobChange({ ...knobSettings, minNThreshold: preset })}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Iterations */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-foreground">Iterations</span>
            <span className="text-xs font-mono text-primary">
              {knobSettings.iterations.toLocaleString()}
            </span>
          </div>
          <input
            type="range"
            className="w-full h-2 rounded-lg cursor-pointer accent-primary"
            min={ITERATIONS_RANGE.min}
            max={ITERATIONS_RANGE.max}
            step={1000}
            value={knobSettings.iterations}
            onChange={(e) => onKnobChange({ ...knobSettings, iterations: Number(e.target.value) })}
          />
          {showPerfWarning && (
            <div className="mt-1 text-[0.6rem] text-warn flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Higher iterations may slow down updates
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OracleBacksideV2;
