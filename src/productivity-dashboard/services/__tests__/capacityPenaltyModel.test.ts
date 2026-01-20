/**
 * Unit tests for capacityPenaltyModel.ts
 * Tests queue delay calculations and duration adjustments
 *
 * v1.1: Added tests for global demand computation
 */

import {
    applyCapacityPenalty,
    calculateQueueDelay,
    createCapacityAdjustedParams,
    getServiceRateForStage,
    getDistributionMedian,
    computeGlobalDemand,
    applyCapacityPenaltyV11
} from '../capacityPenaltyModel';
import { SimulationParameters, DurationDistribution } from '../probabilisticEngine';
import { CanonicalStage, Candidate, Requisition, CandidateDisposition, RequisitionStatus, User } from '../../types';
import {
    OracleCapacityProfile,
    OracleRecruiterCapacity,
    OracleHMCapacity,
    OraclePipelineByStage,
    OracleStageCapacity,
    ORACLE_CAPACITY_CONSTANTS,
    ORACLE_GLOBAL_CAPACITY_PRIORS,
    OracleGlobalDemandInput
} from '../../types/capacityTypes';

const { MAX_QUEUE_DELAY_DAYS } = ORACLE_CAPACITY_CONSTANTS;

// ===== TEST FIXTURES =====

function createStageCapacity(
    stage: CanonicalStage,
    throughput: number,
    confidence: 'HIGH' | 'MED' | 'LOW' = 'HIGH'
): OracleStageCapacity {
    return {
        stage,
        throughput_per_week: throughput,
        n_weeks: 8,
        n_transitions: 40,
        confidence
    };
}

function createRecruiterCapacity(overrides: Partial<OracleRecruiterCapacity> = {}): OracleRecruiterCapacity {
    return {
        recruiter_id: 'rec-001',
        recruiter_name: 'Test Recruiter',
        screens_per_week: createStageCapacity(CanonicalStage.SCREEN, 8),
        hm_screens_per_week: createStageCapacity(CanonicalStage.HM_SCREEN, 4),
        onsites_per_week: createStageCapacity(CanonicalStage.ONSITE, 3),
        offers_per_week: createStageCapacity(CanonicalStage.OFFER, 1.5),
        overall_confidence: 'HIGH',
        confidence_reasons: [],
        date_range: { start: new Date(), end: new Date(), weeks_analyzed: 8 },
        ...overrides
    };
}

function createHMCapacity(overrides: Partial<OracleHMCapacity> = {}): OracleHMCapacity {
    return {
        hm_id: 'hm-001',
        hm_name: 'Test HM',
        interviews_per_week: createStageCapacity(CanonicalStage.HM_SCREEN, 4),
        overall_confidence: 'HIGH',
        confidence_reasons: [],
        date_range: { start: new Date(), end: new Date(), weeks_analyzed: 8 },
        ...overrides
    };
}

function createCapacityProfile(
    recruiterCapacity: OracleRecruiterCapacity | null = createRecruiterCapacity(),
    hmCapacity: OracleHMCapacity | null = createHMCapacity()
): OracleCapacityProfile {
    return {
        recruiter: recruiterCapacity,
        hm: hmCapacity,
        cohort_defaults: ORACLE_GLOBAL_CAPACITY_PRIORS,
        overall_confidence: 'HIGH',
        confidence_reasons: [],
        used_cohort_fallback: false
    };
}

function createSimulationParams(): SimulationParameters {
    return {
        stageConversionRates: {
            [CanonicalStage.SCREEN]: 0.5,
            [CanonicalStage.HM_SCREEN]: 0.6,
            [CanonicalStage.ONSITE]: 0.7,
            [CanonicalStage.OFFER]: 0.8
        },
        stageDurations: {
            [CanonicalStage.SCREEN]: { type: 'lognormal', mu: Math.log(7), sigma: 0.5 },
            [CanonicalStage.HM_SCREEN]: { type: 'lognormal', mu: Math.log(5), sigma: 0.4 },
            [CanonicalStage.ONSITE]: { type: 'lognormal', mu: Math.log(10), sigma: 0.6 },
            [CanonicalStage.OFFER]: { type: 'constant', days: 3 }
        },
        sampleSizes: {
            [`${CanonicalStage.SCREEN}_rate`]: 50,
            [`${CanonicalStage.HM_SCREEN}_rate`]: 40,
            [`${CanonicalStage.ONSITE}_rate`]: 30,
            [`${CanonicalStage.OFFER}_rate`]: 20
        }
    };
}

// ===== TEST SUITES =====

describe('capacityPenaltyModel', () => {
    describe('calculateQueueDelay', () => {
        it('returns 0 when demand <= capacity', () => {
            expect(calculateQueueDelay(5, 8)).toBe(0);
            expect(calculateQueueDelay(8, 8)).toBe(0);
            expect(calculateQueueDelay(0, 8)).toBe(0);
        });

        it('calculates delay when demand > capacity', () => {
            // demand = 12, capacity = 8
            // excess = 4, ratio = 4/8 = 0.5
            // delay = 0.5 * 7 = 3.5 days
            const delay = calculateQueueDelay(12, 8);
            expect(delay).toBeCloseTo(3.5, 1);
        });

        it('caps delay at MAX_QUEUE_DELAY_DAYS', () => {
            // Very high demand should be capped
            const delay = calculateQueueDelay(100, 2);
            expect(delay).toBe(MAX_QUEUE_DELAY_DAYS);
        });

        it('handles zero capacity gracefully', () => {
            expect(calculateQueueDelay(5, 0)).toBe(0);
        });

        it('respects queueFactor parameter', () => {
            const delayNoFactor = calculateQueueDelay(12, 8, 1.0);
            const delayWithFactor = calculateQueueDelay(12, 8, 1.5);
            expect(delayWithFactor).toBeCloseTo(delayNoFactor * 1.5, 1);
        });
    });

    describe('getDistributionMedian', () => {
        it('returns correct median for lognormal distribution', () => {
            const dist: DurationDistribution = { type: 'lognormal', mu: Math.log(10), sigma: 0.5 };
            expect(getDistributionMedian(dist)).toBeCloseTo(10, 1);
        });

        it('returns days for constant distribution', () => {
            const dist: DurationDistribution = { type: 'constant', days: 5 };
            expect(getDistributionMedian(dist)).toBe(5);
        });

        it('returns default for undefined distribution', () => {
            expect(getDistributionMedian(undefined)).toBe(7);
        });
    });

    describe('applyCapacityPenalty', () => {
        it('returns no penalty when demand <= capacity', () => {
            const stageDurations = createSimulationParams().stageDurations;
            const pipelineByStage: OraclePipelineByStage = {
                [CanonicalStage.SCREEN]: 3,
                [CanonicalStage.HM_SCREEN]: 2,
                [CanonicalStage.ONSITE]: 1,
                [CanonicalStage.OFFER]: 1
            };
            const capacityProfile = createCapacityProfile();

            const result = applyCapacityPenalty(stageDurations, pipelineByStage, capacityProfile);

            expect(result.total_queue_delay_days).toBe(0);
            expect(result.top_bottlenecks.length).toBe(0);
            result.stage_diagnostics.forEach(d => {
                expect(d.is_bottleneck).toBe(false);
                expect(d.queue_delay_days).toBe(0);
            });
        });

        it('applies penalty when demand > capacity', () => {
            const stageDurations = createSimulationParams().stageDurations;
            // Overload the Screen stage: 15 candidates but only 8/week capacity
            const pipelineByStage: OraclePipelineByStage = {
                [CanonicalStage.SCREEN]: 15,
                [CanonicalStage.HM_SCREEN]: 2,
                [CanonicalStage.ONSITE]: 1,
                [CanonicalStage.OFFER]: 1
            };
            const capacityProfile = createCapacityProfile();

            const result = applyCapacityPenalty(stageDurations, pipelineByStage, capacityProfile);

            expect(result.total_queue_delay_days).toBeGreaterThan(0);

            // Screen should be a bottleneck
            const screenDiag = result.stage_diagnostics.find(d => d.stage === CanonicalStage.SCREEN);
            expect(screenDiag?.is_bottleneck).toBe(true);
            expect(screenDiag?.queue_delay_days).toBeGreaterThan(0);
            expect(screenDiag?.bottleneck_owner_type).toBe('recruiter');
        });

        it('identifies bottlenecks correctly', () => {
            const stageDurations = createSimulationParams().stageDurations;
            // Overload multiple stages
            const pipelineByStage: OraclePipelineByStage = {
                [CanonicalStage.SCREEN]: 20,
                [CanonicalStage.HM_SCREEN]: 10,
                [CanonicalStage.ONSITE]: 8,
                [CanonicalStage.OFFER]: 1
            };
            const capacityProfile = createCapacityProfile();

            const result = applyCapacityPenalty(stageDurations, pipelineByStage, capacityProfile);

            expect(result.top_bottlenecks.length).toBeGreaterThan(0);
            // Bottlenecks should be sorted by delay (descending)
            for (let i = 1; i < result.top_bottlenecks.length; i++) {
                expect(result.top_bottlenecks[i - 1].queue_delay_days)
                    .toBeGreaterThanOrEqual(result.top_bottlenecks[i].queue_delay_days);
            }
        });

        it('uses cohort defaults when recruiter capacity is null', () => {
            const stageDurations = createSimulationParams().stageDurations;
            const pipelineByStage: OraclePipelineByStage = {
                [CanonicalStage.SCREEN]: 20,
                [CanonicalStage.HM_SCREEN]: 2,
                [CanonicalStage.ONSITE]: 1,
                [CanonicalStage.OFFER]: 1
            };
            // No recruiter capacity - should fall back to cohort defaults
            const capacityProfile = createCapacityProfile(null, null);

            const result = applyCapacityPenalty(stageDurations, pipelineByStage, capacityProfile);

            // Should still calculate something using cohort defaults
            expect(result.stage_diagnostics.length).toBeGreaterThan(0);
        });

        it('caps queue delay at maximum', () => {
            const stageDurations = createSimulationParams().stageDurations;
            // Extreme overload
            const pipelineByStage: OraclePipelineByStage = {
                [CanonicalStage.SCREEN]: 100,
                [CanonicalStage.HM_SCREEN]: 2,
                [CanonicalStage.ONSITE]: 1,
                [CanonicalStage.OFFER]: 1
            };
            const capacityProfile = createCapacityProfile();

            const result = applyCapacityPenalty(stageDurations, pipelineByStage, capacityProfile);

            const screenDiag = result.stage_diagnostics.find(d => d.stage === CanonicalStage.SCREEN);
            expect(screenDiag?.queue_delay_days).toBeLessThanOrEqual(MAX_QUEUE_DELAY_DAYS);
        });
    });

    describe('createCapacityAdjustedParams', () => {
        it('adjusts lognormal distribution mu', () => {
            const baseParams = createSimulationParams();
            const stageDurations = baseParams.stageDurations;

            // Create penalty result with queue delay
            const pipelineByStage: OraclePipelineByStage = {
                [CanonicalStage.SCREEN]: 15,
                [CanonicalStage.HM_SCREEN]: 2,
                [CanonicalStage.ONSITE]: 1,
                [CanonicalStage.OFFER]: 1
            };
            const capacityProfile = createCapacityProfile();
            const penaltyResult = applyCapacityPenalty(stageDurations, pipelineByStage, capacityProfile);

            const adjustedParams = createCapacityAdjustedParams(baseParams, penaltyResult);

            // Screen should have adjusted mu
            const screenDist = adjustedParams.stageDurations[CanonicalStage.SCREEN];
            const originalDist = baseParams.stageDurations[CanonicalStage.SCREEN];

            if (screenDist.type === 'lognormal' && originalDist.type === 'lognormal') {
                // Adjusted mu should be higher (longer duration)
                expect(screenDist.mu!).toBeGreaterThan(originalDist.mu!);
            }
        });

        it('preserves original params for non-bottleneck stages', () => {
            const baseParams = createSimulationParams();

            // No bottlenecks
            const pipelineByStage: OraclePipelineByStage = {
                [CanonicalStage.SCREEN]: 3,
                [CanonicalStage.HM_SCREEN]: 2,
                [CanonicalStage.ONSITE]: 1,
                [CanonicalStage.OFFER]: 1
            };
            const capacityProfile = createCapacityProfile();
            const penaltyResult = applyCapacityPenalty(baseParams.stageDurations, pipelineByStage, capacityProfile);

            const adjustedParams = createCapacityAdjustedParams(baseParams, penaltyResult);

            // Conversion rates should be unchanged
            expect(adjustedParams.stageConversionRates).toEqual(baseParams.stageConversionRates);
        });
    });

    describe('getServiceRateForStage', () => {
        it('returns recruiter capacity for SCREEN', () => {
            const profile = createCapacityProfile();
            expect(getServiceRateForStage(CanonicalStage.SCREEN, profile)).toBe(8);
        });

        it('returns HM capacity for HM_SCREEN when available', () => {
            const profile = createCapacityProfile();
            // HM interviews_per_week takes precedence
            expect(getServiceRateForStage(CanonicalStage.HM_SCREEN, profile)).toBe(4);
        });

        it('falls back to cohort defaults when no individual data', () => {
            const profile = createCapacityProfile(null, null);
            expect(getServiceRateForStage(CanonicalStage.SCREEN, profile))
                .toBe(ORACLE_GLOBAL_CAPACITY_PRIORS.screens_per_week);
        });
    });

    describe('capacity-aware forecast produces later P50 under overload', () => {
        it('capacity penalty increases P50 date', () => {
            const stageDurations = createSimulationParams().stageDurations;

            // Under capacity - no delay
            const underCapacity: OraclePipelineByStage = {
                [CanonicalStage.SCREEN]: 3,
                [CanonicalStage.HM_SCREEN]: 2,
                [CanonicalStage.ONSITE]: 1,
                [CanonicalStage.OFFER]: 1
            };

            // Over capacity - should have delay
            const overCapacity: OraclePipelineByStage = {
                [CanonicalStage.SCREEN]: 20,
                [CanonicalStage.HM_SCREEN]: 10,
                [CanonicalStage.ONSITE]: 8,
                [CanonicalStage.OFFER]: 1
            };

            const capacityProfile = createCapacityProfile();

            const underResult = applyCapacityPenalty(stageDurations, underCapacity, capacityProfile);
            const overResult = applyCapacityPenalty(stageDurations, overCapacity, capacityProfile);

            expect(underResult.total_queue_delay_days).toBe(0);
            expect(overResult.total_queue_delay_days).toBeGreaterThan(0);
        });
    });

    // ===== v1.1 GLOBAL DEMAND TESTS =====

    describe('computeGlobalDemand (v1.1)', () => {
        // Helper to create mock candidates
        function createMockCandidate(
            id: string,
            reqId: string,
            stage: CanonicalStage,
            disposition: CandidateDisposition = CandidateDisposition.Active
        ): Candidate {
            return {
                candidate_id: id,
                req_id: reqId,
                name: `Candidate ${id}`,
                current_stage: stage,
                disposition,
                applied_at: new Date()
            };
        }

        // Helper to create mock requisitions
        function createMockRequisition(
            id: string,
            recruiterId: string | null,
            hmId: string | null,
            status: RequisitionStatus = RequisitionStatus.Open
        ): Requisition {
            return {
                req_id: id,
                title: `Req ${id}`,
                recruiter_id: recruiterId || undefined,
                hiring_manager_id: hmId || undefined,
                status,
                opened_at: new Date()
            };
        }

        // Helper to create mock users
        function createMockUser(id: string, name: string): User {
            return {
                user_id: id,
                name
            };
        }

        it('computes recruiter demand across all open reqs', () => {
            const candidates: Candidate[] = [
                // Req 1 candidates (selected req)
                createMockCandidate('c1', 'req-1', CanonicalStage.SCREEN),
                createMockCandidate('c2', 'req-1', CanonicalStage.HM_SCREEN),
                // Req 2 candidates (same recruiter)
                createMockCandidate('c3', 'req-2', CanonicalStage.SCREEN),
                createMockCandidate('c4', 'req-2', CanonicalStage.SCREEN),
                createMockCandidate('c5', 'req-2', CanonicalStage.ONSITE),
                // Req 3 candidates (different recruiter)
                createMockCandidate('c6', 'req-3', CanonicalStage.SCREEN)
            ];

            const requisitions: Requisition[] = [
                createMockRequisition('req-1', 'rec-001', 'hm-001'),
                createMockRequisition('req-2', 'rec-001', 'hm-002'),
                createMockRequisition('req-3', 'rec-002', 'hm-001')
            ];

            const users: User[] = [
                createMockUser('rec-001', 'Test Recruiter'),
                createMockUser('hm-001', 'Test HM')
            ];

            const input: OracleGlobalDemandInput = {
                selectedReqId: 'req-1',
                recruiterId: 'rec-001',
                hmId: 'hm-001',
                allCandidates: candidates,
                allRequisitions: requisitions,
                users
            };

            const result = computeGlobalDemand(input);

            // Recruiter demand should include req-1 and req-2 (same recruiter)
            // SCREEN: 1 (req-1) + 2 (req-2) = 3
            expect(result.recruiter_demand[CanonicalStage.SCREEN]).toBe(3);
            // ONSITE: 0 (req-1) + 1 (req-2) = 1
            expect(result.recruiter_demand[CanonicalStage.ONSITE]).toBe(1);

            // HM demand should include req-1 and req-3 (same HM)
            // HM_SCREEN: 1 (req-1) - only HM_SCREEN stage is HM-owned
            expect(result.hm_demand[CanonicalStage.HM_SCREEN]).toBe(1);

            // Context should reflect global workload
            expect(result.recruiter_context.open_req_count).toBe(2);
            expect(result.recruiter_context.total_candidates_in_flight).toBe(5); // 2 from req-1, 3 from req-2
            expect(result.hm_context.open_req_count).toBe(2); // req-1 and req-3
        });

        it('uses single_req scope when both IDs are missing', () => {
            const candidates: Candidate[] = [
                createMockCandidate('c1', 'req-1', CanonicalStage.SCREEN),
                createMockCandidate('c2', 'req-1', CanonicalStage.HM_SCREEN)
            ];

            const requisitions: Requisition[] = [
                createMockRequisition('req-1', null, null)
            ];

            const input: OracleGlobalDemandInput = {
                selectedReqId: 'req-1',
                recruiterId: null,
                hmId: null,
                allCandidates: candidates,
                allRequisitions: requisitions
            };

            const result = computeGlobalDemand(input);

            expect(result.demand_scope).toBe('single_req');
            expect(result.confidence).toBe('LOW');
            expect(result.confidence_reasons.some(r => r.message.includes('Both recruiter_id and hm_id missing'))).toBe(true);
        });

        it('excludes terminal candidates from demand', () => {
            const candidates: Candidate[] = [
                createMockCandidate('c1', 'req-1', CanonicalStage.SCREEN, CandidateDisposition.Active),
                createMockCandidate('c2', 'req-1', CanonicalStage.SCREEN, CandidateDisposition.Rejected),
                createMockCandidate('c3', 'req-1', CanonicalStage.SCREEN, CandidateDisposition.Hired)
            ];

            const requisitions: Requisition[] = [
                createMockRequisition('req-1', 'rec-001', 'hm-001')
            ];

            const input: OracleGlobalDemandInput = {
                selectedReqId: 'req-1',
                recruiterId: 'rec-001',
                hmId: 'hm-001',
                allCandidates: candidates,
                allRequisitions: requisitions
            };

            const result = computeGlobalDemand(input);

            // Only active candidate should be counted
            expect(result.recruiter_demand[CanonicalStage.SCREEN]).toBe(1);
        });

        it('sets LOW confidence when selected req has 0 pipeline', () => {
            const candidates: Candidate[] = [
                // Only candidates for other reqs
                createMockCandidate('c1', 'req-2', CanonicalStage.SCREEN)
            ];

            const requisitions: Requisition[] = [
                createMockRequisition('req-1', 'rec-001', 'hm-001'),
                createMockRequisition('req-2', 'rec-001', 'hm-001')
            ];

            const input: OracleGlobalDemandInput = {
                selectedReqId: 'req-1',
                recruiterId: 'rec-001',
                hmId: 'hm-001',
                allCandidates: candidates,
                allRequisitions: requisitions
            };

            const result = computeGlobalDemand(input);

            expect(result.confidence).toBe('LOW');
            expect(result.confidence_reasons.some(r => r.message.includes('0 active candidates'))).toBe(true);
        });

        it('sets HIGH confidence when both IDs present and has multiple reqs', () => {
            const candidates: Candidate[] = [
                createMockCandidate('c1', 'req-1', CanonicalStage.SCREEN),
                createMockCandidate('c2', 'req-2', CanonicalStage.SCREEN)
            ];

            const requisitions: Requisition[] = [
                createMockRequisition('req-1', 'rec-001', 'hm-001'),
                createMockRequisition('req-2', 'rec-001', 'hm-001')
            ];

            const input: OracleGlobalDemandInput = {
                selectedReqId: 'req-1',
                recruiterId: 'rec-001',
                hmId: 'hm-001',
                allCandidates: candidates,
                allRequisitions: requisitions
            };

            const result = computeGlobalDemand(input);

            expect(result.confidence).toBe('HIGH');
            expect(result.demand_scope).toBe('global_by_recruiter');
        });

        it('populates selected_req_pipeline correctly', () => {
            const candidates: Candidate[] = [
                createMockCandidate('c1', 'req-1', CanonicalStage.SCREEN),
                createMockCandidate('c2', 'req-1', CanonicalStage.HM_SCREEN),
                createMockCandidate('c3', 'req-1', CanonicalStage.OFFER),
                createMockCandidate('c4', 'req-2', CanonicalStage.SCREEN)
            ];

            const requisitions: Requisition[] = [
                createMockRequisition('req-1', 'rec-001', 'hm-001'),
                createMockRequisition('req-2', 'rec-001', 'hm-001')
            ];

            const input: OracleGlobalDemandInput = {
                selectedReqId: 'req-1',
                recruiterId: 'rec-001',
                hmId: 'hm-001',
                allCandidates: candidates,
                allRequisitions: requisitions
            };

            const result = computeGlobalDemand(input);

            // selected_req_pipeline should only include req-1 candidates
            expect(result.selected_req_pipeline[CanonicalStage.SCREEN]).toBe(1);
            expect(result.selected_req_pipeline[CanonicalStage.HM_SCREEN]).toBe(1);
            expect(result.selected_req_pipeline[CanonicalStage.OFFER]).toBe(1);
        });
    });

    describe('applyCapacityPenaltyV11', () => {
        // Helper to create mock candidates
        function createMockCandidate(
            id: string,
            reqId: string,
            stage: CanonicalStage,
            disposition: CandidateDisposition = CandidateDisposition.Active
        ): Candidate {
            return {
                candidate_id: id,
                req_id: reqId,
                name: `Candidate ${id}`,
                current_stage: stage,
                disposition,
                applied_at: new Date()
            };
        }

        // Helper to create mock requisitions
        function createMockRequisition(
            id: string,
            recruiterId: string | null,
            hmId: string | null,
            status: RequisitionStatus = RequisitionStatus.Open
        ): Requisition {
            return {
                req_id: id,
                title: `Req ${id}`,
                recruiter_id: recruiterId || undefined,
                hiring_manager_id: hmId || undefined,
                status,
                opened_at: new Date()
            };
        }

        it('uses global demand for penalty calculation', () => {
            const stageDurations = createSimulationParams().stageDurations;

            // Create global demand with overloaded SCREEN stage
            const candidates: Candidate[] = [
                // Selected req has few candidates
                createMockCandidate('c1', 'req-1', CanonicalStage.SCREEN),
                // But recruiter has many more on other reqs
                ...Array.from({ length: 15 }, (_, i) =>
                    createMockCandidate(`c${i + 2}`, 'req-2', CanonicalStage.SCREEN)
                )
            ];

            const requisitions: Requisition[] = [
                createMockRequisition('req-1', 'rec-001', 'hm-001'),
                createMockRequisition('req-2', 'rec-001', 'hm-002')
            ];

            const globalDemand = computeGlobalDemand({
                selectedReqId: 'req-1',
                recruiterId: 'rec-001',
                hmId: 'hm-001',
                allCandidates: candidates,
                allRequisitions: requisitions
            });

            const capacityProfile = createCapacityProfile();

            const result = applyCapacityPenaltyV11(stageDurations, globalDemand, capacityProfile);

            // Should have bottleneck because global demand (16) > capacity (8)
            expect(result.total_queue_delay_days).toBeGreaterThan(0);

            // Screen should be bottleneck
            const screenBottleneck = result.top_bottlenecks.find(b => b.stage === CanonicalStage.SCREEN);
            expect(screenBottleneck).toBeDefined();
            expect(screenBottleneck?.demand).toBe(16); // Global demand, not single req
            expect(screenBottleneck?.bottleneck_owner_type).toBe('recruiter');
        });

        it('generates recommendations for bottlenecks', () => {
            const stageDurations = createSimulationParams().stageDurations;

            // Create overloaded situation
            const candidates: Candidate[] = Array.from({ length: 20 }, (_, i) =>
                createMockCandidate(`c${i}`, 'req-1', CanonicalStage.SCREEN)
            );

            const requisitions: Requisition[] = [
                createMockRequisition('req-1', 'rec-001', 'hm-001'),
                createMockRequisition('req-2', 'rec-001', 'hm-001'),
                createMockRequisition('req-3', 'rec-001', 'hm-001'),
                createMockRequisition('req-4', 'rec-001', 'hm-001')
            ];

            const globalDemand = computeGlobalDemand({
                selectedReqId: 'req-1',
                recruiterId: 'rec-001',
                hmId: 'hm-001',
                allCandidates: candidates,
                allRequisitions: requisitions
            });

            const capacityProfile = createCapacityProfile();

            const result = applyCapacityPenaltyV11(stageDurations, globalDemand, capacityProfile);

            // Should have recommendations
            expect(result.recommendations.length).toBeGreaterThan(0);

            // Should have increase_throughput recommendation
            const throughputRec = result.recommendations.find(r => r.type === 'increase_throughput');
            expect(throughputRec).toBeDefined();
            expect(throughputRec?.estimated_impact_days).toBeGreaterThan(0);
        });

        it('sets LOW confidence when both IDs missing', () => {
            const stageDurations = createSimulationParams().stageDurations;

            const candidates: Candidate[] = [
                createMockCandidate('c1', 'req-1', CanonicalStage.SCREEN)
            ];

            const requisitions: Requisition[] = [
                createMockRequisition('req-1', null, null)
            ];

            const globalDemand = computeGlobalDemand({
                selectedReqId: 'req-1',
                recruiterId: null,
                hmId: null,
                allCandidates: candidates,
                allRequisitions: requisitions
            });

            const capacityProfile = createCapacityProfile(null, null);

            const result = applyCapacityPenaltyV11(stageDurations, globalDemand, capacityProfile);

            expect(result.confidence).toBe('LOW');
        });

        it('includes global_demand in result', () => {
            const stageDurations = createSimulationParams().stageDurations;

            const candidates: Candidate[] = [
                createMockCandidate('c1', 'req-1', CanonicalStage.SCREEN)
            ];

            const requisitions: Requisition[] = [
                createMockRequisition('req-1', 'rec-001', 'hm-001')
            ];

            const globalDemand = computeGlobalDemand({
                selectedReqId: 'req-1',
                recruiterId: 'rec-001',
                hmId: 'hm-001',
                allCandidates: candidates,
                allRequisitions: requisitions
            });

            const capacityProfile = createCapacityProfile();

            const result = applyCapacityPenaltyV11(stageDurations, globalDemand, capacityProfile);

            // Should include global demand context
            expect(result.global_demand).toBeDefined();
            expect(result.global_demand.demand_scope).toBe('global_by_recruiter');
            expect(result.global_demand.recruiter_context).toBeDefined();
        });

        it('attributes HM_SCREEN bottleneck to HM', () => {
            const stageDurations = createSimulationParams().stageDurations;

            // Create overloaded HM_SCREEN situation
            const candidates: Candidate[] = Array.from({ length: 10 }, (_, i) =>
                createMockCandidate(`c${i}`, 'req-1', CanonicalStage.HM_SCREEN)
            );

            const requisitions: Requisition[] = [
                createMockRequisition('req-1', 'rec-001', 'hm-001')
            ];

            const globalDemand = computeGlobalDemand({
                selectedReqId: 'req-1',
                recruiterId: 'rec-001',
                hmId: 'hm-001',
                allCandidates: candidates,
                allRequisitions: requisitions
            });

            // HM capacity of 4/week, demand of 10
            const capacityProfile = createCapacityProfile();

            const result = applyCapacityPenaltyV11(stageDurations, globalDemand, capacityProfile);

            const hmBottleneck = result.top_bottlenecks.find(b => b.stage === CanonicalStage.HM_SCREEN);
            expect(hmBottleneck).toBeDefined();
            expect(hmBottleneck?.bottleneck_owner_type).toBe('hm');
        });
    });
});
