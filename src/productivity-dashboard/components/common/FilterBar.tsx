// Filter Bar Component

import React, { useState, useMemo } from 'react';
import { MetricFilters, User, Requisition } from '../../types';
import { DateRangePicker } from './DateRangePicker';
import { useIsMobile } from '../../hooks/useIsMobile';

interface FilterBarProps {
  filters: MetricFilters;
  requisitions: Requisition[];
  users: User[];
  onChange: (filters: Partial<MetricFilters>) => void;
  onRefresh: () => void;
}

export function FilterBar({
  filters,
  requisitions,
  users,
  onChange,
  onRefresh
}: FilterBarProps) {
  const isMobile = useIsMobile();
  // Start collapsed on mobile for better UX
  const [isExpanded, setIsExpanded] = useState(false);

  // All possible values (for showing all options)
  const allFunctions = useMemo(() => Array.from(new Set(requisitions.map(r => r.function))).sort(), [requisitions]);
  const allJobFamilies = useMemo(() => Array.from(new Set(requisitions.map(r => r.job_family))).filter(Boolean).sort(), [requisitions]);
  const allLevels = useMemo(() => Array.from(new Set(requisitions.map(r => r.level))).filter(Boolean).sort(), [requisitions]);
  const allRegions = useMemo(() => Array.from(new Set(requisitions.map(r => r.location_region))).sort(), [requisitions]);

  const recruiters = useMemo(() => users.filter(u => u.role === 'Recruiter'), [users]);
  const hiringManagers = useMemo(() => users.filter(u => u.role === 'HiringManager'), [users]);

  // Compute available options based on current filter selections
  // Each dropdown shows what's available given ALL OTHER current selections
  const availableOptions = useMemo(() => {
    // Helper to filter requisitions by all criteria EXCEPT the one we're computing for
    const getFilteredReqs = (excludeField: string) => {
      return requisitions.filter(r => {
        if (excludeField !== 'recruiterIds' && filters.recruiterIds?.length) {
          if (!filters.recruiterIds.includes(r.recruiter_id || '')) return false;
        }
        if (excludeField !== 'functions' && filters.functions?.length) {
          if (!filters.functions.includes(r.function)) return false;
        }
        if (excludeField !== 'jobFamilies' && filters.jobFamilies?.length) {
          if (!filters.jobFamilies.includes(r.job_family || '')) return false;
        }
        if (excludeField !== 'levels' && filters.levels?.length) {
          if (!filters.levels.includes(r.level || '')) return false;
        }
        if (excludeField !== 'regions' && filters.regions?.length) {
          if (!filters.regions.includes(r.location_region)) return false;
        }
        if (excludeField !== 'hiringManagerIds' && filters.hiringManagerIds?.length) {
          if (!filters.hiringManagerIds.includes(r.hiring_manager_id || '')) return false;
        }
        return true;
      });
    };

    // Get available recruiters (by their requisitions)
    const recruiterReqs = getFilteredReqs('recruiterIds');
    const availableRecruiterIds = new Set(recruiterReqs.map(r => r.recruiter_id).filter(Boolean));

    // Get available functions
    const functionReqs = getFilteredReqs('functions');
    const availableFunctions = new Set(functionReqs.map(r => r.function));

    // Get available job families
    const jobFamilyReqs = getFilteredReqs('jobFamilies');
    const availableJobFamilies = new Set(jobFamilyReqs.map(r => r.job_family).filter(Boolean));

    // Get available levels
    const levelReqs = getFilteredReqs('levels');
    const availableLevels = new Set(levelReqs.map(r => r.level).filter(Boolean));

    // Get available regions
    const regionReqs = getFilteredReqs('regions');
    const availableRegions = new Set(regionReqs.map(r => r.location_region));

    // Get available hiring managers
    const hmReqs = getFilteredReqs('hiringManagerIds');
    const availableHMIds = new Set(hmReqs.map(r => r.hiring_manager_id).filter(Boolean));

    return {
      recruiterIds: availableRecruiterIds,
      functions: availableFunctions,
      jobFamilies: availableJobFamilies,
      levels: availableLevels,
      regions: availableRegions,
      hiringManagerIds: availableHMIds
    };
  }, [requisitions, filters]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.recruiterIds?.length) count += filters.recruiterIds.length;
    if (filters.functions?.length) count += filters.functions.length;
    if (filters.jobFamilies?.length) count += filters.jobFamilies.length;
    if (filters.levels?.length) count += filters.levels.length;
    if (filters.regions?.length) count += filters.regions.length;
    if (filters.hiringManagerIds?.length) count += filters.hiringManagerIds.length;
    return count;
  }, [filters]);

  const handleSelectChange = (
    field: keyof MetricFilters,
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = e.target.value;
    onChange({ [field]: value ? [value] : undefined });
  };

  const clearFilter = (field: keyof MetricFilters) => {
    onChange({ [field]: undefined });
  };

  // Mobile: Super compact - just date range + expand button
  if (isMobile) {
    return (
      <div className="filter-panel-mobile">
        <div className="d-flex align-items-center gap-2">
          <DateRangePicker
            dateRange={filters.dateRange}
            onChange={(dateRange) => onChange({ dateRange })}
          />
          <button
            className={`btn btn-sm ${isExpanded ? 'btn-bespoke-primary' : 'btn-light'}`}
            onClick={() => setIsExpanded(!isExpanded)}
            style={{ padding: '0.375rem 0.5rem', whiteSpace: 'nowrap' }}
          >
            {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
            <svg className={`ms-1 ${isExpanded ? 'rotate-180' : ''}`} width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={{ transition: 'transform 0.2s' }}>
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z" />
            </svg>
          </button>
        </div>

        {isExpanded && (
          <div className="mt-3">
            <div className="row g-2 mb-2">
              <div className="col-6">
                <select className="form-select form-select-sm" value={filters.recruiterIds?.[0] || ''} onChange={(e) => handleSelectChange('recruiterIds', e)}>
                  <option value="">Recruiter</option>
                  {recruiters.map(r => {
                    const isAvailable = availableOptions.recruiterIds.has(r.user_id);
                    return <option key={r.user_id} value={r.user_id} disabled={!isAvailable}>{r.name}</option>;
                  })}
                </select>
              </div>
              <div className="col-6">
                <select className="form-select form-select-sm" value={filters.functions?.[0] || ''} onChange={(e) => handleSelectChange('functions', e)}>
                  <option value="">Function</option>
                  {allFunctions.map(f => {
                    const isAvailable = availableOptions.functions.has(f);
                    return <option key={f} value={f} disabled={!isAvailable}>{f}</option>;
                  })}
                </select>
              </div>
              <div className="col-6">
                <select className="form-select form-select-sm" value={filters.levels?.[0] || ''} onChange={(e) => handleSelectChange('levels', e)}>
                  <option value="">Level</option>
                  {allLevels.map(l => {
                    const isAvailable = availableOptions.levels.has(l);
                    return <option key={l} value={l} disabled={!isAvailable}>{l}</option>;
                  })}
                </select>
              </div>
              <div className="col-6">
                <select className="form-select form-select-sm" value={filters.hiringManagerIds?.[0] || ''} onChange={(e) => handleSelectChange('hiringManagerIds', e)}>
                  <option value="">HM</option>
                  {hiringManagers.map(hm => {
                    const isAvailable = availableOptions.hiringManagerIds.has(hm.user_id);
                    return <option key={hm.user_id} value={hm.user_id} disabled={!isAvailable}>{hm.name}</option>;
                  })}
                </select>
              </div>
            </div>
            <div className="d-flex justify-content-between align-items-center">
              <div className="d-flex gap-3">
                <label className="d-flex align-items-center gap-1 small">
                  <input type="checkbox" className="form-check-input m-0" checked={filters.useWeighted} onChange={(e) => onChange({ useWeighted: e.target.checked })} />
                  <span className="text-muted">Wtd</span>
                </label>
                <label className="d-flex align-items-center gap-1 small">
                  <input type="checkbox" className="form-check-input m-0" checked={filters.normalizeByLoad} onChange={(e) => onChange({ normalizeByLoad: e.target.checked })} />
                  <span className="text-muted">Norm</span>
                </label>
              </div>
              <button className="btn btn-bespoke-primary btn-sm" onClick={onRefresh}>Apply</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop layout
  return (
    <div className={`filter-panel ${!isExpanded ? 'collapsed' : ''}`}>
      {/* Header Row - Always Visible */}
      <div className="d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-3">
          <button
            className="filter-toggle-btn"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <svg className="chevron" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 0-.708z" />
            </svg>
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="badge-bespoke badge-neutral-soft ms-1">
                {activeFilterCount} active
              </span>
            )}
          </button>

          <DateRangePicker
            dateRange={filters.dateRange}
            onChange={(dateRange) => onChange({ dateRange })}
          />
        </div>

        <div className="d-flex align-items-center gap-3">
          <div className="d-flex gap-3">
            <label className="d-flex align-items-center gap-2 small" style={{ cursor: 'pointer' }}>
              <input
                className="form-check-input m-0"
                type="checkbox"
                checked={filters.useWeighted}
                onChange={(e) => onChange({ useWeighted: e.target.checked })}
              />
              <span className="text-muted">Weighted</span>
            </label>
            <label className="d-flex align-items-center gap-2 small" style={{ cursor: 'pointer' }}>
              <input
                className="form-check-input m-0"
                type="checkbox"
                checked={filters.normalizeByLoad}
                onChange={(e) => onChange({ normalizeByLoad: e.target.checked })}
              />
              <span className="text-muted">Normalize</span>
            </label>
          </div>
          <button
            className="btn btn-bespoke-primary btn-sm"
            onClick={onRefresh}
          >
            Apply
          </button>
        </div>
      </div>

      {/* Expandable Filter Content */}
      <div className="filter-panel-content mt-4">
        <div className="row g-3">
          {/* Recruiter */}
          <div className="col-6 col-md-2">
            <label className="form-label">Recruiter</label>
            <select
              className="form-select form-select-sm"
              value={filters.recruiterIds?.[0] || ''}
              onChange={(e) => handleSelectChange('recruiterIds', e)}
            >
              <option value="">All Recruiters</option>
              {recruiters.map(r => {
                const isAvailable = availableOptions.recruiterIds.has(r.user_id);
                return (
                  <option
                    key={r.user_id}
                    value={r.user_id}
                    disabled={!isAvailable}
                    style={{ color: isAvailable ? 'inherit' : '#aaa' }}
                  >
                    {r.name}{!isAvailable ? ' (no data)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Function */}
          <div className="col-6 col-md-2">
            <label className="form-label">Function</label>
            <select
              className="form-select form-select-sm"
              value={filters.functions?.[0] || ''}
              onChange={(e) => handleSelectChange('functions', e)}
            >
              <option value="">All Functions</option>
              {allFunctions.map(f => {
                const isAvailable = availableOptions.functions.has(f);
                return (
                  <option
                    key={f}
                    value={f}
                    disabled={!isAvailable}
                    style={{ color: isAvailable ? 'inherit' : '#aaa' }}
                  >
                    {f}{!isAvailable ? ' (no data)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Job Family */}
          <div className="col-6 col-md-2">
            <label className="form-label">Job Family</label>
            <select
              className="form-select form-select-sm"
              value={filters.jobFamilies?.[0] || ''}
              onChange={(e) => handleSelectChange('jobFamilies', e)}
            >
              <option value="">All Job Families</option>
              {allJobFamilies.map(jf => {
                const isAvailable = availableOptions.jobFamilies.has(jf);
                return (
                  <option
                    key={jf}
                    value={jf}
                    disabled={!isAvailable}
                    style={{ color: isAvailable ? 'inherit' : '#aaa' }}
                  >
                    {jf}{!isAvailable ? ' (no data)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Level */}
          <div className="col-6 col-md-2">
            <label className="form-label">Level</label>
            <select
              className="form-select form-select-sm"
              value={filters.levels?.[0] || ''}
              onChange={(e) => handleSelectChange('levels', e)}
            >
              <option value="">All Levels</option>
              {allLevels.map(l => {
                const isAvailable = availableOptions.levels.has(l);
                return (
                  <option
                    key={l}
                    value={l}
                    disabled={!isAvailable}
                    style={{ color: isAvailable ? 'inherit' : '#aaa' }}
                  >
                    {l}{!isAvailable ? ' (no data)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Region */}
          <div className="col-6 col-md-2">
            <label className="form-label">Region</label>
            <select
              className="form-select form-select-sm"
              value={filters.regions?.[0] || ''}
              onChange={(e) => handleSelectChange('regions', e)}
            >
              <option value="">All Regions</option>
              {allRegions.map(r => {
                const isAvailable = availableOptions.regions.has(r);
                return (
                  <option
                    key={r}
                    value={r}
                    disabled={!isAvailable}
                    style={{ color: isAvailable ? 'inherit' : '#aaa' }}
                  >
                    {r}{!isAvailable ? ' (no data)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Hiring Manager */}
          <div className="col-6 col-md-2">
            <label className="form-label">Hiring Manager</label>
            <select
              className="form-select form-select-sm"
              value={filters.hiringManagerIds?.[0] || ''}
              onChange={(e) => handleSelectChange('hiringManagerIds', e)}
            >
              <option value="">All HMs</option>
              {hiringManagers.map(hm => {
                const isAvailable = availableOptions.hiringManagerIds.has(hm.user_id);
                return (
                  <option
                    key={hm.user_id}
                    value={hm.user_id}
                    disabled={!isAvailable}
                    style={{ color: isAvailable ? 'inherit' : '#aaa' }}
                  >
                    {hm.name}{!isAvailable ? ' (no data)' : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Active Filter Chips */}
        {activeFilterCount > 0 && (
          <div className="d-flex flex-wrap gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--color-slate-100)' }}>
            {filters.recruiterIds?.map(id => {
              const recruiter = recruiters.find(r => r.user_id === id);
              return (
                <span key={id} className="filter-chip active">
                  {recruiter?.name || id}
                  <span className="remove-btn" onClick={() => clearFilter('recruiterIds')}>×</span>
                </span>
              );
            })}
            {filters.functions?.map(f => (
              <span key={f} className="filter-chip active">
                {f}
                <span className="remove-btn" onClick={() => clearFilter('functions')}>×</span>
              </span>
            ))}
            {filters.jobFamilies?.map(jf => (
              <span key={jf} className="filter-chip active">
                {jf}
                <span className="remove-btn" onClick={() => clearFilter('jobFamilies')}>×</span>
              </span>
            ))}
            {filters.levels?.map(l => (
              <span key={l} className="filter-chip active">
                {l}
                <span className="remove-btn" onClick={() => clearFilter('levels')}>×</span>
              </span>
            ))}
            {filters.regions?.map(r => (
              <span key={r} className="filter-chip active">
                {r}
                <span className="remove-btn" onClick={() => clearFilter('regions')}>×</span>
              </span>
            ))}
            {filters.hiringManagerIds?.map(id => {
              const hm = hiringManagers.find(h => h.user_id === id);
              return (
                <span key={id} className="filter-chip active">
                  {hm?.name || id}
                  <span className="remove-btn" onClick={() => clearFilter('hiringManagerIds')}>×</span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

