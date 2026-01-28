'use client';

/**
 * SLA Settings Tab V2 - Configure stage SLAs and owner assignments
 *
 * V2 component that renders as a sub-view within SettingsTabV2.
 * Uses V2 design patterns: glass-panel, Tailwind tokens, lucide-react icons.
 */

import React, { useState, useCallback } from 'react';
import { Check, RotateCcw, Plus, Trash2, AlertCircle } from 'lucide-react';
import { SlaPolicy, SlaOwnerType, DEFAULT_SLA_POLICIES } from '../../types/slaTypes';
import { Checkbox } from '../../../components/ui/toggles';

// Storage key for SLA policies
const SLA_POLICIES_KEY = 'platovue_sla_policies';

// Load SLA policies from localStorage, falling back to defaults
function loadSlaPolicies(): SlaPolicy[] {
  try {
    const stored = localStorage.getItem(SLA_POLICIES_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load SLA policies:', e);
  }
  return [...DEFAULT_SLA_POLICIES];
}

// Save SLA policies to localStorage
function saveSlaPolicies(policies: SlaPolicy[]): void {
  try {
    localStorage.setItem(SLA_POLICIES_KEY, JSON.stringify(policies));
  } catch (e) {
    console.error('Failed to save SLA policies:', e);
  }
}

// Export for use by other components
export function getSlaPolicies(): SlaPolicy[] {
  return loadSlaPolicies();
}

export function SlaSettingsTabV2() {
  const [policies, setPolicies] = useState<SlaPolicy[]>(() => loadSlaPolicies());
  const [isDirty, setIsDirty] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // New policy form state
  const [newStageKey, setNewStageKey] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newSlaHours, setNewSlaHours] = useState(72);
  const [newOwnerType, setNewOwnerType] = useState<SlaOwnerType>('RECRUITER');

  // Update a policy
  const handleUpdatePolicy = useCallback((index: number, field: keyof SlaPolicy, value: any) => {
    setPolicies(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setIsDirty(true);
  }, []);

  // Remove a policy
  const handleRemovePolicy = useCallback((index: number) => {
    setPolicies(prev => prev.filter((_, i) => i !== index));
    setIsDirty(true);
  }, []);

  // Add a new policy
  const handleAddPolicy = useCallback(() => {
    if (!newStageKey.trim() || !newDisplayName.trim()) return;

    const newPolicy: SlaPolicy = {
      stage_key: newStageKey.toUpperCase().replace(/\s+/g, '_'),
      display_name: newDisplayName.trim(),
      sla_hours: newSlaHours,
      owner_type: newOwnerType,
      enabled: true,
    };

    setPolicies(prev => [...prev, newPolicy]);
    setNewStageKey('');
    setNewDisplayName('');
    setNewSlaHours(72);
    setNewOwnerType('RECRUITER');
    setIsDirty(true);
  }, [newStageKey, newDisplayName, newSlaHours, newOwnerType]);

  // Save changes
  const handleSave = useCallback(() => {
    saveSlaPolicies(policies);
    setIsDirty(false);
    setSuccess('SLA policies saved successfully');
    setTimeout(() => setSuccess(null), 3000);
  }, [policies]);

  // Reset to defaults
  const handleReset = useCallback(() => {
    if (!confirm('Reset all SLA policies to defaults? This cannot be undone.')) return;
    setPolicies([...DEFAULT_SLA_POLICIES]);
    setIsDirty(true);
  }, []);

  // Convert hours to display format
  const formatHoursDisplay = (hours: number): string => {
    if (hours < 24) return `${hours}h`;
    const days = hours / 24;
    return Number.isInteger(days) ? `${days}d` : `${days.toFixed(1)}d`;
  };

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {success && (
        <div className="p-3 rounded-lg flex items-center bg-green-500/10 border border-green-500/30 text-green-400">
          <Check className="w-4 h-4 mr-2" />
          {success}
        </div>
      )}

      {/* Current Policies */}
      <div className="glass-panel p-5">
        <div className="mb-4 pb-3 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Stage SLA Policies</h2>
          <p className="text-xs text-muted-foreground mt-1">Define time limits for each hiring stage</p>
        </div>

        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm" style={{ minWidth: '700px' }}>
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Stage</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Display Name</th>
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">SLA (hours)</th>
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Display</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Owner</th>
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Enabled</th>
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {policies.map((policy, index) => (
                <tr
                  key={policy.stage_key}
                  className={`${policy.enabled ? '' : 'opacity-50'}`}
                >
                  <td className="px-3 py-3 align-middle">
                    <code className="px-1.5 py-0.5 rounded text-xs bg-teal-500/10 text-teal-400">
                      {policy.stage_key}
                    </code>
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <input
                      type="text"
                      className="px-2 py-1.5 rounded-md text-xs max-w-[180px] bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      value={policy.display_name}
                      onChange={(e) => handleUpdatePolicy(index, 'display_name', e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-3 align-middle text-center">
                    <input
                      type="number"
                      className="px-2 py-1.5 rounded-md text-xs text-center w-[80px] bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      value={policy.sla_hours}
                      onChange={(e) => handleUpdatePolicy(index, 'sla_hours', parseInt(e.target.value) || 0)}
                      min={1}
                      max={720}
                    />
                  </td>
                  <td className="px-3 py-3 align-middle text-center font-mono text-muted-foreground">
                    {formatHoursDisplay(policy.sla_hours)}
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <select
                      className="px-2 py-1.5 rounded-md text-xs w-[120px] bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      value={policy.owner_type}
                      onChange={(e) => handleUpdatePolicy(index, 'owner_type', e.target.value)}
                    >
                      <option value="RECRUITER">Recruiter</option>
                      <option value="HM">Hiring Manager</option>
                      <option value="OPS">TA Ops</option>
                    </select>
                  </td>
                  <td className="px-3 py-3 align-middle text-center">
                    <Checkbox
                      checked={policy.enabled}
                      onChange={(checked) => handleUpdatePolicy(index, 'enabled', checked)}
                    />
                  </td>
                  <td className="px-3 py-3 align-middle text-center">
                    <button
                      className="p-1.5 text-xs rounded-md border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors"
                      onClick={() => handleRemovePolicy(index)}
                      title="Remove this SLA policy"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {policies.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    No SLA policies configured. Add one below or reset to defaults.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t border-border">
          <button
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            onClick={handleSave}
            disabled={!isDirty}
          >
            <Check className="w-4 h-4" />
            Save Changes
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors min-h-[44px]"
            onClick={handleReset}
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </button>
          {isDirty && (
            <span className="sm:ml-auto flex items-center justify-center gap-1 text-amber-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              Unsaved changes
            </span>
          )}
        </div>
      </div>

      {/* Add New Policy */}
      <div className="glass-panel p-5">
        <div className="mb-4 pb-3 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Add New Stage</h2>
          <p className="text-xs text-muted-foreground mt-1">Create a custom SLA policy for a stage not listed above</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[1fr_1fr_120px_140px_auto] gap-3 items-end">
          <div>
            <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Stage Key</label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded-md text-sm bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g., PHONE_SCREEN"
              value={newStageKey}
              onChange={(e) => setNewStageKey(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Display Name</label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded-md text-sm bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="e.g., Phone Screen"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-muted-foreground">SLA (hours)</label>
            <input
              type="number"
              className="w-full px-3 py-2 rounded-md text-sm bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              value={newSlaHours}
              onChange={(e) => setNewSlaHours(parseInt(e.target.value) || 72)}
              min={1}
              max={720}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 text-muted-foreground">Owner</label>
            <select
              className="w-full px-3 py-2 rounded-md text-sm bg-muted/50 border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              value={newOwnerType}
              onChange={(e) => setNewOwnerType(e.target.value as SlaOwnerType)}
            >
              <option value="RECRUITER">Recruiter</option>
              <option value="HM">Hiring Manager</option>
              <option value="OPS">TA Ops</option>
            </select>
          </div>
          <button
            className="inline-flex items-center justify-center gap-1 px-4 py-2 text-sm rounded-md border border-primary text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            onClick={handleAddPolicy}
            disabled={!newStageKey.trim() || !newDisplayName.trim()}
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Help Section */}
      <div className="glass-panel p-5">
        <div className="mb-4 pb-3 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">How SLAs Work</h2>
        </div>

        <div className="text-sm text-muted-foreground space-y-3">
          <p>
            <strong className="text-foreground">Stage Key:</strong> The internal identifier matching your ATS stage names
            (e.g., SCREEN, HM_SCREEN, ONSITE).
          </p>
          <p>
            <strong className="text-foreground">SLA Hours:</strong> Maximum time a candidate should spend in this stage
            before it's considered a breach.
          </p>
          <p>
            <strong className="text-foreground">Owner:</strong> Who is responsible for moving candidates through this stage.
            Breaches are attributed to this role.
          </p>
          <ul className="mt-3 space-y-1.5 list-none">
            <li><strong className="text-foreground">Recruiter:</strong> Screens, sourcing, offer management</li>
            <li><strong className="text-foreground">Hiring Manager:</strong> HM screens, interviews, final decisions</li>
            <li><strong className="text-foreground">TA Ops:</strong> Administrative tasks, background checks</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default SlaSettingsTabV2;
