// Dashboard Context and State Management

import React, { createContext, useContext, useReducer, useCallback, ReactNode, useEffect } from 'react';
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
  DataHealth
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
  calculateDataHealth
} from '../services';
import { fetchDashboardData, persistDashboardData, clearAllData } from '../services/dbService';

// ===== ACTION TYPES =====

type DashboardAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'IMPORT_DATA'; payload: { requisitions: Requisition[]; candidates: Candidate[]; events: Event[]; users: User[]; isDemo?: boolean } }
  | { type: 'SET_CONFIG'; payload: DashboardConfig }
  | { type: 'SET_FILTERS'; payload: Partial<MetricFilters> }
  | { type: 'SET_OVERVIEW'; payload: OverviewMetrics }
  | { type: 'SELECT_RECRUITER'; payload: string | null }
  | { type: 'SET_RECRUITER_DETAIL'; payload: RecruiterSummary | null }
  | { type: 'SET_HM_FRICTION'; payload: HiringManagerFriction[] }
  | { type: 'SET_QUALITY_METRICS'; payload: QualityMetrics }
  | { type: 'SET_WEEKLY_TRENDS'; payload: WeeklyTrend[] }
  | { type: 'SET_DATA_HEALTH'; payload: DataHealth }
  | { type: 'RESET' };

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

    default:
      return state;
  }
}

// ===== CONTEXT =====

interface DashboardContextType {
  state: DashboardState;
  importCSVs: (requisitionsCsv: string, candidatesCsv: string, eventsCsv: string, usersCsv: string, isDemo?: boolean) => Promise<{ success: boolean; errors: string[] }>;
  updateConfig: (config: DashboardConfig) => void;
  updateFilters: (filters: Partial<MetricFilters>) => void;
  selectRecruiter: (recruiterId: string | null) => void;
  refreshMetrics: () => void;
  reset: () => void;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

// ===== PROVIDER =====

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);

  // Load persistence on mount
  useEffect(() => {
    async function initData() {
      dispatch({ type: 'SET_LOADING', payload: true });
      try {
        const data = await fetchDashboardData();
        if (data.requisitions.length > 0) {
          dispatch({
            type: 'IMPORT_DATA',
            payload: {
              requisitions: data.requisitions,
              candidates: data.candidates,
              events: data.events,
              users: data.users,
              isDemo: false
            }
          });
          // Trigger metric refresh safely (via ref or just effect dependency?)
          // For simplicity we'll let existing effects or manual refresh handle it, 
          // or we can call refreshMetrics inside useCallback but we don't have it defined yet in this scope.
          // Ideally we dispatch IMPORT_DATA and let a useEffect trigger calculations.
        }
      } catch (err) {
        console.error('Failed to load data from Supabase:', err);
        // Don't show error to user immediately if it's just empty DB
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }
    initData();
  }, []);

  const importCSVs = useCallback(async (
    requisitionsCsv: string,
    candidatesCsv: string,
    eventsCsv: string,
    usersCsv: string,
    isDemo: boolean = false
  ): Promise<{ success: boolean; errors: string[] }> => {
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const result = importCsvData(requisitionsCsv, candidatesCsv, eventsCsv, usersCsv);

      if (!result.isValid) {
        dispatch({ type: 'SET_ERROR', payload: result.criticalErrors.join('; ') });
        return { success: false, errors: result.criticalErrors };
      }

      // Persist to Supabase (only for real imports, not demo data)
      if (!isDemo) {
        await persistDashboardData(
          result.requisitions.data,
          result.candidates.data,
          result.events.data,
          result.users.data
        );
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error during import';
      dispatch({ type: 'SET_ERROR', payload: message });
      return { success: false, errors: [message] };
    }
  }, []);

  // Effect to recalculate metrics when dataStore changes (simplifies refreshMetrics)
  useEffect(() => {
    if (state.dataStore.requisitions.length === 0) return;
    refreshMetricsInternal();
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

  // Internal function to reuse logic
  const refreshMetricsInternal = () => {
    const { requisitions, candidates, events, users, config } = state.dataStore;
    const normalizedEvents = normalizeEventStages(events, config.stageMapping);

    // Calculate HM friction first (needed for weights)
    const hmFriction = calculateHMFrictionMetrics(requisitions, events, users, state.filters, config);
    dispatch({ type: 'SET_HM_FRICTION', payload: hmFriction });

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

    // Calculate weekly trends
    const trends = calculateWeeklyTrends(candidates, events, requisitions, state.filters);
    dispatch({ type: 'SET_WEEKLY_TRENDS', payload: trends });

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

    // Refresh recruiter detail if one is selected
    if (state.selectedRecruiterId) {
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

  const value: DashboardContextType = {
    state,
    importCSVs,
    updateConfig,
    updateFilters,
    selectRecruiter,
    refreshMetrics,
    reset
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
