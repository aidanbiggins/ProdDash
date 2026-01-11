// Loading State Types for Progressive Loading

export type OperationPhase =
  | 'parsing'
  | 'persisting-users'
  | 'persisting-reqs'
  | 'persisting-candidates'
  | 'persisting-events'
  | 'generating-events'
  | 'calculating-overview'
  | 'calculating-hm'
  | 'calculating-quality'
  | 'calculating-trends';

export interface BackgroundOperation {
  id: string;
  phase: OperationPhase;
  label: string;
  current: number;
  total: number;
  startTime: number;
  status: 'pending' | 'running' | 'complete' | 'error';
  error?: string;
}

export interface LoadingState {
  // Data availability flags (for skeleton decisions)
  hasBaseData: boolean;        // reqs, candidates loaded from DB or parsed
  hasEvents: boolean;          // events generated or loaded
  hasOverviewMetrics: boolean; // overview metrics calculated
  hasRecruiterMetrics: boolean; // recruiter summaries calculated
  hasHMMetrics: boolean;       // HM friction calculated
  hasQualityMetrics: boolean;  // quality metrics calculated
  hasTrendMetrics: boolean;    // weekly trends calculated

  // Background operations in progress
  operations: BackgroundOperation[];

  // Computed states
  isFullyReady: boolean;
  overallProgress: number; // 0-100
}

// Helper to create initial loading state
export const createInitialLoadingState = (): LoadingState => ({
  hasBaseData: false,
  hasEvents: false,
  hasOverviewMetrics: false,
  hasRecruiterMetrics: false,
  hasHMMetrics: false,
  hasQualityMetrics: false,
  hasTrendMetrics: false,
  operations: [],
  isFullyReady: false,
  overallProgress: 0
});

// Phase labels for display
export const PHASE_LABELS: Record<OperationPhase, string> = {
  'parsing': 'Parsing CSV data',
  'persisting-users': 'Saving users',
  'persisting-reqs': 'Saving requisitions',
  'persisting-candidates': 'Saving candidates',
  'persisting-events': 'Saving events',
  'generating-events': 'Generating events',
  'calculating-overview': 'Calculating overview metrics',
  'calculating-hm': 'Analyzing hiring managers',
  'calculating-quality': 'Computing quality metrics',
  'calculating-trends': 'Building trend data'
};

// Phase order for progress calculation
export const PHASE_ORDER: OperationPhase[] = [
  'parsing',
  'persisting-users',
  'persisting-reqs',
  'persisting-candidates',
  'generating-events',
  'persisting-events',
  'calculating-overview',
  'calculating-hm',
  'calculating-quality',
  'calculating-trends'
];

// Encouraging messages that rotate during loading
export const LOADING_MESSAGES = [
  "Crunching the numbers... 🔢",
  "Your pipeline is taking shape! 📊",
  "Almost there, stay caffeinated! ☕",
  "Building your recruiting timeline... 🚀",
  "Good data makes great decisions! 💡",
  "Your dashboard is brewing... 🍵",
  "Analyzing candidate journeys... 🎯",
  "This is totally worth the wait... 💪",
  "Making sense of the chaos... ✨",
  "Turning data into insights... 🧠"
];

// Get message based on progress (0-100)
export const getLoadingMessage = (progress: number): string => {
  const index = Math.floor((progress / 100) * (LOADING_MESSAGES.length - 1));
  return LOADING_MESSAGES[Math.min(index, LOADING_MESSAGES.length - 1)];
};

// Calculate time remaining estimate
export const getTimeRemaining = (operation: BackgroundOperation): string => {
  if (operation.current === 0 || operation.status !== 'running') return '';

  const elapsed = Date.now() - operation.startTime;
  const rate = operation.current / elapsed;
  const remaining = operation.total - operation.current;
  const msRemaining = remaining / rate;

  if (msRemaining < 1000) return 'Almost done!';
  if (msRemaining < 60000) return `~${Math.ceil(msRemaining / 1000)}s remaining`;
  return `~${Math.ceil(msRemaining / 60000)}m remaining`;
};

// Calculate overall progress from operations
export const calculateOverallProgress = (operations: BackgroundOperation[]): number => {
  if (operations.length === 0) return 0;

  const totalWeight = operations.length;
  const completedWeight = operations.reduce((sum, op) => {
    if (op.status === 'complete') return sum + 1;
    if (op.status === 'running' && op.total > 0) {
      return sum + (op.current / op.total);
    }
    return sum;
  }, 0);

  return Math.round((completedWeight / totalWeight) * 100);
};
