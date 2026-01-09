// Filter Bar Component

import React, { useState, useMemo } from 'react';
import { MetricFilters, User, Requisition } from '../../types';
import { DateRangePicker } from './DateRangePicker';

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
  const [isExpanded, setIsExpanded] = useState(false);

  // Extract unique values for filters
  const functions = useMemo(() => Array.from(new Set(requisitions.map(r => r.function))).sort(), [requisitions]);
  const jobFamilies = useMemo(() => Array.from(new Set(requisitions.map(r => r.job_family))).filter(Boolean).sort(), [requisitions]);
  const levels = useMemo(() => Array.from(new Set(requisitions.map(r => r.level))).filter(Boolean).sort(), [requisitions]);
  const regions = useMemo(() => Array.from(new Set(requisitions.map(r => r.location_region))).sort(), [requisitions]);

  const recruiters = useMemo(() => users.filter(u => u.role === 'Recruiter'), [users]);
  const hiringManagers = useMemo(() => users.filter(u => u.role === 'HiringManager'), [users]);

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
          <div className="col-md-2">
            <label className="form-label">Recruiter</label>
            <select
              className="form-select form-select-sm"
              value={filters.recruiterIds?.[0] || ''}
              onChange={(e) => handleSelectChange('recruiterIds', e)}
            >
              <option value="">All Recruiters</option>
              {recruiters.map(r => (
                <option key={r.user_id} value={r.user_id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Function */}
          <div className="col-md-2">
            <label className="form-label">Function</label>
            <select
              className="form-select form-select-sm"
              value={filters.functions?.[0] || ''}
              onChange={(e) => handleSelectChange('functions', e)}
            >
              <option value="">All Functions</option>
              {functions.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Job Family */}
          <div className="col-md-2">
            <label className="form-label">Job Family</label>
            <select
              className="form-select form-select-sm"
              value={filters.jobFamilies?.[0] || ''}
              onChange={(e) => handleSelectChange('jobFamilies', e)}
            >
              <option value="">All Job Families</option>
              {jobFamilies.map(jf => (
                <option key={jf} value={jf}>{jf}</option>
              ))}
            </select>
          </div>

          {/* Level */}
          <div className="col-md-2">
            <label className="form-label">Level</label>
            <select
              className="form-select form-select-sm"
              value={filters.levels?.[0] || ''}
              onChange={(e) => handleSelectChange('levels', e)}
            >
              <option value="">All Levels</option>
              {levels.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          {/* Region */}
          <div className="col-md-2">
            <label className="form-label">Region</label>
            <select
              className="form-select form-select-sm"
              value={filters.regions?.[0] || ''}
              onChange={(e) => handleSelectChange('regions', e)}
            >
              <option value="">All Regions</option>
              {regions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Hiring Manager */}
          <div className="col-md-2">
            <label className="form-label">Hiring Manager</label>
            <select
              className="form-select form-select-sm"
              value={filters.hiringManagerIds?.[0] || ''}
              onChange={(e) => handleSelectChange('hiringManagerIds', e)}
            >
              <option value="">All HMs</option>
              {hiringManagers.map(hm => (
                <option key={hm.user_id} value={hm.user_id}>{hm.name}</option>
              ))}
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

