// hmFrictionHelpContent.ts
// Help content for the HM Latency tab
// Written at a 5th grade reading level for clarity

import { HelpContent } from '../../common/HelpDrawer';

export const HM_FRICTION_PAGE_HELP: HelpContent = {
  whatYouSee:
    'An analysis of how quickly hiring managers respond to recruiting activities. Slow HM response is one of the biggest causes of lost candidates and long time-to-fill.',

  howItWorks:
    'We measure the time between when a recruiter submits something (candidates, requests) and when the hiring manager responds. Long delays create friction in the hiring process.',

  whatToLookFor: [
    'HMs with consistently slow response times',
    'Stages where HM delays are worst (screen, interview feedback)',
    'Trends in response time over the past weeks',
    'Impact of delays on overall time-to-fill',
  ],

  watchOutFor: [
    'Some HMs have larger teams and more hiring, so volume matters',
    'PTO and busy periods affect response times',
    'Not all delays are the HM\'s fault - check if recruiters followed up',
    'Response time targets vary by company culture',
  ],
};

export const HM_LATENCY_BREAKDOWN_HELP: HelpContent = {
  whatYouSee:
    'A breakdown of where HM delays happen most often. Different activities have different response time expectations.',

  howItWorks:
    'We categorize HM activities: resume review, screen feedback, interview scheduling, offer decisions, etc. Each category has a target response time. We measure actual vs. target.',

  whatToLookFor: [
    'Categories with the longest delays',
    'Whether delays are getting better or worse',
    'Specific HMs who are outliers in certain categories',
    'Correlation between delay types and candidate drop-off',
  ],

  watchOutFor: [
    'Some activities are more complex and need more time',
    'Group interviews require coordinating multiple HMs',
    'Offer decisions may need budget or leadership approval',
    'Focus on the delays that impact candidates most',
  ],
};

export const HM_RANKING_HELP: HelpContent = {
  whatYouSee:
    'A ranked list of hiring managers by their average response time. This helps identify who needs coaching or support.',

  howItWorks:
    'Each HM gets an average response time across all their activities. We rank from fastest to slowest. You can also see their volume to provide context.',

  whatToLookFor: [
    'HMs at the bottom who may need help',
    'HMs at the top who could mentor others',
    'Whether high-volume HMs have worse response times',
    'Patterns by department or level',
  ],

  watchOutFor: [
    'Low volume HMs may have skewed averages',
    'A single very long delay can drag down the average',
    'Consider using median instead of mean for fairness',
    'Have a conversation before drawing conclusions',
  ],
};
