// sourceEffectivenessHelpContent.ts
// Help content for the Source Effectiveness tab
// Written at a 5th grade reading level for clarity

import { HelpContent } from '../../common/HelpDrawer';

export const SOURCE_EFFECTIVENESS_PAGE_HELP: HelpContent = {
  whatYouSee:
    'An analysis of where your best candidates come from. Compare different sources by volume, quality, and cost to optimize your recruiting spend.',

  howItWorks:
    'We track the source of each candidate (job boards, referrals, agencies, etc.) and follow them through the funnel. Sources that produce more hires at lower cost rank higher.',

  whatToLookFor: [
    'Sources with high conversion rates (quality)',
    'Sources with high volume (scale)',
    'Cost per hire by source (efficiency)',
    'Sources that perform differently by role type',
  ],

  watchOutFor: [
    'Volume without quality wastes recruiter time',
    'Some sources are better for certain roles',
    'Attribution can be tricky (candidate may come from multiple sources)',
    'New sources need time to show results',
  ],
};

export const SOURCE_FUNNEL_HELP: HelpContent = {
  whatYouSee:
    'A breakdown of how candidates from each source move through your hiring funnel.',

  howItWorks:
    'For each source, we show how many candidates entered and what percentage made it to each stage. Higher conversion through the funnel indicates better quality candidates.',

  whatToLookFor: [
    'Sources with high drop-off at screening (low quality)',
    'Sources with strong flow-through to offers',
    'Where in the funnel different sources lose candidates',
    'Whether paid sources outperform organic',
  ],

  watchOutFor: [
    'Early stage drop-off may be a screening issue, not source quality',
    'Small candidate counts make percentages unreliable',
    'Some sources excel at specific stages (referrals often strong at final)',
    'Compare like-to-like (similar roles, same time period)',
  ],
};

export const SOURCE_ROI_HELP: HelpContent = {
  whatYouSee:
    'Return on investment analysis showing which sources give you the best value for your recruiting spend.',

  howItWorks:
    'We calculate cost per applicant, cost per interview, and cost per hire for each source. Sources with lower cost per hire and good quality rank highest.',

  whatToLookFor: [
    'Sources with low cost per hire',
    'Whether expensive sources justify their cost with quality',
    'Opportunities to shift budget to better performers',
    'Hidden costs (recruiter time) not captured in direct spend',
  ],

  watchOutFor: [
    'Cheapest isn\'t always best - consider quality too',
    'Some roles require expensive sources (executive search)',
    'ROI calculations depend on accurate cost data',
    'Brand value from some sources is hard to measure',
  ],
};
