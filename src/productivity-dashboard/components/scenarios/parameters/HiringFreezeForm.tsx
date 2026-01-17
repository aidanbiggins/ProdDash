/**
 * Hiring Freeze Form
 *
 * Parameter form for the Hiring Freeze scenario.
 */

import React, { useState } from 'react';
import { HiringFreezeParams } from '../../../types/scenarioTypes';

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
      <div className="row g-3">
        {/* Freeze Duration */}
        <div className="col-md-6">
          <label className="form-label">Freeze Duration (Weeks)</label>
          <input
            type="number"
            className="form-control"
            value={freezeWeeks}
            onChange={e => setFreezeWeeks(Math.max(1, Math.min(26, parseInt(e.target.value) || 4)))}
            min={1}
            max={26}
          />
          <small className="text-secondary">Duration of hiring freeze (1-26 weeks)</small>
        </div>

        {/* Candidate Action */}
        <div className="col-md-6">
          <label className="form-label">Candidate Action</label>
          <select
            className="form-select"
            value={candidateAction}
            onChange={e => setCandidateAction(e.target.value as 'HOLD' | 'REJECT_SOFT' | 'WITHDRAW')}
          >
            {CANDIDATE_ACTIONS.map(action => (
              <option key={action.value} value={action.value}>
                {action.label}
              </option>
            ))}
          </select>
          <small className="text-secondary">
            {CANDIDATE_ACTIONS.find(a => a.value === candidateAction)?.description}
          </small>
        </div>

        {/* Scope Type */}
        <div className="col-md-6">
          <label className="form-label">Scope</label>
          <select
            className="form-select"
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
          <div className="col-md-6">
            <label className="form-label">
              {scopeType === 'FUNCTION' && 'Function'}
              {scopeType === 'LEVEL' && 'Level'}
              {scopeType === 'SPECIFIC_REQS' && 'Requisition IDs'}
            </label>
            {scopeType === 'FUNCTION' ? (
              <select
                className="form-select"
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
                className="form-select"
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
                className="form-control"
                value={scopeFilterValue}
                onChange={e => setScopeFilterValue(e.target.value)}
                placeholder="REQ-001, REQ-002, ..."
              />
            )}
          </div>
        )}

        {/* Impact Preview */}
        <div className="col-12">
          <div className="alert alert-info mb-0">
            <i className="bi bi-info-circle me-2" />
            <strong>Impact Preview:</strong> A {freezeWeeks}-week freeze with "{candidateAction.toLowerCase().replace('_', ' ')}"
            action will affect {scopeType === 'ALL' ? 'all open requisitions' : `requisitions in scope`}.
            Expect candidate decay and potential pipeline attrition.
          </div>
        </div>
      </div>

      <div className="mt-4">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isRunning || (scopeType !== 'ALL' && !scopeFilterValue)}
        >
          {isRunning ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" />
              Running...
            </>
          ) : (
            <>
              <i className="bi bi-play-fill me-2" />
              Run Scenario
            </>
          )}
        </button>
      </div>
    </form>
  );
}
