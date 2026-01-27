// overviewHelpContent.ts
// Help content for the Overview tab
// Written at a 5th grade reading level for clarity

import { HelpContent } from '../../common/HelpDrawer';

export const OVERVIEW_PAGE_HELP: HelpContent = {
  whatYouSee:
    'A high-level summary of your recruiting operation. This shows key metrics, trends over time, and the overall health of your hiring process.',

  howItWorks:
    'We calculate metrics from your requisition and candidate data. Weekly trends show how things are changing. The funnel shows where candidates drop off in your process.',

  whatToLookFor: [
    'Metrics trending in the wrong direction (up when they should be down, or vice versa)',
    'Funnel stages with big drop-offs',
    'Comparisons to prior periods',
    'Overall patterns across all your hiring',
  ],

  watchOutFor: [
    'This is an aggregate view - individual recruiter or HM issues may be hidden',
    'Small changes in metrics may not be meaningful',
    'Seasonal patterns can affect trends',
    'The data is only as fresh as your last import',
  ],
};

export const FUNNEL_HELP: HelpContent = {
  whatYouSee:
    'A visual breakdown of how candidates move through your hiring process, from application to hire.',

  howItWorks:
    'Each bar shows how many candidates reached that stage. The percentage shows the conversion rate from the previous stage. Taller bars mean more candidates.',

  whatToLookFor: [
    'Stages with low conversion rates (big drop-offs)',
    'Bottlenecks where candidates pile up',
    'Healthy flow from stage to stage',
    'Compare to industry benchmarks if available',
  ],

  watchOutFor: [
    'Some drop-off is normal and healthy',
    'Different roles have different funnel shapes',
    'The funnel doesn\'t show time - just volume',
    'Candidates may skip stages or go backward',
  ],
};

export const WEEKLY_TRENDS_HELP: HelpContent = {
  whatYouSee:
    'Charts showing how key metrics change week over week. This helps you spot trends and patterns.',

  howItWorks:
    'Each point on the chart represents one week of data. Lines connect the points to show direction. Green trends are positive, red trends need attention.',

  whatToLookFor: [
    'Consistent upward or downward trends',
    'Sudden spikes or drops that need investigation',
    'Seasonal patterns (end of quarter, holidays)',
    'Whether recent changes had the expected effect',
  ],

  watchOutFor: [
    'One bad week doesn\'t mean a crisis',
    'Trends need at least 4-6 weeks to be meaningful',
    'External factors (budget, market) affect trends',
    'Compare to the same period last year if possible',
  ],
};
