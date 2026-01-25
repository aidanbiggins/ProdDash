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
  /** Callback when AI enabled state changes */
  onAiEnabledChange?: (enabled: boolean) => void;
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
  onAiEnabledChange,
}: AiProviderSettingsProps) {
  // Form state - initialize from current config or defaults
  const [provider, setProvider] = useState<AiProvider>(currentConfig?.provider ?? DEFAULT_AI_CONFIG.provider);
  const [model, setModel] = useState(currentConfig?.model ?? DEFAULT_AI_CONFIG.model);
  const [apiKey, setApiKey] = useState(currentConfig?.apiKey ?? '');
  const [baseUrl, setBaseUrl] = useState(currentConfig?.baseUrl ?? '');
  const [redactPii, setRedactPii] = useState(currentConfig?.redactPii ?? DEFAULT_AI_CONFIG.redactPii);
  const [temperature, setTemperature] = useState(currentConfig?.temperature ?? DEFAULT_AI_CONFIG.temperature);
  const [maxTokens, setMaxTokens] = useState(currentConfig?.maxTokens ?? DEFAULT_AI_CONFIG.maxTokens);
  const [aiEnabled, setAiEnabled] = useState(currentConfig?.aiEnabled ?? DEFAULT_AI_CONFIG.aiEnabled);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Key storage
  const [saveScope, setSaveScope] = useState<AiKeyScope>('user');
  const [shouldPersist, setShouldPersist] = useState(true);

  // AI Keys hook - used for vault persistence (optional, non-blocking)
  const { keyState, loadKeys, saveKey, deleteKey, getEffectiveKey, clearError } = useAiKeys();

  // Load keys on mount (non-blocking - don't let failures block the form)
  useEffect(() => {
    if (isOpen) {
      // Fire and forget - don't block the form on vault loading
      loadKeys(orgId ?? null).catch(err => {
        console.warn('[AiProviderSettings] Failed to load keys from vault:', err);
      });
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
      setAiEnabled(currentConfig?.aiEnabled ?? DEFAULT_AI_CONFIG.aiEnabled);
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
      aiEnabled,
    };

    // Clear the "cleared" flag since user is saving new config
    localStorage.removeItem('platovue_ai_cleared');

    // Save config immediately so AI works right away
    onSave(config);
    onClose();

    // Persist key in background if requested (don't block the UI)
    if (shouldPersist) {
      saveKey(
        provider,
        apiKey.trim(),
        saveScope,
        orgId,
        userId,
        { model, baseUrl: baseUrl || undefined }
      ).catch(err => {
        console.warn('Failed to persist AI key to vault:', err);
        // Key still works for this session even if persistence failed
      });
    }
  };

  const handleAiToggle = (enabled: boolean) => {
    setAiEnabled(enabled);
    onAiEnabledChange?.(enabled);
  };

  const handleClear = () => {
    // Set the "cleared" flag to prevent auto-restore from vault
    localStorage.setItem('platovue_ai_cleared', 'true');

    // Clear config immediately so AI is disabled right away
    onClear();
    setApiKey('');
    setBaseUrl('');
    onClose();

    // Delete stored key in background (don't block the UI)
    const storedKey = getEffectiveKey(provider);
    if (storedKey) {
      deleteKey(provider, storedKey.scope, orgId).catch(err => {
        console.warn('[AiProviderSettings] Failed to delete key from vault:', err);
      });
    }
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
        className="fixed inset-0 bg-black/50 z-[1050]"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-[1055] flex items-center justify-center"
        tabIndex={-1}
      >
        <div className="max-w-3xl w-full mx-4">
          <div className="rounded-lg" style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <h5 className="text-lg font-semibold" style={{ color: '#f8fafc' }}>
                <i className="bi bi-robot mr-2"></i>
                AI Provider Settings
              </h5>
              <button
                type="button"
                className="p-0 border-0 bg-transparent"
                onClick={onClose}
                style={{ filter: 'invert(1) grayscale(100%) brightness(200%)' }}
              />
            </div>

            <div className="px-6 py-4" style={{ color: '#e2e8f0' }}>
              {/* AI Enable/Disable Toggle - Master Switch */}
              <div className="mb-4 p-3 rounded flex items-center justify-between" style={{
                background: aiEnabled ? theme.tealSubtle : theme.surfaceElevated,
                border: `1px solid ${aiEnabled ? theme.teal : theme.border}`,
              }}>
                <div>
                  <div className="flex items-center gap-2">
                    <i className={`bi ${aiEnabled ? 'bi-stars' : 'bi-cpu'}`} style={{ color: aiEnabled ? theme.teal : theme.textSecondary }}></i>
                    <span style={{ color: theme.textPrimary, fontWeight: 500 }}>
                      {aiEnabled ? 'AI Mode Enabled' : 'AI Mode Disabled'}
                    </span>
                  </div>
                  <div className="text-xs mt-1" style={{ color: theme.textMuted }}>
                    {aiEnabled
                      ? 'AI will generate dynamic responses using your configured provider.'
                      : 'Using deterministic mode with pre-built responses.'}
                  </div>
                </div>
                <div className="mb-0">
                  <input
                    className="w-12 h-6 cursor-pointer"
                    type="checkbox"
                    role="switch"
                    id="aiEnabledToggle"
                    checked={aiEnabled}
                    onChange={(e) => handleAiToggle(e.target.checked)}
                    style={{
                      backgroundColor: aiEnabled ? theme.teal : theme.textMuted,
                    }}
                  />
                </div>
              </div>

              {/* Error display */}
              {keyState.error && (
                <div className="mb-3 p-3" style={styles.alertDanger}>
                  <i className="bi bi-exclamation-triangle mr-2"></i>
                  {keyState.error}
                </div>
              )}

              {/* Stored Keys Info */}
              {(keyState.userProviders.length > 0 || keyState.orgProviders.length > 0) && (
                <div className="mb-4 p-3 rounded" style={{ background: theme.surfaceElevated }}>
                  <div className="text-xs mb-2" style={{ color: theme.textMuted }}>
                    <i className="bi bi-key mr-1"></i>
                    Stored API Keys
                  </div>
                  {keyState.userProviders.length > 0 && (
                    <div className="text-xs mb-1">
                      <span style={{ color: theme.textSecondary }}>Your keys: </span>
                      <span style={{ color: theme.teal }}>
                        {keyState.userProviders.map(p => PROVIDER_LABELS[p]).join(', ')}
                      </span>
                    </div>
                  )}
                  {keyState.orgProviders.length > 0 && (
                    <div className="text-xs">
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
                <label className="block text-xs font-medium mb-1" style={{ color: theme.textMuted }}>Provider</label>
                <select
                  className="w-full px-3 py-2 rounded border"
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
                <label className="block text-xs font-medium mb-1" style={{ color: theme.textMuted }}>Model</label>
                {provider === 'openai_compatible' ? (
                  <input
                    type="text"
                    className="w-full px-3 py-2 rounded border"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g., llama-3-70b-instruct"
                    style={styles.input}
                  />
                ) : (
                  <select
                    className="w-full px-3 py-2 rounded border"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    style={styles.input}
                  >
                    {/* Group models by category */}
                    {(() => {
                      const categories = new Map<string, typeof models>();
                      models.forEach((m) => {
                        const cat = m.category || 'Other';
                        if (!categories.has(cat)) categories.set(cat, []);
                        categories.get(cat)!.push(m);
                      });
                      return Array.from(categories.entries()).map(([category, categoryModels]) => (
                        <optgroup key={category} label={category}>
                          {categoryModels.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} {m.description ? `- ${m.description}` : ''}
                            </option>
                          ))}
                        </optgroup>
                      ));
                    })()}
                  </select>
                )}
              </div>

              {/* Base URL for OpenAI-Compatible */}
              {provider === 'openai_compatible' && (
                <div className="mb-3">
                  <label className="block text-xs font-medium mb-1" style={{ color: theme.textMuted }}>Base URL</label>
                  <input
                    type="url"
                    className="w-full px-3 py-2 rounded border"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://api.together.xyz/v1"
                    style={styles.input}
                  />
                </div>
              )}

              {/* API Key */}
              <div className="mb-3">
                <label className="block text-xs font-medium mb-1" style={{ color: theme.textMuted }}>API Key</label>
                <div className="flex">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    className="flex-1 px-3 py-2 rounded-l border"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={`Enter your ${PROVIDER_LABELS[provider]} API key`}
                    style={styles.input}
                  />
                  <button
                    type="button"
                    className="px-3 py-2 rounded-r border border-l-0"
                    onClick={() => setShowApiKey(!showApiKey)}
                    style={styles.btnSecondary}
                  >
                    <i className={`bi bi-eye${showApiKey ? '-slash' : ''}`}></i>
                  </button>
                </div>
                {hasStoredKey && (
                  <div className="text-xs mt-1" style={{ color: theme.teal }}>
                    <i className="bi bi-check-circle mr-1"></i>
                    Key loaded from {existingUserKey ? 'your saved keys' : 'organization'}
                  </div>
                )}
              </div>

              {/* Save Key Options */}
              <div className="mb-3 p-3 rounded" style={{ background: theme.surfaceElevated }}>
                <div className="flex items-center mb-2">
                  <input
                    className="mr-2"
                    type="checkbox"
                    id="persistKey"
                    checked={shouldPersist}
                    onChange={(e) => setShouldPersist(e.target.checked)}
                  />
                  <label className="cursor-pointer" htmlFor="persistKey" style={{ color: theme.textPrimary }}>
                    Save API key for future sessions
                  </label>
                </div>

                {shouldPersist && (
                  <div className="ml-4">
                    <div className="flex items-center">
                      <input
                        className="mr-2"
                        type="radio"
                        name="saveScope"
                        id="scopeUser"
                        checked={saveScope === 'user'}
                        onChange={() => setSaveScope('user')}
                      />
                      <label className="cursor-pointer" htmlFor="scopeUser" style={{ color: theme.textSecondary }}>
                        <i className="bi bi-person mr-1"></i>
                        Save for me only
                      </label>
                    </div>
                    {canSetOrgKey && (
                      <div className="flex items-center">
                        <input
                          className="mr-2"
                          type="radio"
                          name="saveScope"
                          id="scopeOrg"
                          checked={saveScope === 'org'}
                          onChange={() => setSaveScope('org')}
                        />
                        <label className="cursor-pointer" htmlFor="scopeOrg" style={{ color: theme.textSecondary }}>
                          <i className="bi bi-building mr-1"></i>
                          Share with entire organization
                        </label>
                      </div>
                    )}
                    <div className="text-xs mt-2" style={{ color: theme.textMuted }}>
                      {saveScope === 'user'
                        ? 'Key will be saved to your account only.'
                        : 'All organization members will be able to use this key.'}
                    </div>
                  </div>
                )}
              </div>

              {/* PII Redaction Toggle */}
              <div className="mb-3">
                <div className="flex items-center">
                  <input
                    className="mr-2 cursor-pointer"
                    type="checkbox"
                    id="redactPii"
                    checked={redactPii}
                    onChange={(e) => setRedactPii(e.target.checked)}
                  />
                  <label className="cursor-pointer" htmlFor="redactPii" style={{ color: theme.textPrimary }}>
                    Redact PII before sending to AI
                  </label>
                </div>
                <div className="text-xs mt-1" style={{ color: redactPii ? theme.textMuted : theme.warning }}>
                  {redactPii
                    ? 'Names, emails, and phone numbers will be replaced with placeholders.'
                    : 'Warning: Real PII will be sent to the AI provider.'}
                </div>
              </div>

              {/* Advanced Settings Toggle */}
              <div className="mb-3">
                <button
                  type="button"
                  className="p-0 border-0 bg-transparent no-underline"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  style={{ color: theme.textSecondary }}
                >
                  <i className={`bi bi-chevron-${showAdvanced ? 'down' : 'right'} mr-1`}></i>
                  Advanced Settings
                </button>
              </div>

              {/* Advanced Settings */}
              {showAdvanced && (
                <div className="pl-3 border-l" style={{ borderColor: theme.border }}>
                  {/* Temperature */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium mb-1" style={{ color: theme.textMuted }}>
                      Temperature: <span style={{ color: theme.copper }}>{temperature.toFixed(1)}</span>
                    </label>
                    <input
                      type="range"
                      className="w-full"
                      min="0"
                      max="1"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    />
                    <div className="flex justify-between text-xs" style={{ color: theme.textMuted }}>
                      <span>Precise (0)</span>
                      <span>Creative (1)</span>
                    </div>
                  </div>

                  {/* Max Tokens */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium mb-1" style={{ color: theme.textMuted }}>Max Output Tokens</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 rounded border"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1024)}
                      min={256}
                      max={4096}
                      step={256}
                      style={styles.input}
                    />
                    <div className="text-xs mt-1" style={{ color: theme.textMuted }}>
                      Controls the maximum length of AI responses (256-4096).
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: `1px solid ${theme.border}` }}>
              {currentConfig && (
                <button
                  type="button"
                  className="px-4 py-2 rounded"
                  onClick={handleClear}
                  style={styles.btnDanger}
                >
                  <i className="bi bi-trash mr-1"></i>
                  Clear Config
                </button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  className="px-4 py-2 rounded"
                  onClick={onClose}
                  style={styles.btnSecondary}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded"
                  onClick={handleSave}
                  disabled={!isValid}
                  style={{
                    ...styles.btnPrimary,
                    opacity: isValid ? 1 : 0.5,
                  }}
                >
                  <i className="bi bi-check-lg mr-1"></i> Save Settings
                </button>
              </div>
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
      className="text-xs px-2 py-1 rounded"
      onClick={onClick}
      title={isEnabled ? 'AI enabled - click to configure' : 'Configure AI provider'}
      style={{
        background: isEnabled ? theme.tealSubtle : 'transparent',
        border: `1px solid ${isEnabled ? theme.teal : theme.border}`,
        color: isEnabled ? theme.teal : theme.textSecondary,
      }}
    >
      <i className="bi bi-robot mr-1"></i>
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
