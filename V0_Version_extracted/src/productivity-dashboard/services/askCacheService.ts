// Ask PlatoVue Cache Service
// Persists query responses to localStorage for session continuity

import { IntentResponse } from '../types/askTypes';

const CACHE_KEY = 'platovue_ask_cache';
const CACHE_VERSION = 1;

export interface AskCacheEntry {
  query: string;
  response: IntentResponse;
  generatedAt: string; // ISO timestamp
  usedFallback: boolean;
  aiEnabled: boolean;
}

interface AskCacheData {
  version: number;
  lastEntry: AskCacheEntry | null;
  history: AskCacheEntry[];
}

/**
 * Save the current Ask response to cache
 */
export function saveAskCache(entry: AskCacheEntry): void {
  try {
    const existing = loadAskCacheData();

    // Add to history (keep last 20 entries)
    const history = [entry, ...existing.history].slice(0, 20);

    const cacheData: AskCacheData = {
      version: CACHE_VERSION,
      lastEntry: entry,
      history,
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (err) {
    console.warn('Failed to save Ask cache:', err);
  }
}

/**
 * Load the cached Ask response
 */
export function loadAskCache(): AskCacheEntry | null {
  try {
    const data = loadAskCacheData();
    return data.lastEntry;
  } catch (err) {
    console.warn('Failed to load Ask cache:', err);
    return null;
  }
}

/**
 * Load conversation history from cache
 */
export function loadAskHistory(): AskCacheEntry[] {
  try {
    const data = loadAskCacheData();
    return data.history;
  } catch (err) {
    console.warn('Failed to load Ask history:', err);
    return [];
  }
}

/**
 * Clear the Ask cache
 */
export function clearAskCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (err) {
    console.warn('Failed to clear Ask cache:', err);
  }
}

/**
 * Get relative time string (e.g., "2 minutes ago", "1 hour ago")
 */
export function getRelativeTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  const pluralize = (n: number, unit: string): string => `${n} ${unit}${n === 1 ? '' : 's'} ago`;

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return pluralize(diffMins, 'minute');
  if (diffHours < 24) return pluralize(diffHours, 'hour');
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Internal helper to load raw cache data
function loadAskCacheData(): AskCacheData {
  const raw = localStorage.getItem(CACHE_KEY);
  if (!raw) {
    return { version: CACHE_VERSION, lastEntry: null, history: [] };
  }

  const data = JSON.parse(raw);

  // Handle version migration if needed
  if (data.version !== CACHE_VERSION) {
    return { version: CACHE_VERSION, lastEntry: null, history: [] };
  }

  return data;
}
