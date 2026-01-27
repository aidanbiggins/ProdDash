// recruiterHelpContent.ts
// Help content for the Recruiter Performance tab
// Written at a 5th grade reading level for clarity

import React from 'react';
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

// Table styles for help drawer
const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: '0.75rem',
  marginBottom: '0.75rem',
  fontSize: '0.8rem',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.5rem',
  borderBottom: '1px solid rgba(255,255,255,0.2)',
  color: 'var(--text-secondary)',
  fontWeight: 600,
  textTransform: 'uppercase',
  fontSize: '0.65rem',
  letterSpacing: '0.05em',
};

const tdStyle: React.CSSProperties = {
  padding: '0.5rem',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  color: 'var(--text-primary)',
};

const tdAccentStyle: React.CSSProperties = {
  ...tdStyle,
  fontFamily: 'var(--font-mono)',
  color: 'var(--color-accent-secondary)',
  fontWeight: 600,
};

export const PRODUCTIVITY_TREND_HELP: HelpContent = {
  whatYouSee:
    'A chart showing recruiter productivity over time. The Y-axis shows "Weighted Hires per Open Req" — a ratio that accounts for role difficulty, not just raw hire counts.',

  howItWorks: React.createElement('div', null,
    React.createElement('p', { style: { marginBottom: '0.75rem' } },
      'Each hire gets a "complexity score" based on four factors. These weights are multiplied together:'
    ),
    React.createElement('table', { style: tableStyle },
      React.createElement('thead', null,
        React.createElement('tr', null,
          React.createElement('th', { style: thStyle }, 'Factor'),
          React.createElement('th', { style: thStyle }, 'What It Measures'),
          React.createElement('th', { style: thStyle }, 'Range'),
        )
      ),
      React.createElement('tbody', null,
        React.createElement('tr', null,
          React.createElement('td', { style: tdStyle }, 'Level Weight'),
          React.createElement('td', { style: tdStyle }, 'Seniority (IC vs Director)'),
          React.createElement('td', { style: tdAccentStyle }, '1.0× – 1.5×'),
        ),
        React.createElement('tr', null,
          React.createElement('td', { style: tdStyle }, 'Market Weight'),
          React.createElement('td', { style: tdStyle }, 'Location type difficulty'),
          React.createElement('td', { style: tdAccentStyle }, '0.9× – 1.2×'),
        ),
        React.createElement('tr', null,
          React.createElement('td', { style: tdStyle }, 'Niche Weight'),
          React.createElement('td', { style: tdStyle }, 'Job family scarcity'),
          React.createElement('td', { style: tdAccentStyle }, '1.0× – 1.4×'),
        ),
        React.createElement('tr', null,
          React.createElement('td', { style: tdStyle }, 'HM Weight'),
          React.createElement('td', { style: tdStyle }, 'Hiring manager responsiveness'),
          React.createElement('td', { style: tdAccentStyle }, '0.8× – 1.3×'),
        ),
      )
    ),
    React.createElement('p', { style: { marginTop: '0.75rem', marginBottom: '0.5rem', fontWeight: 600 } },
      'Example Calculation:'
    ),
    React.createElement('table', { style: tableStyle },
      React.createElement('thead', null,
        React.createElement('tr', null,
          React.createElement('th', { style: thStyle }, 'Hire'),
          React.createElement('th', { style: thStyle }, 'Level'),
          React.createElement('th', { style: thStyle }, 'Market'),
          React.createElement('th', { style: thStyle }, 'Niche'),
          React.createElement('th', { style: thStyle }, 'HM'),
          React.createElement('th', { style: thStyle }, 'Score'),
        )
      ),
      React.createElement('tbody', null,
        React.createElement('tr', null,
          React.createElement('td', { style: tdStyle }, 'Sr. ML Engineer (Onsite)'),
          React.createElement('td', { style: tdStyle }, '1.2'),
          React.createElement('td', { style: tdStyle }, '1.1'),
          React.createElement('td', { style: tdStyle }, '1.3'),
          React.createElement('td', { style: tdStyle }, '1.0'),
          React.createElement('td', { style: tdAccentStyle }, '1.72'),
        ),
        React.createElement('tr', null,
          React.createElement('td', { style: tdStyle }, 'Jr. Analyst (Remote)'),
          React.createElement('td', { style: tdStyle }, '1.0'),
          React.createElement('td', { style: tdStyle }, '0.9'),
          React.createElement('td', { style: tdStyle }, '1.0'),
          React.createElement('td', { style: tdStyle }, '1.1'),
          React.createElement('td', { style: tdAccentStyle }, '0.99'),
        ),
      )
    ),
    React.createElement('p', { style: { marginTop: '0.75rem', padding: '0.5rem', background: 'rgba(45, 212, 191, 0.1)', borderRadius: '4px', borderLeft: '3px solid var(--color-accent-secondary)' } },
      React.createElement('strong', null, 'Formula: '),
      'Σ(Level × Market × Niche × HM) ÷ Open Reqs = Productivity'
    )
  ),

  whatToLookFor: [
    'Upward trends indicate improving efficiency',
    'Consistent peaks suggest steady, predictable output',
    'Dips during holidays or reorg periods are normal',
    'Compare to prior period (dotted line) for context',
  ],

  watchOutFor: [
    'Raw hire counts favor recruiters with easy reqs — this metric corrects for that',
    'A recruiter with 3 hard hires may outscore one with 5 easy hires',
    'Zero productivity weeks often mean no hires closed, not inactivity',
    'The HM weight penalizes recruiters stuck with slow hiring managers — check if that\'s the case',
    'Weights are configurable in Settings → Dashboard Config',
  ],
};
