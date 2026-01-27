import React, { useState } from 'react';
import { Calendar, ChevronDown, Filter, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../components/ui/popover';
import { Calendar as CalendarComponent } from '../../../components/ui/calendar';
import { Checkbox } from '../../../components/ui/checkbox';
import type { FilterState, DateRange } from './types';

interface FilterBarV2Props {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  recruiters?: Array<{ id: string; name: string }>;
  departments?: string[];
}

const datePresets = [
  { label: '30 days', days: 30 },
  { label: '60 days', days: 60 },
  { label: '90 days', days: 90 },
  { label: 'YTD', days: -1 },
];

export function FilterBarV2({ filters, onFiltersChange, recruiters = [], departments = [] }: FilterBarV2Props) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState<string>('90 days');

  const handleDatePreset = (preset: { label: string; days: number }) => {
    setSelectedPreset(preset.label);
    const end = new Date();
    let start: Date;

    if (preset.days === -1) {
      // YTD
      start = new Date(end.getFullYear(), 0, 1);
    } else {
      start = new Date();
      start.setDate(start.getDate() - preset.days);
    }

    onFiltersChange({
      ...filters,
      dateRange: { start, end },
    });
  };

  const handleRecruiterToggle = (recruiterId: string) => {
    const newRecruiters = filters.recruiters.includes(recruiterId)
      ? filters.recruiters.filter(id => id !== recruiterId)
      : [...filters.recruiters, recruiterId];

    onFiltersChange({
      ...filters,
      recruiters: newRecruiters,
    });
  };

  const handleDepartmentToggle = (dept: string) => {
    const newDepartments = filters.departments.includes(dept)
      ? filters.departments.filter(d => d !== dept)
      : [...filters.departments, dept];

    onFiltersChange({
      ...filters,
      departments: newDepartments,
    });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      ...filters,
      recruiters: [],
      departments: [],
      regions: [],
      priorities: [],
      statuses: [],
    });
  };

  const activeFilterCount =
    filters.recruiters.length +
    filters.departments.length +
    filters.regions.length;

  const formatDateRange = (range: DateRange) => {
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${range.start.toLocaleDateString('en-US', options)} - ${range.end.toLocaleDateString('en-US', options)}`;
  };

  return (
    <div className="glass-panel mb-6">
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
            <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary text-xs font-semibold">
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
        <div className="p-3 md:p-4 space-y-3 md:space-y-4">
          {/* Date Range Row */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3">
            <span className="text-[10px] md:text-xs font-medium uppercase tracking-wider text-muted-foreground sm:min-w-[80px]">
              Date Range
            </span>

            {/* Preset Buttons */}
            <div className="flex gap-1 p-1 rounded-md bg-[rgba(255,255,255,0.03)] overflow-x-auto">
              {datePresets.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleDatePreset(preset)}
                  className={`px-2 md:px-3 py-1.5 rounded text-[11px] md:text-xs font-medium transition-colors whitespace-nowrap ${
                    selectedPreset === preset.label
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Date Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-[11px] md:text-xs bg-transparent border-white/[0.08] hover:bg-white/[0.04] w-full sm:w-auto justify-center sm:justify-start"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDateRange(filters.dateRange)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="range"
                  numberOfMonths={1}
                  className="md:hidden"
                />
                <CalendarComponent
                  mode="range"
                  numberOfMonths={2}
                  className="hidden md:block"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Recruiters Filter */}
          {recruiters.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-start gap-2 sm:gap-3">
              <span className="text-[10px] md:text-xs font-medium uppercase tracking-wider text-muted-foreground sm:min-w-[80px] sm:pt-1">
                Recruiters
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs bg-transparent border-white/[0.08] hover:bg-white/[0.04]"
                  >
                    {filters.recruiters.length === 0
                      ? 'All Recruiters'
                      : `${filters.recruiters.length} selected`}
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[240px] p-2" align="start">
                  <div className="space-y-1 max-h-[240px] overflow-y-auto">
                    {recruiters.map((recruiter) => (
                      <label
                        key={recruiter.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.06] cursor-pointer"
                      >
                        <Checkbox
                          checked={filters.recruiters.includes(recruiter.id)}
                          onCheckedChange={() => handleRecruiterToggle(recruiter.id)}
                        />
                        <span className="text-sm">{recruiter.name}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Selected Recruiter Chips */}
              {filters.recruiters.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {filters.recruiters.map((id) => {
                    const recruiter = recruiters.find(r => r.id === id);
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/30"
                      >
                        {recruiter?.name}
                        <button
                          type="button"
                          onClick={() => handleRecruiterToggle(id)}
                          className="hover:bg-primary/20 rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Departments Filter */}
          {departments.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-start gap-2 sm:gap-3">
              <span className="text-[10px] md:text-xs font-medium uppercase tracking-wider text-muted-foreground sm:min-w-[80px] sm:pt-1">
                Departments
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs bg-transparent border-white/[0.08] hover:bg-white/[0.04]"
                  >
                    {filters.departments.length === 0
                      ? 'All Departments'
                      : `${filters.departments.length} selected`}
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-2" align="start">
                  <div className="space-y-1">
                    {departments.map((dept) => (
                      <label
                        key={dept}
                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.06] cursor-pointer"
                      >
                        <Checkbox
                          checked={filters.departments.includes(dept)}
                          onCheckedChange={() => handleDepartmentToggle(dept)}
                        />
                        <span className="text-sm">{dept}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Selected Department Chips */}
              {filters.departments.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {filters.departments.map((dept) => (
                    <span
                      key={dept}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/30"
                    >
                      {dept}
                      <button
                        type="button"
                        onClick={() => handleDepartmentToggle(dept)}
                        className="hover:bg-primary/20 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
