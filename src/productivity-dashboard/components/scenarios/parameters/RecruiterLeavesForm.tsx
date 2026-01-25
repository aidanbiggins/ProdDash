/**
 * Recruiter Leaves Form
 *
 * Parameter form for the Recruiter Leaves scenario.
 */

import React, { useState } from 'react';
import { RecruiterLeavesParams } from '../../../types/scenarioTypes';

interface RecruiterLeavesFormProps {
  recruiters: Array<{ recruiter_id: string; name: string; demand_wu: number; utilization: number }>;
  defaultRecruiterId?: string;
  onSubmit: (params: RecruiterLeavesParams) => void;
  isRunning: boolean;
}

const REASSIGNMENT_STRATEGIES: Array<{
  value: 'OPTIMIZE_FIT' | 'BALANCE_LOAD' | 'MANUAL';
  label: string;
  description: string;
}> = [
  {
    value: 'OPTIMIZE_FIT',
    label: 'Optimize for Fit',
    description: 'Assign reqs to recruiters with best historical fit scores',
  },
  {
    value: 'BALANCE_LOAD',
    label: 'Balance Load',
    description: 'Distribute evenly based on current utilization',
  },
  {
    value: 'MANUAL',
    label: 'Manual Assignment',
    description: 'Specify reassignments yourself (advanced)',
  },
];

export default function RecruiterLeavesForm({
  recruiters,
  defaultRecruiterId,
  onSubmit,
  isRunning,
}: RecruiterLeavesFormProps) {
  const [recruiterId, setRecruiterId] = useState(defaultRecruiterId || '');
  const [departureDate, setDepartureDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 14); // Default 14 days from now
    return date.toISOString().split('T')[0];
  });
  const [reassignmentStrategy, setReassignmentStrategy] = useState<'OPTIMIZE_FIT' | 'BALANCE_LOAD' | 'MANUAL'>('OPTIMIZE_FIT');

  const selectedRecruiter = recruiters.find(r => r.recruiter_id === recruiterId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!recruiterId) return;

    const params: RecruiterLeavesParams = {
      recruiter_id: recruiterId,
      departure_date: new Date(departureDate),
      reassignment_strategy: reassignmentStrategy,
    };

    onSubmit(params);
  };

  // Calculate days until departure
  const daysUntilDeparture = departureDate
    ? Math.ceil((new Date(departureDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <form onSubmit={handleSubmit} className="scenario-form">
      <div className="grid grid-cols-12 gap-3">
        {/* Recruiter Selection */}
        <div className="col-span-12 md:col-span-6">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Departing Recruiter</label>
          <select
            className="w-full px-3 py-2 text-sm bg-bg-glass border border-glass-border rounded-md appearance-none"
            value={recruiterId}
            onChange={e => setRecruiterId(e.target.value)}
            required
          >
            <option value="">Select recruiter...</option>
            {recruiters.map((r, idx) => (
              <option key={r.recruiter_id} value={r.recruiter_id}>
                Recruiter {idx + 1} ({Math.round(r.utilization * 100)}% utilized)
              </option>
            ))}
          </select>
          {selectedRecruiter && (
            <small className="text-muted-foreground">
              Current workload: {selectedRecruiter.demand_wu} WU
            </small>
          )}
        </div>

        {/* Departure Date */}
        <div className="col-span-12 md:col-span-6">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Departure Date</label>
          <input
            type="date"
            className="w-full px-3 py-2 text-sm bg-bg-glass border border-glass-border rounded-md"
            value={departureDate}
            onChange={e => setDepartureDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            required
          />
          <small className="text-muted-foreground">
            {daysUntilDeparture > 0 ? `${daysUntilDeparture} days from now` : 'Select a future date'}
          </small>
        </div>

        {/* Reassignment Strategy */}
        <div className="col-span-12">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Reassignment Strategy</label>
          <div className="strategy-options">
            {REASSIGNMENT_STRATEGIES.map(strategy => (
              <div
                key={strategy.value}
                className={`strategy-option ${reassignmentStrategy === strategy.value ? 'selected' : ''}`}
                onClick={() => setReassignmentStrategy(strategy.value)}
              >
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="strategy"
                    value={strategy.value}
                    checked={reassignmentStrategy === strategy.value}
                    onChange={() => setReassignmentStrategy(strategy.value)}
                    className="mr-2"
                  />
                  <div>
                    <strong>{strategy.label}</strong>
                    <p className="mb-0 text-muted-foreground text-sm">{strategy.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Warning for short timeline */}
        {daysUntilDeparture > 0 && daysUntilDeparture < 7 && (
          <div className="col-span-12">
            <div className="p-3 rounded-lg bg-yellow-500/10 text-yellow-400 mb-0">
              <i className="bi bi-exclamation-triangle mr-2" />
              <strong>Short Timeline:</strong> Only {daysUntilDeparture} days until departure.
              Consider extending the date for smoother knowledge transfer.
            </div>
          </div>
        )}

        {/* Selected recruiter preview */}
        {selectedRecruiter && (
          <div className="col-span-12">
            <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 mb-0">
              <i className="bi bi-info-circle mr-2" />
              <strong>Impact Preview:</strong> Recruiter {recruiters.findIndex(r => r.recruiter_id === recruiterId) + 1}'s
              workload ({selectedRecruiter.demand_wu} WU) will be redistributed among {recruiters.length - 1} remaining recruiters.
            </div>
          </div>
        )}
      </div>

      <div className="mt-4">
        <button
          type="submit"
          className="px-4 py-2 rounded-md bg-accent-primary text-white font-medium hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isRunning || !recruiterId || daysUntilDeparture <= 0}
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
