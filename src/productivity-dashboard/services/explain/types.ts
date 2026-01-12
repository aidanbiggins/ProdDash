// Explain Provider Types
// Interface for explain providers and context

import { Explanation, ExplainProviderId, BlockedReason } from '../../types/explainTypes';
import { Requisition, Candidate, Event, User } from '../../types/entities';
import { MetricFilters, OverviewMetrics, HiringManagerFriction } from '../../types/metrics';
import { DashboardConfig } from '../../types/config';

/**
 * Data context passed to all providers
 */
export interface ExplainContext {
  requisitions: Requisition[];
  candidates: Candidate[];
  events: Event[];
  users: User[];
  filters: MetricFilters;
  config: DashboardConfig;
  overview: OverviewMetrics | null;
  hmFriction: HiringManagerFriction[];
}

/**
 * Provider interface - each KPI implements this
 */
export interface ExplainProvider {
  id: ExplainProviderId;

  /**
   * Check if provider can generate explanation with current data
   * Returns blocked reasons if data is insufficient
   */
  canExplain(context: ExplainContext): BlockedReason[];

  /**
   * Generate the explanation
   * Should only be called if canExplain returns empty array
   */
  explain(context: ExplainContext): Explanation;
}
