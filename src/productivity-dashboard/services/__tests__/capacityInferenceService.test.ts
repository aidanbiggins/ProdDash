/**
 * Unit tests for capacityInferenceService.ts
 * Tests capacity inference from historical event data
 */

import { subWeeks, subDays, addDays } from 'date-fns';
import {
    inferCapacity,
    calculateCohortDefaults,
    buildStageCapacity,
    countStageTransitions
} from '../capacityInferenceService';
import { CanonicalStage, Event, Candidate, Requisition, User, EventType, UserRole, CandidateSource, CandidateDisposition, RequisitionStatus, HeadcountType, LocationType, LocationRegion } from '../../types';
import { OracleInferCapacityInput, ORACLE_CAPACITY_CONSTANTS } from '../../types/capacityTypes';

// ===== TEST FIXTURES =====

const NOW = new Date('2024-01-15');
const RECRUITER_ID = 'rec-001';
const HM_ID = 'hm-001';
const REQ_ID = 'req-001';

function createEvent(
    overrides: Partial<Event> & { event_at: Date; event_type: EventType }
): Event {
    return {
        event_id: `evt-${Math.random().toString(36).substr(2, 9)}`,
        candidate_id: `cand-${Math.random().toString(36).substr(2, 9)}`,
        req_id: REQ_ID,
        from_stage: null,
        to_stage: null,
        actor_user_id: RECRUITER_ID,
        metadata_json: null,
        ...overrides
    };
}

function createCandidate(overrides: Partial<Candidate> = {}): Candidate {
    return {
        candidate_id: `cand-${Math.random().toString(36).substr(2, 9)}`,
        name: 'Test Candidate',
        req_id: REQ_ID,
        source: CandidateSource.Inbound,
        applied_at: subWeeks(NOW, 2),
        first_contacted_at: subWeeks(NOW, 1),
        current_stage: CanonicalStage.SCREEN,
        current_stage_entered_at: NOW,
        disposition: CandidateDisposition.Active,
        hired_at: null,
        offer_extended_at: null,
        offer_accepted_at: null,
        ...overrides
    };
}

function createRequisition(overrides: Partial<Requisition> = {}): Requisition {
    return {
        req_id: REQ_ID,
        req_title: 'Test Req',
        function: 'Engineering',
        job_family: 'Software',
        level: 'L4',
        location_type: LocationType.Remote,
        location_region: LocationRegion.AMER,
        location_city: null,
        comp_band_min: null,
        comp_band_max: null,
        opened_at: subWeeks(NOW, 4),
        closed_at: null,
        status: RequisitionStatus.Open,
        hiring_manager_id: HM_ID,
        recruiter_id: RECRUITER_ID,
        business_unit: null,
        headcount_type: HeadcountType.New,
        priority: null,
        candidate_slate_required: false,
        search_firm_used: false,
        ...overrides
    };
}

function createUser(id: string, role: UserRole, name: string = 'Test User'): User {
    return {
        user_id: id,
        name,
        role,
        team: null,
        manager_user_id: null,
        email: null
    };
}

// Generate events for N weeks with transitions per week
function generateWeeklyEvents(
    weeksBack: number,
    transitionsPerWeek: number,
    stage: CanonicalStage
): Event[] {
    const events: Event[] = [];
    for (let week = 0; week < weeksBack; week++) {
        for (let i = 0; i < transitionsPerWeek; i++) {
            events.push(createEvent({
                event_at: subWeeks(NOW, week),
                event_type: EventType.STAGE_CHANGE,
                to_stage: stage
            }));
        }
    }
    return events;
}

// ===== TEST SUITES =====

describe('capacityInferenceService', () => {
    describe('countStageTransitions', () => {
        it('counts stage transitions correctly', () => {
            const events: Event[] = [
                createEvent({ event_at: NOW, event_type: EventType.STAGE_CHANGE, to_stage: CanonicalStage.SCREEN }),
                createEvent({ event_at: NOW, event_type: EventType.STAGE_CHANGE, to_stage: CanonicalStage.SCREEN }),
                createEvent({ event_at: NOW, event_type: EventType.STAGE_CHANGE, to_stage: CanonicalStage.HM_SCREEN }),
                createEvent({ event_at: NOW, event_type: EventType.FEEDBACK_SUBMITTED }),
            ];

            expect(countStageTransitions(events, CanonicalStage.SCREEN)).toBe(2);
            expect(countStageTransitions(events, CanonicalStage.HM_SCREEN)).toBe(1);
            expect(countStageTransitions(events, CanonicalStage.ONSITE)).toBe(0);
        });

        it('returns 0 for empty events', () => {
            expect(countStageTransitions([], CanonicalStage.SCREEN)).toBe(0);
        });
    });

    describe('buildStageCapacity', () => {
        it('returns correct throughput for sufficient data', () => {
            const transitions = 40; // 40 transitions
            const weeksAnalyzed = 8; // 8 weeks
            const priorThroughput = 5;

            const result = buildStageCapacity(
                CanonicalStage.SCREEN,
                transitions,
                weeksAnalyzed,
                priorThroughput
            );

            // Observed: 40/8 = 5 per week
            // With shrinkage toward 5, should stay around 5
            expect(result.throughput_per_week).toBeCloseTo(5, 1);
            expect(result.n_weeks).toBe(8);
            expect(result.n_transitions).toBe(40);
            expect(result.confidence).toBe('HIGH');
        });

        it('applies shrinkage for small sample sizes', () => {
            const transitions = 4; // Only 4 transitions
            const weeksAnalyzed = 2; // 2 weeks
            const priorThroughput = 8; // Prior is 8/week

            const result = buildStageCapacity(
                CanonicalStage.SCREEN,
                transitions,
                weeksAnalyzed,
                priorThroughput
            );

            // Observed: 4/2 = 2 per week
            // With shrinkage toward 8, should be pulled up
            expect(result.throughput_per_week).toBeGreaterThan(2);
            expect(result.throughput_per_week).toBeLessThan(8);
            expect(result.confidence).toBe('LOW');
        });

        it('returns LOW confidence for insufficient data', () => {
            const result = buildStageCapacity(
                CanonicalStage.SCREEN,
                2, // Very few transitions
                2, // Few weeks
                8
            );

            expect(result.confidence).toBe('LOW');
        });

        it('returns MED confidence for moderate data', () => {
            const result = buildStageCapacity(
                CanonicalStage.SCREEN,
                10, // Moderate transitions
                5, // 5 weeks
                8
            );

            expect(result.confidence).toBe('MED');
        });
    });

    describe('inferCapacity', () => {
        it('returns recruiter capacity when data exists', () => {
            const events = generateWeeklyEvents(8, 5, CanonicalStage.SCREEN);
            const requisitions = [createRequisition()];
            const candidates = [createCandidate()];
            const users = [
                createUser(RECRUITER_ID, UserRole.Recruiter, 'Test Recruiter'),
                createUser(HM_ID, UserRole.HiringManager, 'Test HM')
            ];

            const input: OracleInferCapacityInput = {
                reqId: REQ_ID,
                recruiterId: RECRUITER_ID,
                hmId: HM_ID,
                dateRange: { start: subWeeks(NOW, 12), end: NOW },
                events,
                candidates,
                requisitions,
                users
            };

            const result = inferCapacity(input);

            expect(result.recruiter).not.toBeNull();
            expect(result.recruiter?.recruiter_id).toBe(RECRUITER_ID);
            expect(result.recruiter?.recruiter_name).toBe('Test Recruiter');
            expect(result.recruiter?.screens_per_week.throughput_per_week).toBeGreaterThan(0);
        });

        it('returns null recruiter capacity when no reqs for recruiter', () => {
            const events = generateWeeklyEvents(8, 5, CanonicalStage.SCREEN);
            const requisitions: Requisition[] = []; // No reqs
            const candidates: Candidate[] = [];

            const input: OracleInferCapacityInput = {
                reqId: REQ_ID,
                recruiterId: RECRUITER_ID,
                hmId: HM_ID,
                dateRange: { start: subWeeks(NOW, 12), end: NOW },
                events,
                candidates,
                requisitions
            };

            const result = inferCapacity(input);

            expect(result.recruiter).toBeNull();
            expect(result.used_cohort_fallback).toBe(true);
        });

        it('falls back to cohort defaults when individual data insufficient', () => {
            const events: Event[] = []; // No events
            const requisitions = [createRequisition()];
            const candidates: Candidate[] = [];

            const input: OracleInferCapacityInput = {
                reqId: REQ_ID,
                recruiterId: RECRUITER_ID,
                hmId: HM_ID,
                dateRange: { start: subWeeks(NOW, 12), end: NOW },
                events,
                candidates,
                requisitions
            };

            const result = inferCapacity(input);

            // Should still have cohort defaults
            expect(result.cohort_defaults.screens_per_week).toBeGreaterThan(0);
            expect(result.overall_confidence).toBe('LOW');
        });

        it('includes confidence reasons', () => {
            const events = generateWeeklyEvents(2, 2, CanonicalStage.SCREEN);
            const requisitions = [createRequisition()];
            const candidates = [createCandidate()];

            const input: OracleInferCapacityInput = {
                reqId: REQ_ID,
                recruiterId: RECRUITER_ID,
                hmId: HM_ID,
                dateRange: { start: subWeeks(NOW, 12), end: NOW },
                events,
                candidates,
                requisitions
            };

            const result = inferCapacity(input);

            expect(result.confidence_reasons.length).toBeGreaterThan(0);
            expect(result.confidence_reasons.some(r => r.type === 'sample_size')).toBe(true);
        });
    });

    describe('calculateCohortDefaults', () => {
        it('calculates reasonable defaults from event data', () => {
            const events = [
                ...generateWeeklyEvents(8, 10, CanonicalStage.SCREEN),
                ...generateWeeklyEvents(8, 5, CanonicalStage.HM_SCREEN),
                ...generateWeeklyEvents(8, 3, CanonicalStage.ONSITE),
            ];

            const dateRange = { start: subWeeks(NOW, 12), end: NOW };
            const result = calculateCohortDefaults(events, [], dateRange);

            expect(result.screens_per_week).toBeGreaterThan(0);
            expect(result.hm_screens_per_week).toBeGreaterThan(0);
            expect(result.onsites_per_week).toBeGreaterThan(0);
        });

        it('returns global priors when no data', () => {
            const dateRange = { start: subWeeks(NOW, 12), end: NOW };
            const result = calculateCohortDefaults([], [], dateRange);

            // Should use global priors
            expect(result.screens_per_week).toBeGreaterThan(0);
            expect(result.sample_sizes.weeks).toBeGreaterThan(0);
        });
    });

    describe('HM capacity inference', () => {
        it('infers HM capacity from interview events', () => {
            const events = generateWeeklyEvents(8, 4, CanonicalStage.HM_SCREEN);
            const requisitions = [createRequisition()];
            const candidates = [createCandidate()];

            const input: OracleInferCapacityInput = {
                reqId: REQ_ID,
                recruiterId: RECRUITER_ID,
                hmId: HM_ID,
                dateRange: { start: subWeeks(NOW, 12), end: NOW },
                events,
                candidates,
                requisitions
            };

            const result = inferCapacity(input);

            expect(result.hm).not.toBeNull();
            expect(result.hm?.hm_id).toBe(HM_ID);
        });

        it('returns null HM capacity when no HM reqs', () => {
            const events = generateWeeklyEvents(8, 4, CanonicalStage.HM_SCREEN);
            // No reqs for this HM
            const requisitions = [createRequisition({ hiring_manager_id: 'other-hm' })];
            const candidates: Candidate[] = [];

            const input: OracleInferCapacityInput = {
                reqId: REQ_ID,
                recruiterId: RECRUITER_ID,
                hmId: HM_ID,
                dateRange: { start: subWeeks(NOW, 12), end: NOW },
                events,
                candidates,
                requisitions
            };

            const result = inferCapacity(input);

            expect(result.hm).toBeNull();
        });
    });
});
