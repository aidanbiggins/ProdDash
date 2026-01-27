// V2 Component Types - Maps V0 types to existing dashboard data

export type RiskLevel = 'good' | 'warn' | 'bad' | 'neutral';

export interface KPIMetric {
  id?: string;
  label: string;
  value: number | string;
  subtitle?: string;
  change?: number;
  trend?: 'up' | 'down' | 'flat';
  status: RiskLevel;
  helpText?: string;
}

export interface PipelineStage {
  name: string;
  count: number;
  avgDays: number;
  conversionRate: number;
}

export interface BottleneckItem {
  id: string;
  type: 'stage' | 'recruiter' | 'department' | 'requisition';
  name: string;
  severity: RiskLevel;
  metric: string;
  value: number;
  impact: string;
  recommendation: string;
}

export interface TeamCapacity {
  team: string;
  totalCapacity: number;
  usedCapacity: number;
  utilization: number;
  headcount: number;
  openReqs: number;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface FilterState {
  dateRange: DateRange;
  recruiters: string[];
  departments: string[];
  regions: string[];
  priorities: string[];
  statuses: string[];
}

export interface RequisitionV2 {
  id: string;
  title: string;
  department: string;
  level: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'sourcing' | 'screening' | 'interviewing' | 'offer' | 'closed' | 'on-hold';
  openDate: string;
  targetCloseDate: string;
  assignedRecruiter: string | null;
  hiringManager: string;
  location: string;
  candidates: number;
  interviews: number;
  offers: number;
  daysOpen: number;
  healthScore: number;
}
