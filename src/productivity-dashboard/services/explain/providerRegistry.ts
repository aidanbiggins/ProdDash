// Explain Provider Registry
// Central registry for all explain providers

import { ExplainProvider, ExplainContext } from './types';
import { Explanation, ExplainProviderId, BlockedReason } from '../../types/explainTypes';
import { TimeToOfferProvider } from './providers/timeToOfferProvider';
import { MedianTTFProvider } from './providers/medianTTFProvider';
import { HMLatencyProvider } from './providers/hmLatencyProvider';
import { StalledReqsProvider } from './providers/stalledReqsProvider';
import { OfferAcceptRateProvider } from './providers/offerAcceptRateProvider';

// Provider instances - all 5 v1 providers
const providers = new Map<ExplainProviderId, ExplainProvider>();
providers.set('time_to_offer', new TimeToOfferProvider());
providers.set('median_ttf', new MedianTTFProvider());
providers.set('hm_latency', new HMLatencyProvider());
providers.set('stalled_reqs', new StalledReqsProvider());
providers.set('offer_accept_rate', new OfferAcceptRateProvider());

/**
 * Get explanation for a metric
 */
export function getExplanation(
  providerId: ExplainProviderId,
  context: ExplainContext
): Explanation {
  const provider = providers.get(providerId);

  if (!provider) {
    return createNotImplementedExplanation(providerId, context);
  }

  const blockedReasons = provider.canExplain(context);

  if (blockedReasons.length > 0) {
    return createBlockedExplanation(providerId, blockedReasons, context);
  }

  return provider.explain(context);
}

/**
 * Check if a provider is implemented
 */
export function hasProvider(providerId: ExplainProviderId): boolean {
  return providers.has(providerId);
}

/**
 * Get all available provider IDs
 */
export function getAvailableProviders(): ExplainProviderId[] {
  return Array.from(providers.keys());
}

// Helper to create blocked explanation
function createBlockedExplanation(
  metricId: ExplainProviderId,
  blockedReasons: BlockedReason[],
  context: ExplainContext
): Explanation {
  const labels: Record<ExplainProviderId, string> = {
    median_ttf: 'Median Time to Fill',
    hm_latency: 'HM Latency',
    stalled_reqs: 'Stalled Requisitions',
    offer_accept_rate: 'Offer Accept Rate',
    time_to_offer: 'Time to Offer',
  };

  return {
    metricId,
    metricLabel: labels[metricId] || metricId,
    status: 'blocked',
    value: null,
    unit: '',
    formula: '',
    dateRange: {
      start: context.filters.dateRange.startDate,
      end: context.filters.dateRange.endDate,
    },
    includedCount: 0,
    excludedCount: 0,
    exclusionReasons: [],
    blockedReasons,
    computedAt: new Date(),
  };
}

// Helper for not-yet-implemented providers
function createNotImplementedExplanation(
  metricId: ExplainProviderId,
  context: ExplainContext
): Explanation {
  return createBlockedExplanation(
    metricId,
    [{ code: 'NOT_IMPLEMENTED', message: `Explain provider for ${metricId} is not yet implemented` }],
    context
  );
}
