// Filter Bar Component

import React, { useState, useMemo } from 'react';
import { MetricFilters, User, Requisition } from '../../types';
import { DateRangePicker } from './DateRangePicker';
import { MultiSelect } from './MultiSelect';
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

  const handleMultiSelectChange = (
    field: keyof MetricFilters,
    values: string[]
  ) => {
    onChange({ [field]: values.length > 0 ? values : undefined });
  };

  const clearFilterValue = (field: keyof MetricFilters, valueToRemove: string) => {
    const currentValues = filters[field] as string[] | undefined;
    if (currentValues) {
      const newValues = currentValues.filter(v => v !== valueToRemove);
      onChange({ [field]: newValues.length > 0 ? newValues : undefined });
    }
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
              <div className="col-6" style={{ position: 'relative' }}>
                <MultiSelect
                  options={recruiters.map(r => ({
                    value: r.user_id,
                    label: r.name,
                    disabled: !availableOptions.recruiterIds.has(r.user_id)
                  }))}
                  selected={filters.recruiterIds || []}
                  onChange={(values) => handleMultiSelectChange('recruiterIds', values)}
                  placeholder="Recruiter"
                  allLabel="All Recruiters"
                />
              </div>
              <div className="col-6" style={{ position: 'relative' }}>
                <MultiSelect
                  options={allFunctions.map(f => ({
                    value: f,
                    label: f,
                    disabled: !availableOptions.functions.has(f)
                  }))}
                  selected={filters.functions || []}
                  onChange={(values) => handleMultiSelectChange('functions', values)}
                  placeholder="Function"
                  allLabel="All Functions"
                />
              </div>
              <div className="col-6" style={{ position: 'relative' }}>
                <MultiSelect
                  options={allLevels.map(l => ({
                    value: l,
                    label: l,
                    disabled: !availableOptions.levels.has(l)
                  }))}
                  selected={filters.levels || []}
                  onChange={(values) => handleMultiSelectChange('levels', values)}
                  placeholder="Level"
                  allLabel="All Levels"
                />
              </div>
              <div className="col-6" style={{ position: 'relative' }}>
                <MultiSelect
                  options={hiringManagers.map(hm => ({
                    value: hm.user_id,
                    label: hm.name,
                    disabled: !availableOptions.hiringManagerIds.has(hm.user_id)
                  }))}
                  selected={filters.hiringManagerIds || []}
                  onChange={(values) => handleMultiSelectChange('hiringManagerIds', values)}
                  placeholder="HM"
                  allLabel="All HMs"
                />
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
          <div className="col-6 col-md-2" style={{ position: 'relative' }}>
            <label className="form-label">Recruiter</label>
            <MultiSelect
              options={recruiters.map(r => ({
                value: r.user_id,
                label: r.name,
                disabled: !availableOptions.recruiterIds.has(r.user_id)
              }))}
              selected={filters.recruiterIds || []}
              onChange={(values) => handleMultiSelectChange('recruiterIds', values)}
              placeholder="Recruiter"
              allLabel="All Recruiters"
            />
          </div>

          {/* Function */}
          <div className="col-6 col-md-2" style={{ position: 'relative' }}>
            <label className="form-label">Function</label>
            <MultiSelect
              options={allFunctions.map(f => ({
                value: f,
                label: f,
                disabled: !availableOptions.functions.has(f)
              }))}
              selected={filters.functions || []}
              onChange={(values) => handleMultiSelectChange('functions', values)}
              placeholder="Function"
              allLabel="All Functions"
            />
          </div>

          {/* Job Family */}
          <div className="col-6 col-md-2" style={{ position: 'relative' }}>
            <label className="form-label">Job Family</label>
            <MultiSelect
              options={allJobFamilies.map(jf => ({
                value: jf,
                label: jf,
                disabled: !availableOptions.jobFamilies.has(jf)
              }))}
              selected={filters.jobFamilies || []}
              onChange={(values) => handleMultiSelectChange('jobFamilies', values)}
              placeholder="Job Family"
              allLabel="All Job Families"
            />
          </div>

          {/* Level */}
          <div className="col-6 col-md-2" style={{ position: 'relative' }}>
            <label className="form-label">Level</label>
            <MultiSelect
              options={allLevels.map(l => ({
                value: l,
                label: l,
                disabled: !availableOptions.levels.has(l)
              }))}
              selected={filters.levels || []}
              onChange={(values) => handleMultiSelectChange('levels', values)}
              placeholder="Level"
              allLabel="All Levels"
            />
          </div>

          {/* Region */}
          <div className="col-6 col-md-2" style={{ position: 'relative' }}>
            <label className="form-label">Region</label>
            <MultiSelect
              options={allRegions.map(r => ({
                value: r,
                label: r,
                disabled: !availableOptions.regions.has(r)
              }))}
              selected={filters.regions || []}
              onChange={(values) => handleMultiSelectChange('regions', values)}
              placeholder="Region"
              allLabel="All Regions"
            />
          </div>

          {/* Hiring Manager */}
          <div className="col-6 col-md-2" style={{ position: 'relative' }}>
            <label className="form-label">Hiring Manager</label>
            <MultiSelect
              options={hiringManagers.map(hm => ({
                value: hm.user_id,
                label: hm.name,
                disabled: !availableOptions.hiringManagerIds.has(hm.user_id)
              }))}
              selected={filters.hiringManagerIds || []}
              onChange={(values) => handleMultiSelectChange('hiringManagerIds', values)}
              placeholder="Hiring Manager"
              allLabel="All HMs"
            />
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
                  <span className="remove-btn" onClick={() => clearFilterValue('recruiterIds', id)}>×</span>
                </span>
              );
            })}
            {filters.functions?.map(f => (
              <span key={f} className="filter-chip active">
                {f}
                <span className="remove-btn" onClick={() => clearFilterValue('functions', f)}>×</span>
              </span>
            ))}
            {filters.jobFamilies?.map(jf => (
              <span key={jf} className="filter-chip active">
                {jf}
                <span className="remove-btn" onClick={() => clearFilterValue('jobFamilies', jf)}>×</span>
              </span>
            ))}
            {filters.levels?.map(l => (
              <span key={l} className="filter-chip active">
                {l}
                <span className="remove-btn" onClick={() => clearFilterValue('levels', l)}>×</span>
              </span>
            ))}
            {filters.regions?.map(r => (
              <span key={r} className="filter-chip active">
                {r}
                <span className="remove-btn" onClick={() => clearFilterValue('regions', r)}>×</span>
              </span>
            ))}
            {filters.hiringManagerIds?.map(id => {
              const hm = hiringManagers.find(h => h.user_id === id);
              return (
                <span key={id} className="filter-chip active">
                  {hm?.name || id}
                  <span className="remove-btn" onClick={() => clearFilterValue('hiringManagerIds', id)}>×</span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

