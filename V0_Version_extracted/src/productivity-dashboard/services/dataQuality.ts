// Data Quality Service for the Recruiter Productivity Dashboard

import {
  Requisition,
  Candidate,
  Event,
  User,
  DataHealth
} from '../types';
import { DashboardConfig } from '../types/config';

/**
 * Calculates data health metrics for the imported data
 */
export function calculateDataHealth(
  requisitions: Requisition[],
  candidates: Candidate[],
  events: Event[],
  users: User[],
  config: DashboardConfig
): DataHealth {
  // Candidates missing first_contacted_at
  const candidatesMissingContact = candidates.filter(c => !c.first_contacted_at);
  const candidatesMissingContactPct = candidates.length > 0
    ? (candidatesMissingContact.length / candidates.length) * 100
    : 0;

  // Events missing actor_user_id
  const eventsMissingActor = events.filter(e => !e.actor_user_id || e.actor_user_id.trim() === '');
  const eventsMissingActorPct = events.length > 0
    ? (eventsMissingActor.length / events.length) * 100
    : 0;

  // Reqs missing level
  const reqsMissingLevel = requisitions.filter(r => !r.level || r.level.trim() === '');
  const reqsMissingLevelPct = requisitions.length > 0
    ? (reqsMissingLevel.length / requisitions.length) * 100
    : 0;

  // Reqs missing job_family
  const reqsMissingJobFamily = requisitions.filter(r => !r.job_family || r.job_family.trim() === '');
  const reqsMissingJobFamilyPct = requisitions.length > 0
    ? (reqsMissingJobFamily.length / requisitions.length) * 100
    : 0;

  // Unmapped stages
  const unmappedStagesCount = config.stageMapping.unmappedStages.length;

  // Determine which metrics have low confidence
  const lowConfidenceMetrics: string[] = [];
  const threshold = config.thresholds.lowConfidenceThreshold;

  if (candidatesMissingContactPct > threshold) {
    lowConfidenceMetrics.push('First Touch Latency');
    lowConfidenceMetrics.push('Recruiter Controlled Time');
  }

  if (eventsMissingActorPct > threshold) {
    lowConfidenceMetrics.push('Execution Volume');
    lowConfidenceMetrics.push('Time Attribution');
  }

  if (reqsMissingLevelPct > threshold) {
    lowConfidenceMetrics.push('Complexity Scoring');
    lowConfidenceMetrics.push('Weighted Metrics');
  }

  if (reqsMissingJobFamilyPct > threshold) {
    lowConfidenceMetrics.push('Niche Weights');
  }

  if (unmappedStagesCount > 0) {
    lowConfidenceMetrics.push('Funnel Conversion');
  }

  // Calculate overall health score (0-100)
  let healthScore = 100;

  // Deduct for each issue
  healthScore -= Math.min(20, candidatesMissingContactPct / 2);
  healthScore -= Math.min(20, eventsMissingActorPct / 2);
  healthScore -= Math.min(15, reqsMissingLevelPct);
  healthScore -= Math.min(15, reqsMissingJobFamilyPct);
  healthScore -= Math.min(30, unmappedStagesCount * 3);

  healthScore = Math.max(0, healthScore);

  return {
    candidatesMissingFirstContact: {
      count: candidatesMissingContact.length,
      percentage: Math.round(candidatesMissingContactPct * 10) / 10
    },
    eventsMissingActor: {
      count: eventsMissingActor.length,
      percentage: Math.round(eventsMissingActorPct * 10) / 10
    },
    reqsMissingLevel: {
      count: reqsMissingLevel.length,
      percentage: Math.round(reqsMissingLevelPct * 10) / 10
    },
    reqsMissingJobFamily: {
      count: reqsMissingJobFamily.length,
      percentage: Math.round(reqsMissingJobFamilyPct * 10) / 10
    },
    unmappedStagesCount,
    overallHealthScore: Math.round(healthScore),
    lowConfidenceMetrics
  };
}

/**
 * Generates a detailed data quality report
 */
export interface DataQualityReport {
  summary: {
    totalRequisitions: number;
    totalCandidates: number;
    totalEvents: number;
    totalUsers: number;
    overallHealthScore: number;
    healthGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  };
  issues: DataQualityIssue[];
  recommendations: string[];
}

export interface DataQualityIssue {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  description: string;
  affectedCount: number;
  affectedPercentage: number;
  impactedMetrics: string[];
}

export function generateDataQualityReport(
  requisitions: Requisition[],
  candidates: Candidate[],
  events: Event[],
  users: User[],
  config: DashboardConfig
): DataQualityReport {
  const health = calculateDataHealth(requisitions, candidates, events, users, config);

  const issues: DataQualityIssue[] = [];
  const recommendations: string[] = [];

  // Check for critical issues
  if (!config.stageMapping.isComplete) {
    issues.push({
      severity: 'critical',
      category: 'Stage Mapping',
      description: 'Stage mapping is incomplete. Some canonical stages are not mapped.',
      affectedCount: config.stageMapping.unmappedStages.length,
      affectedPercentage: 0,
      impactedMetrics: ['Funnel Conversion', 'Stage Distribution', 'Candidate Flow']
    });
    recommendations.push('Complete the stage mapping configuration before analyzing funnel metrics.');
  }

  // Check candidates missing first contact
  if (health.candidatesMissingFirstContact.percentage > 0) {
    const severity = health.candidatesMissingFirstContact.percentage > 10 ? 'warning' : 'info';
    issues.push({
      severity,
      category: 'Candidate Data',
      description: 'Candidates are missing first_contacted_at timestamp.',
      affectedCount: health.candidatesMissingFirstContact.count,
      affectedPercentage: health.candidatesMissingFirstContact.percentage,
      impactedMetrics: ['First Touch Latency', 'Recruiter Response Time']
    });
    if (severity === 'warning') {
      recommendations.push('Review ATS integration to ensure first contact dates are being captured.');
    }
  }

  // Check events missing actor
  if (health.eventsMissingActor.percentage > 0) {
    const severity = health.eventsMissingActor.percentage > 10 ? 'warning' : 'info';
    issues.push({
      severity,
      category: 'Event Data',
      description: 'Events are missing actor_user_id.',
      affectedCount: health.eventsMissingActor.count,
      affectedPercentage: health.eventsMissingActor.percentage,
      impactedMetrics: ['Execution Volume', 'Time Attribution', 'User Activity']
    });
    if (severity === 'warning') {
      recommendations.push('Ensure ATS events include the user who performed the action.');
    }
  }

  // Check reqs missing level
  if (health.reqsMissingLevel.percentage > 0) {
    const severity = health.reqsMissingLevel.percentage > 10 ? 'warning' : 'info';
    issues.push({
      severity,
      category: 'Requisition Data',
      description: 'Requisitions are missing level field.',
      affectedCount: health.reqsMissingLevel.count,
      affectedPercentage: health.reqsMissingLevel.percentage,
      impactedMetrics: ['Complexity Scoring', 'Weighted Hires', 'Weighted Offers']
    });
    if (severity === 'warning') {
      recommendations.push('Add level information to requisitions for accurate complexity scoring.');
    }
  }

  // Check reqs missing job family
  if (health.reqsMissingJobFamily.percentage > 0) {
    const severity = health.reqsMissingJobFamily.percentage > 10 ? 'warning' : 'info';
    issues.push({
      severity,
      category: 'Requisition Data',
      description: 'Requisitions are missing job_family field.',
      affectedCount: health.reqsMissingJobFamily.count,
      affectedPercentage: health.reqsMissingJobFamily.percentage,
      impactedMetrics: ['Niche Weights', 'Complexity Scoring']
    });
    if (severity === 'warning') {
      recommendations.push('Add job family information for accurate niche weighting.');
    }
  }

  // Check referential integrity
  const reqIds = new Set(requisitions.map(r => r.req_id));
  const candidateIds = new Set(candidates.map(c => c.candidate_id));
  const userIds = new Set(users.map(u => u.user_id));

  const orphanedCandidates = candidates.filter(c => !reqIds.has(c.req_id));
  if (orphanedCandidates.length > 0) {
    issues.push({
      severity: 'warning',
      category: 'Referential Integrity',
      description: 'Candidates reference non-existent requisitions.',
      affectedCount: orphanedCandidates.length,
      affectedPercentage: (orphanedCandidates.length / candidates.length) * 100,
      impactedMetrics: ['All candidate-based metrics']
    });
    recommendations.push('Ensure all candidates reference valid requisition IDs.');
  }

  const orphanedEvents = events.filter(e => !candidateIds.has(e.candidate_id));
  if (orphanedEvents.length > 0) {
    issues.push({
      severity: 'warning',
      category: 'Referential Integrity',
      description: 'Events reference non-existent candidates.',
      affectedCount: orphanedEvents.length,
      affectedPercentage: (orphanedEvents.length / events.length) * 100,
      impactedMetrics: ['All event-based metrics']
    });
    recommendations.push('Ensure all events reference valid candidate IDs.');
  }

  // Determine health grade
  let healthGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (health.overallHealthScore >= 90) healthGrade = 'A';
  else if (health.overallHealthScore >= 80) healthGrade = 'B';
  else if (health.overallHealthScore >= 70) healthGrade = 'C';
  else if (health.overallHealthScore >= 60) healthGrade = 'D';
  else healthGrade = 'F';

  return {
    summary: {
      totalRequisitions: requisitions.length,
      totalCandidates: candidates.length,
      totalEvents: events.length,
      totalUsers: users.length,
      overallHealthScore: health.overallHealthScore,
      healthGrade
    },
    issues,
    recommendations
  };
}
