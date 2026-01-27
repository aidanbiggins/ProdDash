// Export Service for the Recruiter Productivity Dashboard

import { saveAs } from 'file-saver';
import {
  Requisition,
  Candidate,
  Event,
  User,
  RecruiterSummary,
  HiringManagerFriction,
  ReqDetail,
  MetricFilters
} from '../types';

// ===== CSV GENERATION =====

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function arrayToCSV(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const headerLine = headers.map(escapeCSV).join(',');
  const dataLines = rows.map(row => row.map(escapeCSV).join(','));
  return [headerLine, ...dataLines].join('\n');
}

// ===== RECRUITER SUMMARY EXPORT =====

export function exportRecruiterSummaryCSV(
  summaries: RecruiterSummary[],
  filters: MetricFilters
): void {
  const headers = [
    'Recruiter ID',
    'Recruiter Name',
    'Team',
    'Hires',
    'Weighted Hires',
    'Offers Extended',
    'Offers Accepted',
    'Offer Acceptance Rate',
    'Time to Fill (Median Days)',
    'Outreach Sent',
    'Screens Completed',
    'Submittals to HM',
    'Interview Loops Scheduled',
    'Follow-up Velocity (Median Hours)',
    'Screen to HM Conversion',
    'HM to Onsite Conversion',
    'Onsite to Offer Conversion',
    'Offer to Hired Conversion',
    'Open Reqs',
    'Stalled Reqs',
    'Recruiter Lead to Action (Hours)',
    'Recruiter Screen to Submit (Hours)',
    'HM Feedback Latency (Hours)',
    'HM Decision Latency (Hours)',
    'Active Req Load',
    'Productivity Index'
  ];

  const rows = summaries.map(s => [
    s.recruiterId,
    s.recruiterName,
    s.team,
    s.outcomes.hires,
    s.weighted.weightedHires.toFixed(2),
    s.outcomes.offersExtended,
    s.outcomes.offersAccepted,
    s.outcomes.offerAcceptanceRate !== null ? (s.outcomes.offerAcceptanceRate * 100).toFixed(1) + '%' : '',
    s.outcomes.timeToFillMedian,
    s.executionVolume.outreachSent,
    s.executionVolume.screensCompleted,
    s.executionVolume.submittalsToHM,
    s.executionVolume.interviewLoopsScheduled,
    s.executionVolume.followUpVelocityMedian,
    s.funnelConversion.screenToHmScreen.rate !== null ? (s.funnelConversion.screenToHmScreen.rate * 100).toFixed(1) + '%' : '',
    s.funnelConversion.hmScreenToOnsite.rate !== null ? (s.funnelConversion.hmScreenToOnsite.rate * 100).toFixed(1) + '%' : '',
    s.funnelConversion.onsiteToOffer.rate !== null ? (s.funnelConversion.onsiteToOffer.rate * 100).toFixed(1) + '%' : '',
    s.funnelConversion.offerToHired.rate !== null ? (s.funnelConversion.offerToHired.rate * 100).toFixed(1) + '%' : '',
    s.aging.openReqCount,
    s.aging.stalledReqs.count,
    s.timeAttribution.recruiterControlledTime.leadToFirstAction,
    s.timeAttribution.recruiterControlledTime.screenToSubmittal,
    s.timeAttribution.hmControlledTime.feedbackLatency,
    s.timeAttribution.hmControlledTime.decisionLatency,
    s.activeReqLoad,
    s.productivityIndex.toFixed(3)
  ]);

  const csv = arrayToCSV(headers, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const dateStr = new Date().toISOString().split('T')[0];
  saveAs(blob, `recruiter_summary_${dateStr}.csv`);
}

// ===== HM FRICTION EXPORT =====

export function exportHMFrictionCSV(
  friction: HiringManagerFriction[]
): void {
  const headers = [
    'HM ID',
    'HM Name',
    'Reqs in Range',
    'Feedback Latency (Median Hours)',
    'Decision Latency (Median Hours)',
    'Offer Acceptance Rate',
    'HM Weight',
    'Interview Loop Count'
  ];

  const rows = friction.map(f => [
    f.hmId,
    f.hmName,
    f.reqsInRange,
    f.feedbackLatencyMedian,
    f.decisionLatencyMedian,
    f.offerAcceptanceRate !== null ? (f.offerAcceptanceRate * 100).toFixed(1) + '%' : '',
    f.hmWeight.toFixed(2),
    f.loopCount
  ]);

  const csv = arrayToCSV(headers, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const dateStr = new Date().toISOString().split('T')[0];
  saveAs(blob, `hm_friction_${dateStr}.csv`);
}

// ===== REQ LIST EXPORT =====

export function exportReqListCSV(
  reqs: ReqDetail[]
): void {
  const headers = [
    'Req ID',
    'Title',
    'Function',
    'Job Family',
    'Level',
    'Location Type',
    'Region',
    'City',
    'Status',
    'Hiring Manager',
    'Recruiter ID',
    'Age (Days)',
    'Candidate Count',
    'Is Stalled',
    'Complexity Score',
    'Delay Contributor',
    'Delay Days',
    'Last Activity',
    'Last Activity Type'
  ];

  const rows = reqs.map(r => [
    r.req.req_id,
    r.req.req_title,
    r.req.function,
    r.req.job_family,
    r.req.level,
    r.req.location_type,
    r.req.location_region,
    r.req.location_city,
    r.req.status,
    r.hmName,
    r.req.recruiter_id,
    r.ageInDays,
    r.candidateCount,
    r.isStalled,
    r.complexityScore.toFixed(2),
    r.delayContributor,
    r.delayDays,
    r.lastActivityAt?.toISOString(),
    r.lastActivityType
  ]);

  const csv = arrayToCSV(headers, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const dateStr = new Date().toISOString().split('T')[0];
  saveAs(blob, `requisition_list_${dateStr}.csv`);
}

// ===== RAW DATA EXPORT =====

export function exportRawRequisitionsCSV(requisitions: Requisition[]): void {
  const headers = [
    'req_id', 'req_title', 'function', 'job_family', 'level',
    'location_type', 'location_region', 'location_city',
    'comp_band_min', 'comp_band_max', 'opened_at', 'closed_at',
    'status', 'hiring_manager_id', 'recruiter_id', 'business_unit',
    'headcount_type', 'priority', 'candidate_slate_required', 'search_firm_used'
  ];

  const rows = requisitions.map(r => [
    r.req_id, r.req_title, r.function, r.job_family, r.level,
    r.location_type, r.location_region, r.location_city,
    r.comp_band_min, r.comp_band_max,
    r.opened_at?.toISOString(), r.closed_at?.toISOString(),
    r.status, r.hiring_manager_id, r.recruiter_id, r.business_unit,
    r.headcount_type, r.priority, r.candidate_slate_required, r.search_firm_used
  ]);

  const csv = arrayToCSV(headers, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const dateStr = new Date().toISOString().split('T')[0];
  saveAs(blob, `raw_requisitions_${dateStr}.csv`);
}

export function exportRawCandidatesCSV(candidates: Candidate[]): void {
  const headers = [
    'candidate_id', 'req_id', 'source', 'applied_at', 'first_contacted_at',
    'current_stage', 'current_stage_entered_at', 'disposition',
    'hired_at', 'offer_extended_at', 'offer_accepted_at'
  ];

  const rows = candidates.map(c => [
    c.candidate_id, c.req_id, c.source,
    c.applied_at?.toISOString(), c.first_contacted_at?.toISOString(),
    c.current_stage, c.current_stage_entered_at?.toISOString(), c.disposition,
    c.hired_at?.toISOString(), c.offer_extended_at?.toISOString(),
    c.offer_accepted_at?.toISOString()
  ]);

  const csv = arrayToCSV(headers, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const dateStr = new Date().toISOString().split('T')[0];
  saveAs(blob, `raw_candidates_${dateStr}.csv`);
}

export function exportRawEventsCSV(events: Event[]): void {
  const headers = [
    'event_id', 'candidate_id', 'req_id', 'event_type',
    'from_stage', 'to_stage', 'actor_user_id', 'event_at', 'metadata_json'
  ];

  const rows = events.map(e => [
    e.event_id, e.candidate_id, e.req_id, e.event_type,
    e.from_stage, e.to_stage, e.actor_user_id,
    e.event_at?.toISOString(), e.metadata_json
  ]);

  const csv = arrayToCSV(headers, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const dateStr = new Date().toISOString().split('T')[0];
  saveAs(blob, `raw_events_${dateStr}.csv`);
}

export function exportRawUsersCSV(users: User[]): void {
  const headers = [
    'user_id', 'name', 'role', 'team', 'manager_user_id', 'email'
  ];

  const rows = users.map(u => [
    u.user_id, u.name, u.role, u.team, u.manager_user_id, u.email
  ]);

  const csv = arrayToCSV(headers, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const dateStr = new Date().toISOString().split('T')[0];
  saveAs(blob, `raw_users_${dateStr}.csv`);
}

// ===== EXPORT ALL RAW DATA =====

export function exportAllRawData(
  requisitions: Requisition[],
  candidates: Candidate[],
  events: Event[],
  users: User[]
): void {
  exportRawRequisitionsCSV(requisitions);
  exportRawCandidatesCSV(candidates);
  exportRawEventsCSV(events);
  exportRawUsersCSV(users);
}
