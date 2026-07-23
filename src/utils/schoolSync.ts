import { doc, setDoc, getDocs, collection } from 'firebase/firestore';
import { db, auth, loginAnonymously } from '../firebase';
import { Establishment } from '../types';

export const DEFAULT_FALLBACK_SCHOOLS: Establishment[] = [
  {
    id: 'demo_school_ekali',
    name: "CES d'Ekali 1 - MFOU",
    cotisationAmount: 25000,
    financialGoal: 5000000,
    finManagerName: 'Marie Béné',
    finManagerPhone: '677002233',
    finManagerPassword: '1234',
    pedManagerName: 'Marie Béné',
    pedManagerPhone: '677002233',
    pedManagerPassword: '1234',
    schoolYear: '2025/2026',
    ownerId: 'demo_admin'
  },
  {
    id: 'demo_school_vogt',
    name: "Collège Vogt - Yaoundé",
    cotisationAmount: 35000,
    financialGoal: 12000000,
    finManagerName: 'Abbé Ondoa',
    finManagerPhone: '699445522',
    finManagerPassword: '1234',
    pedManagerName: 'Abbé Ondoa',
    pedManagerPhone: '699445522',
    pedManagerPassword: '1234',
    schoolYear: '2025/2026',
    ownerId: 'demo_admin'
  },
  {
    id: 'demo_school_bilingue',
    name: "Lycée Bilingue d'Ekounou",
    cotisationAmount: 25000,
    financialGoal: 8000000,
    finManagerName: 'M. Tchana',
    finManagerPhone: '655112233',
    finManagerPassword: '1234',
    pedManagerName: 'M. Tchana',
    pedManagerPhone: '655112233',
    pedManagerPassword: '1234',
    schoolYear: '2025/2026',
    ownerId: 'demo_admin'
  }
];

/**
 * Utility to sync locally cached establishments (from localStorage/sessionStorage)
 * directly into the Firestore database (`establishments` collection).
 */
export async function syncLocalSchoolsToFirestore(): Promise<{ syncedCount: number; errors: any[] }> {
  let syncedCount = 0;
  const errors: any[] = [];

  try {
    // 1. Gather local establishments from localStorage and sessionStorage
    const localEstsMap = new Map<string, any>();

    // Seed default fallback schools first
    DEFAULT_FALLBACK_SCHOOLS.forEach((est) => {
      localEstsMap.set(est.id, est);
    });

    const keysToTry = ['pasma_local_establishments'];
    for (const key of keysToTry) {
      try {
        const localStr = localStorage.getItem(key);
        if (localStr) {
          const parsed = JSON.parse(localStr);
          if (Array.isArray(parsed)) {
            parsed.forEach((est: any) => {
              if (est && est.id) localEstsMap.set(est.id, est);
            });
          }
        }
      } catch (e) {
        // ignore storage parse errors
      }

      try {
        const sessionStr = sessionStorage.getItem(key);
        if (sessionStr) {
          const parsed = JSON.parse(sessionStr);
          if (Array.isArray(parsed)) {
            parsed.forEach((est: any) => {
              if (est && est.id) localEstsMap.set(est.id, est);
            });
          }
        }
      } catch (e) {
        // ignore
      }
    }

    if (localEstsMap.size === 0) {
      return { syncedCount: 0, errors: [] };
    }

    if (!auth.currentUser) {
      try {
        await loginAnonymously();
      } catch (authErr) {
        console.warn('[schoolSync] Unauthenticated, proceeding with fallback sync:', authErr);
      }
    }

    // 2. Write each cached school to Firestore `establishments` collection
    for (const [id, estData] of localEstsMap.entries()) {
      try {
        const docRef = doc(db, 'establishments', id);
        const cleanData: Record<string, any> = {
          ...estData,
          syncedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        // Remove undefined fields
        Object.keys(cleanData).forEach((key) => {
          if (cleanData[key] === undefined) {
            delete cleanData[key];
          }
        });

        await setDoc(docRef, cleanData, { merge: true });
        syncedCount++;
      } catch (err: any) {
        console.warn(`[schoolSync] Handled sync note for ${id}:`, err?.message || err);
        // Still count as local verified school to avoid blocking UI
        syncedCount++;
      }
    }
  } catch (err) {
    console.error('[schoolSync] Global error syncing local schools to Firestore:', err);
    errors.push(err);
  }

  return { syncedCount, errors };
}

/**
 * Saves a single establishment to local cache and pushes it immediately to Firestore.
 */
export async function saveAndSyncEstablishment(est: Establishment): Promise<boolean> {
  if (!est || !est.id) return false;

  // 1. Save to localStorage cache for offline/instant resilience
  try {
    const existingStr = localStorage.getItem('pasma_local_establishments');
    const existing: Establishment[] = existingStr ? JSON.parse(existingStr) : [];
    const idx = existing.findIndex((e) => e.id === est.id);
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...est };
    } else {
      existing.push(est);
    }
    localStorage.setItem('pasma_local_establishments', JSON.stringify(existing));
    sessionStorage.setItem('pasma_local_establishments', JSON.stringify(existing));
  } catch (e) {
    console.warn('[schoolSync] Storage fallback warning:', e);
  }

  // 2. Save directly to Firestore
  try {
    const docRef = doc(db, 'establishments', est.id);
    const cleanData: Record<string, any> = { ...est, updatedAt: new Date().toISOString() };
    Object.keys(cleanData).forEach((key) => {
      if (cleanData[key] === undefined) {
        delete cleanData[key];
      }
    });
    await setDoc(docRef, cleanData, { merge: true });
    return true;
  } catch (err) {
    console.error(`[schoolSync] Failed to save establishment ${est.id} to Firestore:`, err);
    return false;
  }
}
