// AI Provider Settings Modal
// Allows users to configure their AI provider with BYOK (Bring Your Own Key)
// Supports two scopes:
// - User: Key saved for the current user only
// - Organization: Key shared with all org members (admin only)

import React, { useState, useEffect, CSSProperties } from 'react';
import {
  AiProvider,
  AiProviderConfig,
  AiKeyScope,
  StoredAiKey,
  PROVIDER_MODELS,
  PROVIDER_LABELS,
  DEFAULT_AI_CONFIG,
} from '../../types/aiTypes';
import { useAiKeys } from '../../hooks/useAiVault';

// Theme colors matching the Davos Glass design system
const theme = {
  base: '#1a1a1a',
  surface: '#242424',
  surfaceElevated: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.1)',
  borderHover: 'rgba(255,255,255,0.2)',
  textPrimary: '#f8fafc',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  copper: '#d4a373',
  copperHover: '#e5b896',
  copperSubtle: 'rgba(212, 163, 115, 0.15)',
  teal: '#2dd4bf',
  tealSubtle: 'rgba(45, 212, 191, 0.15)',
  warning: '#f59e0b',
  warningSubtle: 'rgba(245, 158, 11, 0.15)',
  danger: '#ef4444',
  dangerSubtle: 'rgba(239, 68, 68, 0.15)',
  info: '#3b82f6',
  infoSubtle: 'rgba(59, 130, 246, 0.15)',
};

// Reusable styled components as CSS
const styles: Record<string, CSSProperties> = {
  input: {
    background: theme.surface,
    border: `1px solid ${theme.borderHover}`,
    color: theme.textPrimary,
  },
  btnPrimary: {
    background: theme.copper,
    border: 'none',
    color: '#1a1a1a',
    fontWeight: 500,
  },
  btnSecondary: {
    background: 'transparent',
    border: `1px solid ${theme.border}`,
    color: theme.textSecondary,
  },
  btnOutline: {
    background: 'transparent',
    border: `1px solid ${theme.copper}`,
    color: theme.copper,
  },
  btnDanger: {
    background: theme.dangerSubtle,
    border: `1px solid ${theme.danger}`,
    color: theme.danger,
  },
  alertWarning: {
    background: theme.warningSubtle,
    border: `1px solid rgba(245, 158, 11, 0.3)`,
    color: theme.warning,
    borderRadius: '0.5rem',
  },
  alertSuccess: {
    background: theme.tealSubtle,
    border: `1px solid rgba(45, 212, 191, 0.3)`,
    color: theme.teal,
    borderRadius: '0.5rem',
  },
  alertDanger: {
    background: theme.dangerSubtle,
    border: `1px solid rgba(239, 68, 68, 0.3)`,
    color: theme.danger,
    borderRadius: '0.5rem',
  },
  alertInfo: {
    background: theme.infoSubtle,
    border: `1px solid rgba(59, 130, 246, 0.3)`,
    color: theme.info,
    borderRadius: '0.5rem',
  },
};

interface AiProviderSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: AiProviderConfig | null;
  onSave: (config: AiProviderConfig) => void;
  onClear: () => void;
  /** Current organization ID */
  orgId?: string | null;
  /** Current user ID */
  userId?: string;
  /** Whether user can set org-level keys (admin or super admin) */
  canSetOrgKey?: boolean;
}

export function AiProviderSettings({
  isOpen,
  onClose,
  currentConfig,
  onSave,
  onClear,
  orgId,
  userId,
  canSetOrgKey = false,
}: AiProviderSettingsProps) {
  // Form state - initialize from current config or defaults
  const [provider, setProvider] = useState<AiProvider>(currentConfig?.provider ?? DEFAULT_AI_CONFIG.provider);
  const [model, setModel] = useState(currentConfig?.model ?? DEFAULT_AI_CONFIG.model);
  const [apiKey, setApiKey] = useState(currentConfig?.apiKey ?? '');
  const [baseUrl, setBaseUrl] = useState(currentConfig?.baseUrl ?? '');
  const [redactPii, setRedactPii] = useState(currentConfig?.redactPii ?? DEFAULT_AI_CONFIG.redactPii);
  const [temperature, setTemperature] = useState(currentConfig?.temperature ?? DEFAULT_AI_CONFIG.temperature);
  const [maxTokens, setMaxTokens] = useState(currentConfig?.maxTokens ?? DEFAULT_AI_CONFIG.maxTokens);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Key storage
  const [saveScope, setSaveScope] = useState<AiKeyScope>('user');
  const [shouldPersist, setShouldPersist] = useState(true);

  // AI Keys hook
  const { keyState, loadKeys, saveKey, deleteKey, getEffectiveKey, clearError } = useAiKeys();

  // Load keys on mount
  useEffect(() => {
    if (isOpen) {
      loadKeys(orgId ?? null);
    }
  }, [isOpen, orgId, loadKeys]);

  // Reset form when modal opens with new config
  useEffect(() => {
    if (isOpen) {
      setProvider(currentConfig?.provider ?? DEFAULT_AI_CONFIG.provider);
      setModel(currentConfig?.model ?? DEFAULT_AI_CONFIG.model);
      setApiKey(currentConfig?.apiKey ?? '');
      setBaseUrl(currentConfig?.baseUrl ?? '');
      setRedactPii(currentConfig?.redactPii ?? DEFAULT_AI_CONFIG.redactPii);
      setTemperature(currentConfig?.temperature ?? DEFAULT_AI_CONFIG.temperature);
      setMaxTokens(currentConfig?.maxTokens ?? DEFAULT_AI_CONFIG.maxTokens);
      clearError();
    }
  }, [isOpen, currentConfig, clearError]);

  // Update model when provider changes
  useEffect(() => {
    const models = PROVIDER_MODELS[provider];
    if (models.length > 0 && !models.find(m => m.id === model)) {
      setModel(models[0].id);
    }
  }, [provider, model]);

  // Load stored key when provider changes
  useEffect(() => {
    if (isOpen) {
      const storedKey = getEffectiveKey(provider);
      if (storedKey) {
        setApiKey(storedKey.apiKey);
        if (storedKey.model) setModel(storedKey.model);
        if (storedKey.baseUrl) setBaseUrl(storedKey.baseUrl);
      }
    }
  }, [isOpen, provider, getEffectiveKey]);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      return; // Don't save without API key
    }

    const config: AiProviderConfig = {
      provider,
      model: provider === 'openai_compatible' && !model ? 'custom' : model,
      apiKey: apiKey.trim(),
      baseUrl: provider === 'openai_compatible' ? baseUrl.trim() : undefined,
      redactPii,
      temperature,
      maxTokens,
    };

    // Persist key if requested
    if (shouldPersist) {
      await saveKey(
        provider,
        apiKey.trim(),
        saveScope,
        orgId,
        userId,
        { model, baseUrl: baseUrl || undefined }
      );
    }

    onSave(config);
    onClose();
  };

  const handleClear = async () => {
    // Delete stored key
    const storedKey = getEffectiveKey(provider);
    if (storedKey) {
      await deleteKey(provider, storedKey.scope, orgId);
    }

    onClear();
    setApiKey('');
    setBaseUrl('');
    onClose();
  };

  if (!isOpen) return null;

  const models = PROVIDER_MODELS[provider];
  const isValid = apiKey.trim().length > 0 && (provider !== 'openai_compatible' || baseUrl.trim().length > 0);

  // Check if there's an existing stored key for this provider
  const existingUserKey = keyState.userKeys.get(provider);
  const existingOrgKey = keyState.orgKeys.get(provider);
  const hasStoredKey = existingUserKey || existingOrgKey;

  return (
    <>
      {/* Backdrop */}
      <div
        className="modal-backdrop fade show"
        style={{ zIndex: 1050 }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="modal fade show d-block"
        tabIndex={-1}
        style={{ zIndex: 1055 }}
      >
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content" style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <h5 className="modal-title" style={{ color: '#f8fafc' }}>
                <i className="bi bi-robot me-2"></i>
                AI Provider Settings
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
                style={{ filter: 'invert(1) grayscale(100%) brightness(200%)' }}
              />
            </div>

            <div className="modal-body" style={{ color: '#e2e8f0' }}>
              {/* Error display */}
              {keyState.error && (
                <div className="mb-3 p-3" style={styles.alertDanger}>
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {keyState.error}
                </div>
              )}

              {/* Stored Keys Info */}
              {(keyState.userProviders.length > 0 || keyState.orgProviders.length > 0) && (
                <div className="mb-4 p-3 rounded" style={{ background: theme.surfaceElevated }}>
                  <div className="small mb-2" style={{ color: theme.textMuted }}>
                    <i className="bi bi-key me-1"></i>
                    Stored API Keys
                  </div>
                  {keyState.userProviders.length > 0 && (
                    <div className="small mb-1">
                      <span style={{ color: theme.textSecondary }}>Your keys: </span>
                      <span style={{ color: theme.teal }}>
                        {keyState.userProviders.map(p => PROVIDER_LABELS[p]).join(', ')}
                      </span>
                    </div>
                  )}
                  {keyState.orgProviders.length > 0 && (
                    <div className="small">
                      <span style={{ color: theme.textSecondary }}>Org keys: </span>
                      <span style={{ color: theme.copper }}>
                        {keyState.orgProviders.map(p => PROVIDER_LABELS[p]).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Provider Selection */}
              <div className="mb-3">
                <label className="form-label small" style={{ color: theme.textMuted }}>Provider</label>
                <select
                  className="form-select"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as AiProvider)}
                  style={styles.input}
                >
                  {(Object.keys(PROVIDER_LABELS) as AiProvider[]).map((p) => (
                    <option key={p} value={p}>
                      {PROVIDER_LABELS[p]}
                      {keyState.userKeys.has(p) ? ' (your key)' : keyState.orgKeys.has(p) ? ' (org key)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Model Selection */}
              <div className="mb-3">
                <label className="form-label small" style={{ color: theme.textMuted }}>Model</label>
                {provider === 'openai_compatible' ? (
                  <input
                    type="text"
                    className="form-control"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g., llama-3-70b-instruct"
                    style={styles.input}
                  />
                ) : (
                  <select
                    className="form-select"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    style={styles.input}
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.description ? `- ${m.description}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Base URL for OpenAI-Compatible */}
              {provider === 'openai_compatible' && (
                <div className="mb-3">
                  <label className="form-label small" style={{ color: theme.textMuted }}>Base URL</label>
                  <input
                    type="url"
                    className="form-control"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://api.together.xyz/v1"
                    style={styles.input}
                  />
                </div>
              )}

              {/* API Key */}
              <div className="mb-3">
                <label className="form-label small" style={{ color: theme.textMuted }}>API Key</label>
                <div className="input-group">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    className="form-control"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={`Enter your ${PROVIDER_LABELS[provider]} API key`}
                    style={styles.input}
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setShowApiKey(!showApiKey)}
                    style={styles.btnSecondary}
                  >
                    <i className={`bi bi-eye${showApiKey ? '-slash' : ''}`}></i>
                  </button>
                </div>
                {hasStoredKey && (
                  <div className="form-text small" style={{ color: theme.teal }}>
                    <i className="bi bi-check-circle me-1"></i>
                    Key loaded from {existingUserKey ? 'your saved keys' : 'organization'}
                  </div>
                )}
              </div>

              {/* Save Key Options */}
              <div className="mb-3 p-3 rounded" style={{ background: theme.surfaceElevated }}>
                <div className="form-check mb-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="persistKey"
                    checked={shouldPersist}
                    onChange={(e) => setShouldPersist(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="persistKey" style={{ color: theme.textPrimary }}>
                    Save API key for future sessions
                  </label>
                </div>

                {shouldPersist && (
                  <div className="ms-4">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="saveScope"
                        id="scopeUser"
                        checked={saveScope === 'user'}
                        onChange={() => setSaveScope('user')}
                      />
                      <label className="form-check-label" htmlFor="scopeUser" style={{ color: theme.textSecondary }}>
                        <i className="bi bi-person me-1"></i>
                        Save for me only
                      </label>
                    </div>
                    {canSetOrgKey && (
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="saveScope"
                          id="scopeOrg"
                          checked={saveScope === 'org'}
                          onChange={() => setSaveScope('org')}
                        />
                        <label className="form-check-label" htmlFor="scopeOrg" style={{ color: theme.textSecondary }}>
                          <i className="bi bi-building me-1"></i>
                          Share with entire organization
                        </label>
                      </div>
                    )}
                    <div className="form-text small mt-2" style={{ color: theme.textMuted }}>
                      {saveScope === 'user'
                        ? 'Key will be saved to your account only.'
                        : 'All organization members will be able to use this key.'}
                    </div>
                  </div>
                )}
              </div>

              {/* PII Redaction Toggle */}
              <div className="mb-3">
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="redactPii"
                    checked={redactPii}
                    onChange={(e) => setRedactPii(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <label className="form-check-label" htmlFor="redactPii" style={{ color: theme.textPrimary }}>
                    Redact PII before sending to AI
                  </label>
                </div>
                <div className="form-text small" style={{ color: redactPii ? theme.textMuted : theme.warning }}>
                  {redactPii
                    ? 'Names, emails, and phone numbers will be replaced with placeholders.'
                    : 'Warning: Real PII will be sent to the AI provider.'}
                </div>
              </div>

              {/* Advanced Settings Toggle */}
              <div className="mb-3">
                <button
                  type="button"
                  className="btn btn-link p-0 text-decoration-none"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  style={{ color: theme.textSecondary }}
                >
                  <i className={`bi bi-chevron-${showAdvanced ? 'down' : 'right'} me-1`}></i>
                  Advanced Settings
                </button>
              </div>

              {/* Advanced Settings */}
              {showAdvanced && (
                <div className="ps-3 border-start" style={{ borderColor: theme.border }}>
                  {/* Temperature */}
                  <div className="mb-3">
                    <label className="form-label small" style={{ color: theme.textMuted }}>
                      Temperature: <span style={{ color: theme.copper }}>{temperature.toFixed(1)}</span>
                    </label>
                    <input
                      type="range"
                      className="form-range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    />
                    <div className="d-flex justify-content-between small" style={{ color: theme.textMuted }}>
                      <span>Precise (0)</span>
                      <span>Creative (1)</span>
                    </div>
                  </div>

                  {/* Max Tokens */}
                  <div className="mb-3">
                    <label className="form-label small" style={{ color: theme.textMuted }}>Max Output Tokens</label>
                    <input
                      type="number"
                      className="form-control"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1024)}
                      min={256}
                      max={4096}
                      step={256}
                      style={styles.input}
                    />
                    <div className="form-text small" style={{ color: theme.textMuted }}>
                      Controls the maximum length of AI responses (256-4096).
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ borderTop: `1px solid ${theme.border}` }}>
              {currentConfig && (
                <button
                  type="button"
                  className="btn me-auto"
                  onClick={handleClear}
                  style={styles.btnDanger}
                >
                  <i className="bi bi-trash me-1"></i>
                  Clear Config
                </button>
              )}
              <button
                type="button"
                className="btn"
                onClick={onClose}
                style={styles.btnSecondary}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleSave}
                disabled={!isValid || keyState.isLoading}
                style={{
                  ...styles.btnPrimary,
                  opacity: isValid && !keyState.isLoading ? 1 : 0.5,
                }}
              >
                {keyState.isLoading ? (
                  <><span className="spinner-border spinner-border-sm me-1"></span> Saving...</>
                ) : (
                  <><i className="bi bi-check-lg me-1"></i> Save Settings</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Badge component to show AI status
export function AiEnabledBadge({ isEnabled, onClick }: { isEnabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="btn btn-sm"
      onClick={onClick}
      title={isEnabled ? 'AI enabled - click to configure' : 'Configure AI provider'}
      style={{
        fontSize: '0.75rem',
        padding: '0.25rem 0.5rem',
        background: isEnabled ? theme.tealSubtle : 'transparent',
        border: `1px solid ${isEnabled ? theme.teal : theme.border}`,
        color: isEnabled ? theme.teal : theme.textSecondary,
      }}
    >
      <i className="bi bi-robot me-1"></i>
      {isEnabled ? 'AI Enabled' : 'AI Settings'}
    </button>
  );
}

// Legacy export for backwards compatibility
export function VaultLockedBanner({
  onUnlock,
  storedProviders,
}: {
  onUnlock: () => void;
  storedProviders: AiProvider[];
}) {
  // No longer needed with the new system, but kept for backwards compatibility
  return null;
}
