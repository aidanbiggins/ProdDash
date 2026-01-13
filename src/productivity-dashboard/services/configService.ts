/**
 * Config Service - Supabase Persistence for Dashboard Configuration
 *
 * Handles loading and saving of DashboardConfig to the organization_settings table.
 * This ensures config (benchmarks, stage mappings, weights, etc.) persists across
 * devices and sessions - users can log in from anywhere seamlessly.
 */

import { supabase } from '../../lib/supabase';
import { DashboardConfig, DEFAULT_CONFIG } from '../types/config';

// Local storage key for fallback/cache
const CONFIG_CACHE_KEY = 'productivity_dashboard_config_cache';

/**
 * Serialize config for database storage
 * Converts Date objects to ISO strings
 */
function serializeConfig(config: DashboardConfig): Record<string, unknown> {
  return {
    ...config,
    lastUpdated: config.lastUpdated?.toISOString() || new Date().toISOString(),
    pipelineBenchmarks: config.pipelineBenchmarks ? {
      ...config.pipelineBenchmarks,
      lastUpdated: config.pipelineBenchmarks.lastUpdated?.toISOString() || null,
    } : null,
  };
}

/**
 * Deserialize config from database
 * Converts ISO strings back to Date objects
 */
function deserializeConfig(data: Record<string, unknown>): DashboardConfig {
  const config = data as unknown as DashboardConfig;

  return {
    ...config,
    lastUpdated: config.lastUpdated ? new Date(config.lastUpdated as unknown as string) : new Date(),
    pipelineBenchmarks: config.pipelineBenchmarks ? {
      ...config.pipelineBenchmarks,
      lastUpdated: config.pipelineBenchmarks.lastUpdated
        ? new Date(config.pipelineBenchmarks.lastUpdated as unknown as string)
        : null,
    } : DEFAULT_CONFIG.pipelineBenchmarks,
  };
}

/**
 * Load organization settings from Supabase
 * Falls back to localStorage cache if Supabase is unavailable
 */
export async function loadOrgConfig(organizationId: string): Promise<DashboardConfig | null> {
  if (!supabase) {
    console.warn('[ConfigService] Supabase not configured, using localStorage fallback');
    return loadConfigFromCache(organizationId);
  }

  try {
    console.log(`[ConfigService] Loading config for org: ${organizationId}`);

    const { data, error } = await supabase
      .from('organization_settings')
      .select('config, config_version, updated_at')
      .eq('organization_id', organizationId)
      .single();

    if (error) {
      // PGRST116 = no rows returned (not an error, just no config yet)
      if (error.code === 'PGRST116') {
        console.log('[ConfigService] No config found for org, will use defaults');
        return null;
      }
      console.error('[ConfigService] Error loading config:', error);
      return loadConfigFromCache(organizationId);
    }

    if (data?.config) {
      const config = deserializeConfig(data.config as Record<string, unknown>);
      console.log(`[ConfigService] Loaded config v${data.config_version} from ${data.updated_at}`);

      // Update local cache
      saveConfigToCache(organizationId, config);

      return config;
    }

    return null;
  } catch (err) {
    console.error('[ConfigService] Exception loading config:', err);
    return loadConfigFromCache(organizationId);
  }
}

/**
 * Save organization settings to Supabase
 * Also updates localStorage cache for offline/fallback access
 */
export async function saveOrgConfig(
  organizationId: string,
  config: DashboardConfig,
  userId?: string
): Promise<boolean> {
  // Always update local cache first
  saveConfigToCache(organizationId, config);

  if (!supabase) {
    console.warn('[ConfigService] Supabase not configured, saved to localStorage only');
    return true;
  }

  try {
    console.log(`[ConfigService] Saving config for org: ${organizationId}`);

    const serializedConfig = serializeConfig(config);

    const { error } = await supabase
      .from('organization_settings')
      .upsert({
        organization_id: organizationId,
        config: serializedConfig,
        config_version: config.version || '1.0.0',
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'organization_id',
      });

    if (error) {
      console.error('[ConfigService] Error saving config:', error);
      return false;
    }

    console.log('[ConfigService] Config saved successfully');
    return true;
  } catch (err) {
    console.error('[ConfigService] Exception saving config:', err);
    return false;
  }
}

/**
 * Delete organization settings from Supabase
 * Used when resetting to defaults
 */
export async function deleteOrgConfig(organizationId: string): Promise<boolean> {
  // Clear local cache
  clearConfigCache(organizationId);

  if (!supabase) {
    return true;
  }

  try {
    const { error } = await supabase
      .from('organization_settings')
      .delete()
      .eq('organization_id', organizationId);

    if (error) {
      console.error('[ConfigService] Error deleting config:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[ConfigService] Exception deleting config:', err);
    return false;
  }
}

// ===== LOCAL STORAGE CACHE (Fallback/Offline Support) =====

function getCacheKey(organizationId: string): string {
  return `${CONFIG_CACHE_KEY}_${organizationId}`;
}

function loadConfigFromCache(organizationId: string): DashboardConfig | null {
  try {
    const cached = localStorage.getItem(getCacheKey(organizationId));
    if (!cached) return null;

    const data = JSON.parse(cached);
    return deserializeConfig(data);
  } catch {
    return null;
  }
}

function saveConfigToCache(organizationId: string, config: DashboardConfig): void {
  try {
    const serialized = serializeConfig(config);
    localStorage.setItem(getCacheKey(organizationId), JSON.stringify(serialized));
  } catch (err) {
    console.warn('[ConfigService] Failed to cache config locally:', err);
  }
}

function clearConfigCache(organizationId: string): void {
  try {
    localStorage.removeItem(getCacheKey(organizationId));
  } catch {
    // Ignore
  }
}

// ===== MIGRATION HELPER =====

/**
 * Migrate config from old localStorage format to Supabase
 * Call this once during app initialization if needed
 */
export async function migrateLocalStorageConfig(
  organizationId: string,
  userId?: string
): Promise<boolean> {
  const OLD_KEY = 'productivity_dashboard_config';

  try {
    const oldConfig = localStorage.getItem(OLD_KEY);
    if (!oldConfig) {
      console.log('[ConfigService] No legacy config to migrate');
      return true;
    }

    // Check if Supabase already has config
    const existingConfig = await loadOrgConfig(organizationId);
    if (existingConfig) {
      console.log('[ConfigService] Supabase config exists, skipping migration');
      // Clean up old localStorage
      localStorage.removeItem(OLD_KEY);
      return true;
    }

    // Parse and migrate
    const parsed = JSON.parse(oldConfig) as DashboardConfig;
    parsed.lastUpdated = parsed.lastUpdated ? new Date(parsed.lastUpdated) : new Date();

    // Save to Supabase
    const saved = await saveOrgConfig(organizationId, parsed, userId);

    if (saved) {
      console.log('[ConfigService] Successfully migrated config to Supabase');
      // Clean up old localStorage
      localStorage.removeItem(OLD_KEY);
    }

    return saved;
  } catch (err) {
    console.error('[ConfigService] Migration failed:', err);
    return false;
  }
}
