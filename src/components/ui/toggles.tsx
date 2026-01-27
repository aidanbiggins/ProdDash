// Shared Toggle Components
// Consistent, visible toggle controls used across the app

import React from 'react';
import { Check } from 'lucide-react';

// Toggle Switch - For on/off binary choices
export function ToggleSwitch({
  checked,
  onChange,
  size = 'md',
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}) {
  const sizes = {
    sm: { track: 'w-10 h-5', thumb: 'w-4 h-4', translate: 'translate-x-5' },
    md: { track: 'w-14 h-7', thumb: 'w-6 h-6', translate: 'translate-x-7' },
    lg: { track: 'w-16 h-8', thumb: 'w-7 h-7', translate: 'translate-x-8' },
  };
  const s = sizes[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`
        ${s.track} relative inline-flex items-center rounded-full
        transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background
        ${checked ? 'bg-accent' : 'bg-white/20'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <span
        className={`
          ${s.thumb} inline-block rounded-full bg-white shadow-lg transform transition-transform duration-200 ease-in-out
          ${checked ? s.translate : 'translate-x-0.5'}
        `}
      />
    </button>
  );
}

// Checkbox - For multi-select or boolean options
export function Checkbox({
  checked,
  onChange,
  id,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      id={id}
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`
        w-5 h-5 rounded flex items-center justify-center transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background
        ${checked
          ? 'bg-accent border-accent'
          : 'bg-white/10 border-2 border-white/30 hover:border-white/50'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {checked && <Check className="w-3.5 h-3.5 text-accent-foreground stroke-[3]" />}
    </button>
  );
}

// Radio - For single-select from multiple options
export function Radio({
  checked,
  onChange,
  name,
  id,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  name: string;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      id={id}
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange()}
      className={`
        w-5 h-5 rounded-full flex items-center justify-center transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background
        ${checked
          ? 'bg-accent border-accent'
          : 'bg-white/10 border-2 border-white/30 hover:border-white/50'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {checked && <div className="w-2 h-2 rounded-full bg-accent-foreground" />}
    </button>
  );
}
