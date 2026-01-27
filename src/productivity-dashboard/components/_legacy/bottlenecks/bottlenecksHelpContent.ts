// bottlenecksHelpContent.ts
// Help content for the Bottlenecks & SLAs tab
// Written at a 5th grade reading level for clarity

import { HelpContent } from '../../common/HelpDrawer';

export const BOTTLENECKS_PAGE_HELP: HelpContent = {
  whatYouSee:
    'This page shows where candidates get stuck in your hiring process. When someone waits too long at a stage, it\'s called a "breach." More breaches mean a bigger problem.',

  howItWorks:
    'We check how long each candidate sits at each stage. If they wait longer than the target time (the SLA), that\'s a breach. We track who is responsible for moving candidates forward and measure how often delays happen.',

  whatToLookFor: [
    'Stages with high breach rates (shown in red)',
    'The same person causing many delays',
    'Patterns that repeat week after week',
    'Requisitions with multiple breaches',
  ],

  watchOutFor: [
    'A few bad reqs can skew the numbers',
    'Some stages naturally take longer (like onsite interviews)',
    'Low sample sizes can make percentages look worse than they are',
    'Holidays and out-of-office time can cause temporary spikes',
  ],
};

export const BOTTLENECK_STAGES_HELP: HelpContent = {
  whatYouSee:
    'A ranked list of stages where candidates wait the longest. The worst problems are at the top.',

  howItWorks:
    'Each stage gets a score based on three things: how long people wait (median time), how often they wait too long (breach rate), and how many people are affected (volume). Stages with high scores in all three areas rank higher.',

  whatToLookFor: [
    'Red indicators mean high breach rates (40%+)',
    'Yellow means moderate (20-40%)',
    'Green means healthy (under 20%)',
    'Look at the "X/Y breached" to see actual numbers',
  ],

  watchOutFor: [
    'A stage with 2/3 breached (67%) looks worse than 20/100 (20%)',
    'Check the volume before panicking about high percentages',
    'Some breaches happen because of holidays or out-of-office time',
    'The score formula weighs breach rate heavily',
  ],
};

export const SLA_BREACH_SUMMARY_HELP: HelpContent = {
  whatYouSee:
    'A breakdown of who is responsible for delays. This shows hiring managers, recruiters, and TA ops separately.',

  howItWorks:
    'Each stage has an "owner" who is responsible for moving candidates forward. When a breach happens, the owner gets tagged. We add up all breaches by owner type to show where delays come from.',

  whatToLookFor: [
    'Which group has the most breaches',
    'Individual owners with many breaches',
    'Patterns (same person, same stage)',
    'The percentage breakdown between owner types',
  ],

  watchOutFor: [
    'High breach counts might mean high volume, not poor performance',
    'Some owners handle harder roles that naturally take longer',
    'One bad req can make an owner look worse than they are',
    'Only HMs with 3+ breaches appear in the leaderboard',
  ],
};

export const BREACH_TABLE_HELP: HelpContent = {
  whatYouSee:
    'A list of job openings (reqs) with SLA breaches. The worst ones are at the top.',

  howItWorks:
    'For each req, we count how many times candidates waited too long. We show the stage where the worst breach happened and who was responsible. Click a row to see the full timeline.',

  whatToLookFor: [
    'Reqs with many breaches need attention',
    'Look at "Days Open" - older reqs often have more problems',
    'The "Worst Stage" column shows where the biggest delay happened',
    'Click a row to drill into the timeline',
  ],

  watchOutFor: [
    'A req might have breaches because it\'s hard to fill, not because of slow owners',
    'Check if the hiring manager has been responsive',
    'Some breaches resolve themselves (candidate moves forward)',
    'The "breach hours" is cumulative across all stages',
  ],
};
