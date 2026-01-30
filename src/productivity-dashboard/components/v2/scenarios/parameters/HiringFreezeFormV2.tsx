/**
 * HiringFreezeFormV2
 *
 * Parameter form for the Hiring Freeze scenario.
 * V2 version using Tailwind tokens and mobile-friendly styling.
 */

import React, { useState } from 'react';
import { Play, Loader2, Info } from 'lucide-react';
import { HiringFreezeParams } from '../../../../types/scenarioTypes';

interface HiringFreezeFormV2Props {
  onSubmit: (params: HiringFreezeParams) => void;
  isRunning: boolean;
}

const CANDIDATE_ACTIONS: Array<{
  value: 'HOLD' | 'REJECT_SOFT' | 'WITHDRAW';
  label: string;
  description: string;
}> = [
  { value: 'HOLD', label: 'Hold in Place', description: 'Keep candidates where they are in the process' },
  { value: 'REJECT_SOFT', label: 'Soft Reject', description: 'Send friendly "timing not right" message' },
  { value: 'WITHDRAW', label: 'Withdraw', description: 'Remove candidates from process entirely' },
];

const SCOPE_TYPES: Array<{ value: 'ALL' | 'FUNCTION' | 'LEVEL' | 'SPECIFIC_REQS'; label: string }> = [
  { value: 'ALL', label: 'All Open Requisitions' },
  { value: 'FUNCTION', label: 'Specific Function' },
  { value: 'LEVEL', label: 'Specific Level' },
  { value: 'SPECIFIC_REQS', label: 'Specific Requisitions' },
];

const COMMON_FUNCTIONS = ['Engineering', 'Product', 'Design', 'Sales', 'Marketing', 'Operations'];
const COMMON_LEVELS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'Intern', 'Contractor'];

export function HiringFreezeFormV2({ onSubmit, isRunning }: HiringFreezeFormV2Props) {
  const [freezeWeeks, setFreezeWeeks] = useState(4);
  const [candidateAction, setCandidateAction] = useState<'HOLD' | 'REJECT_SOFT' | 'WITHDRAW'>('HOLD');
  const [scopeType, setScopeType] = useState<'ALL' | 'FUNCTION' | 'LEVEL' | 'SPECIFIC_REQS'>('ALL');
  const [scopeFilterValue, setScopeFilterValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const params: HiringFreezeParams = {
      freeze_weeks: freezeWeeks,
      candidate_action: candidateAction,
      scope: {
        type: scopeType,
        ...(scopeType !== 'ALL' && scopeFilterValue && { filter_value: scopeFilterValue }),
      },
    };

    onSubmit(params);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Freeze Duration */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Freeze Duration (Weeks)
          </label>
          <input
            type="number"
            className="w-full px-3 py-2 min-h-[44px] text-sm bg-muted/30 border border-border rounded-md text-foreground"
            value={freezeWeeks}
            onChange={(e) =>
              setFreezeWeeks(Math.max(1, Math.min(26, parseInt(e.target.value) || 4)))
            }
            min={1}
            max={26}
          />
          <small className="text-muted-foreground">Duration of hiring freeze (1-26 weeks)</small>
        </div>

        {/* Candidate Action */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Candidate Action
          </label>
          <select
            className="w-full px-3 py-2 min-h-[44px] text-sm bg-muted/30 border border-border rounded-md text-foreground appearance-none"
            value={candidateAction}
            onChange={(e) =>
              setCandidateAction(e.target.value as 'HOLD' | 'REJECT_SOFT' | 'WITHDRAW')
            }
          >
            {CANDIDATE_ACTIONS.map((action) => (
              <option key={action.value} value={action.value}>
                {action.label}
              </option>
            ))}
          </select>
          <small className="text-muted-foreground">
            {CANDIDATE_ACTIONS.find((a) => a.value === candidateAction)?.description}
          </small>
        </div>

        {/* Scope Type */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Scope</label>
          <select
            className="w-full px-3 py-2 min-h-[44px] text-sm bg-muted/30 border border-border rounded-md text-foreground appearance-none"
            value={scopeType}
            onChange={(e) => {
              setScopeType(e.target.value as typeof scopeType);
              setScopeFilterValue('');
            }}
          >
            {SCOPE_TYPES.map((scope) => (
              <option key={scope.value} value={scope.value}>
                {scope.label}
              </option>
            ))}
          </select>
        </div>

        {/* Scope Filter Value */}
        {scopeType !== 'ALL' && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {scopeType === 'FUNCTION' && 'Function'}
              {scopeType === 'LEVEL' && 'Level'}
              {scopeType === 'SPECIFIC_REQS' && 'Requisition IDs'}
            </label>
            {scopeType === 'FUNCTION' ? (
              <select
                className="w-full px-3 py-2 min-h-[44px] text-sm bg-muted/30 border border-border rounded-md text-foreground appearance-none"
                value={scopeFilterValue}
                onChange={(e) => setScopeFilterValue(e.target.value)}
              >
                <option value="">Select function...</option>
                {COMMON_FUNCTIONS.map((fn) => (
                  <option key={fn} value={fn}>
                    {fn}
                  </option>
                ))}
              </select>
            ) : scopeType === 'LEVEL' ? (
              <select
                className="w-full px-3 py-2 min-h-[44px] text-sm bg-muted/30 border border-border rounded-md text-foreground appearance-none"
                value={scopeFilterValue}
                onChange={(e) => setScopeFilterValue(e.target.value)}
              >
                <option value="">Select level...</option>
                {COMMON_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="w-full px-3 py-2 min-h-[44px] text-sm bg-muted/30 border border-border rounded-md text-foreground"
                value={scopeFilterValue}
                onChange={(e) => setScopeFilterValue(e.target.value)}
                placeholder="REQ-001, REQ-002, ..."
              />
            )}
          </div>
        )}
      </div>

      {/* Impact Preview */}
      <div className="p-3 rounded-lg bg-primary/10 text-primary flex items-start text-sm">
        <Info size={16} className="mr-2 mt-0.5 shrink-0" />
        <div>
          <span className="font-semibold">Impact Preview:</span> A {freezeWeeks}-week freeze with "
          {candidateAction.toLowerCase().replace('_', ' ')}" action will affect{' '}
          {scopeType === 'ALL' ? 'all open requisitions' : `requisitions in scope`}. Expect
          candidate decay and potential pipeline attrition.
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          className="w-full md:w-auto px-6 py-3 min-h-[44px] rounded-md bg-accent text-white font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
          disabled={isRunning || (scopeType !== 'ALL' && !scopeFilterValue)}
        >
          {isRunning ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play size={16} className="mr-2" />
              Run Scenario
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default HiringFreezeFormV2;
