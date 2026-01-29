// scenariosHelpContent.ts
// Help content for the What-If Scenarios tab
// Written at a 5th grade reading level for clarity

import { HelpContent } from '../../common/HelpDrawer';

export const SCENARIOS_PAGE_HELP: HelpContent = {
  whatYouSee:
    'A simulator for testing how different situations would affect your recruiting operation. Run "what-if" scenarios to prepare for changes.',

  howItWorks:
    'Choose a scenario type (hiring freeze, team change, budget cut, etc.) and adjust the parameters. The simulator projects the impact on your metrics, timeline, and capacity.',

  whatToLookFor: [
    'Impact magnitude - how much would things change?',
    'Timeline - how quickly would you feel the effects?',
    'Mitigation options - what could you do to reduce impact?',
    'Dependencies - what else would be affected?',
  ],

  watchOutFor: [
    'Scenarios are simplified models of reality',
    'Real situations have more variables',
    'Use scenarios for directional thinking, not precise prediction',
    'Consider multiple scenarios, not just one',
  ],
};

export const SCENARIO_BUILDER_HELP: HelpContent = {
  whatYouSee:
    'Controls for setting up your what-if scenario: type, parameters, and assumptions.',

  howItWorks:
    'Select a scenario type, then adjust the parameters (like how many recruiters leave, or what percentage of budget is cut). The simulator applies these to your current data.',

  whatToLookFor: [
    'Scenario types that match your concerns',
    'Realistic parameter values',
    'Multiple scenarios to compare',
    'The "baseline" to compare against',
  ],

  watchOutFor: [
    'Extreme scenarios may break the model',
    'Parameters interact in complex ways',
    'Start with small changes to understand the model',
    'Validate against intuition before presenting',
  ],
};

export const SCENARIO_RESULTS_HELP: HelpContent = {
  whatYouSee:
    'The projected impact of your scenario: changes to metrics, timeline, and operations.',

  howItWorks:
    'We apply your scenario to your current state and project forward. Results show what metrics would change and by how much. We also suggest mitigations.',

  whatToLookFor: [
    'Biggest metric impacts',
    'How long until effects are felt',
    'Which teams or roles are most affected',
    'Whether mitigations can offset the impact',
  ],

  watchOutFor: [
    'Results are projections, not certainties',
    'Second-order effects may not be captured',
    "People adapt in ways models can't predict",
    'Use results to spark discussion, not end it',
  ],
};

export const SCENARIO_LIBRARY_HELP: HelpContent = {
  whatYouSee:
    'Pre-built scenario templates for common situations: hiring freezes, team changes, budget adjustments, and more.',

  howItWorks:
    'Each template has pre-set parameters based on typical situations. You can use them as-is or customize for your specific needs.',

  whatToLookFor: [
    'Scenarios relevant to your current situation',
    'Templates you can customize',
    'Combinations of scenarios (e.g., freeze + attrition)',
    "Historical scenarios you've run before",
  ],

  watchOutFor: [
    'Templates are generic - customize for accuracy',
    'Your situation may not match the template exactly',
    'Some scenarios are more likely than others',
    "Keep a record of scenarios you've run",
  ],
};
