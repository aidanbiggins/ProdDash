// velocityHelpContent.ts
// Help content for the Pipeline Velocity tab
// Written at a 5th grade reading level for clarity

import { HelpContent } from '../common/HelpDrawer';

export const VELOCITY_PAGE_HELP: HelpContent = {
  whatYouSee:
    'Deep analysis of how quickly candidates and requisitions move through your hiring process. Velocity directly impacts your ability to compete for talent.',

  howItWorks:
    'We measure time at each stage, conversion rates between stages, and overall time-to-fill. Faster velocity means less candidate drop-off and quicker hires. We compare fast hires to slow hires to find patterns.',

  whatToLookFor: [
    'Stages where candidates spend too long (bottlenecks)',
    'Differences between fast hires and slow hires',
    'Trends in velocity over time',
    'Whether process changes have improved speed',
  ],

  watchOutFor: [
    'Speed without quality leads to bad hires',
    'Some stages need time for good decisions',
    'External factors (HM availability, holidays) affect velocity',
    'Small sample sizes can be misleading',
  ],
};

export const TIME_TO_FILL_HELP: HelpContent = {
  whatYouSee:
    'How long it takes to fill a requisition from open to hired. This is the ultimate measure of recruiting efficiency.',

  howItWorks:
    'Time-to-fill is calculated from req open date to candidate hire date. We show median (middle value) because averages can be skewed by outliers. We also show distribution.',

  whatToLookFor: [
    'Median TTF compared to your target (usually 30-45 days)',
    'Distribution shape - tight or spread out?',
    'Outliers that may need investigation',
    'Trends over time',
  ],

  watchOutFor: [
    'TTF can be misleading if reqs are paused or deprioritized',
    'Different roles have very different TTF expectations',
    'Zombie reqs should be excluded from calculations',
    'Consider "true TTF" which excludes unhealthy reqs',
  ],
};

export const STAGE_VELOCITY_HELP: HelpContent = {
  whatYouSee:
    'A breakdown of how long candidates spend at each stage of your hiring process.',

  howItWorks:
    'We track when candidates enter and exit each stage. Median time gives you the typical duration. We compare to your SLA targets to identify bottlenecks.',

  whatToLookFor: [
    'Stages exceeding SLA targets',
    'Where candidates wait longest',
    'Stages with high variability (some fast, some slow)',
    'Whether stage times have improved recently',
  ],

  watchOutFor: [
    'Some stages have multiple sub-steps not visible in data',
    'Waiting time vs. active time aren\'t separated',
    'Weekends and holidays affect stage duration',
    'Stage definitions may vary across your ATS',
  ],
};

export const FAST_VS_SLOW_HELP: HelpContent = {
  whatYouSee:
    'A comparison of what makes fast hires different from slow hires. This helps identify practices that speed up hiring.',

  howItWorks:
    'We split hires into fast (below median TTF) and slow (above median). Then we compare characteristics: source, HM response time, interview count, etc.',

  whatToLookFor: [
    'Sources that produce faster hires',
    'HM behaviors that correlate with speed',
    'Interview processes that are more efficient',
    'Patterns you can replicate',
  ],

  watchOutFor: [
    'Fast isn\'t always better - check quality too',
    'Some fast hires are just easier roles',
    'Correlation isn\'t causation',
    'Sample sizes need to be adequate for comparison',
  ],
};
