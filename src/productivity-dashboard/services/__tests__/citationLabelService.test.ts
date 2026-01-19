/**
 * Citation Label Service Tests
 * Tests that technical citation paths are properly converted to human-readable labels
 */

import {
  getCitationLabel,
  getShortCitationLabel,
  shouldCollapseCitations,
  getCitationsSummary
} from '../citationLabelService';

describe('citationLabelService', () => {
  describe('getCitationLabel', () => {
    it('maps KPI paths to readable labels', () => {
      expect(getCitationLabel('kpis.median_ttf_days')).toBe('Median Time to Fill');
      expect(getCitationLabel('kpis.offer_accept_rate')).toBe('Offer Accept Rate');
      expect(getCitationLabel('kpis.overall_fill_rate')).toBe('Fill Rate');
      expect(getCitationLabel('kpis.decay_start_day')).toBe('Decay Start Day');
    });

    it('maps sample size paths to readable labels', () => {
      expect(getCitationLabel('sample_sizes.total_offers')).toBe('Total Offers');
      expect(getCitationLabel('sample_sizes.total_reqs')).toBe('Total Reqs');
      expect(getCitationLabel('sample_sizes.total_hires')).toBe('Total Hires');
    });

    it('maps contributing reqs paths to readable labels', () => {
      expect(getCitationLabel('contributing_reqs.zombie_req_ids')).toBe('Zombie Reqs');
      expect(getCitationLabel('contributing_reqs.stalled_req_ids')).toBe('Stalled Reqs');
    });

    it('handles uppercase paths (AI sometimes returns uppercase)', () => {
      expect(getCitationLabel('KPIS.MEDIAN_TTF_DAYS')).toBe('Median Time to Fill');
      expect(getCitationLabel('SAMPLE_SIZES.TOTAL_OFFERS')).toBe('Total Offers');
    });

    it('handles array index paths', () => {
      // bottleneck_stages maps to the base label
      expect(getCitationLabel('bottleneck_stages[0].stage')).toBe('Bottleneck Stage');
      expect(getCitationLabel('bottleneck_stages[1].avg_days')).toBe('Bottleneck Avg Days');
      // candidate_decay.buckets paths get friendly labels
      expect(getCitationLabel('candidate_decay.buckets[0].rate')).toBe('Decay Accept Rate');
      expect(getCitationLabel('CANDIDATE_DECAY.BUCKETS[0].RATE')).toBe('Decay Accept Rate');
    });

    it('falls back to formatted label for unknown paths', () => {
      expect(getCitationLabel('some.unknown.path')).toBe('Path');
      expect(getCitationLabel('custom_metric_name')).toBe('Custom Metric Name');
    });

    it('trims whitespace', () => {
      expect(getCitationLabel('  kpis.median_ttf_days  ')).toBe('Median Time to Fill');
    });
  });

  describe('getShortCitationLabel', () => {
    it('returns short versions of common labels', () => {
      expect(getShortCitationLabel('kpis.median_ttf_days')).toBe('TTF');
      expect(getShortCitationLabel('kpis.offer_accept_rate')).toBe('Accept %');
      expect(getShortCitationLabel('sample_sizes.total_offers')).toBe('Offers');
      expect(getShortCitationLabel('contributing_reqs.zombie_req_ids')).toBe('Zombie');
    });
  });

  describe('shouldCollapseCitations', () => {
    it('returns false for 3 or fewer citations', () => {
      expect(shouldCollapseCitations([])).toBe(false);
      expect(shouldCollapseCitations(['a'])).toBe(false);
      expect(shouldCollapseCitations(['a', 'b'])).toBe(false);
      expect(shouldCollapseCitations(['a', 'b', 'c'])).toBe(false);
    });

    it('returns true for more than 3 citations', () => {
      expect(shouldCollapseCitations(['a', 'b', 'c', 'd'])).toBe(true);
      expect(shouldCollapseCitations(['a', 'b', 'c', 'd', 'e', 'f'])).toBe(true);
    });
  });

  describe('getCitationsSummary', () => {
    it('returns empty string for no citations', () => {
      expect(getCitationsSummary([])).toBe('');
    });

    it('returns singular form for one citation', () => {
      expect(getCitationsSummary(['a'])).toBe('1 data point');
    });

    it('returns plural form for multiple citations', () => {
      expect(getCitationsSummary(['a', 'b'])).toBe('2 data points');
      expect(getCitationsSummary(['a', 'b', 'c', 'd', 'e', 'f'])).toBe('6 data points');
    });
  });
});
