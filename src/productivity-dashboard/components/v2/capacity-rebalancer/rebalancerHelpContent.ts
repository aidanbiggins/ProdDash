/**
 * Help content for Capacity Rebalancer tab
 */

import { HelpContent } from '../../common/HelpDrawer';

export const REBALANCER_PAGE_HELP: HelpContent = {
  whatYouSee:
    'A tool to identify overloaded recruiters and suggest workload rebalancing moves. Shows who has too much work, who has capacity, and which req reassignments would help most.',

  howItWorks:
    'Utilization is calculated as Demand ÷ Capacity. Demand is weighted by stage complexity (Screen 35%, HM Screen 25%, Onsite 25%, Offer 15%). Status thresholds: Critical >120%, Overloaded >110%, Balanced 90-110%, Available <90%. Suggested moves are ranked by expected delay reduction.',

  whatToLookFor: [
    'Recruiters with critical or overloaded status',
    'Available recruiters who can take on more work',
    'High-impact moves that reduce delays significantly',
    'Confidence levels on suggestions (HIGH means more reliable)',
  ],

  watchOutFor: [
    'Limited recruiter_id coverage reduces analysis accuracy',
    'Transfer costs add ~2 days context-switch overhead',
    'Low confidence suggestions need manual review',
    'Apply Plan creates action items - no ATS changes are automatic',
  ],
};

export const UTILIZATION_TABLE_HELP: HelpContent = {
  whatYouSee:
    'A sortable table showing each recruiter\'s current workload status. Columns show demand (active candidates), capacity (per week), utilization percentage, and status classification.',

  howItWorks:
    'Click column headers to sort. By default sorted by utilization to highlight overloaded recruiters first. Click a row to open detailed workload breakdown.',

  whatToLookFor: [
    'Recruiters with high utilization (red/yellow status)',
    'Recruiters with low utilization who could help',
    'Stage-level breakdown in the detail drawer',
    'Confidence notes explaining data quality',
  ],

  watchOutFor: [
    'High utilization doesn\'t always mean overloaded',
    'Some recruiters handle higher complexity roles',
    'Missing recruiter_id data appears at bottom',
    'Capacity estimates are based on historical patterns',
  ],
};

export const SUGGESTED_MOVES_HELP: HelpContent = {
  whatYouSee:
    'A ranked list of suggested req reassignments. Each card shows the requisition, source and target recruiters, expected delay reduction, and confidence level.',

  howItWorks:
    'Moves are scored by net system improvement. We subtract transfer costs (~2 days) and consider both source relief and target impact. Only moves that improve overall throughput are suggested.',

  whatToLookFor: [
    'High confidence moves that reduce delays significantly',
    'Whether target recruiter has real capacity',
    'The pipeline being moved (candidates by stage)',
    'Net system improvement in the detail view',
  ],

  watchOutFor: [
    'Individual applies create action items for each move',
    'Apply Plan creates items for all suggested moves',
    'No ATS changes happen automatically',
    'Review detail view before applying uncertain moves',
  ],
};
