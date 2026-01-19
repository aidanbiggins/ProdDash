/**
 * Citation Label Service
 * Maps technical fact pack paths to human-readable labels
 * Used to display friendly citation names instead of raw key paths
 */

// Mapping from technical citation paths to human-readable labels
const CITATION_LABELS: Record<string, string> = {
  // KPIs
  'kpis.median_ttf_days': 'Median Time to Fill',
  'kpis.offer_accept_rate': 'Offer Accept Rate',
  'kpis.overall_fill_rate': 'Fill Rate',
  'kpis.decay_rate_per_day': 'Decay Rate',
  'kpis.req_decay_rate_per_day': 'Req Decay Rate',
  'kpis.decay_start_day': 'Decay Start Day',

  // Sample sizes
  'sample_sizes.total_offers': 'Total Offers',
  'sample_sizes.total_accepted': 'Accepted Offers',
  'sample_sizes.total_reqs': 'Total Reqs',
  'sample_sizes.total_filled': 'Filled Reqs',
  'sample_sizes.total_hires': 'Total Hires',
  'sample_sizes.fast_hires_cohort': 'Fast Hires',
  'sample_sizes.slow_hires_cohort': 'Slow Hires',

  // Cohort comparison
  'cohort_comparison.fast_hires': 'Fast Hires Cohort',
  'cohort_comparison.slow_hires': 'Slow Hires Cohort',
  'cohort_comparison.factors': 'Cohort Factors',
  'cohort_comparison.fast_hires.count': 'Fast Hires Count',
  'cohort_comparison.slow_hires.count': 'Slow Hires Count',
  'cohort_comparison.fast_hires.avg_ttf': 'Fast Hires Avg TTF',
  'cohort_comparison.slow_hires.avg_ttf': 'Slow Hires Avg TTF',

  // Decay analysis
  'candidate_decay.available': 'Candidate Decay Data',
  'candidate_decay.buckets': 'Decay Buckets',
  'req_decay.available': 'Req Decay Data',
  'req_decay.buckets': 'Req Decay Buckets',

  // Contributing reqs
  'contributing_reqs.zombie_req_ids': 'Zombie Reqs',
  'contributing_reqs.stalled_req_ids': 'Stalled Reqs',
  'contributing_reqs.slow_fill_req_ids': 'Slow Fill Reqs',
  'contributing_reqs.fast_fill_req_ids': 'Fast Fill Reqs',

  // Stage timing
  'stage_timing.capability': 'Stage Timing Capability',
  'stage_timing.can_show_duration': 'Can Show Duration',
  'stage_timing.reason': 'Stage Timing Status',

  // Bottleneck stages
  'bottleneck_stages': 'Bottleneck Stages',

  // Metadata
  'metadata.data_quality': 'Data Quality',
  'metadata.date_range': 'Date Range',
};

// Uppercase version mapping (AI sometimes returns uppercase)
const UPPERCASE_CITATION_LABELS: Record<string, string> = {};
Object.entries(CITATION_LABELS).forEach(([key, value]) => {
  UPPERCASE_CITATION_LABELS[key.toUpperCase()] = value;
});

/**
 * Get a human-readable label for a citation path
 * @param citation - The technical citation path (e.g., "kpis.median_ttf_days")
 * @returns Human-readable label (e.g., "Median Time to Fill")
 */
export function getCitationLabel(citation: string): string {
  // Normalize the citation (remove leading/trailing whitespace)
  const normalized = citation.trim();

  // Try direct match first
  if (CITATION_LABELS[normalized]) {
    return CITATION_LABELS[normalized];
  }

  // Try uppercase match (AI sometimes returns uppercase)
  const upperKey = normalized.toUpperCase();
  if (UPPERCASE_CITATION_LABELS[upperKey]) {
    return UPPERCASE_CITATION_LABELS[upperKey];
  }

  // Try lowercase match
  const lowerKey = normalized.toLowerCase();
  if (CITATION_LABELS[lowerKey]) {
    return CITATION_LABELS[lowerKey];
  }

  // Handle specialized array patterns BEFORE generic base matching
  // Handle bottleneck_stages[n].* patterns
  if (/bottleneck_stages\[\d+\]/i.test(normalized)) {
    const suffix = normalized.match(/\.(stage|avg_days|count)$/i);
    if (suffix) {
      const suffixLabel = {
        'stage': 'Stage',
        'avg_days': 'Avg Days',
        'count': 'Count'
      }[suffix[1].toLowerCase()];
      return `Bottleneck ${suffixLabel || 'Data'}`;
    }
    return 'Bottleneck Stage';
  }

  // Handle candidate_decay.buckets[n].* patterns
  if (/candidate_decay\.buckets\[\d+\]/i.test(normalized)) {
    const suffix = normalized.match(/\.(label|count|rate)$/i);
    if (suffix) {
      const suffixLabel = {
        'label': 'Bucket',
        'count': 'Count',
        'rate': 'Accept Rate'
      }[suffix[1].toLowerCase()];
      return `Decay ${suffixLabel || 'Data'}`;
    }
    return 'Decay Bucket';
  }

  // Handle req_decay.buckets[n].* patterns
  if (/req_decay\.buckets\[\d+\]/i.test(normalized)) {
    const suffix = normalized.match(/\.(label|count|rate)$/i);
    if (suffix) {
      const suffixLabel = {
        'label': 'Bucket',
        'count': 'Count',
        'rate': 'Fill Rate'
      }[suffix[1].toLowerCase()];
      return `Req Decay ${suffixLabel || 'Data'}`;
    }
    return 'Req Decay Bucket';
  }

  // Fallback: Create a readable label from the path
  return formatCitationPathAsLabel(normalized);
}

/**
 * Format a citation path as a readable label (fallback)
 * @param path - The citation path
 * @returns A formatted label
 */
function formatCitationPathAsLabel(path: string): string {
  // Remove array indices
  const withoutIndices = path.replace(/\[\d+\]/g, '');

  // Get the last meaningful segment
  const segments = withoutIndices.split('.');
  const lastSegment = segments[segments.length - 1] || segments[0] || path;

  // Convert snake_case to Title Case
  return lastSegment
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get a very short label for compact display
 * @param citation - The technical citation path
 * @returns Short label (1-2 words)
 */
export function getShortCitationLabel(citation: string): string {
  const fullLabel = getCitationLabel(citation);

  // Shorten common long labels
  const shortMappings: Record<string, string> = {
    'Median Time to Fill': 'TTF',
    'Offer Accept Rate': 'Accept %',
    'Fill Rate': 'Fill %',
    'Decay Rate': 'Decay %',
    'Req Decay Rate': 'Decay %',
    'Decay Start Day': 'Day 0',
    'Total Offers': 'Offers',
    'Accepted Offers': 'Accepted',
    'Total Reqs': 'Reqs',
    'Filled Reqs': 'Filled',
    'Total Hires': 'Hires',
    'Fast Hires Cohort': 'Fast',
    'Slow Hires Cohort': 'Slow',
    'Zombie Reqs': 'Zombie',
    'Stalled Reqs': 'Stalled',
    'Bottleneck Stage': 'Stage',
  };

  return shortMappings[fullLabel] || fullLabel;
}

/**
 * Check if citations should be hidden from main view
 * (When there are too many to display inline nicely)
 * @param citations - Array of citation paths
 * @returns true if citations should be collapsed
 */
export function shouldCollapseCitations(citations: string[]): boolean {
  return citations.length > 3;
}

/**
 * Get a summary string for collapsed citations
 * @param citations - Array of citation paths
 * @returns Summary string like "Based on 6 data points"
 */
export function getCitationsSummary(citations: string[]): string {
  const count = citations.length;
  if (count === 0) return '';
  if (count === 1) return '1 data point';
  return `${count} data points`;
}
