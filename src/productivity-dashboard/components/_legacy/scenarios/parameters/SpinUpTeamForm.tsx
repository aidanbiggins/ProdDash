/**
 * Spin Up Team Form
 *
 * Parameter form for the Spin Up Team scenario.
 */

import React, { useState } from 'react';
import { SpinUpTeamParams } from '../../../../types/scenarioTypes';

interface SpinUpTeamFormProps {
  recruiters: Array<{ recruiter_id: string; name: string }>;
  hiringManagers: Array<{ hm_id: string; name: string }>;
  defaultFunction?: string;
  defaultLevel?: string;
  onSubmit: (params: SpinUpTeamParams) => void;
  isRunning: boolean;
}

const COMMON_FUNCTIONS = ['Engineering', 'Product', 'Design', 'Sales', 'Marketing', 'Operations', 'Finance', 'HR'];
const COMMON_LEVELS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'IC1', 'IC2', 'IC3', 'Manager', 'Senior Manager', 'Director'];
const LOCATION_TYPES: Array<'Remote' | 'Hybrid' | 'Onsite'> = ['Remote', 'Hybrid', 'Onsite'];

export default function SpinUpTeamForm({
  recruiters,
  hiringManagers,
  defaultFunction,
  defaultLevel,
  onSubmit,
  isRunning,
}: SpinUpTeamFormProps) {
  const [headcount, setHeadcount] = useState(5);
  const [roleFunction, setRoleFunction] = useState(defaultFunction || 'Engineering');
  const [level, setLevel] = useState(defaultLevel || 'L4');
  const [locationType, setLocationType] = useState<'Remote' | 'Hybrid' | 'Onsite'>('Hybrid');
  const [targetDays, setTargetDays] = useState(60);
  const [hiringManagerId, setHiringManagerId] = useState<string>('');
  const [assignedRecruiterIds, setAssignedRecruiterIds] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const params: SpinUpTeamParams = {
      headcount,
      role_profile: {
        function: roleFunction,
        level,
        location_type: locationType,
      },
      target_days: targetDays,
      ...(hiringManagerId && { hiring_manager_id: hiringManagerId }),
      ...(assignedRecruiterIds.length > 0 && { assigned_recruiter_ids: assignedRecruiterIds }),
    };

    onSubmit(params);
  };

  const toggleRecruiter = (id: string) => {
    setAssignedRecruiterIds(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="scenario-form">
      <div className="grid grid-cols-12 gap-3">
        {/* Headcount */}
        <div className="col-span-12 md:col-span-6">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Team Size</label>
          <input
            type="number"
            className="w-full px-3 py-2 text-sm bg-bg-glass border border-glass-border rounded-md"
            value={headcount}
            onChange={e => setHeadcount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
            min={1}
            max={20}
          />
          <small className="text-muted-foreground">Number of hires needed (1-20)</small>
        </div>

        {/* Target Days */}
        <div className="col-span-12 md:col-span-6">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Target Timeline (Days)</label>
          <input
            type="number"
            className="w-full px-3 py-2 text-sm bg-bg-glass border border-glass-border rounded-md"
            value={targetDays}
            onChange={e => setTargetDays(Math.max(30, Math.min(180, parseInt(e.target.value) || 60)))}
            min={30}
            max={180}
          />
          <small className="text-muted-foreground">Days to complete hiring (30-180)</small>
        </div>

        {/* Function */}
        <div className="col-span-12 md:col-span-4">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Function</label>
          <select
            className="w-full px-3 py-2 text-sm bg-bg-glass border border-glass-border rounded-md appearance-none"
            value={roleFunction}
            onChange={e => setRoleFunction(e.target.value)}
          >
            {COMMON_FUNCTIONS.map(fn => (
              <option key={fn} value={fn}>{fn}</option>
            ))}
          </select>
        </div>

        {/* Level */}
        <div className="col-span-12 md:col-span-4">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Level</label>
          <select
            className="w-full px-3 py-2 text-sm bg-bg-glass border border-glass-border rounded-md appearance-none"
            value={level}
            onChange={e => setLevel(e.target.value)}
          >
            {COMMON_LEVELS.map(lvl => (
              <option key={lvl} value={lvl}>{lvl}</option>
            ))}
          </select>
        </div>

        {/* Location Type */}
        <div className="col-span-12 md:col-span-4">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Location Type</label>
          <select
            className="w-full px-3 py-2 text-sm bg-bg-glass border border-glass-border rounded-md appearance-none"
            value={locationType}
            onChange={e => setLocationType(e.target.value as 'Remote' | 'Hybrid' | 'Onsite')}
          >
            {LOCATION_TYPES.map(lt => (
              <option key={lt} value={lt}>{lt}</option>
            ))}
          </select>
        </div>

        {/* Hiring Manager (optional) */}
        <div className="col-span-12 md:col-span-6">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Hiring Manager (Optional)</label>
          <select
            className="w-full px-3 py-2 text-sm bg-bg-glass border border-glass-border rounded-md appearance-none"
            value={hiringManagerId}
            onChange={e => setHiringManagerId(e.target.value)}
          >
            <option value="">Not specified</option>
            {hiringManagers.map((hm) => (
              <option key={hm.hm_id} value={hm.hm_id}>
                {hm.name}
              </option>
            ))}
          </select>
          <small className="text-muted-foreground">HM latency impacts TTF prediction</small>
        </div>

        {/* Assigned Recruiters (optional) */}
        <div className="col-span-12">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Assigned Recruiters (Optional)</label>
          <div className="recruiter-chips">
            {recruiters.map((r) => (
              <button
                key={r.recruiter_id}
                type="button"
                className={`px-4 py-2.5 min-h-[44px] text-sm rounded-md mr-2 mb-2 transition-colors ${
                  assignedRecruiterIds.includes(r.recruiter_id)
                    ? 'bg-accent-primary text-white'
                    : 'border border-glass-border bg-transparent text-muted-foreground hover:bg-surface-elevated'
                }`}
                onClick={() => toggleRecruiter(r.recruiter_id)}
              >
                {r.name}
                {assignedRecruiterIds.includes(r.recruiter_id) && (
                  <i className="bi bi-check ml-1" />
                )}
              </button>
            ))}
          </div>
          <small className="text-muted-foreground">Select recruiters to assign (leave empty to distribute evenly)</small>
        </div>
      </div>

      <div className="mt-4">
        <button
          type="submit"
          className="w-full md:w-auto px-6 py-3 min-h-[44px] rounded-md bg-accent-primary text-white font-medium hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isRunning}
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
