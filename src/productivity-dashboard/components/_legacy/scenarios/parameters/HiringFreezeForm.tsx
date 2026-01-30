/**
 * Hiring Freeze Form
 *
 * Parameter form for the Hiring Freeze scenario.
 */

import React, { useState } from 'react';
import { HiringFreezeParams } from '../../../../types/scenarioTypes';

interface HiringFreezeFormProps {
  onSubmit: (params: HiringFreezeParams) => void;
  isRunning: boolean;
}

const CANDIDATE_ACTIONS: Array<{ value: 'HOLD' | 'REJECT_SOFT' | 'WITHDRAW'; label: string; description: string }> = [
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

export default function HiringFreezeForm({ onSubmit, isRunning }: HiringFreezeFormProps) {
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
    <form onSubmit={handleSubmit} className="scenario-form">
      <div className="grid grid-cols-12 gap-3">
        {/* Freeze Duration */}
        <div className="col-span-12 md:col-span-6">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Freeze Duration (Weeks)</label>
          <input
            type="number"
            className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md"
            value={freezeWeeks}
            onChange={e => setFreezeWeeks(Math.max(1, Math.min(26, parseInt(e.target.value) || 4)))}
            min={1}
            max={26}
          />
          <small className="text-muted-foreground">Duration of hiring freeze (1-26 weeks)</small>
        </div>

        {/* Candidate Action */}
        <div className="col-span-12 md:col-span-6">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Candidate Action</label>
          <select
            className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md appearance-none"
            value={candidateAction}
            onChange={e => setCandidateAction(e.target.value as 'HOLD' | 'REJECT_SOFT' | 'WITHDRAW')}
          >
            {CANDIDATE_ACTIONS.map(action => (
              <option key={action.value} value={action.value}>
                {action.label}
              </option>
            ))}
          </select>
          <small className="text-muted-foreground">
            {CANDIDATE_ACTIONS.find(a => a.value === candidateAction)?.description}
          </small>
        </div>

        {/* Scope Type */}
        <div className="col-span-12 md:col-span-6">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Scope</label>
          <select
            className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md appearance-none"
            value={scopeType}
            onChange={e => {
              setScopeType(e.target.value as typeof scopeType);
              setScopeFilterValue('');
            }}
          >
            {SCOPE_TYPES.map(scope => (
              <option key={scope.value} value={scope.value}>
                {scope.label}
              </option>
            ))}
          </select>
        </div>

        {/* Scope Filter Value */}
        {scopeType !== 'ALL' && (
          <div className="col-span-12 md:col-span-6">
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {scopeType === 'FUNCTION' && 'Function'}
              {scopeType === 'LEVEL' && 'Level'}
              {scopeType === 'SPECIFIC_REQS' && 'Requisition IDs'}
            </label>
            {scopeType === 'FUNCTION' ? (
              <select
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md appearance-none"
                value={scopeFilterValue}
                onChange={e => setScopeFilterValue(e.target.value)}
              >
                <option value="">Select function...</option>
                {COMMON_FUNCTIONS.map(fn => (
                  <option key={fn} value={fn}>{fn}</option>
                ))}
              </select>
            ) : scopeType === 'LEVEL' ? (
              <select
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md appearance-none"
                value={scopeFilterValue}
                onChange={e => setScopeFilterValue(e.target.value)}
              >
                <option value="">Select level...</option>
                {COMMON_LEVELS.map(lvl => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md"
                value={scopeFilterValue}
                onChange={e => setScopeFilterValue(e.target.value)}
                placeholder="REQ-001, REQ-002, ..."
              />
            )}
          </div>
        )}

        {/* Impact Preview */}
        <div className="col-span-12">
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 mb-0">
            <i className="bi bi-info-circle mr-2" />
            <strong>Impact Preview:</strong> A {freezeWeeks}-week freeze with "{candidateAction.toLowerCase().replace('_', ' ')}"
            action will affect {scopeType === 'ALL' ? 'all open requisitions' : `requisitions in scope`}.
            Expect candidate decay and potential pipeline attrition.
          </div>
        </div>
      </div>

      <div className="mt-4">
        <button
          type="submit"
          className="w-full md:w-auto px-6 py-3 min-h-[44px] rounded-md bg-accent-primary text-white font-medium hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isRunning || (scopeType !== 'ALL' && !scopeFilterValue)}
        >
          {isRunning ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin mr-2" />
              Running...
            </>
          ) : (
            <>
              <i className="bi bi-play-fill mr-2" />
              Run Scenario
            </>
          )}
        </button>
      </div>
    </form>
  );
}
