// controlTowerHelpContent.ts
// Help content for the Command Center tab
// Written at a 5th grade reading level for clarity

import { HelpContent } from '../../common/HelpDrawer';

export const CONTROL_TOWER_PAGE_HELP: HelpContent = {
  whatYouSee:
    'This is your recruiting command center - a single view of everything that needs attention. It shows health indicators, risks, and actions across your entire hiring operation.',

  howItWorks:
    'We pull together data from all your requisitions, candidates, and hiring managers to surface what matters most. KPIs turn red when they miss targets. Risks are sorted by urgency. Actions are prioritized so you know what to tackle first.',

  whatToLookFor: [
    'Red KPIs that need immediate attention',
    'P0 (blocking) and P1 (at-risk) actions at the top',
    'Patterns in risks (same failure mode repeated)',
    'The forecast gap showing how far you are from hiring goals',
  ],

  watchOutFor: [
    'This view updates with your filter settings - check the date range',
    'Some actions may already be in progress but not marked done',
    'Risks are based on rules - use your judgment for context',
    'The health score is a summary, not a complete picture',
  ],
};

export const HEALTH_KPIS_HELP: HelpContent = {
  whatYouSee:
    'Five key indicators showing the overall health of your recruiting operation. Green means on track, yellow means caution, red means action needed.',

  howItWorks:
    'Each KPI has a target threshold. Median TTF should be under 45 days. Accept rate should be above 80%. When you miss these targets, the indicator turns yellow or red.',

  whatToLookFor: [
    'Any red indicators need immediate investigation',
    'Trends over time - is it getting better or worse?',
    'Multiple yellows together can signal systemic issues',
    'Compare to prior period to see direction',
  ],

  watchOutFor: [
    'Small sample sizes can swing percentages dramatically',
    'Seasonal hiring patterns affect these numbers',
    'New reqs take time to show up in metrics',
    'One outlier can skew the median',
  ],
};

export const RISKS_HELP: HelpContent = {
  whatYouSee:
    'The top 10 requisitions that need attention, ranked by urgency. Each has a label explaining why it\'s at risk.',

  howItWorks:
    'We check each req against failure patterns: zombie (no activity 30+ days), stalled (14-30 days), pipeline gap (no candidates), HM delay (overdue feedback), offer risk (offer pending 7+ days), and at-risk (old with few candidates).',

  whatToLookFor: [
    'Zombie and stalled reqs that may need to be closed',
    'Pipeline gaps that need sourcing attention',
    'HM delays that need escalation',
    'Clusters of similar risk types',
  ],

  watchOutFor: [
    'Some reqs are intentionally paused - check context',
    'Recent activity may not be captured yet',
    'A req can have multiple risk factors',
    'Click through to see the full picture',
  ],
};

export const ACTIONS_HELP: HelpContent = {
  whatYouSee:
    'A prioritized list of tasks for recruiters and hiring managers. P0 means blocking, P1 means at risk, P2 means optimize.',

  howItWorks:
    'Actions come from multiple sources: SLA breaches, overdue feedback, empty pipelines, and more. They\'re assigned to the person responsible and given a due date based on urgency.',

  whatToLookFor: [
    'P0 actions should be handled today',
    'Clusters of actions for the same person',
    'Recurring action types that signal process issues',
    'Actions that have been open too long',
  ],

  watchOutFor: [
    'Mark actions as done when complete to keep the list clean',
    'Some actions may be duplicates from different sources',
    'Due dates are guidelines, not hard deadlines',
    'Filter by owner type to focus your view',
  ],
};

export const FORECAST_HELP: HelpContent = {
  whatYouSee:
    'A projection of how many hires you can expect based on your current pipeline, and the gap to your goals.',

  howItWorks:
    'We look at active candidates and apply conversion rates to estimate expected hires. The gap is the difference between open reqs and expected hires. Confidence depends on data quality.',

  whatToLookFor: [
    'A large gap means you need more pipeline or faster conversion',
    'Low confidence suggests data quality issues',
    'Compare expected to actual hires over time',
    'Use this to prioritize sourcing efforts',
  ],

  watchOutFor: [
    'Forecasts are estimates, not guarantees',
    'Conversion rates are based on historical data',
    'New roles without history are harder to forecast',
    'External factors (budget, market) aren\'t captured',
  ],
};
