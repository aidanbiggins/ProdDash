// hiringManagersHelpContent.ts
// Help content for the HM Scorecard tab
// Written at a 5th grade reading level for clarity

import { HelpContent } from '../common/HelpDrawer';

export const HM_SCORECARD_PAGE_HELP: HelpContent = {
  whatYouSee:
    'A scorecard view of hiring manager performance and their pending actions. Use this to identify HMs who need support and track outstanding items.',

  howItWorks:
    'Each HM gets metrics based on their hiring activity: response times, conversion rates, time-to-fill, and more. Pending actions show what they need to do. The scorecard helps prioritize where to focus TA partnership.',

  whatToLookFor: [
    'HMs with overdue actions that need follow-up',
    'Low performers who may need coaching',
    'High performers whose practices could be shared',
    'Patterns by department or hiring frequency',
  ],

  watchOutFor: [
    'New HMs need time to learn the process',
    'Some roles are harder to fill regardless of HM performance',
    'HM metrics are affected by recruiter support quality too',
    'Use scorecards for coaching, not punishment',
  ],
};

export const HM_PENDING_ACTIONS_HELP: HelpContent = {
  whatYouSee:
    'A list of items waiting for hiring manager action: feedback to provide, decisions to make, interviews to schedule.',

  howItWorks:
    'We track when activities are sent to HMs and how long they\'ve been waiting. Items are prioritized by how overdue they are. Click to see details and send reminders.',

  whatToLookFor: [
    'Items overdue by several days',
    'Clusters of items for the same HM',
    'Types of actions that get stuck most often',
    'Whether follow-up reminders are working',
  ],

  watchOutFor: [
    'Some items may be blocked by external factors',
    'HMs may have completed actions not yet recorded',
    'Aggressive follow-up can damage relationships',
    'Prioritize items that affect candidate experience most',
  ],
};

export const HM_METRICS_HELP: HelpContent = {
  whatYouSee:
    'Performance metrics for each hiring manager: response time, conversion rates, and hiring velocity.',

  howItWorks:
    'Metrics are calculated from the HM\'s requisitions and their interactions with candidates. We compare to team averages and targets to show relative performance.',

  whatToLookFor: [
    'Response time compared to target (usually 24-48 hours)',
    'Screen-to-hire conversion rate',
    'Number of open reqs and pipeline health',
    'Trend direction over recent weeks',
  ],

  watchOutFor: [
    'Small sample sizes can make percentages misleading',
    'Different roles have different benchmarks',
    'HMs hiring for multiple roles may have mixed results',
    'External factors (budget, org changes) affect metrics',
  ],
};
