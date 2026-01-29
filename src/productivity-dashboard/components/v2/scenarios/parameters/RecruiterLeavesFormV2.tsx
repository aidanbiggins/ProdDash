/**
 * RecruiterLeavesFormV2
 *
 * Parameter form for the Recruiter Leaves scenario.
 * V2 version using Tailwind tokens and mobile-friendly styling.
 */

import React, { useState } from 'react';
import { Play, Loader2, AlertTriangle, Info } from 'lucide-react';
import { RecruiterLeavesParams } from '../../../../types/scenarioTypes';
import { Radio } from '../../../../../components/ui/toggles';

interface RecruiterLeavesFormV2Props {
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

export function RecruiterLeavesFormV2({
  recruiters,
  defaultRecruiterId,
  onSubmit,
  isRunning,
}: RecruiterLeavesFormV2Props) {
  const [recruiterId, setRecruiterId] = useState(defaultRecruiterId || '');
  const [departureDate, setDepartureDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 14); // Default 14 days from now
    return date.toISOString().split('T')[0];
  });
  const [reassignmentStrategy, setReassignmentStrategy] = useState<
    'OPTIMIZE_FIT' | 'BALANCE_LOAD' | 'MANUAL'
  >('OPTIMIZE_FIT');

  const selectedRecruiter = recruiters.find((r) => r.recruiter_id === recruiterId);

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recruiter Selection */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Departing Recruiter
          </label>
          <select
            className="w-full px-3 py-2 min-h-[44px] text-sm bg-muted/30 border border-border rounded-md text-foreground appearance-none"
            value={recruiterId}
            onChange={(e) => setRecruiterId(e.target.value)}
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
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Departure Date
          </label>
          <input
            type="date"
            className="w-full px-3 py-2 min-h-[44px] text-sm bg-muted/30 border border-border rounded-md text-foreground"
            value={departureDate}
            onChange={(e) => setDepartureDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            required
          />
          <small className="text-muted-foreground">
            {daysUntilDeparture > 0 ? `${daysUntilDeparture} days from now` : 'Select a future date'}
          </small>
        </div>
      </div>

      {/* Reassignment Strategy */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-2">
          Reassignment Strategy
        </label>
        <div className="space-y-2">
          {REASSIGNMENT_STRATEGIES.map((strategy) => (
            <div
              key={strategy.value}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                reassignmentStrategy === strategy.value
                  ? 'border-accent bg-accent/10'
                  : 'border-border bg-muted/30 hover:bg-muted/50'
              }`}
              onClick={() => setReassignmentStrategy(strategy.value)}
            >
              <div className="flex items-center gap-3">
                <Radio
                  checked={reassignmentStrategy === strategy.value}
                  onChange={() => setReassignmentStrategy(strategy.value)}
                  name="strategy"
                />
                <div>
                  <strong className="text-foreground">{strategy.label}</strong>
                  <p className="mb-0 text-muted-foreground text-sm">{strategy.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Warning for short timeline */}
      {daysUntilDeparture > 0 && daysUntilDeparture < 7 && (
        <div className="p-3 rounded-lg bg-warn/10 text-warn flex items-start">
          <AlertTriangle size={16} className="mr-2 mt-0.5 shrink-0" />
          <div>
            <strong>Short Timeline:</strong> Only {daysUntilDeparture} days until departure.
            Consider extending the date for smoother knowledge transfer.
          </div>
        </div>
      )}

      {/* Selected recruiter preview */}
      {selectedRecruiter && (
        <div className="p-3 rounded-lg bg-primary/10 text-primary flex items-start">
          <Info size={16} className="mr-2 mt-0.5 shrink-0" />
          <div>
            <strong>Impact Preview:</strong> Recruiter{' '}
            {recruiters.findIndex((r) => r.recruiter_id === recruiterId) + 1}&apos;s workload (
            {selectedRecruiter.demand_wu} WU) will be redistributed among {recruiters.length - 1}{' '}
            remaining recruiters.
          </div>
        </div>
      )}

      <div className="pt-2">
        <button
          type="submit"
          className="w-full md:w-auto px-6 py-3 min-h-[44px] rounded-md bg-accent text-white font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
          disabled={isRunning || !recruiterId || daysUntilDeparture <= 0}
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

export default RecruiterLeavesFormV2;
