// Filter Bar Component - V2 Design with Full Functionality

import React, { useState, useMemo } from 'react';
import { format, subDays, startOfYear, differenceInDays } from 'date-fns';
import { Calendar, ChevronDown, Filter, X } from 'lucide-react';
import { MetricFilters, User, Requisition, UserRole, DateRange } from '../../types';
import { Button } from 'components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from 'components/ui/popover';
import { Checkbox } from 'components/ui/checkbox';
import { useIsMobile } from '../../hooks/useIsMobile';

interface FilterBarProps {
  filters: MetricFilters;
  requisitions: Requisition[];
  users: User[];
  onChange: (filters: Partial<MetricFilters>) => void;
}

const datePresets = [
  { label: '30d', days: 30 },
  { label: '60d', days: 60 },
  { label: '90d', days: 90 },
  { label: '6mo', days: 180 },
  { label: 'YTD', days: -1 },
];

export function FilterBar({
  filters,
  requisitions,
  users,
  onChange
}: FilterBarProps) {
  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(!isMobile);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(() => {
    // Determine initial preset based on current date range
    const daysDiff = differenceInDays(filters.dateRange.endDate, filters.dateRange.startDate);
    const preset = datePresets.find(p => p.days > 0 && Math.abs(p.days - daysDiff) <= 2);
    return preset?.label || null;
  });

  // All possible values (for showing all options)
  const allFunctions = useMemo(() => Array.from(new Set(requisitions.map(r => String(r.function)))).sort(), [requisitions]);
  const allJobFamilies = useMemo(() => Array.from(new Set(requisitions.map(r => r.job_family))).filter(Boolean).sort(), [requisitions]);
  const allLevels = useMemo(() => Array.from(new Set(requisitions.map(r => r.level))).filter(Boolean).sort(), [requisitions]);
  const allRegions = useMemo(() => Array.from(new Set(requisitions.map(r => r.location_region))).sort(), [requisitions]);

  // Get recruiters from users table, with fallback to extracting from requisitions
  const recruiters = useMemo(() => {
    const fromUsers = users.filter(u => u.role === 'Recruiter');
    if (fromUsers.length > 0) return fromUsers;

    const recruiterMap = new Map<string, User>();
    requisitions.forEach(r => {
      if (r.recruiter_id && !recruiterMap.has(r.recruiter_id)) {
        recruiterMap.set(r.recruiter_id, {
          user_id: r.recruiter_id,
          name: r.recruiter_id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          role: UserRole.Recruiter,
          team: null,
          manager_user_id: null,
          email: null
        });
      }
    });
    return Array.from(recruiterMap.values());
  }, [users, requisitions]);

  // Get hiring managers from users table, with fallback to extracting from requisitions
  const hiringManagers = useMemo(() => {
    const fromUsers = users.filter(u => u.role === 'HiringManager');
    if (fromUsers.length > 0) return fromUsers;

    const hmMap = new Map<string, User>();
    requisitions.forEach(r => {
      if (r.hiring_manager_id && !hmMap.has(r.hiring_manager_id)) {
        hmMap.set(r.hiring_manager_id, {
          user_id: r.hiring_manager_id,
          name: r.hiring_manager_id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          role: UserRole.HiringManager,
          team: null,
          manager_user_id: null,
          email: null
        });
      }
    });
    return Array.from(hmMap.values());
  }, [users, requisitions]);

  // Compute available options based on current filter selections
  const availableOptions = useMemo(() => {
    const getFilteredReqs = (excludeField: string) => {
      return requisitions.filter(r => {
        if (excludeField !== 'recruiterIds' && filters.recruiterIds?.length) {
          if (!filters.recruiterIds.includes(r.recruiter_id || '')) return false;
        }
        if (excludeField !== 'functions' && filters.functions?.length) {
          if (!filters.functions.includes(String(r.function))) return false;
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

    const recruiterReqs = getFilteredReqs('recruiterIds');
    const availableRecruiterIds = new Set(recruiterReqs.map(r => r.recruiter_id).filter(Boolean));

    const functionReqs = getFilteredReqs('functions');
    const availableFunctions = new Set(functionReqs.map(r => String(r.function)));

    const jobFamilyReqs = getFilteredReqs('jobFamilies');
    const availableJobFamilies = new Set(jobFamilyReqs.map(r => r.job_family).filter(Boolean));

    const levelReqs = getFilteredReqs('levels');
    const availableLevels = new Set(levelReqs.map(r => r.level).filter(Boolean));

    const regionReqs = getFilteredReqs('regions');
    const availableRegions = new Set(regionReqs.map(r => r.location_region));

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

  // Count active filters (excluding date range)
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

  // Date preset handler
  const handleDatePreset = (preset: { label: string; days: number }) => {
    setSelectedPreset(preset.label);
    const end = new Date();
    let start: Date;

    if (preset.days === -1) {
      // YTD
      start = startOfYear(end);
    } else {
      start = subDays(end, preset.days);
    }

    onChange({
      dateRange: { startDate: start, endDate: end }
    });
  };

  // Custom date change handler
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = new Date(e.target.value);
    if (!isNaN(newStart.getTime())) {
      setSelectedPreset(null);
      onChange({
        dateRange: { ...filters.dateRange, startDate: newStart }
      });
    }
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = new Date(e.target.value);
    if (!isNaN(newEnd.getTime())) {
      setSelectedPreset(null);
      onChange({
        dateRange: { ...filters.dateRange, endDate: newEnd }
      });
    }
  };

  // Multi-select handlers
  const handleToggle = (field: keyof MetricFilters, value: string) => {
    const currentValues = (filters[field] as string[] | undefined) || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];

    onChange({ [field]: newValues.length > 0 ? newValues : undefined });
  };

  const clearFilterValue = (field: keyof MetricFilters, valueToRemove: string) => {
    const currentValues = filters[field] as string[] | undefined;
    if (currentValues) {
      const newValues = currentValues.filter(v => v !== valueToRemove);
      onChange({ [field]: newValues.length > 0 ? newValues : undefined });
    }
  };

  const clearAllFilters = () => {
    onChange({
      recruiterIds: undefined,
      functions: undefined,
      jobFamilies: undefined,
      levels: undefined,
      regions: undefined,
      hiringManagerIds: undefined,
    });
  };

  const formatDateRange = (range: DateRange) => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${range.startDate.toLocaleDateString('en-US', options)} - ${range.endDate.toLocaleDateString('en-US', options)}`;
  };

  // Filter dropdown component - compact for grid layout
  const FilterDropdown = ({
    label,
    field,
    options,
    selectedValues,
    availableSet,
    displayFn = (v: string) => v
  }: {
    label: string;
    field: keyof MetricFilters;
    options: Array<{ value: string; label: string }>;
    selectedValues: string[];
    availableSet: Set<string>;
    displayFn?: (value: string) => string;
  }) => (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`gap-2 text-xs bg-transparent border-white/[0.08] hover:bg-white/[0.04] w-full justify-between ${
              selectedValues.length > 0 ? 'border-accent/50 text-accent' : ''
            }`}
          >
            <span className="truncate">
              {selectedValues.length === 0
                ? `All ${label}`
                : selectedValues.length === 1
                  ? displayFn(selectedValues[0])
                  : `${selectedValues.length} selected`}
            </span>
            <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[240px] p-2" align="start">
          <div className="space-y-1 max-h-[280px] overflow-y-auto">
            {options.map((option) => {
              const isDisabled = !availableSet.has(option.value);
              return (
                <label
                  key={option.value}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer ${
                    isDisabled
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:bg-white/[0.06]'
                  }`}
                >
                  <Checkbox
                    checked={selectedValues.includes(option.value)}
                    onCheckedChange={() => !isDisabled && handleToggle(field, option.value)}
                    disabled={isDisabled}
                  />
                  <span className="text-sm truncate">{option.label}</span>
                </label>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <div className="glass-panel">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/[0.06]">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Filter className="w-4 h-4" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-accent/20 text-accent text-xs font-semibold">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
        </button>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Filter Content */}
      {isExpanded && (
        <div className="p-3 md:p-4 space-y-3">
          {/* Date Range Row */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-[10px] md:text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Date Range
            </span>

            {/* Preset Buttons */}
            <div className="flex gap-1 p-1 rounded-md bg-white/[0.03]">
              {datePresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleDatePreset(preset)}
                  className={`px-2 md:px-3 py-1.5 rounded text-[11px] md:text-xs font-medium transition-colors whitespace-nowrap ${
                    selectedPreset === preset.label
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Date Inputs */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="px-2 py-1.5 text-xs bg-transparent border border-white/[0.08] rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                value={format(filters.dateRange.startDate, 'yyyy-MM-dd')}
                onChange={handleStartDateChange}
              />
              <span className="text-muted-foreground text-xs">to</span>
              <input
                type="date"
                className="px-2 py-1.5 text-xs bg-transparent border border-white/[0.08] rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                value={format(filters.dateRange.endDate, 'yyyy-MM-dd')}
                onChange={handleEndDateChange}
              />
            </div>
          </div>

          {/* Dimensional Filters - Horizontal Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {recruiters.length > 0 && (
              <FilterDropdown
                label="Recruiters"
                field="recruiterIds"
                options={recruiters.map(r => ({ value: r.user_id, label: r.name }))}
                selectedValues={filters.recruiterIds || []}
                availableSet={availableOptions.recruiterIds as Set<string>}
                displayFn={(id) => recruiters.find(r => r.user_id === id)?.name || id}
              />
            )}

            {allFunctions.length > 0 && (
              <FilterDropdown
                label="Function"
                field="functions"
                options={allFunctions.map(f => ({ value: f, label: f }))}
                selectedValues={filters.functions || []}
                availableSet={availableOptions.functions as Set<string>}
              />
            )}

            {allJobFamilies.length > 0 && (
              <FilterDropdown
                label="Job Family"
                field="jobFamilies"
                options={allJobFamilies.map(jf => ({ value: jf, label: jf }))}
                selectedValues={filters.jobFamilies || []}
                availableSet={availableOptions.jobFamilies as Set<string>}
              />
            )}

            {allLevels.length > 0 && (
              <FilterDropdown
                label="Level"
                field="levels"
                options={allLevels.map(l => ({ value: l, label: l }))}
                selectedValues={filters.levels || []}
                availableSet={availableOptions.levels as Set<string>}
              />
            )}

            {allRegions.length > 0 && (
              <FilterDropdown
                label="Region"
                field="regions"
                options={allRegions.map(r => ({ value: r, label: r }))}
                selectedValues={filters.regions || []}
                availableSet={availableOptions.regions as Set<string>}
              />
            )}

            {hiringManagers.length > 0 && (
              <FilterDropdown
                label="HM"
                field="hiringManagerIds"
                options={hiringManagers.map(hm => ({ value: hm.user_id, label: hm.name }))}
                selectedValues={filters.hiringManagerIds || []}
                availableSet={availableOptions.hiringManagerIds as Set<string>}
                displayFn={(id) => hiringManagers.find(hm => hm.user_id === id)?.name || id}
              />
            )}
          </div>

          {/* Active Filter Chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/[0.06]">
              {(filters.recruiterIds || []).map((id) => (
                <span key={`rec-${id}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-accent/15 text-accent border border-accent/30">
                  {recruiters.find(r => r.user_id === id)?.name || id}
                  <button type="button" onClick={() => clearFilterValue('recruiterIds', id)} className="hover:bg-accent/20 rounded-full p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {(filters.functions || []).map((f) => (
                <span key={`fn-${f}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-accent/15 text-accent border border-accent/30">
                  {f}
                  <button type="button" onClick={() => clearFilterValue('functions', f)} className="hover:bg-accent/20 rounded-full p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {(filters.jobFamilies || []).map((jf) => (
                <span key={`jf-${jf}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-accent/15 text-accent border border-accent/30">
                  {jf}
                  <button type="button" onClick={() => clearFilterValue('jobFamilies', jf)} className="hover:bg-accent/20 rounded-full p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {(filters.levels || []).map((l) => (
                <span key={`lvl-${l}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-accent/15 text-accent border border-accent/30">
                  {l}
                  <button type="button" onClick={() => clearFilterValue('levels', l)} className="hover:bg-accent/20 rounded-full p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {(filters.regions || []).map((r) => (
                <span key={`reg-${r}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-accent/15 text-accent border border-accent/30">
                  {r}
                  <button type="button" onClick={() => clearFilterValue('regions', r)} className="hover:bg-accent/20 rounded-full p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {(filters.hiringManagerIds || []).map((id) => (
                <span key={`hm-${id}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-accent/15 text-accent border border-accent/30">
                  {hiringManagers.find(hm => hm.user_id === id)?.name || id}
                  <button type="button" onClick={() => clearFilterValue('hiringManagerIds', id)} className="hover:bg-accent/20 rounded-full p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
