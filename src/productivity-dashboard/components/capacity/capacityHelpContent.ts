// capacityHelpContent.ts
// Help content for the Capacity Planning tab
// Written at a 5th grade reading level for clarity

import { HelpContent } from '../common/HelpDrawer';

export const CAPACITY_PAGE_HELP: HelpContent = {
  whatYouSee:
    'An analysis of recruiter workload and capacity. This helps you balance work across the team and plan for hiring surges.',

  howItWorks:
    'We count open reqs per recruiter and compare to targets. We factor in req complexity and historical throughput to estimate realistic capacity. Overloaded recruiters need support.',

  whatToLookFor: [
    'Recruiters with too many reqs (overloaded)',
    'Recruiters with capacity for more work',
    'Whether workload matches experience level',
    'Upcoming hiring that will need capacity',
  ],

  watchOutFor: [
    'Req count alone doesn\'t capture complexity',
    'Some recruiters handle harder roles',
    'New recruiters need ramp time',
    'Capacity planning is an estimate, not exact science',
  ],
};

export const WORKLOAD_DISTRIBUTION_HELP: HelpContent = {
  whatYouSee:
    'A view of how requisitions are distributed across your recruiting team.',

  howItWorks:
    'We count open reqs per recruiter and show the distribution. The target workload line shows your ideal reqs-per-recruiter. Above target means overloaded.',

  whatToLookFor: [
    'Recruiters significantly above or below target',
    'Whether distribution is fair given experience',
    'Opportunities to rebalance workload',
    'Trends as new reqs come in',
  ],

  watchOutFor: [
    'Not all reqs are equal in effort',
    'Some recruiters specialize in high-volume roles',
    'Consider quality metrics alongside volume',
    'Rebalancing has transition costs',
  ],
};

export const CAPACITY_FORECAST_HELP: HelpContent = {
  whatYouSee:
    'A projection of future workload based on historical hiring patterns and known upcoming needs.',

  howItWorks:
    'We look at typical req inflow, fill rates, and known future hiring. This projects how many reqs your team will have and whether you have enough capacity.',

  whatToLookFor: [
    'Periods where demand will exceed capacity',
    'Whether you need to hire more recruiters',
    'Seasonal patterns in hiring demand',
    'Lead time needed to build capacity',
  ],

  watchOutFor: [
    'Forecasts are uncertain - plan for ranges',
    'Business changes can shift demand quickly',
    'Contractor or agency support can add flex capacity',
    'Building capacity takes time (hiring, training)',
  ],
};

export const COMPLEXITY_SCORING_HELP: HelpContent = {
  whatYouSee:
    'A scoring system that accounts for the difficulty of each requisition, not just the count.',

  howItWorks:
    'Each req gets a complexity score based on factors: seniority, role scarcity, location, hiring manager responsiveness, and historical fill difficulty. Higher scores mean harder to fill.',

  whatToLookFor: [
    'High-complexity reqs that need senior recruiter attention',
    'Whether complexity is evenly distributed',
    'Roles that consistently score high (may need specialized sourcing)',
    'Mismatch between recruiter experience and req complexity',
  ],

  watchOutFor: [
    'Complexity scoring is based on historical patterns',
    'New roles don\'t have history for accurate scoring',
    'The model may not capture all difficulty factors',
    'Use scores as guidance, not absolute truth',
  ],
};
