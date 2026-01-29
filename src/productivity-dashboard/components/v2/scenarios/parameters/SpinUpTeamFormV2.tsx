/**
 * SpinUpTeamFormV2
 *
 * Parameter form for the Spin Up Team scenario.
 * V2 version using Tailwind tokens and mobile-friendly styling.
 */

import React, { useState } from 'react';
import { Play, Loader2, Check } from 'lucide-react';
import { SpinUpTeamParams } from '../../../../types/scenarioTypes';

interface SpinUpTeamFormV2Props {
  recruiters: Array<{ recruiter_id: string; name: string }>;
  hiringManagers: Array<{ hm_id: string; name: string }>;
  defaultFunction?: string;
  defaultLevel?: string;
  onSubmit: (params: SpinUpTeamParams) => void;
  isRunning: boolean;
}

const COMMON_FUNCTIONS = [
  'Engineering',
  'Product',
  'Design',
  'Sales',
  'Marketing',
  'Operations',
  'Finance',
  'HR',
];
const COMMON_LEVELS = [
  'L1',
  'L2',
  'L3',
  'L4',
  'L5',
  'L6',
  'L7',
  'IC1',
  'IC2',
  'IC3',
  'Manager',
  'Senior Manager',
  'Director',
];
const LOCATION_TYPES: Array<'Remote' | 'Hybrid' | 'Onsite'> = ['Remote', 'Hybrid', 'Onsite'];

export function SpinUpTeamFormV2({
  recruiters,
  hiringManagers,
  defaultFunction,
  defaultLevel,
  onSubmit,
  isRunning,
}: SpinUpTeamFormV2Props) {
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
    setAssignedRecruiterIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Headcount */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Team Size</label>
          <input
            type="number"
            className="w-full px-3 py-2 min-h-[44px] text-sm bg-muted/30 border border-border rounded-md text-foreground"
            value={headcount}
            onChange={(e) => setHeadcount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
            min={1}
            max={20}
          />
          <small className="text-muted-foreground">Number of hires needed (1-20)</small>
        </div>

        {/* Target Days */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Target Timeline (Days)
          </label>
          <input
            type="number"
            className="w-full px-3 py-2 min-h-[44px] text-sm bg-muted/30 border border-border rounded-md text-foreground"
            value={targetDays}
            onChange={(e) =>
              setTargetDays(Math.max(30, Math.min(180, parseInt(e.target.value) || 60)))
            }
            min={30}
            max={180}
          />
          <small className="text-muted-foreground">Days to complete hiring (30-180)</small>
        </div>

        {/* Function */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Function</label>
          <select
            className="w-full px-3 py-2 min-h-[44px] text-sm bg-muted/30 border border-border rounded-md text-foreground appearance-none"
            value={roleFunction}
            onChange={(e) => setRoleFunction(e.target.value)}
          >
            {COMMON_FUNCTIONS.map((fn) => (
              <option key={fn} value={fn}>
                {fn}
              </option>
            ))}
          </select>
        </div>

        {/* Level */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Level</label>
          <select
            className="w-full px-3 py-2 min-h-[44px] text-sm bg-muted/30 border border-border rounded-md text-foreground appearance-none"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            {COMMON_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl}
              </option>
            ))}
          </select>
        </div>

        {/* Location Type */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Location Type
          </label>
          <select
            className="w-full px-3 py-2 min-h-[44px] text-sm bg-muted/30 border border-border rounded-md text-foreground appearance-none"
            value={locationType}
            onChange={(e) => setLocationType(e.target.value as 'Remote' | 'Hybrid' | 'Onsite')}
          >
            {LOCATION_TYPES.map((lt) => (
              <option key={lt} value={lt}>
                {lt}
              </option>
            ))}
          </select>
        </div>

        {/* Hiring Manager (optional) */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Hiring Manager (Optional)
          </label>
          <select
            className="w-full px-3 py-2 min-h-[44px] text-sm bg-muted/30 border border-border rounded-md text-foreground appearance-none"
            value={hiringManagerId}
            onChange={(e) => setHiringManagerId(e.target.value)}
          >
            <option value="">Not specified</option>
            {hiringManagers.map((hm, idx) => (
              <option key={hm.hm_id} value={hm.hm_id}>
                Manager {idx + 1}
              </option>
            ))}
          </select>
          <small className="text-muted-foreground">HM latency impacts TTF prediction</small>
        </div>
      </div>

      {/* Assigned Recruiters (optional) */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-2">
          Assigned Recruiters (Optional)
        </label>
        <div className="flex flex-wrap gap-2">
          {recruiters.map((r, idx) => (
            <button
              key={r.recruiter_id}
              type="button"
              className={`px-4 py-2 min-h-[44px] text-sm rounded-md transition-colors inline-flex items-center ${
                assignedRecruiterIds.includes(r.recruiter_id)
                  ? 'bg-accent text-white'
                  : 'border border-border bg-transparent text-muted-foreground hover:bg-muted'
              }`}
              onClick={() => toggleRecruiter(r.recruiter_id)}
            >
              Recruiter {idx + 1}
              {assignedRecruiterIds.includes(r.recruiter_id) && (
                <Check size={14} className="ml-1" />
              )}
            </button>
          ))}
        </div>
        <small className="text-muted-foreground block mt-1">
          Select recruiters to assign (leave empty to distribute evenly)
        </small>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          className="w-full md:w-auto px-6 py-3 min-h-[44px] rounded-md bg-accent text-white font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
          disabled={isRunning}
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

export default SpinUpTeamFormV2;
