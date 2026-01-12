// Date Range Picker Component

import React, { useState } from 'react';
import { format, subDays, differenceInDays } from 'date-fns';
import { DateRange, DateRangePreset } from '../../types';
import { useIsMobile } from '../../hooks/useIsMobile';

interface DateRangePickerProps {
  dateRange: DateRange;
  onChange: (range: DateRange) => void;
}

const presets: { label: string; value: DateRangePreset; days: number }[] = [
  { label: '30d', value: '30', days: 30 },
  { label: '60d', value: '60', days: 60 },
  { label: '90d', value: '90', days: 90 },
  { label: '6mo', value: '180', days: 180 },
  { label: '1yr', value: '365', days: 365 }
];

export function DateRangePicker({ dateRange, onChange }: DateRangePickerProps) {
  const isMobile = useIsMobile();
  const [activePreset, setActivePreset] = useState<DateRangePreset | null>(null);

  // Determine which preset is active based on current date range
  const getActivePreset = (): DateRangePreset | null => {
    if (activePreset) return activePreset;
    const daysDiff = differenceInDays(dateRange.endDate, dateRange.startDate);
    const isEndToday = differenceInDays(new Date(), dateRange.endDate) <= 1;
    if (!isEndToday) return null;
    const preset = presets.find(p => Math.abs(p.days - daysDiff) <= 2);
    return preset?.value || null;
  };

  const handlePresetClick = (days: number, value: DateRangePreset) => {
    setActivePreset(value);
    onChange({
      startDate: subDays(new Date(), days),
      endDate: new Date()
    });
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = new Date(e.target.value);
    if (!isNaN(newStart.getTime())) {
      setActivePreset(null);
      onChange({
        ...dateRange,
        startDate: newStart
      });
    }
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = new Date(e.target.value);
    if (!isNaN(newEnd.getTime())) {
      setActivePreset(null);
      onChange({
        ...dateRange,
        endDate: newEnd
      });
    }
  };

  const currentPreset = getActivePreset();

  // Mobile: Super compact - just presets
  if (isMobile) {
    return (
      <div className="date-preset-group" style={{ display: 'flex', flexWrap: 'nowrap', gap: '0.25rem' }}>
        {presets.map(preset => (
          <button
            key={preset.value}
            type="button"
            className={`date-preset-btn ${currentPreset === preset.value ? 'active' : ''}`}
            onClick={() => handlePresetClick(preset.days, preset.value)}
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
          >
            {preset.label}
          </button>
        ))}
      </div>
    );
  }

  // Desktop: Full version
  return (
    <div className="d-flex align-items-center gap-3">
      <div className="date-preset-group">
        {presets.map(preset => (
          <button
            key={preset.value}
            type="button"
            className={`date-preset-btn ${currentPreset === preset.value ? 'active' : ''}`}
            onClick={() => handlePresetClick(preset.days, preset.value)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="d-flex align-items-center gap-2">
        <input
          type="date"
          className="form-control form-control-sm"
          style={{ width: '130px' }}
          value={format(dateRange.startDate, 'yyyy-MM-dd')}
          onChange={handleStartDateChange}
        />
        <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>to</span>
        <input
          type="date"
          className="form-control form-control-sm"
          style={{ width: '130px' }}
          value={format(dateRange.endDate, 'yyyy-MM-dd')}
          onChange={handleEndDateChange}
        />
      </div>
    </div>
  );
}

