// Ultimate Demo Modal
// Interactive modal for loading synthetic demo data with configurable packs
// See docs/plans/ULTIMATE_DEMO_DATA_INTERACTIVE_V1.md

import React, { useState, useMemo, useCallback } from 'react';
import {
  DemoPackConfig,
  DemoPackInfo,
  DEMO_PACK_INFO,
  DEFAULT_PACK_CONFIG,
  MINIMAL_PACK_CONFIG,
  getMissingDependencies,
} from '../../types/demoTypes';
import { generateUltimateDemo, getDemoStoryPatterns, DemoStoryPattern } from '../../services/ultimateDemoGenerator';

interface UltimateDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadDemo: (bundle: ReturnType<typeof generateUltimateDemo>) => void;
  isLoading?: boolean;
}

type PresetType = 'all' | 'minimal' | 'custom';

const PRESET_CONFIGS: Record<PresetType, DemoPackConfig> = {
  all: DEFAULT_PACK_CONFIG,
  minimal: MINIMAL_PACK_CONFIG,
  custom: DEFAULT_PACK_CONFIG,
};

export function UltimateDemoModal({
  isOpen,
  onClose,
  onLoadDemo,
  isLoading = false,
}: UltimateDemoModalProps) {
  const [preset, setPreset] = useState<PresetType>('all');
  const [packConfig, setPackConfig] = useState<DemoPackConfig>(DEFAULT_PACK_CONFIG);
  const [seed, setSeed] = useState('ultimate-demo-v1');

  // Preview the bundle to show capability status
  const previewBundle = useMemo(() => {
    return generateUltimateDemo(seed, packConfig);
  }, [seed, packConfig]);

  const handlePresetChange = useCallback((newPreset: PresetType) => {
    setPreset(newPreset);
    if (newPreset !== 'custom') {
      setPackConfig(PRESET_CONFIGS[newPreset]);
    }
  }, []);

  const handlePackToggle = useCallback((packId: keyof DemoPackConfig) => {
    setPreset('custom');
    setPackConfig((prev) => {
      const newConfig = { ...prev, [packId]: !prev[packId] };

      // If enabling a pack, auto-enable its dependencies
      if (newConfig[packId]) {
        const packInfo = DEMO_PACK_INFO.find((p) => p.id === packId);
        if (packInfo) {
          for (const dep of packInfo.dependencies) {
            newConfig[dep] = true;
          }
        }
      }

      return newConfig;
    });
  }, []);

  const handleLoad = useCallback(() => {
    const bundle = generateUltimateDemo(seed, packConfig);
    onLoadDemo(bundle);
  }, [seed, packConfig, onLoadDemo]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="modal-backdrop fade show"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="modal fade show d-block"
        tabIndex={-1}
        role="dialog"
        style={{ zIndex: 1055 }}
      >
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div
            className="modal-content"
            style={{
              background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
              border: '1px solid rgba(212, 163, 115, 0.3)',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Header */}
            <div
              className="modal-header border-0 pb-0"
              style={{ padding: '1.5rem 1.5rem 1rem' }}
            >
              <div className="d-flex align-items-center gap-3">
                <div
                  className="d-flex align-items-center justify-content-center"
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: 'rgba(212, 163, 115, 0.15)',
                    color: 'var(--accent-primary)',
                  }}
                >
                  <i className="bi bi-magic" style={{ fontSize: '1.5rem' }}></i>
                </div>
                <div>
                  <h5
                    className="modal-title mb-1"
                    style={{ color: '#f8fafc', fontWeight: 600 }}
                  >
                    Load Ultimate Demo
                  </h5>
                  <p className="mb-0 small" style={{ color: '#94a3b8' }}>
                    Load synthetic data to explore all PlatoVue features
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
                disabled={isLoading}
              />
            </div>

            {/* Body */}
            <div className="modal-body" style={{ padding: '1.5rem' }}>
              {/* Presets */}
              <div className="mb-4">
                <h6
                  className="mb-3"
                  style={{
                    color: '#e2e8f0',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  Presets
                </h6>
                <div className="d-flex gap-3">
                  <PresetButton
                    label="All Features"
                    description="Recommended - enables everything"
                    selected={preset === 'all'}
                    onClick={() => handlePresetChange('all')}
                  />
                  <PresetButton
                    label="Minimal"
                    description="Core ATS only"
                    selected={preset === 'minimal'}
                    onClick={() => handlePresetChange('minimal')}
                  />
                  <PresetButton
                    label="Custom"
                    description="Pick individual packs"
                    selected={preset === 'custom'}
                    onClick={() => handlePresetChange('custom')}
                  />
                </div>
              </div>

              {/* Demo Packs */}
              <div className="mb-4">
                <h6
                  className="mb-3"
                  style={{
                    color: '#e2e8f0',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  Demo Packs
                </h6>
                <div
                  className="rounded-3 p-3"
                  style={{
                    background: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <div className="row g-2">
                    {DEMO_PACK_INFO.map((pack) => (
                      <div key={pack.id} className="col-6">
                        <PackToggle
                          pack={pack}
                          enabled={packConfig[pack.id]}
                          onToggle={() => handlePackToggle(pack.id)}
                          missingDeps={getMissingDependencies(pack.id, packConfig)}
                          disabled={pack.id === 'core_ats'} // Core ATS is always required
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Seed Input */}
              <div className="mb-4">
                <label
                  className="form-label"
                  style={{
                    color: '#e2e8f0',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  Seed (for reproducibility)
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  placeholder="ultimate-demo-v1"
                  style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#e2e8f0',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.875rem',
                  }}
                />
                <small style={{ color: '#64748b' }}>
                  Same seed always produces identical data
                </small>
              </div>

              {/* Demo Story Panel */}
              <DemoStoryPanel />

              {/* Capability Preview */}
              <CapabilityPreview bundle={previewBundle} />
            </div>

            {/* Footer */}
            <div
              className="modal-footer border-0 pt-0"
              style={{ padding: '0 1.5rem 1.5rem', gap: '0.75rem' }}
            >
              <button
                type="button"
                className="btn btn-bespoke-secondary"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-bespoke-primary"
                onClick={handleLoad}
                disabled={isLoading}
                style={{ minWidth: '160px' }}
              >
                {isLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Loading...
                  </>
                ) : (
                  <>
                    <i className="bi bi-play-fill me-2"></i>
                    Load Demo Data
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Preset button component
function PresetButton({
  label,
  description,
  selected,
  onClick,
}: {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex-fill p-3 rounded-3 text-start border-0"
      onClick={onClick}
      style={{
        background: selected
          ? 'rgba(212, 163, 115, 0.15)'
          : 'rgba(15, 23, 42, 0.5)',
        border: selected
          ? '1px solid var(--accent-primary)'
          : '1px solid rgba(255, 255, 255, 0.1)',
        transition: 'all 0.2s ease',
      }}
    >
      <div className="d-flex align-items-center gap-2 mb-1">
        <div
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            border: selected
              ? '2px solid var(--accent-primary)'
              : '2px solid rgba(255, 255, 255, 0.3)',
            background: selected ? 'var(--accent-primary)' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected && (
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#0f172a',
              }}
            />
          )}
        </div>
        <span style={{ color: '#f8fafc', fontWeight: 500, fontSize: '0.875rem' }}>
          {label}
        </span>
      </div>
      <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{description}</span>
    </button>
  );
}

// Pack toggle component
function PackToggle({
  pack,
  enabled,
  onToggle,
  missingDeps,
  disabled,
}: {
  pack: DemoPackInfo;
  enabled: boolean;
  onToggle: () => void;
  missingDeps: (keyof DemoPackConfig)[];
  disabled?: boolean;
}) {
  const hasMissingDeps = missingDeps.length > 0 && !enabled;

  return (
    <div
      className="d-flex align-items-start gap-2 p-2 rounded-2"
      style={{
        background: enabled ? 'rgba(212, 163, 115, 0.08)' : 'transparent',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onClick={disabled ? undefined : onToggle}
    >
      <div
        className="form-check"
        style={{ marginTop: '2px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          className="form-check-input"
          checked={enabled}
          onChange={onToggle}
          disabled={disabled}
          style={{
            background: enabled ? 'var(--accent-primary)' : 'rgba(15, 23, 42, 0.8)',
            borderColor: enabled ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.2)',
          }}
        />
      </div>
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <div
          style={{
            color: enabled ? '#f8fafc' : '#94a3b8',
            fontSize: '0.8125rem',
            fontWeight: 500,
          }}
        >
          {pack.name}
        </div>
        <div
          style={{
            color: '#64748b',
            fontSize: '0.7rem',
            lineHeight: 1.3,
          }}
        >
          {pack.description}
        </div>
        {hasMissingDeps && (
          <div
            style={{
              color: '#f59e0b',
              fontSize: '0.65rem',
              marginTop: '2px',
            }}
          >
            <i className="bi bi-exclamation-triangle me-1"></i>
            Requires: {missingDeps.join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}

// Demo story panel component
function DemoStoryPanel() {
  const patterns = getDemoStoryPatterns();
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div
      className="rounded-3 p-3 mb-4"
      style={{
        background: 'rgba(45, 212, 191, 0.08)',
        border: '1px solid rgba(45, 212, 191, 0.2)',
      }}
    >
      <div
        className="d-flex align-items-center justify-content-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer' }}
      >
        <div className="d-flex align-items-center gap-2">
          <i className="bi bi-lightbulb" style={{ color: '#2dd4bf' }}></i>
          <span style={{ color: '#e2e8f0', fontSize: '0.8125rem', fontWeight: 500 }}>
            What You'll Find in This Demo
          </span>
        </div>
        <i
          className={`bi bi-chevron-${expanded ? 'up' : 'down'}`}
          style={{ color: '#64748b', fontSize: '0.75rem' }}
        ></i>
      </div>

      {expanded && (
        <div className="mt-3">
          <div className="row g-2">
            {patterns.map((pattern) => (
              <div key={pattern.id} className="col-6">
                <div
                  className="p-2 rounded-2"
                  style={{ background: 'rgba(15, 23, 42, 0.4)' }}
                >
                  <div
                    style={{
                      color: '#f8fafc',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      marginBottom: '2px',
                    }}
                  >
                    {pattern.name}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.65rem' }}>
                    {pattern.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div
            className="mt-2 pt-2"
            style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#64748b',
              fontSize: '0.65rem',
            }}
          >
            <i className="bi bi-info-circle me-1"></i>
            These patterns are intentionally placed to demonstrate PlatoVue's detection capabilities.
          </div>
        </div>
      )}
    </div>
  );
}

// Capability preview component
function CapabilityPreview({
  bundle,
}: {
  bundle: ReturnType<typeof generateUltimateDemo>;
}) {
  const { enabled, disabled, disabledReasons } = bundle.capabilityPreview;
  const [expandedFeature, setExpandedFeature] = React.useState<string | null>(null);

  return (
    <div
      className="rounded-3 p-3"
      style={{
        background: 'rgba(15, 23, 42, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <h6
        className="mb-3"
        style={{
          color: '#e2e8f0',
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        Features Preview
      </h6>

      {/* Enabled features */}
      {enabled.length > 0 && (
        <div className="mb-3">
          <div
            className="d-flex flex-wrap gap-2"
            style={{ marginBottom: '0.5rem' }}
          >
            {enabled.slice(0, 10).map((feature) => (
              <span
                key={feature}
                className="badge"
                style={{
                  background: 'rgba(34, 197, 94, 0.15)',
                  color: '#86efac',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  fontSize: '0.7rem',
                  fontWeight: 500,
                }}
              >
                <i className="bi bi-check-circle me-1"></i>
                {feature}
              </span>
            ))}
            {enabled.length > 10 && (
              <span
                className="badge"
                style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  color: '#86efac',
                  fontSize: '0.7rem',
                }}
              >
                +{enabled.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Disabled features */}
      {disabled.length > 0 && (
        <div>
          <div className="d-flex flex-wrap gap-2 mb-2">
            {disabled.slice(0, 5).map((feature) => (
              <button
                key={feature}
                type="button"
                className="badge border-0"
                onClick={() => setExpandedFeature(expandedFeature === feature ? null : feature)}
                style={{
                  background: expandedFeature === feature
                    ? 'rgba(239, 68, 68, 0.25)'
                    : 'rgba(239, 68, 68, 0.1)',
                  color: '#fca5a5',
                  border: expandedFeature === feature
                    ? '1px solid rgba(239, 68, 68, 0.5)'
                    : '1px solid rgba(239, 68, 68, 0.2)',
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <i className="bi bi-x-circle me-1"></i>
                {feature}
                <i
                  className={`bi bi-chevron-${expandedFeature === feature ? 'up' : 'down'} ms-1`}
                  style={{ fontSize: '0.6rem' }}
                ></i>
              </button>
            ))}
            {disabled.length > 5 && (
              <span
                className="badge"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#fca5a5',
                  fontSize: '0.7rem',
                }}
              >
                +{disabled.length - 5} more
              </span>
            )}
          </div>

          {/* Expanded explanation */}
          {expandedFeature && disabledReasons[expandedFeature] && (
            <div
              className="rounded-2 p-2 mt-2"
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
              }}
            >
              <div className="d-flex align-items-start gap-2">
                <i
                  className="bi bi-info-circle"
                  style={{ color: '#fca5a5', marginTop: '2px' }}
                ></i>
                <div>
                  <div
                    style={{
                      color: '#fca5a5',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      marginBottom: '4px',
                    }}
                  >
                    Why "{expandedFeature}" is disabled:
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.7rem', lineHeight: 1.4 }}>
                    {disabledReasons[expandedFeature]}
                  </div>
                  <div
                    className="mt-2 pt-2"
                    style={{
                      borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                      color: '#64748b',
                      fontSize: '0.65rem',
                    }}
                  >
                    <i className="bi bi-lightbulb me-1"></i>
                    Enable the required pack above to unlock this feature.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* All enabled message */}
      {disabled.length === 0 && (
        <div
          className="text-center py-2"
          style={{ color: '#86efac', fontSize: '0.8rem' }}
        >
          <i className="bi bi-stars me-2"></i>
          All features enabled with this configuration!
        </div>
      )}

      {/* Data summary */}
      <div
        className="d-flex gap-4 mt-3 pt-3"
        style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}
      >
        <DataStat label="Requisitions" value={bundle.requisitions.length} />
        <DataStat label="Candidates" value={bundle.candidates.length} />
        <DataStat label="Events" value={bundle.events.length} />
        <DataStat label="Users" value={bundle.users.length} />
      </div>
    </div>
  );
}

// Data stat component
function DataStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div
        style={{
          color: '#f8fafc',
          fontSize: '1.125rem',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
        }}
      >
        {value.toLocaleString()}
      </div>
      <div style={{ color: '#64748b', fontSize: '0.65rem' }}>{label}</div>
    </div>
  );
}

export default UltimateDemoModal;
