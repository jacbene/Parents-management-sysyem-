import { PendingAction } from '../types';

const PENDING_ACTIONS_KEY = 'pasma_pending_actions';

/**
 * Retrieves all currently queued pending offline actions from local storage.
 */
export function getPendingActions(): PendingAction[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const saved = localStorage.getItem(PENDING_ACTIONS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (err) {
    console.warn('[networkCacheStrategy] Error reading pending actions:', err);
    return [];
  }
}

/**
 * Applies pending offline actions on top of an authoritative network list.
 *
 * Core rule:
 * - Network data is the primary source of truth (Network-First).
 * - Stale items previously saved in local cache are NEVER resurrected.
 * - Only explicit un-synced user actions (created/modified/deleted while offline)
 *   are overlaid until they get synced to the remote database.
 */
export function applyPendingActionsToNetworkList<T extends { id: string }>(
  networkList: T[],
  collectionName: string
): T[] {
  const pendingActions = getPendingActions().filter(a => a.collection === collectionName);
  if (pendingActions.length === 0) {
    return networkList;
  }

  const deleteIds = new Set<string>();
  const updateMap = new Map<string, any>();
  const createItems: T[] = [];

  for (const action of pendingActions) {
    if (action.type === 'DELETE') {
      deleteIds.add(action.targetId);
      updateMap.delete(action.targetId);
    } else if (action.type === 'UPDATE') {
      if (!deleteIds.has(action.targetId) && action.data) {
        updateMap.set(action.targetId, action.data);
      }
    } else if (action.type === 'CREATE') {
      if (!deleteIds.has(action.targetId) && action.data) {
        createItems.push({ id: action.targetId, ...action.data } as T);
      }
    }
  }

  // 1. Remove deleted items & apply updates to authoritative network list
  const result: T[] = [];
  for (const item of networkList) {
    if (deleteIds.has(item.id)) continue;
    if (updateMap.has(item.id)) {
      result.push({ ...item, ...updateMap.get(item.id) });
    } else {
      result.push(item);
    }
  }

  // 2. Append newly created offline items that are not yet on the server
  for (const created of createItems) {
    if (!result.some(r => r.id === created.id)) {
      result.push(created);
    }
  }

  return result;
}

/**
 * Saves fresh network data to local cache as a safe offline refuge.
 */
export function saveToLocalRefuge<T>(cacheKey: string, data: T): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(cacheKey, JSON.stringify(data));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pasma_refuge_saved', { detail: { cacheKey } }));
    }
  } catch (err) {
    console.warn(`[networkCacheStrategy] Error saving to refuge cache (${cacheKey}):`, err);
  }
}

/**
 * Retrieves data from the local refuge cache.
 * Used during initial page startup (fast paint) and as fallback when network is unavailable.
 */
export function loadFromLocalRefuge<T>(cacheKey: string, fallback: T): T {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[networkCacheStrategy] Error loading from refuge cache (${cacheKey}):`, err);
    return fallback;
  }
}
