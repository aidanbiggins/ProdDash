// SLA Settings Tab - Configure stage SLAs and owner assignments
import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '../../common/PageHeader';
import { GlassPanel } from '../layout/GlassPanel';
import { SectionHeader } from '../../common/SectionHeader';
import { SlaPolicy, SlaOwnerType, DEFAULT_SLA_POLICIES } from '../../../types/slaTypes';
import { Checkbox } from '../../../../components/ui/toggles';

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

export function SlaSettingsTab() {
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
    <div className="sla-settings-tab">
      <PageHeader
        title="SLA Configuration"
        subtitle="Configure stage time limits and ownership for SLA tracking"
      />

      {/* Success Message */}
      {success && (
        <div className="p-3 rounded-lg flex items-center mb-4 bg-good-bg border border-good/30 text-good">
          <i className="bi bi-check-circle mr-2"></i>
          {success}
        </div>
      )}

      {/* Current Policies */}
      <GlassPanel>
        <SectionHeader
          title="Stage SLA Policies"
          subtitle="Define time limits for each hiring stage"
        />

        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <table className="w-full text-sm" style={{ minWidth: '700px' }}>
            <thead>
              <tr className="border-b border-glass-border">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Stage</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Display Name</th>
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">SLA (hours)</th>
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Display</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Owner</th>
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Enabled</th>
                <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
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
                      className="px-2 py-1 rounded-md text-xs max-w-[180px] bg-white/5 border border-white/10 text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                      value={policy.display_name}
                      onChange={(e) => handleUpdatePolicy(index, 'display_name', e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-3 align-middle text-center">
                    <input
                      type="number"
                      className="px-2 py-1 rounded-md text-xs text-center w-[80px] bg-white/5 border border-white/10 text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
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
                      className="px-2 py-1 rounded-md text-xs w-[120px] bg-white/5 border border-white/10 text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
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
                      className="px-2 py-1 text-xs rounded-md border border-bad text-bad hover:bg-bad/10 transition-colors"
                      onClick={() => handleRemovePolicy(index)}
                      title="Remove this SLA policy"
                    >
                      <i className="bi bi-trash"></i>
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
        <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t border-glass-border">
          <button
            className="px-4 py-2.5 rounded-md font-medium bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            onClick={handleSave}
            disabled={!isDirty}
          >
            <i className="bi bi-check-lg mr-1"></i>
            Save Changes
          </button>
          <button
            className="px-4 py-2.5 rounded-md border border-white/10 text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors min-h-[44px]"
            onClick={handleReset}
          >
            <i className="bi bi-arrow-counterclockwise mr-1"></i>
            Reset to Defaults
          </button>
          {isDirty && (
            <span className="sm:ml-auto flex items-center justify-center text-warn text-sm">
              <i className="bi bi-exclamation-circle mr-1"></i>
              Unsaved changes
            </span>
          )}
        </div>
      </GlassPanel>

      {/* Add New Policy */}
      <div className="mt-4">
        <GlassPanel>
          <SectionHeader
            title="Add New Stage"
            subtitle="Create a custom SLA policy for a stage not listed above"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[1fr_1fr_120px_140px_auto] gap-3 items-end">
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Stage Key</label>
              <input
                type="text"
                className="w-full px-2 py-1.5 rounded-md text-sm bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="e.g., PHONE_SCREEN"
                value={newStageKey}
                onChange={(e) => setNewStageKey(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Display Name</label>
              <input
                type="text"
                className="w-full px-2 py-1.5 rounded-md text-sm bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="e.g., Phone Screen"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">SLA (hours)</label>
              <input
                type="number"
                className="w-full px-2 py-1.5 rounded-md text-sm bg-white/5 border border-white/10 text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                value={newSlaHours}
                onChange={(e) => setNewSlaHours(parseInt(e.target.value) || 72)}
                min={1}
                max={720}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-muted-foreground">Owner</label>
              <select
                className="w-full px-2 py-1.5 rounded-md text-sm bg-white/5 border border-white/10 text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                value={newOwnerType}
                onChange={(e) => setNewOwnerType(e.target.value as SlaOwnerType)}
              >
                <option value="RECRUITER">Recruiter</option>
                <option value="HM">Hiring Manager</option>
                <option value="OPS">TA Ops</option>
              </select>
            </div>
            <button
              className="px-3 py-1.5 text-sm rounded-md border border-accent text-accent hover:bg-accent/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-[34px]"
              onClick={handleAddPolicy}
              disabled={!newStageKey.trim() || !newDisplayName.trim()}
            >
              <i className="bi bi-plus-lg mr-1"></i>
              Add
            </button>
          </div>
        </GlassPanel>
      </div>

      {/* Help Section */}
      <div className="mt-4">
        <GlassPanel>
          <SectionHeader title="How SLAs Work" />
          <div className="text-sm text-muted-foreground space-y-2">
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
            <ul className="mt-3 space-y-1 list-none">
              <li><strong className="text-foreground">Recruiter:</strong> Screens, sourcing, offer management</li>
              <li><strong className="text-foreground">Hiring Manager:</strong> HM screens, interviews, final decisions</li>
              <li><strong className="text-foreground">TA Ops:</strong> Administrative tasks, background checks</li>
            </ul>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

export default SlaSettingsTab;
