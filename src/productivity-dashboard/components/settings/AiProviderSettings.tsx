// AI Provider Settings Modal
// Allows users to configure their AI provider with BYOK (Bring Your Own Key)
// Supports two storage modes:
// - Memory: Keys stored in memory only (default, cleared on page refresh)
// - Vault: Keys encrypted and stored in Supabase, unlocked with passphrase

import React, { useState, useEffect, CSSProperties } from 'react';
import {
  AiProvider,
  AiProviderConfig,
  AiKeyStorageMode,
  AiVaultState,
  PROVIDER_MODELS,
  PROVIDER_LABELS,
  DEFAULT_AI_CONFIG,
  INITIAL_VAULT_STATE,
} from '../../types/aiTypes';
import { useAiVault, configsToKeysMap, keysToConfigs } from '../../hooks/useAiVault';

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
  /** All provider configs (for vault save) */
  allConfigs?: Map<AiProvider, AiProviderConfig>;
  /** Callback when vault is unlocked with keys */
  onVaultUnlock?: (configs: Map<AiProvider, AiProviderConfig>) => void;
  /** Callback when vault is cleared */
  onVaultClear?: () => void;
}

export function AiProviderSettings({
  isOpen,
  onClose,
  currentConfig,
  onSave,
  onClear,
  allConfigs,
  onVaultUnlock,
  onVaultClear,
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

  // Vault state
  const {
    vaultState,
    setStorageMode,
    checkVaultEntries,
    unlockVault,
    saveToVault,
    forgetVault,
    clearError,
  } = useAiVault();

  // Passphrase input for vault operations
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [vaultAction, setVaultAction] = useState<'none' | 'unlock' | 'save' | 'forget'>('none');

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
      // Reset vault action state
      setVaultAction('none');
      setPassphrase('');
      setConfirmPassphrase('');
      clearError();
      // Check vault entries when in vault mode
      if (vaultState.storageMode === 'vault') {
        checkVaultEntries();
      }
    }
  }, [isOpen, currentConfig, vaultState.storageMode, checkVaultEntries, clearError]);

  // Update model when provider changes
  useEffect(() => {
    const models = PROVIDER_MODELS[provider];
    if (models.length > 0 && !models.find(m => m.id === model)) {
      setModel(models[0].id);
    }
  }, [provider, model]);

  const handleSave = () => {
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

    onSave(config);
    onClose();
  };

  const handleClear = () => {
    onClear();
    setApiKey('');
    setBaseUrl('');
    onClose();
  };

  const handleStorageModeChange = (mode: AiKeyStorageMode) => {
    setStorageMode(mode);
    if (mode === 'vault') {
      checkVaultEntries();
    }
  };

  const handleUnlockVault = async () => {
    if (!passphrase) return;

    const keys = await unlockVault(passphrase);
    if (keys && keys.size > 0) {
      // Convert keys to configs and notify parent
      const configs = keysToConfigs(keys);
      onVaultUnlock?.(configs);
      setVaultAction('none');
      setPassphrase('');
      // Auto-select the first available provider
      const firstProvider = Array.from(keys.keys())[0];
      if (firstProvider && keys.get(firstProvider)) {
        setProvider(firstProvider);
        setApiKey(keys.get(firstProvider) || '');
      }
    }
  };

  const handleSaveToVault = async () => {
    if (!passphrase || passphrase !== confirmPassphrase) return;

    // Collect current key if not already in allConfigs
    const keysToSave = new Map<AiProvider, string>();
    if (allConfigs) {
      for (const [p, config] of allConfigs) {
        if (config.apiKey) {
          keysToSave.set(p, config.apiKey);
        }
      }
    }
    // Add current key if entered
    if (apiKey.trim()) {
      keysToSave.set(provider, apiKey.trim());
    }

    if (keysToSave.size === 0) {
      return;
    }

    const success = await saveToVault(keysToSave, passphrase);
    if (success) {
      setVaultAction('none');
      setPassphrase('');
      setConfirmPassphrase('');
    }
  };

  const handleForgetVault = async () => {
    const success = await forgetVault();
    if (success) {
      onVaultClear?.();
      setVaultAction('none');
      setPassphrase('');
    }
  };

  if (!isOpen) return null;

  const models = PROVIDER_MODELS[provider];
  const isValid = apiKey.trim().length > 0 && (provider !== 'openai_compatible' || baseUrl.trim().length > 0);
  const isVaultMode = vaultState.storageMode === 'vault';
  const showVaultLocked = isVaultMode && vaultState.hasVaultEntries && !vaultState.isUnlocked;

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
              {/* Storage Mode Toggle */}
              <div className="mb-4 p-3 rounded" style={{ background: theme.surfaceElevated }}>
                <label className="form-label small mb-2" style={{ color: theme.textMuted }}>
                  <i className="bi bi-shield-lock me-1"></i>
                  Key Storage Mode
                </label>
                <div className="btn-group w-100" role="group">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => handleStorageModeChange('memory')}
                    style={!isVaultMode
                      ? { ...styles.btnPrimary }
                      : { ...styles.btnSecondary }
                    }
                  >
                    <i className="bi bi-memory me-1"></i>
                    Memory Only
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => handleStorageModeChange('vault')}
                    style={isVaultMode
                      ? { ...styles.btnPrimary }
                      : { ...styles.btnSecondary }
                    }
                  >
                    <i className="bi bi-cloud-lock me-1"></i>
                    Sync Across Devices
                  </button>
                </div>
                <div className="form-text small mt-2" style={{ color: theme.textMuted }}>
                  {isVaultMode
                    ? 'Keys encrypted with your passphrase and stored in the cloud. Unlock on any device.'
                    : 'Keys stored in browser memory only. Cleared when you close the tab.'}
                </div>
              </div>

              {/* Vault Status Banner */}
              {showVaultLocked && (
                <div
                  className="d-flex align-items-center mb-4 p-3"
                  style={styles.alertWarning}
                >
                  <i className="bi bi-lock-fill me-2 fs-5"></i>
                  <div className="flex-grow-1">
                    <strong style={{ color: theme.textPrimary }}>Vault Locked</strong>
                    <div className="small" style={{ color: theme.textSecondary }}>Enter your passphrase to unlock your saved API keys.</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setVaultAction('unlock')}
                    style={{
                      background: theme.warning,
                      border: 'none',
                      color: '#1a1a1a',
                      fontWeight: 500,
                    }}
                  >
                    Unlock Vault
                  </button>
                </div>
              )}

              {/* Vault Unlocked Banner */}
              {isVaultMode && vaultState.isUnlocked && (
                <div
                  className="d-flex align-items-center mb-4 p-3"
                  style={styles.alertSuccess}
                >
                  <i className="bi bi-unlock-fill me-2 fs-5"></i>
                  <div className="flex-grow-1">
                    <strong style={{ color: theme.textPrimary }}>Vault Unlocked</strong>
                    <div className="small" style={{ color: theme.textSecondary }}>
                      Keys loaded for: {vaultState.storedProviders.map(p => PROVIDER_LABELS[p]).join(', ')}
                    </div>
                  </div>
                </div>
              )}

              {/* Vault Action Forms */}
              {vaultAction !== 'none' && (
                <div
                  className="mb-4 p-3 rounded"
                  style={{
                    background: theme.surfaceElevated,
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  {vaultAction === 'unlock' && (
                    <>
                      <h6 className="mb-3" style={{ color: theme.textPrimary }}>
                        <i className="bi bi-key me-2" style={{ color: theme.copper }}></i>
                        Unlock Vault
                      </h6>
                      <div className="mb-3">
                        <label className="form-label small" style={{ color: theme.textMuted }}>Passphrase</label>
                        <div className="input-group">
                          <input
                            type={showPassphrase ? 'text' : 'password'}
                            className="form-control"
                            value={passphrase}
                            onChange={(e) => setPassphrase(e.target.value)}
                            placeholder="Enter your vault passphrase"
                            style={styles.input}
                            onKeyDown={(e) => e.key === 'Enter' && handleUnlockVault()}
                          />
                          <button
                            type="button"
                            className="btn"
                            onClick={() => setShowPassphrase(!showPassphrase)}
                            style={styles.btnSecondary}
                          >
                            <i className={`bi bi-eye${showPassphrase ? '-slash' : ''}`}></i>
                          </button>
                        </div>
                      </div>
                      {vaultState.error && (
                        <div className="py-2 px-3 mb-3" style={styles.alertDanger}>
                          <i className="bi bi-exclamation-triangle me-1"></i>
                          {vaultState.error}
                        </div>
                      )}
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className="btn"
                          onClick={handleUnlockVault}
                          disabled={!passphrase || vaultState.isLoading}
                          style={styles.btnPrimary}
                        >
                          {vaultState.isLoading ? (
                            <><span className="spinner-border spinner-border-sm me-1"></span> Unlocking...</>
                          ) : (
                            <><i className="bi bi-unlock me-1"></i> Unlock</>
                          )}
                        </button>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setVaultAction('none')}
                          style={styles.btnSecondary}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}

                  {vaultAction === 'save' && (
                    <>
                      <h6 className="mb-3" style={{ color: theme.textPrimary }}>
                        <i className="bi bi-cloud-upload me-2" style={{ color: theme.copper }}></i>
                        Save Keys to Vault
                      </h6>
                      <div className="py-2 px-3 mb-3" style={styles.alertInfo}>
                        <i className="bi bi-info-circle me-1"></i>
                        Choose a passphrase to encrypt your keys. You'll need this to unlock on other devices.
                      </div>
                      <div className="mb-3">
                        <label className="form-label small" style={{ color: theme.textMuted }}>New Passphrase</label>
                        <input
                          type={showPassphrase ? 'text' : 'password'}
                          className="form-control"
                          value={passphrase}
                          onChange={(e) => setPassphrase(e.target.value)}
                          placeholder="Choose a strong passphrase"
                          style={styles.input}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label small" style={{ color: theme.textMuted }}>Confirm Passphrase</label>
                        <input
                          type={showPassphrase ? 'text' : 'password'}
                          className="form-control"
                          value={confirmPassphrase}
                          onChange={(e) => setConfirmPassphrase(e.target.value)}
                          placeholder="Confirm your passphrase"
                          style={styles.input}
                        />
                        {confirmPassphrase && passphrase !== confirmPassphrase && (
                          <div className="form-text" style={{ color: theme.danger }}>Passphrases do not match</div>
                        )}
                      </div>
                      {vaultState.error && (
                        <div className="py-2 px-3 mb-3" style={styles.alertDanger}>
                          <i className="bi bi-exclamation-triangle me-1"></i>
                          {vaultState.error}
                        </div>
                      )}
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className="btn"
                          onClick={handleSaveToVault}
                          disabled={!passphrase || passphrase !== confirmPassphrase || vaultState.isLoading}
                          style={styles.btnPrimary}
                        >
                          {vaultState.isLoading ? (
                            <><span className="spinner-border spinner-border-sm me-1"></span> Saving...</>
                          ) : (
                            <><i className="bi bi-cloud-upload me-1"></i> Save to Vault</>
                          )}
                        </button>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setVaultAction('none')}
                          style={styles.btnSecondary}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}

                  {vaultAction === 'forget' && (
                    <>
                      <h6 className="mb-3" style={{ color: theme.danger }}>
                        <i className="bi bi-trash me-2"></i>
                        Forget Vault Keys
                      </h6>
                      <div className="py-2 px-3 mb-3" style={styles.alertDanger}>
                        <i className="bi bi-exclamation-triangle me-1"></i>
                        This will permanently delete all encrypted keys from the vault. You will need to re-enter your API keys.
                      </div>
                      {vaultState.error && (
                        <div className="py-2 px-3 mb-3" style={styles.alertDanger}>
                          {vaultState.error}
                        </div>
                      )}
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className="btn"
                          onClick={handleForgetVault}
                          disabled={vaultState.isLoading}
                          style={{
                            background: theme.danger,
                            border: 'none',
                            color: '#fff',
                            fontWeight: 500,
                          }}
                        >
                          {vaultState.isLoading ? (
                            <><span className="spinner-border spinner-border-sm me-1"></span> Deleting...</>
                          ) : (
                            <><i className="bi bi-trash me-1"></i> Delete All Keys</>
                          )}
                        </button>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => setVaultAction('none')}
                          style={styles.btnSecondary}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Main Settings Form - only show if vault action not active */}
              {vaultAction === 'none' && (
                <>
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
                      <div className="form-text small" style={{ color: theme.textMuted }}>
                        Must be on the approved host list for security.
                      </div>
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
                    <div className="form-text small" style={{ color: theme.textMuted }}>
                      <i className="bi bi-shield-check me-1" style={{ color: theme.teal }}></i>
                      {isVaultMode
                        ? 'Key will be encrypted with your passphrase before storage.'
                        : 'Key is stored in memory only - never saved to disk or sent to our servers.'}
                    </div>
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
                </>
              )}
            </div>

            <div className="modal-footer" style={{ borderTop: `1px solid ${theme.border}` }}>
              {/* Vault Actions (left side) */}
              {isVaultMode && vaultAction === 'none' && (
                <div className="me-auto d-flex gap-2">
                  {!vaultState.hasVaultEntries && apiKey.trim() && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setVaultAction('save')}
                      style={styles.btnOutline}
                    >
                      <i className="bi bi-cloud-upload me-1"></i>
                      Save to Vault
                    </button>
                  )}
                  {vaultState.hasVaultEntries && !vaultState.isUnlocked && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setVaultAction('unlock')}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${theme.warning}`,
                        color: theme.warning,
                      }}
                    >
                      <i className="bi bi-unlock me-1"></i>
                      Unlock Vault
                    </button>
                  )}
                  {vaultState.isUnlocked && (
                    <>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setVaultAction('save')}
                        style={styles.btnOutline}
                      >
                        <i className="bi bi-cloud-upload me-1"></i>
                        Update Vault
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setVaultAction('forget')}
                        style={styles.btnDanger}
                      >
                        <i className="bi bi-trash me-1"></i>
                        Forget Keys
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Standard Actions (right side) */}
              {vaultAction === 'none' && (
                <>
                  {currentConfig && (
                    <button
                      type="button"
                      className="btn"
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
                    disabled={!isValid}
                    style={{
                      ...styles.btnPrimary,
                      opacity: isValid ? 1 : 0.5,
                    }}
                  >
                    <i className="bi bi-check-lg me-1"></i>
                    Save Settings
                  </button>
                </>
              )}
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

// Vault locked banner component for display elsewhere in the app
export function VaultLockedBanner({
  onUnlock,
  storedProviders,
}: {
  onUnlock: () => void;
  storedProviders: AiProvider[];
}) {
  return (
    <div
      className="d-flex align-items-center mb-0 p-2 rounded"
      style={{
        background: theme.warningSubtle,
        border: `1px solid rgba(245, 158, 11, 0.3)`,
      }}
    >
      <i className="bi bi-lock-fill me-2" style={{ color: theme.warning }}></i>
      <div className="flex-grow-1 small">
        <strong style={{ color: theme.textPrimary }}>AI Vault Locked</strong>
        <span style={{ color: theme.textSecondary }}> - Unlock to use {storedProviders.map(p => PROVIDER_LABELS[p]).join(', ')}</span>
      </div>
      <button
        type="button"
        className="btn btn-sm"
        onClick={onUnlock}
        style={{
          background: theme.warning,
          border: 'none',
          color: '#1a1a1a',
          fontWeight: 500,
        }}
      >
        Unlock
      </button>
    </div>
  );
}
