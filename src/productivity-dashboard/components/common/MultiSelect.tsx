// Multi-Select Dropdown Component

import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Checkbox } from '../../../components/ui/toggles';

interface MultiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
  allLabel?: string;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  allLabel
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Calculate position and open dropdown
  const openDropdown = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 2,
        left: rect.left + window.scrollX,
        width: rect.width
      });
      setIsOpen(true);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const selectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const availableOptions = options.filter(o => !o.disabled).map(o => o.value);
    onChange(availableOptions);
  };

  const getDisplayText = () => {
    if (selected.length === 0) {
      return allLabel || placeholder;
    }
    if (selected.length === 1) {
      const opt = options.find(o => o.value === selected[0]);
      return opt?.label || selected[0];
    }
    return `${selected.length} selected`;
  };

  const hasSelection = selected.length > 0;
  const availableCount = options.filter(o => !o.disabled).length;

  // Render dropdown in a portal to escape stacking context
  const dropdownContent = isOpen ? ReactDOM.createPortal(
    <div
      ref={dropdownRef}
      className="multiselect-portal-dropdown"
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        minWidth: Math.max(position.width, 200),
        zIndex: 99999,
      }}
    >
      {/* Quick actions */}
      <div
        className="flex justify-between px-3 py-2"
        style={{ borderBottom: '1px solid #27272a', backgroundColor: '#0a0a0a' }}
      >
        <button
          type="button"
          className="p-0 text-xs text-accent hover:underline"
          onClick={selectAll}
        >
          Select all ({availableCount})
        </button>
        {hasSelection && (
          <button
            type="button"
            className="p-0 text-xs text-muted-foreground hover:underline"
            onClick={clearAll}
          >
            Clear
          </button>
        )}
      </div>

      {/* Options */}
      <div className="py-1">
        {options.map(option => {
          const isSelected = selected.includes(option.value);
          const isDisabled = option.disabled;

          return (
            <div
              key={option.value}
              className={`multiselect-option ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
              onClick={() => !isDisabled && toggleOption(option.value)}
            >
              <Checkbox
                checked={isSelected}
                onChange={() => !isDisabled && toggleOption(option.value)}
                disabled={isDisabled}
              />
              <span className="ml-2">{option.label || option.value}{isDisabled && ' (no data)'}</span>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="multi-select relative">
      <button
        ref={triggerRef}
        type="button"
        className={`w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-left ${hasSelection ? 'has-selection' : ''}`}
        onClick={() => isOpen ? setIsOpen(false) : openDropdown()}
        style={{
          paddingRight: hasSelection ? '2rem' : '1.5rem',
          backgroundColor: hasSelection ? 'rgba(45, 212, 191, 0.15)' : undefined,
          borderColor: hasSelection ? '#2dd4bf' : undefined,
          color: hasSelection ? '#2dd4bf' : undefined,
        }}
      >
        <span className="truncate block" style={{ maxWidth: '100%' }}>
          {getDisplayText()}
        </span>
        {hasSelection && (
          <span
            onClick={clearAll}
            title="Clear selection"
            style={{
              position: 'absolute',
              right: '1.5rem',
              top: '50%',
              transform: 'translateY(-50%)',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold',
              color: '#2dd4bf',
              lineHeight: 1
            }}
          >
            ×
          </span>
        )}
      </button>
      {dropdownContent}
    </div>
  );
}
