// recruiterHelpContent.ts
// Help content for the Recruiter Performance tab
// Written at a 5th grade reading level for clarity

import { HelpContent } from '../common/HelpDrawer';

export const RECRUITER_PAGE_HELP: HelpContent = {
  whatYouSee:
    'A detailed view of how each recruiter is performing. See their workload, metrics, and individual requisitions.',

  howItWorks:
    'We track each recruiter\'s assigned reqs, their candidates, and key metrics like time-to-fill, accept rate, and activity levels. You can compare recruiters or drill into one person\'s portfolio.',

  whatToLookFor: [
    'Recruiters with unusually high or low workloads',
    'Metrics that differ significantly from team averages',
    'Patterns in performance (some strong at sourcing, others at closing)',
    'Reqs that have been open too long',
  ],

  watchOutFor: [
    'Workload isn\'t the same as difficulty - some reqs are harder',
    'New recruiters need ramp time',
    'Some roles (executive, niche) naturally take longer',
    'Context matters - ask before drawing conclusions',
  ],
};

export const RECRUITER_METRICS_HELP: HelpContent = {
  whatYouSee:
    'Key performance indicators for the selected recruiter, including hires, time-to-fill, and pipeline health.',

  howItWorks:
    'Metrics are calculated from the recruiter\'s assigned requisitions and the candidates in their pipeline. Comparisons show how they stack up against team averages.',

  whatToLookFor: [
    'Time-to-fill compared to target and team average',
    'Accept rate showing offer effectiveness',
    'Pipeline health (enough candidates at each stage)',
    'Activity levels (is work happening?)',
  ],

  watchOutFor: [
    'Low hire counts may mean hard reqs, not poor performance',
    'High activity isn\'t always productive',
    'Metrics don\'t capture relationship building or candidate experience',
    'Short time periods can be misleading',
  ],
};

export const RECRUITER_REQS_HELP: HelpContent = {
  whatYouSee:
    'A list of all requisitions assigned to this recruiter, with status and key details.',

  howItWorks:
    'Each req shows its current status, days open, candidate count, and any risk flags. Click a row to see more details about that requisition.',

  whatToLookFor: [
    'Reqs that have been open too long',
    'Reqs with no candidates (need sourcing)',
    'Risk flags like "stalled" or "zombie"',
    'Balance of req types and difficulty levels',
  ],

  watchOutFor: [
    'Some reqs are intentionally paused or deprioritized',
    'Days open alone doesn\'t indicate a problem',
    'Check if the recruiter has support for difficult reqs',
    'HM responsiveness affects time-to-fill too',
  ],
};
