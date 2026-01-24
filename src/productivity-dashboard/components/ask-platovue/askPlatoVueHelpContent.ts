// askPlatoVueHelpContent.ts
// Help content for the Ask PlatoVue tab
// Written at a 5th grade reading level for clarity

import { HelpContent } from '../common/HelpDrawer';

export const ASK_PLATOVUE_PAGE_HELP: HelpContent = {
  whatYouSee:
    'A conversational way to explore your recruiting data. Ask questions in plain English and get answers with supporting evidence.',

  howItWorks:
    'Type a question and we\'ll find the answer from your dashboard data. Every answer includes citations showing where the numbers came from. You can click citations to drill into that part of the dashboard.',

  whatToLookFor: [
    'Try suggested questions to get started',
    'Citations at the bottom show the data sources',
    'Click "Go to..." links to explore further',
    'The AI toggle switches between fast (deterministic) and flexible (AI) modes',
  ],

  watchOutFor: [
    'Answers are only as good as your data',
    'AI mode requires an API key configured in Settings',
    'Complex questions may need to be broken down',
    'All numbers come from the fact pack - nothing is made up',
  ],
};

export const SUGGESTED_QUESTIONS_HELP: HelpContent = {
  whatYouSee:
    'Pre-written questions that match common things people want to know. Click one to get an instant answer.',

  howItWorks:
    'These questions are mapped to specific data in your dashboard. They\'re designed to surface insights quickly without you having to figure out where to look.',

  whatToLookFor: [
    'Questions grouped by category (risks, actions, metrics)',
    'Each question shows what kind of answer you\'ll get',
    'Start here if you\'re not sure what to ask',
    'Your own questions can be more specific',
  ],

  watchOutFor: [
    'Suggested questions are generic - your own may be more relevant',
    'Some questions depend on having enough data',
    'The same question can give different answers as data changes',
    'Use these as starting points, then dig deeper',
  ],
};
