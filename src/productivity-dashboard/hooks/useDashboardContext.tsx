// Dashboard Context and State Management

import React, { createContext, useContext, useReducer, useCallback, ReactNode, useEffect, useRef } from 'react';
import { subDays, differenceInDays } from 'date-fns';
import {
  DataStore,
  DashboardState,
  MetricFilters,
  OverviewMetrics,
  RecruiterSummary,
  HiringManagerFriction,
  QualityMetrics,
  WeeklyTrend,
  Requisition,
  Candidate,
  Event,
  User,
  DataHealth,
  LoadingState,
  BackgroundOperation,
  OperationPhase,
  createInitialLoadingState,
  calculateOverallProgress
} from '../types';
import { DEFAULT_CONFIG, DashboardConfig } from '../types/config';
import {
  importCsvData,
  extractAllStages,
  autoSuggestMappings,
  createStageMappingConfig,
  normalizeEventStages,
  calculateOverviewMetrics,
  calculateRecruiterSummary,
  calculateWeeklyTrends,
  calculateHMFrictionMetrics,
  createHMWeightsMap,
  calculateAllComplexityScores,
  calculateQualityMetrics,
  calculateDataHealth,
  generateEventsFromCandidates,
  isEventGenerationNeeded,
  EventGenerationProgress
} from '../services';
import { fetchDashboardData, persistDashboardData, clearAllData } from '../services/dbService';
import { useAuth } from '../../contexts/AuthContext';

// Utility to yield to browser and allow UI updates
const yieldToBrowser = () => new Promise<void>(resolve => setTimeout(resolve, 0));

// ===== ACTION TYPES =====

type DashboardAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'IMPORT_DATA'; payload: { requisitions: Requisition[]; candidates: Candidate[]; events: Event[]; users: User[]; isDemo?: boolean } }
  | { type: 'ADD_EVENTS'; payload: Event[] }
  | { type: 'SET_CONFIG'; payload: DashboardConfig }
  | { type: 'SET_FILTERS'; payload: Partial<MetricFilters> }
  | { type: 'SET_OVERVIEW'; payload: OverviewMetrics }
  | { type: 'SELECT_RECRUITER'; payload: string | null }
  | { type: 'SET_RECRUITER_DETAIL'; payload: RecruiterSummary | null }
  | { type: 'SET_HM_FRICTION'; payload: HiringManagerFriction[] }
  | { type: 'SET_QUALITY_METRICS'; payload: QualityMetrics }
  | { type: 'SET_WEEKLY_TRENDS'; payload: WeeklyTrend[] }
  | { type: 'SET_DATA_HEALTH'; payload: DataHealth }
  | { type: 'RESET' }
  // Loading state actions
  | { type: 'START_OPERATION'; payload: { id: string; phase: OperationPhase; label: string; total: number } }
  | { type: 'UPDATE_OPERATION'; payload: { id: string; current: number; total?: number } }
  | { type: 'COMPLETE_OPERATION'; payload: { id: string } }
  | { type: 'FAIL_OPERATION'; payload: { id: string; error: string } }
  | { type: 'CLEAR_OPERATIONS' }
  | { type: 'SET_DATA_READY'; payload: Partial<LoadingState> };

// ===== INITIAL STATE =====

const defaultFilters: MetricFilters = {
  dateRange: {
    startDate: subDays(new Date(), 90),
    endDate: new Date()
  },
  useWeighted: false,
  normalizeByLoad: false
};

const initialState: DashboardState = {
  dataStore: {
    requisitions: [],
    candidates: [],
    events: [],
    users: [],
    config: DEFAULT_CONFIG,
    dataHealth: {
      candidatesMissingFirstContact: { count: 0, percentage: 0 },
      eventsMissingActor: { count: 0, percentage: 0 },
      reqsMissingLevel: { count: 0, percentage: 0 },
      reqsMissingJobFamily: { count: 0, percentage: 0 },
      unmappedStagesCount: 0,
      overallHealthScore: 100,
      lowConfidenceMetrics: []
    },
    lastImportAt: null,
    importSource: null
  },
  filters: defaultFilters,
  overview: null,
  selectedRecruiterId: null,
  recruiterDetail: null,
  hmFriction: [],
  qualityMetrics: null,
  weeklyTrends: [],
  isLoading: false,
  loadingState: createInitialLoadingState(),
  error: null
};

// ===== REDUCER =====

function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };

    case 'IMPORT_DATA':
      return {
        ...state,
        dataStore: {
          ...state.dataStore,
          requisitions: action.payload.requisitions,
          candidates: action.payload.candidates,
          events: action.payload.events,
          users: action.payload.users,
          lastImportAt: new Date(),
          importSource: action.payload.isDemo ? 'demo' : 'csv'
        },
        // Set loading state flags for base data
        loadingState: {
          ...state.loadingState,
          hasBaseData: action.payload.requisitions.length > 0 || action.payload.candidates.length > 0,
          hasEvents: action.payload.events.length > 0,
          // Reset metric flags since we'll need to recalculate
          hasOverviewMetrics: false,
          hasRecruiterMetrics: false,
          hasHMMetrics: false,
          hasQualityMetrics: false,
          hasTrendMetrics: false,
          isFullyReady: false,
          overallProgress: 0
        }
      };

    case 'ADD_EVENTS':
      return {
        ...state,
        dataStore: {
          ...state.dataStore,
          events: [...state.dataStore.events, ...action.payload],
          lastImportAt: new Date() // Trigger metrics recalculation
        }
      };

    case 'SET_CONFIG':
      return {
        ...state,
        dataStore: {
          ...state.dataStore,
          config: action.payload
        }
      };

    case 'SET_FILTERS':
      return {
        ...state,
        filters: { ...state.filters, ...action.payload }
      };

    case 'SET_OVERVIEW':
      return { ...state, overview: action.payload };

    case 'SELECT_RECRUITER':
      return { ...state, selectedRecruiterId: action.payload };

    case 'SET_RECRUITER_DETAIL':
      return { ...state, recruiterDetail: action.payload };

    case 'SET_HM_FRICTION':
      return { ...state, hmFriction: action.payload };

    case 'SET_QUALITY_METRICS':
      return { ...state, qualityMetrics: action.payload };

    case 'SET_WEEKLY_TRENDS':
      return { ...state, weeklyTrends: action.payload };

    case 'SET_DATA_HEALTH':
      return {
        ...state,
        dataStore: {
          ...state.dataStore,
          dataHealth: action.payload
        }
      };

    case 'RESET':
      return initialState;

    // Loading state actions
    case 'START_OPERATION': {
      const newOp: BackgroundOperation = {
        id: action.payload.id,
        phase: action.payload.phase,
        label: action.payload.label,
        current: 0,
        total: action.payload.total,
        startTime: Date.now(),
        status: 'running'
      };
      const operations = [...state.loadingState.operations, newOp];
      return {
        ...state,
        loadingState: {
          ...state.loadingState,
          operations,
          overallProgress: calculateOverallProgress(operations),
          isFullyReady: false
        }
      };
    }

    case 'UPDATE_OPERATION': {
      const operations = state.loadingState.operations.map(op =>
        op.id === action.payload.id
          ? { ...op, current: action.payload.current, total: action.payload.total ?? op.total }
          : op
      );
      return {
        ...state,
        loadingState: {
          ...state.loadingState,
          operations,
          overallProgress: calculateOverallProgress(operations)
        }
      };
    }

    case 'COMPLETE_OPERATION': {
      const operations = state.loadingState.operations.map(op =>
        op.id === action.payload.id
          ? { ...op, status: 'complete' as const, current: op.total }
          : op
      );
      const allComplete = operations.every(op => op.status === 'complete');
      return {
        ...state,
        loadingState: {
          ...state.loadingState,
          operations,
          overallProgress: calculateOverallProgress(operations),
          isFullyReady: allComplete
        }
      };
    }

    case 'FAIL_OPERATION': {
      const operations = state.loadingState.operations.map(op =>
        op.id === action.payload.id
          ? { ...op, status: 'error' as const, error: action.payload.error }
          : op
      );
      return {
        ...state,
        loadingState: {
          ...state.loadingState,
          operations,
          overallProgress: calculateOverallProgress(operations)
        }
      };
    }

    case 'CLEAR_OPERATIONS':
      return {
        ...state,
        loadingState: {
          ...state.loadingState,
          operations: [],
          overallProgress: 0
        }
      };

    case 'SET_DATA_READY': {
      const newLoadingState = {
        ...state.loadingState,
        ...action.payload
      };
      // Calculate progress based on completed flags
      const flagsToCheck = [
        newLoadingState.hasBaseData,
        newLoadingState.hasEvents,
        newLoadingState.hasOverviewMetrics,
        newLoadingState.hasHMMetrics,
        newLoadingState.hasQualityMetrics,
        newLoadingState.hasTrendMetrics
      ];
      const completedFlags = flagsToCheck.filter(Boolean).length;
      const overallProgress = Math.round((completedFlags / flagsToCheck.length) * 100);
      const isFullyReady = completedFlags === flagsToCheck.length;

      return {
        ...state,
        loadingState: {
          ...newLoadingState,
          isFullyReady,
          overallProgress
        }
      };
    }

    default:
      return state;
  }
}

// ===== CONTEXT =====

// Progress info for database persistence
export interface PersistenceProgress {
  phase: 'generating' | 'persisting';
  current: number;
  total: number;
  eventsGenerated: number;
  startTime: number;
}

interface DashboardContextType {
  state: DashboardState;
  importCSVs: (requisitionsCsv: string, candidatesCsv: string, eventsCsv: string, usersCsv: string, isDemo?: boolean) => Promise<{ success: boolean; errors: string[] }>;
  updateConfig: (config: DashboardConfig) => void;
  updateFilters: (filters: Partial<MetricFilters>) => void;
  selectRecruiter: (recruiterId: string | null) => void;
  refreshMetrics: () => void;
  reset: () => void;
  clearPersistedData: () => Promise<{ success: boolean; error?: string }>;
  generateEvents: (
    onProgress?: (progress: EventGenerationProgress) => void,
    onPersistProgress?: (progress: PersistenceProgress) => void
  ) => Promise<{ success: boolean; eventsGenerated: number; error?: string }>;
  needsEventGeneration: boolean;
  canImportData: boolean;
  // Loading state helpers
  startOperation: (id: string, phase: OperationPhase, label: string, total: number) => void;
  updateOperation: (id: string, current: number, total?: number) => void;
  completeOperation: (id: string) => void;
  failOperation: (id: string, error: string) => void;
  clearOperations: () => void;
  setDataReady: (flags: Partial<LoadingState>) => void;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

// ===== PROVIDER =====

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);
  const { currentOrg, canImportData } = useAuth();

  // Helper to get/set import source from localStorage
  const getStoredImportSource = (orgId: string): 'demo' | 'csv' | null => {
    try {
      const stored = localStorage.getItem(`importSource_${orgId}`);
      return stored === 'demo' || stored === 'csv' ? stored : null;
    } catch {
      return null;
    }
  };

  const setStoredImportSource = (orgId: string, source: 'demo' | 'csv') => {
    try {
      localStorage.setItem(`importSource_${orgId}`, source);
    } catch {
      // Ignore localStorage errors
    }
  };

  // Load data when org changes
  useEffect(() => {
    async function loadOrgData() {
      if (!currentOrg?.id) {
        // No org selected - reset to empty state
        dispatch({ type: 'RESET' });
        return;
      }

      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const data = await fetchDashboardData(currentOrg.id);
        if (data.requisitions.length > 0) {
          // Check if this org's data was originally demo data
          const storedSource = getStoredImportSource(currentOrg.id);
          const isDemo = storedSource === 'demo';

          dispatch({
            type: 'IMPORT_DATA',
            payload: {
              requisitions: data.requisitions,
              candidates: data.candidates,
              events: data.events,
              users: data.users,
              isDemo
            }
          });
        } else {
          // Org has no data yet
          dispatch({ type: 'RESET' });
        }
      } catch (err) {
        console.error('Failed to load data from Supabase:', err);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to load organization data' });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }
    loadOrgData();
  }, [currentOrg?.id]);

  const importCSVs = useCallback(async (
    requisitionsCsv: string,
    candidatesCsv: string,
    eventsCsv: string,
    usersCsv: string,
    isDemo: boolean = false
  ): Promise<{ success: boolean; errors: string[] }> => {
    // Check permissions - only admins can import
    if (!isDemo && !canImportData) {
      return { success: false, errors: ['Only organization admins can import data'] };
    }

    // Check org is selected
    if (!isDemo && !currentOrg?.id) {
      return { success: false, errors: ['No organization selected. Please create or join an organization first.'] };
    }

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const result = importCsvData(requisitionsCsv, candidatesCsv, eventsCsv, usersCsv);

      if (!result.isValid) {
        dispatch({ type: 'SET_ERROR', payload: result.criticalErrors.join('; ') });
        return { success: false, errors: result.criticalErrors };
      }

      // Persist to Supabase (including demo data so it survives org switches)
      if (currentOrg?.id) {
        await persistDashboardData(
          result.requisitions.data,
          result.candidates.data,
          result.events.data,
          result.users.data,
          currentOrg.id
        );
        // Store import source in localStorage so we know if it was demo data on reload
        setStoredImportSource(currentOrg.id, isDemo ? 'demo' : 'csv');
      }

      dispatch({
        type: 'IMPORT_DATA',
        payload: {
          requisitions: result.requisitions.data,
          candidates: result.candidates.data,
          events: result.events.data,
          users: result.users.data,
          isDemo
        }
      });

      // Auto-detect and suggest stage mappings
      const allStages = extractAllStages(result.candidates.data, result.events.data);
      const suggestions = autoSuggestMappings(allStages);
      const stageMappingConfig = createStageMappingConfig(suggestions, allStages);

      const newConfig: DashboardConfig = {
        ...DEFAULT_CONFIG,
        stageMapping: stageMappingConfig,
        lastUpdated: new Date(),
        lastUpdatedBy: 'system'
      };

      dispatch({ type: 'SET_CONFIG', payload: newConfig });

      // Calculate data health
      const dataHealth = calculateDataHealth(
        result.requisitions.data,
        result.candidates.data,
        result.events.data,
        result.users.data,
        newConfig
      );
      dispatch({ type: 'SET_DATA_HEALTH', payload: dataHealth });

      dispatch({ type: 'SET_LOADING', payload: false });

      return { success: true, errors: [] };
    } catch (error: any) {
      console.error('Import failed:', error);
      let message = 'Unknown error during import';

      if (error?.code === '42501') {
        message = 'Database Permission Error (RLS). Please run the SQL fix provided to allow imports while using the dev bypass.';
      } else if (error?.status === 401 || error?.message?.includes('Unauthorized')) {
        message = 'Unauthorized: Your session may have expired or the database requires a real login instead of the dev bypass.';
      } else if (error instanceof Error) {
        message = error.message;
      }

      dispatch({ type: 'SET_ERROR', payload: message });
      return { success: false, errors: [message] };
    }
  }, [canImportData, currentOrg?.id]);

  // Debounce timer ref
  const metricsDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Effect to recalculate metrics when dataStore changes (DEBOUNCED for performance)
  useEffect(() => {
    if (state.dataStore.requisitions.length === 0) return;

    // Clear any pending calculation
    if (metricsDebounceRef.current) {
      clearTimeout(metricsDebounceRef.current);
    }

    // Show loading state immediately
    dispatch({ type: 'SET_LOADING', payload: true });

    // Debounce the actual calculation (300ms delay)
    metricsDebounceRef.current = setTimeout(() => {
      // Use requestAnimationFrame to let UI update before heavy calculation
      requestAnimationFrame(async () => {
        console.time('[Metrics] Total calculation time');
        await refreshMetricsInternal();
        console.timeEnd('[Metrics] Total calculation time');
        dispatch({ type: 'SET_LOADING', payload: false });
      });
    }, 300);

    return () => {
      if (metricsDebounceRef.current) {
        clearTimeout(metricsDebounceRef.current);
      }
    };
  }, [state.dataStore.lastImportAt, state.filters, state.dataStore.config, state.selectedRecruiterId]);

  const updateConfig = useCallback((config: DashboardConfig) => {
    dispatch({ type: 'SET_CONFIG', payload: config });
  }, []);

  const updateFilters = useCallback((filters: Partial<MetricFilters>) => {
    dispatch({ type: 'SET_FILTERS', payload: filters });
  }, []);

  const selectRecruiter = useCallback((recruiterId: string | null) => {
    dispatch({ type: 'SELECT_RECRUITER', payload: recruiterId });
  }, []);

  // Internal async function for non-blocking metric calculations
  const refreshMetricsInternal = async () => {
    const { requisitions, candidates, events, users, config } = state.dataStore;
    const normalizedEvents = normalizeEventStages(events, config.stageMapping);

    // Start tracking operations
    dispatch({ type: 'CLEAR_OPERATIONS' });
    dispatch({ type: 'START_OPERATION', payload: { id: 'hm-metrics', phase: 'calculating-hm', label: 'Analyzing hiring managers', total: 1 } });
    dispatch({ type: 'START_OPERATION', payload: { id: 'overview-metrics', phase: 'calculating-overview', label: 'Calculating overview metrics', total: 1 } });
    dispatch({ type: 'START_OPERATION', payload: { id: 'quality-metrics', phase: 'calculating-quality', label: 'Computing quality metrics', total: 1 } });
    dispatch({ type: 'START_OPERATION', payload: { id: 'trend-metrics', phase: 'calculating-trends', label: 'Building trend data', total: 1 } });

    // Yield to allow UI to show operations
    await yieldToBrowser();

    // Calculate HM friction first (needed for weights)
    const hmFriction = calculateHMFrictionMetrics(requisitions, events, users, state.filters, config);
    dispatch({ type: 'SET_HM_FRICTION', payload: hmFriction });
    dispatch({ type: 'COMPLETE_OPERATION', payload: { id: 'hm-metrics' } });
    dispatch({ type: 'SET_DATA_READY', payload: { hasHMMetrics: true } });

    // Yield before next heavy calculation
    await yieldToBrowser();

    const hmWeights = createHMWeightsMap(hmFriction);
    const complexityScores = calculateAllComplexityScores(requisitions, hmWeights, config);

    // Calculate overview
    const overview = calculateOverviewMetrics(
      requisitions,
      candidates,
      events,
      normalizedEvents,
      users,
      state.filters,
      config,
      complexityScores,
      hmWeights
    );

    // Calculate prior period metrics for comparison
    const currentRange = state.filters.dateRange;
    const periodDays = differenceInDays(currentRange.endDate, currentRange.startDate);

    if (periodDays > 0 && periodDays <= 365) {
      const priorEndDate = subDays(currentRange.startDate, 1);
      const priorStartDate = subDays(priorEndDate, periodDays);

      const priorFilters: MetricFilters = {
        ...state.filters,
        dateRange: { startDate: priorStartDate, endDate: priorEndDate }
      };

      const priorOverview = calculateOverviewMetrics(
        requisitions,
        candidates,
        events,
        normalizedEvents,
        users,
        priorFilters,
        config,
        complexityScores,
        hmWeights
      );

      // Determine label based on period length
      let periodLabel = 'prior period';
      if (periodDays <= 31) periodLabel = `prior ${periodDays + 1}d`;
      else if (periodDays <= 95) periodLabel = 'prior qtr';
      else if (periodDays <= 185) periodLabel = 'prior 6mo';
      else periodLabel = 'prior year';

      overview.priorPeriod = {
        hires: priorOverview.totalHires,
        weightedHires: priorOverview.totalWeightedHires,
        offers: priorOverview.totalOffers,
        label: periodLabel
      };

      // Calculate per-recruiter prior periods
      overview.recruiterPriorPeriods = {};
      priorOverview.recruiterSummaries.forEach(r => {
        if (overview.recruiterPriorPeriods) {
          overview.recruiterPriorPeriods[r.recruiterId] = {
            hires: r.outcomes.hires,
            weightedHires: r.weighted.weightedHires,
            offers: r.outcomes.offersExtended,
            label: periodLabel
          };
        }
      });
    }

    dispatch({ type: 'SET_OVERVIEW', payload: overview });
    dispatch({ type: 'COMPLETE_OPERATION', payload: { id: 'overview-metrics' } });
    dispatch({ type: 'SET_DATA_READY', payload: { hasOverviewMetrics: true, hasRecruiterMetrics: true } });

    // Yield before trends calculation
    await yieldToBrowser();

    // Calculate weekly trends (with complexity scores for productivity)
    const trends = calculateWeeklyTrends(candidates, events, requisitions, state.filters, complexityScores);
    dispatch({ type: 'SET_WEEKLY_TRENDS', payload: trends });
    dispatch({ type: 'COMPLETE_OPERATION', payload: { id: 'trend-metrics' } });
    dispatch({ type: 'SET_DATA_READY', payload: { hasTrendMetrics: true } });

    // Yield before quality calculation
    await yieldToBrowser();

    // Calculate quality metrics
    const quality = calculateQualityMetrics(
      requisitions,
      candidates,
      events,
      users,
      state.filters,
      config
    );
    dispatch({ type: 'SET_QUALITY_METRICS', payload: quality });
    dispatch({ type: 'COMPLETE_OPERATION', payload: { id: 'quality-metrics' } });
    dispatch({ type: 'SET_DATA_READY', payload: { hasQualityMetrics: true } });

    // Refresh recruiter detail if one is selected
    if (state.selectedRecruiterId) {
      await yieldToBrowser();
      const detail = calculateRecruiterSummary(
        state.selectedRecruiterId,
        requisitions,
        candidates,
        events,
        normalizedEvents,
        users,
        state.filters,
        config,
        complexityScores,
        hmWeights
      );
      dispatch({ type: 'SET_RECRUITER_DETAIL', payload: detail });
    } else {
      dispatch({ type: 'SET_RECRUITER_DETAIL', payload: null });
    }
  };

  const refreshMetrics = useCallback(() => {
    refreshMetricsInternal();
  }, [state.dataStore, state.filters, state.selectedRecruiterId]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const clearPersistedData = useCallback(async () => {
    // Check permissions
    if (!canImportData) {
      return { success: false, error: 'Only organization admins can clear data' };
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await clearAllData(currentOrg?.id);
      dispatch({ type: 'RESET' });
      dispatch({ type: 'SET_LOADING', payload: false });
      return { success: true };
    } catch (error: any) {
      console.error('Clear data failed:', error);
      const message = error instanceof Error ? error.message : 'Unknown error clearing data';
      dispatch({ type: 'SET_ERROR', payload: message });
      dispatch({ type: 'SET_LOADING', payload: false });
      return { success: false, error: message };
    }
  }, [canImportData, currentOrg?.id]);

  // Generate events from existing candidates
  const generateEvents = useCallback(async (
    onProgress?: (progress: EventGenerationProgress) => void,
    onPersistProgress?: (progress: PersistenceProgress) => void
  ): Promise<{ success: boolean; eventsGenerated: number; error?: string }> => {
    const { candidates, events, requisitions } = state.dataStore;

    if (candidates.length === 0) {
      return { success: false, eventsGenerated: 0, error: 'No candidates to generate events from' };
    }

    const startTime = Date.now();
    console.log(`[Event Generation] Starting for ${candidates.length} candidates...`);

    // Report generation phase
    onPersistProgress?.({ phase: 'generating', current: 0, total: candidates.length, eventsGenerated: 0, startTime });

    try {
      // Pass requisitions for HM attribution in event generation
      const result = await generateEventsFromCandidates(candidates, requisitions, (progress) => {
        onProgress?.(progress);
        onPersistProgress?.({ phase: 'generating', current: progress.processed, total: progress.total, eventsGenerated: progress.eventsGenerated, startTime });
      });
      console.log(`[Event Generation] Generated ${result.stats.eventsGenerated} events`);
      console.log('[Event Generation] Stats:', result.stats);

      // Add events to state
      dispatch({ type: 'ADD_EVENTS', payload: result.events });

      // Persist to Supabase if we have an org
      if (currentOrg?.id && result.events.length > 0) {
        console.log('[Event Generation] Persisting to Supabase...');

        // Transform events for DB
        const dbEvents = result.events.map(e => ({
          event_id: e.event_id,
          candidate_id: e.candidate_id,
          req_id: e.req_id,
          event_type: e.event_type,
          from_stage: e.from_stage,
          to_stage: e.to_stage,
          actor_user_id: e.actor_user_id,
          event_at: e.event_at,
          metadata: e.metadata_json ? JSON.parse(e.metadata_json) : null,
          organization_id: currentOrg.id
        }));

        const { supabase } = await import('../../lib/supabase');
        if (supabase) {
          // Batch insert in chunks of 500
          const chunkSize = 500;
          const totalChunks = Math.ceil(dbEvents.length / chunkSize);
          console.log(`[Event Generation] Persisting ${dbEvents.length} events in ${totalChunks} chunks...`);

          // Report persistence phase start
          onPersistProgress?.({ phase: 'persisting', current: 0, total: totalChunks, eventsGenerated: result.stats.eventsGenerated, startTime });

          for (let i = 0; i < dbEvents.length; i += chunkSize) {
            const chunk = dbEvents.slice(i, i + chunkSize);
            const chunkNum = Math.floor(i / chunkSize) + 1;
            const { error } = await supabase.from('events').upsert(chunk);
            if (error) {
              console.error(`[Event Generation] DB error (chunk ${chunkNum}):`, error);
              // Continue anyway - events are already in state
            }

            // Report progress on every chunk
            onPersistProgress?.({ phase: 'persisting', current: chunkNum, total: totalChunks, eventsGenerated: result.stats.eventsGenerated, startTime });

            if (chunkNum % 10 === 0 || chunkNum === totalChunks) {
              console.log(`[Event Generation] Persisted chunk ${chunkNum}/${totalChunks}`);
            }
          }
          console.log('[Event Generation] Persisted to Supabase');
        }
      }

      return { success: true, eventsGenerated: result.stats.eventsGenerated };
    } catch (error: any) {
      console.error('[Event Generation] Error:', error);
      return { success: false, eventsGenerated: 0, error: error.message || 'Event generation failed' };
    }
  }, [state.dataStore.candidates, currentOrg?.id]);

  // Check if event generation is needed
  const needsEventGeneration = isEventGenerationNeeded(
    state.dataStore.candidates.length,
    state.dataStore.events.length
  );

  // Loading state helper functions
  const startOperation = useCallback((id: string, phase: OperationPhase, label: string, total: number) => {
    dispatch({ type: 'START_OPERATION', payload: { id, phase, label, total } });
  }, []);

  const updateOperation = useCallback((id: string, current: number, total?: number) => {
    dispatch({ type: 'UPDATE_OPERATION', payload: { id, current, total } });
  }, []);

  const completeOperation = useCallback((id: string) => {
    dispatch({ type: 'COMPLETE_OPERATION', payload: { id } });
  }, []);

  const failOperation = useCallback((id: string, error: string) => {
    dispatch({ type: 'FAIL_OPERATION', payload: { id, error } });
  }, []);

  const clearOperations = useCallback(() => {
    dispatch({ type: 'CLEAR_OPERATIONS' });
  }, []);

  const setDataReady = useCallback((flags: Partial<LoadingState>) => {
    dispatch({ type: 'SET_DATA_READY', payload: flags });
  }, []);

  const value: DashboardContextType = {
    state,
    importCSVs,
    updateConfig,
    updateFilters,
    selectRecruiter,
    refreshMetrics,
    reset,
    clearPersistedData,
    generateEvents,
    needsEventGeneration,
    canImportData,
    startOperation,
    updateOperation,
    completeOperation,
    failOperation,
    clearOperations,
    setDataReady
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

// ===== HOOK =====

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
