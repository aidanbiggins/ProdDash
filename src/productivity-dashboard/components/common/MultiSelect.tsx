// Multi-Select Dropdown Component

import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';

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
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        width: position.width,
        zIndex: 99999,
        backgroundColor: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '0.375rem',
        boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        maxHeight: '280px',
        overflowY: 'auto'
      }}
    >
      {/* Quick actions */}
      <div
        className="d-flex justify-content-between px-3 py-2"
        style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}
      >
        <button
          type="button"
          className="btn btn-link btn-sm p-0 text-decoration-none"
          onClick={selectAll}
          style={{ fontSize: '0.75rem' }}
        >
          Select all ({availableCount})
        </button>
        {hasSelection && (
          <button
            type="button"
            className="btn btn-link btn-sm p-0 text-decoration-none text-muted"
            onClick={clearAll}
            style={{ fontSize: '0.75rem' }}
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
            <label
              key={option.value}
              className="d-flex align-items-center gap-2 px-3 py-2"
              style={{
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isDisabled ? 0.5 : 1,
                backgroundColor: isSelected ? '#f0fdf4' : undefined,
                margin: 0
              }}
              onMouseEnter={(e) => {
                if (!isDisabled && !isSelected) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = '#f8fafc';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = isSelected ? '#f0fdf4' : '';
              }}
            >
              <input
                type="checkbox"
                className="form-check-input m-0"
                checked={isSelected}
                disabled={isDisabled}
                onChange={() => !isDisabled && toggleOption(option.value)}
                style={{ cursor: isDisabled ? 'not-allowed' : 'pointer' }}
              />
              <span
                className="flex-grow-1 text-truncate"
                style={{ fontSize: '0.875rem', color: isDisabled ? '#aaa' : undefined }}
              >
                {option.label}
                {isDisabled && <span className="text-muted ms-1">(no data)</span>}
              </span>
            </label>
          );
        })}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="multi-select" style={{ position: 'relative' }}>
      <button
        ref={triggerRef}
        type="button"
        className={`form-select form-select-sm ${hasSelection ? 'has-selection' : ''}`}
        onClick={() => isOpen ? setIsOpen(false) : openDropdown()}
        style={{
          textAlign: 'left',
          paddingRight: hasSelection ? '2rem' : '1.5rem',
          backgroundColor: hasSelection ? '#f0fdf4' : undefined,
          borderColor: hasSelection ? '#0f766e' : undefined,
          color: hasSelection ? '#0f766e' : undefined,
          width: '100%'
        }}
      >
        <span className="text-truncate d-block" style={{ maxWidth: '100%' }}>
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
              color: '#0f766e',
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
