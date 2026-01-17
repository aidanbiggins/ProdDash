/**
 * Scenario Action Plan Service
 *
 * Generates and deduplicates ActionItems from scenario outputs.
 * Integrates with the Unified Action Queue.
 */

import {
  ActionItem,
  ActionOwnerType,
  ActionPriority,
  ActionType,
  generateActionId,
} from '../types/actionTypes';
import {
  Bottleneck,
  ScenarioOutput,
  RecruiterLeavesParams,
  HiringFreezeParams,
  SpinUpTeamParams,
  RebalanceRecommendation,
} from '../types/scenarioTypes';

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Calculate difference in days between two dates
 */
function differenceInDays(later: Date, earlier: Date): number {
  const diffTime = later.getTime() - earlier.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Anonymize recruiter ID to "Recruiter N" format
 */
function anonymizeRecruiter(recruiterId: string, index?: number): string {
  // If index is provided, use it; otherwise generate from ID
  const idx = index !== undefined ? index : Math.abs(hashString(recruiterId)) % 100;
  return `Recruiter ${idx + 1}`;
}

/**
 * Simple hash function for strings
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

/**
 * Deduplicate actions, keeping highest priority when duplicates exist.
 * Duplicates are identified by same owner_type + owner_id + req_id + action_type.
 */
export function deduplicateActions(actions: ActionItem[]): ActionItem[] {
  const priorityOrder: Record<ActionPriority, number> = { P0: 0, P1: 1, P2: 2 };
  const actionMap = new Map<string, ActionItem>();

  for (const action of actions) {
    const key = `${action.owner_type}:${action.owner_id}:${action.req_id}:${action.action_type}`;
    const existing = actionMap.get(key);

    if (!existing || priorityOrder[action.priority] < priorityOrder[existing.priority]) {
      actionMap.set(key, action);
    }
  }

  return Array.from(actionMap.values());
}

/**
 * Generate actions for the Recruiter Leaves scenario
 */
export function generateRecruiterLeavesActions(
  params: RecruiterLeavesParams,
  affectedReqs: Array<{ req_id: string; title: string; hiring_manager_id: string | null }>,
  reassignmentPlan: RebalanceRecommendation[],
  departingRecruiterReqCount: number,
  recruiterIndexMap: Map<string, number>
): ActionItem[] {
  const actions: ActionItem[] = [];
  const now = new Date();
  const daysUntilDeparture = differenceInDays(params.departure_date, now);

  // Action 1: Knowledge transfer
  actions.push({
    action_id: generateActionId('TA_OPS', 'ta-ops', 'general', 'PROCESS_OPTIMIZATION'),
    owner_type: 'TA_OPS',
    owner_id: 'ta-ops',
    owner_name: 'TA Operations',
    req_id: 'general',
    action_type: 'PROCESS_OPTIMIZATION',
    title: 'Conduct knowledge transfer with departing recruiter',
    priority: 'P0',
    due_in_days: Math.min(daysUntilDeparture - 3, 7),
    due_date: addDays(now, Math.min(daysUntilDeparture - 3, 7)),
    evidence: {
      kpi_key: 'departing_recruiter.req_count',
      explain_provider_key: 'scenario_library',
      short_reason: `${departingRecruiterReqCount} requisitions need handoff`,
    },
    recommended_steps: [
      'Schedule 1:1 with departing recruiter',
      'Document status of each active requisition',
      'Identify candidates in critical stages',
      'Note any HM preferences or quirks',
      'Transfer any candidate relationships',
    ],
    created_at: now,
    status: 'OPEN',
  });

  // Action 2: Execute reassignments
  for (const assignment of reassignmentPlan) {
    const toRecruiterAnon = anonymizeRecruiter(
      assignment.to_recruiter_id,
      recruiterIndexMap.get(assignment.to_recruiter_id)
    );
    actions.push({
      action_id: generateActionId('TA_OPS', 'ta-ops', assignment.req_id, 'PROCESS_OPTIMIZATION'),
      owner_type: 'TA_OPS',
      owner_id: 'ta-ops',
      owner_name: 'TA Operations',
      req_id: assignment.req_id,
      req_title: assignment.req_title,
      action_type: 'PROCESS_OPTIMIZATION',
      title: `Reassign ${assignment.req_title} to ${toRecruiterAnon}`,
      priority: 'P1',
      due_in_days: Math.max(daysUntilDeparture - 1, 1),
      due_date: addDays(now, Math.max(daysUntilDeparture - 1, 1)),
      evidence: {
        kpi_key: 'reassignment_plan.fit_improvement',
        explain_provider_key: 'capacity_fit_engine',
        short_reason: assignment.rationale,
      },
      recommended_steps: [
        'Update req assignment in ATS',
        'Notify new recruiter owner',
        'Brief on current pipeline status',
        'Introduce to HM if needed',
      ],
      created_at: now,
      status: 'OPEN',
    });
  }

  // Action 3: Notify affected HMs
  const uniqueHMs = [...new Set(affectedReqs.map(r => r.hiring_manager_id).filter(Boolean))];
  if (uniqueHMs.length > 0) {
    actions.push({
      action_id: generateActionId('TA_OPS', 'ta-ops', 'general-hm-notify', 'PROCESS_OPTIMIZATION'),
      owner_type: 'TA_OPS',
      owner_id: 'ta-ops',
      owner_name: 'TA Operations',
      req_id: 'general-hm-notify', // Use unique req_id for deduplication
      action_type: 'PROCESS_OPTIMIZATION',
      title: `Notify ${uniqueHMs.length} HMs of recruiter change`,
      priority: 'P1',
      due_in_days: Math.max(daysUntilDeparture, 1),
      due_date: addDays(now, Math.max(daysUntilDeparture, 1)),
      evidence: {
        kpi_key: 'affected_hms.count',
        explain_provider_key: 'scenario_library',
        short_reason: `${uniqueHMs.length} hiring managers affected`,
      },
      recommended_steps: [
        'Draft communication about transition',
        'Introduce new recruiter assignments',
        'Set expectations for brief ramp-up period',
      ],
      created_at: now,
      status: 'OPEN',
    });
  }

  return deduplicateActions(actions);
}

/**
 * Generate actions for the Hiring Freeze scenario
 */
export function generateHiringFreezeActions(
  params: HiringFreezeParams,
  affectedReqs: Array<{ req_id: string; hiring_manager_id: string | null }>,
  candidatesInActiveStages: number
): ActionItem[] {
  const actions: ActionItem[] = [];
  const now = new Date();

  // Action 1: Communicate with active candidates
  if (candidatesInActiveStages > 0) {
    actions.push({
      action_id: generateActionId('TA_OPS', 'ta-ops', 'general-candidate-comm', 'PROCESS_OPTIMIZATION'),
      owner_type: 'TA_OPS',
      owner_id: 'ta-ops',
      owner_name: 'TA Operations',
      req_id: 'general-candidate-comm', // Use unique req_id for deduplication
      action_type: 'PROCESS_OPTIMIZATION',
      title: `Communicate freeze to ${candidatesInActiveStages} active candidates`,
      priority: 'P0',
      due_in_days: 3,
      due_date: addDays(now, 3),
      evidence: {
        kpi_key: 'freeze_scope.active_candidates',
        explain_provider_key: 'scenario_library',
        short_reason: `${candidatesInActiveStages} candidates in interview stages`,
      },
      recommended_steps: [
        'Draft candidate communication template',
        'Get legal/HR approval on messaging',
        'Send personalized outreach to each candidate',
        'Log communication in ATS',
      ],
      created_at: now,
      status: 'OPEN',
    });
  }

  // Action 2: Notify hiring managers
  const uniqueHMs = [...new Set(affectedReqs.map(r => r.hiring_manager_id).filter(Boolean))];
  if (uniqueHMs.length > 0) {
    actions.push({
      action_id: generateActionId('TA_OPS', 'ta-ops', 'general-hm-brief', 'PROCESS_OPTIMIZATION'),
      owner_type: 'TA_OPS',
      owner_id: 'ta-ops',
      owner_name: 'TA Operations',
      req_id: 'general-hm-brief', // Use unique req_id for deduplication
      action_type: 'PROCESS_OPTIMIZATION',
      title: `Brief ${uniqueHMs.length} hiring managers on freeze impact`,
      priority: 'P0',
      due_in_days: 2,
      due_date: addDays(now, 2),
      evidence: {
        kpi_key: 'freeze_scope.affected_hms',
        explain_provider_key: 'scenario_library',
        short_reason: `${uniqueHMs.length} HMs have affected requisitions`,
      },
      recommended_steps: [
        'Schedule brief sync with each HM',
        'Share timeline and expected delays',
        'Discuss re-engagement strategy post-freeze',
        'Document revised hiring timelines',
      ],
      created_at: now,
      status: 'OPEN',
    });
  }

  // Action 3: Plan re-engagement
  actions.push({
    action_id: generateActionId('TA_OPS', 'ta-ops', 'general-reengagement', 'PIPELINE_HEALTH_CHECK'),
    owner_type: 'TA_OPS',
    owner_id: 'ta-ops',
    owner_name: 'TA Operations',
    req_id: 'general',
    action_type: 'PIPELINE_HEALTH_CHECK',
    title: 'Prepare post-freeze re-engagement plan',
    priority: 'P1',
    due_in_days: params.freeze_weeks * 7 - 7, // 1 week before freeze ends
    due_date: addDays(now, params.freeze_weeks * 7 - 7),
    evidence: {
      kpi_key: 'scenario.freeze_end_date',
      explain_provider_key: 'scenario_library',
      short_reason: 'Prepare to restart hiring efficiently',
    },
    recommended_steps: [
      'Audit candidate pipeline status',
      'Identify candidates likely to have moved on',
      'Prioritize warm candidates for re-engagement',
      'Schedule HM re-calibration meetings',
    ],
    created_at: now,
    status: 'OPEN',
  });

  return deduplicateActions(actions);
}

/**
 * Generate actions for the Spin Up Team scenario
 */
export function generateSpinUpTeamActions(
  params: SpinUpTeamParams,
  bottlenecks: Bottleneck[]
): ActionItem[] {
  const actions: ActionItem[] = [];
  const now = new Date();

  // Action 1: Create requisitions
  actions.push({
    action_id: generateActionId('TA_OPS', 'ta-ops', 'general-create-reqs', 'PIPELINE_HEALTH_CHECK'),
    owner_type: 'TA_OPS',
    owner_id: 'ta-ops',
    owner_name: 'TA Operations',
    req_id: 'general',
    action_type: 'PIPELINE_HEALTH_CHECK',
    title: `Open ${params.headcount} ${params.role_profile.function} requisitions`,
    priority: 'P0',
    due_in_days: 7,
    due_date: addDays(now, 7),
    evidence: {
      kpi_key: 'scenario.spin_up_team.headcount',
      explain_provider_key: 'scenario_library',
      short_reason: `${params.headcount} positions needed by target date`,
    },
    recommended_steps: [
      'Create job descriptions for each role',
      'Get HM approval on role requirements',
      'Open requisitions in ATS',
      'Assign to recruiters',
    ],
    created_at: now,
    status: 'OPEN',
  });

  // Action 2: Address bottlenecks
  for (const bottleneck of bottlenecks) {
    if (bottleneck.constraint_type === 'CAPACITY_GAP') {
      actions.push({
        action_id: generateActionId('TA_OPS', 'ta-ops', 'general-capacity', 'PROCESS_OPTIMIZATION'),
        owner_type: 'TA_OPS',
        owner_id: 'ta-ops',
        owner_name: 'TA Operations',
        req_id: 'general',
        action_type: 'PROCESS_OPTIMIZATION',
        title: 'Address recruiter capacity gap',
        priority: bottleneck.severity === 'CRITICAL' ? 'P0' : 'P1',
        due_in_days: 14,
        due_date: addDays(now, 14),
        evidence: {
          kpi_key: 'capacity.capacity_gap',
          explain_provider_key: 'capacity_fit_engine',
          short_reason: bottleneck.description,
        },
        recommended_steps: [
          'Review recruiter load distribution',
          'Consider temporary staffing augmentation',
          'Rebalance existing assignments',
          'Evaluate agency support',
        ],
        created_at: now,
        status: 'OPEN',
      });
    }

    if (bottleneck.constraint_type === 'HM_FRICTION') {
      const hmId = params.hiring_manager_id || 'unknown';
      actions.push({
        action_id: generateActionId('HIRING_MANAGER', hmId, 'general-hm-sla', 'FEEDBACK_DUE'),
        owner_type: 'HIRING_MANAGER',
        owner_id: hmId,
        owner_name: `Manager (${params.role_profile.function})`,
        req_id: 'general',
        action_type: 'FEEDBACK_DUE',
        title: 'Establish HM responsiveness SLA',
        priority: 'P1',
        due_in_days: 7,
        due_date: addDays(now, 7),
        evidence: {
          kpi_key: 'hm_friction.feedback_latency',
          explain_provider_key: 'hm_metrics_engine',
          short_reason: bottleneck.description,
        },
        recommended_steps: [
          'Meet with HM to set expectations',
          'Agree on 24-hour feedback SLA',
          'Set up automated reminder system',
        ],
        created_at: now,
        status: 'OPEN',
      });
    }

    if (bottleneck.constraint_type === 'PIPELINE_DEPTH') {
      actions.push({
        action_id: generateActionId('TA_OPS', 'ta-ops', 'general-sourcing', 'SOURCE_CANDIDATES'),
        owner_type: 'TA_OPS',
        owner_id: 'ta-ops',
        owner_name: 'TA Operations',
        req_id: 'general',
        action_type: 'SOURCE_CANDIDATES',
        title: 'Build candidate pipeline for new team',
        priority: bottleneck.severity === 'CRITICAL' ? 'P0' : 'P1',
        due_in_days: 14,
        due_date: addDays(now, 14),
        evidence: {
          kpi_key: 'pipeline_requirements.total_candidates_needed',
          explain_provider_key: 'scenario_library',
          short_reason: bottleneck.description,
        },
        recommended_steps: [
          'Activate sourcing channels',
          'Brief recruiters on role requirements',
          'Consider referral bonus campaigns',
          'Engage external sourcing partners if needed',
        ],
        created_at: now,
        status: 'OPEN',
      });
    }
  }

  return deduplicateActions(actions);
}

/**
 * Generate actions from bottlenecks (generic)
 */
export function generateActionsFromBottlenecks(bottlenecks: Bottleneck[]): ActionItem[] {
  const actions: ActionItem[] = [];
  const now = new Date();

  for (const bottleneck of bottlenecks) {
    const action: ActionItem = {
      action_id: generateActionId(
        'TA_OPS',
        'ta-ops',
        `bottleneck-${bottleneck.constraint_type.toLowerCase()}`,
        'PROCESS_OPTIMIZATION'
      ),
      owner_type: 'TA_OPS',
      owner_id: 'ta-ops',
      owner_name: 'TA Operations',
      req_id: 'general',
      action_type: 'PROCESS_OPTIMIZATION',
      title: bottleneck.mitigation,
      priority: bottleneck.severity === 'CRITICAL' ? 'P0' : bottleneck.severity === 'HIGH' ? 'P1' : 'P2',
      due_in_days: bottleneck.severity === 'CRITICAL' ? 3 : bottleneck.severity === 'HIGH' ? 7 : 14,
      due_date: addDays(now, bottleneck.severity === 'CRITICAL' ? 3 : bottleneck.severity === 'HIGH' ? 7 : 14),
      evidence: {
        kpi_key: bottleneck.evidence.metric_key,
        explain_provider_key: bottleneck.evidence.source_citation,
        short_reason: bottleneck.description,
      },
      recommended_steps: [bottleneck.mitigation],
      created_at: now,
      status: 'OPEN',
    };
    actions.push(action);
  }

  return deduplicateActions(actions);
}
