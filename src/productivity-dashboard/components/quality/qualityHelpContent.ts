// qualityHelpContent.ts
// Help content for the Quality Guardrails tab
// Written at a 5th grade reading level for clarity

import { HelpContent } from '../common/HelpDrawer';

export const QUALITY_PAGE_HELP: HelpContent = {
  whatYouSee:
    'Quality metrics that help ensure you\'re not just hiring fast, but hiring well. This shows offer acceptance, candidate experience, and hiring manager satisfaction indicators.',

  howItWorks:
    'Quality is measured through outcomes: Do candidates accept offers? Do they stay? Are hiring managers satisfied? We track these metrics alongside speed metrics to ensure balance.',

  whatToLookFor: [
    'Offer acceptance rate - should be 80%+ for most roles',
    'Reasons for declined offers (compensation, timing, counter-offers)',
    'Candidate drop-off points in the process',
    'Feedback quality and consistency',
  ],

  watchOutFor: [
    'High speed with low quality is worse than balanced performance',
    'Some roles naturally have lower acceptance rates',
    'Quality issues often have root causes in the process',
    'Talk to candidates and HMs for qualitative feedback too',
  ],
};

export const ACCEPTANCE_RATE_HELP: HelpContent = {
  whatYouSee:
    'The percentage of offers that candidates accept. This is a key indicator of offer competitiveness and process quality.',

  howItWorks:
    'We count offers extended and offers accepted over your date range. The rate is accepted divided by extended. We break down by decline reason when available.',

  whatToLookFor: [
    'Overall rate compared to your target (usually 80%+)',
    'Trends over time - is it improving or declining?',
    'Differences by role, level, or recruiter',
    'Common decline reasons that can be addressed',
  ],

  watchOutFor: [
    'Small numbers can swing the percentage dramatically',
    'Competitive markets have lower acceptance rates',
    'Counter-offers may be out of your control',
    'Some decline reasons (relocation, timing) aren\'t about the offer',
  ],
};

export const CANDIDATE_EXPERIENCE_HELP: HelpContent = {
  whatYouSee:
    'Indicators of how candidates experience your hiring process: time to respond, interview burden, and communication clarity.',

  howItWorks:
    'We measure touchpoints: how long candidates wait, how many interviews they do, whether they get timely updates. Poor experience leads to drop-offs and declined offers.',

  whatToLookFor: [
    'Long waits between stages (candidate cooling off)',
    'Too many interview rounds (candidate fatigue)',
    'Stages where candidates withdraw most often',
    'Correlation between experience metrics and acceptance',
  ],

  watchOutFor: [
    'Not all candidate experience is captured in data',
    'Some complexity is necessary for good hiring decisions',
    'Candidates have different expectations by role level',
    'Surveys and feedback provide richer information',
  ],
};
