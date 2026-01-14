// Rebalance Optimizer Service
// Greedy algorithm for generating req reassignment recommendations

import {
  RebalanceRecommendation,
  RecruiterLoadRow,
  ReqWithWorkload,
  FitMatrixCell,
  SegmentKey,
  CAPACITY_CONSTANTS,
  segmentKeyToString
} from '../types/capacityTypes';
import { getFitScore } from './fitScoring';

// ===== VALIDATION =====

/**
 * Checks if a req is in final stages (should not be moved)
 */
function isInFinalStages(req: ReqWithWorkload): boolean {
  return req.hasOfferOut || req.hasFinalist;
}

/**
 * Validates if a move is allowed per constraints
 */
function isValidMove(
  source: RecruiterLoadRow,
  dest: RecruiterLoadRow,
  req: ReqWithWorkload,
  fitMatrix: FitMatrixCell[],
  moveCounts: Map<string, number>
): boolean {
  // Constraint 1: Don't overload destination
  const newDestUtil = dest.utilization + (req.workloadScore / dest.capacityWU);
  if (newDestUtil > CAPACITY_CONSTANTS.MAX_DEST_UTILIZATION_AFTER_MOVE) {
    return false;
  }

  // Constraint 2: Must meaningfully help source
  const relief = req.workloadScore / source.capacityWU;
  if (relief < CAPACITY_CONSTANTS.MIN_SOURCE_RELIEF) {
    return false;
  }

  // Constraint 3: Don't move if destination has poor fit
  const destFit = getFitScore(fitMatrix, dest.recruiterId, req.segment);
  if (destFit !== null && destFit < CAPACITY_CONSTANTS.MIN_FIT_FOR_ASSIGNMENT) {
    return false;
  }

  // Constraint 4: Limit churn per recruiter
  const currentMoves = moveCounts.get(source.recruiterId) ?? 0;
  if (currentMoves >= CAPACITY_CONSTANTS.MAX_MOVES_PER_RECRUITER) {
    return false;
  }

  return true;
}

// ===== DESTINATION SELECTION =====

/**
 * Finds the best destination recruiter for a req
 */
function findBestDestination(
  req: ReqWithWorkload,
  available: RecruiterLoadRow[],
  fitMatrix: FitMatrixCell[]
): RecruiterLoadRow | null {
  let bestDest: RecruiterLoadRow | null = null;
  let bestScore = -Infinity;

  const segmentStr = segmentKeyToString(req.segment);

  for (const dest of available) {
    const fitCell = fitMatrix.find(c =>
      c.recruiterId === dest.recruiterId &&
      c.segmentString === segmentStr
    );

    // Score = fit bonus + availability bonus
    const fitBonus = fitCell?.fitScore ?? 0; // -1 to +1 range
    const availBonus = (1 - dest.utilization) * 0.5; // 0 to 0.5 range
    const score = fitBonus + availBonus;

    if (score > bestScore) {
      bestScore = score;
      bestDest = dest;
    }
  }

  return bestDest;
}

/**
 * Generates rationale text for a recommended move
 */
function generateRationale(
  source: RecruiterLoadRow,
  dest: RecruiterLoadRow,
  req: ReqWithWorkload,
  fitMatrix: FitMatrixCell[]
): string {
  const segmentStr = segmentKeyToString(req.segment);
  const destFitCell = fitMatrix.find(c =>
    c.recruiterId === dest.recruiterId &&
    c.segmentString === segmentStr
  );

  const parts: string[] = [];

  // Mention utilization improvement
  parts.push(`${source.recruiterName} is at ${Math.round(source.utilization * 100)}% capacity`);
  parts.push(`${dest.recruiterName} has availability at ${Math.round(dest.utilization * 100)}%`);

  // Mention fit if available
  if (destFitCell && destFitCell.confidence !== 'INSUFFICIENT') {
    const fitLabel = destFitCell.fitScore > 0.3 ? 'strong' :
                     destFitCell.fitScore > 0.1 ? 'good' :
                     destFitCell.fitScore > -0.1 ? 'neutral' : 'limited';
    parts.push(`${dest.recruiterName} has ${fitLabel} fit for ${segmentStr}`);
  }

  return parts.join('. ') + '.';
}

/**
 * Calculates fit score improvement from a move
 */
function getFitImprovement(
  source: RecruiterLoadRow,
  dest: RecruiterLoadRow,
  segment: SegmentKey,
  fitMatrix: FitMatrixCell[]
): number | null {
  const sourceFit = getFitScore(fitMatrix, source.recruiterId, segment);
  const destFit = getFitScore(fitMatrix, dest.recruiterId, segment);

  if (sourceFit === null || destFit === null) {
    return null;
  }

  return destFit - sourceFit;
}

// ===== MAIN ALGORITHM =====

/**
 * Generates rebalance recommendations using greedy algorithm
 */
export function generateRebalanceRecommendations(
  recruiters: RecruiterLoadRow[],
  reqs: ReqWithWorkload[],
  fitMatrix: FitMatrixCell[],
  maxRecommendations: number = 5
): RebalanceRecommendation[] {
  const recommendations: RebalanceRecommendation[] = [];
  const moveCounts = new Map<string, number>();

  // Create mutable copies for simulation
  const recruitersCopy = recruiters.map(r => ({ ...r }));

  // Sort recruiters by utilization descending
  const overloaded = recruitersCopy
    .filter(r => r.utilization > CAPACITY_CONSTANTS.UTILIZATION_OVERLOADED)
    .sort((a, b) => b.utilization - a.utilization);

  const available = recruitersCopy
    .filter(r => r.utilization < CAPACITY_CONSTANTS.UTILIZATION_BALANCED_LOW)
    .sort((a, b) => a.utilization - b.utilization);

  // No rebalancing possible if no available recruiters
  if (available.length === 0) {
    return [];
  }

  for (const source of overloaded) {
    if (recommendations.length >= maxRecommendations) break;

    // Get moveable reqs (not in final stages)
    const moveableReqs = reqs
      .filter(r => r.recruiterId === source.recruiterId)
      .filter(r => !isInFinalStages(r))
      .sort((a, b) => b.workloadScore - a.workloadScore);

    for (const req of moveableReqs) {
      if (recommendations.length >= maxRecommendations) break;

      // Find best destination
      const bestDest = findBestDestination(req, available, fitMatrix);

      if (bestDest && isValidMove(source, bestDest, req, fitMatrix, moveCounts)) {
        recommendations.push({
          reqId: req.reqId,
          reqTitle: req.reqTitle,
          fromRecruiterId: source.recruiterId,
          fromRecruiterName: source.recruiterName,
          fromUtilization: source.utilization,
          toRecruiterId: bestDest.recruiterId,
          toRecruiterName: bestDest.recruiterName,
          toUtilization: bestDest.utilization,
          rationale: generateRationale(source, bestDest, req, fitMatrix),
          fitScoreImprovement: getFitImprovement(source, bestDest, req.segment, fitMatrix),
          demandImpact: req.workloadScore,
          rank: recommendations.length + 1
        });

        // Update simulated utilizations for next iteration
        source.utilization -= req.workloadScore / source.capacityWU;
        bestDest.utilization += req.workloadScore / bestDest.capacityWU;

        // Track move count
        moveCounts.set(source.recruiterId, (moveCounts.get(source.recruiterId) ?? 0) + 1);
      }
    }
  }

  return recommendations;
}
