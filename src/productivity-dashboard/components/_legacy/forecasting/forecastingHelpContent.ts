// forecastingHelpContent.ts
// Help content for the Hiring Forecast tab
// Written at a 5th grade reading level for clarity

import { HelpContent } from '../../common/HelpDrawer';

export const FORECASTING_PAGE_HELP: HelpContent = {
  whatYouSee:
    'Predictions of future hiring outcomes based on your current pipeline and historical conversion rates. Use this to set expectations and identify gaps.',

  howItWorks:
    'We look at candidates in each stage and apply probability of hire based on historical data. Expected hires = sum of (candidates × conversion probability). We project week by week.',

  whatToLookFor: [
    'Whether expected hires meet your goals',
    'Pipeline gaps that will cause future misses',
    'Confidence level of the forecast',
    'Week-by-week trajectory',
  ],

  watchOutFor: [
    'Forecasts are estimates based on past patterns',
    'New roles without history have lower accuracy',
    'External factors (budget, strategy) can change everything',
    'The further out you forecast, the less accurate',
  ],
};

export const PIPELINE_PROJECTION_HELP: HelpContent = {
  whatYouSee:
    'A forward-looking view of how your current pipeline will convert to hires over time.',

  howItWorks:
    'We take current candidates at each stage, apply historical conversion rates, and project when they\'ll likely be hired. This creates a timeline of expected hires.',

  whatToLookFor: [
    'Whether the pipeline supports your hiring goals',
    'Stages where you need more candidates',
    'Timeline for when hires will land',
    'Gaps that need sourcing attention now',
  ],

  watchOutFor: [
    'Pipeline can change quickly (candidates withdraw)',
    'Conversion rates vary by role and market',
    'Offer timing affects when hires land',
    'Don\'t wait until the gap is imminent to act',
  ],
};

export const GOAL_TRACKING_HELP: HelpContent = {
  whatYouSee:
    'Progress toward your hiring goals with projections showing if you\'ll hit them.',

  howItWorks:
    'We compare actual hires to your targets and project future hires. The gap shows how many more hires you need. Color coding shows if you\'re on track.',

  whatToLookFor: [
    'Current progress vs. where you should be',
    'Projected final outcome vs. goal',
    'Size of the gap you need to close',
    'Which roles are furthest behind',
  ],

  watchOutFor: [
    'Goals may have changed since being set',
    'Some roles matter more than others strategically',
    'Pushing too hard can sacrifice quality',
    'Discuss gaps early rather than missing silently',
  ],
};

export const SCENARIO_MODELING_HELP: HelpContent = {
  whatYouSee:
    'What-if scenarios showing how changes would affect your hiring forecast.',

  howItWorks:
    'Adjust assumptions (conversion rates, time-to-fill, sourcing volume) and see how it changes the forecast. This helps you understand what levers matter most.',

  whatToLookFor: [
    'Which changes have the biggest impact',
    'Realistic vs. optimistic scenarios',
    'What it would take to hit your goals',
    'Trade-offs between different approaches',
  ],

  watchOutFor: [
    'Models simplify reality - use judgment',
    'Some changes are harder than they look',
    'Multiple small improvements may beat one big one',
    'Scenarios help thinking, not predict exactly',
  ],
};
