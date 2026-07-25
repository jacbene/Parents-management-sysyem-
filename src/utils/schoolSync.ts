import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, auth, loginAnonymously, queuePendingAction } from '../firebase';
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

function sanitizeFirestoreId(id: string): string {
  if (!id) return `sch_${Date.now()}`;
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function cleanPayload(data: Record<string, any>): Record<string, any> {
  const clean: Record<string, any> = {};
  Object.keys(data).forEach((k) => {
    if (data[k] !== undefined && typeof data[k] !== 'function') {
      clean[k] = data[k];
    }
  });
  return clean;
}

/**
 * Utility to sync locally cached establishments (from localStorage/sessionStorage)
 * directly into the Firestore database (`establishments` collection) along with
 * their settings and initial student/invoice records.
 */
export async function syncLocalSchoolsToFirestore(): Promise<{ syncedCount: number; errors: any[] }> {
  let syncedCount = 0;
  const errors: any[] = [];

  try {
    // Ensure authentication state
    if (!auth.currentUser) {
      try {
        await loginAnonymously();
      } catch (authErr) {
        console.warn('[schoolSync] Unauthenticated, proceeding with fallback sync:', authErr);
      }
    }

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
        // ignore parse errors
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

    const currentUid = auth.currentUser?.uid || 'demo_admin';

    // 2. Write each cached school to Firestore `establishments` collection
    for (const [rawId, estData] of localEstsMap.entries()) {
      const id = sanitizeFirestoreId(rawId);
      try {
        const docRef = doc(db, 'establishments', id);
        const cleanEstData = cleanPayload({
          ...estData,
          id,
          ownerId: estData.ownerId || currentUid,
          syncedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        await setDoc(docRef, cleanEstData, { merge: true });
        syncedCount++;

        // 3. Ensure settings document `invoices/${id}_settings` exists
        try {
          const settingsRef = doc(db, 'invoices', `${id}_settings`);
          const budgetLines = [
            { id: 'bl_1', name: 'Soutien Pédagogique et Matériel Didactique', allocatedAmount: Math.round((estData.financialGoal || 5000000) * 0.3), description: 'Frais de craie, vacataires, etc.' },
            { id: 'bl_2', name: 'Aménagement & Réparations', allocatedAmount: Math.round((estData.financialGoal || 5000000) * 0.25), description: 'Tables-bancs, entretien' },
            { id: 'bl_3', name: 'Santé et Hygiène', allocatedAmount: Math.round((estData.financialGoal || 5000000) * 0.15), description: 'Secourisme, eau potable' },
            { id: 'bl_4', name: 'Activités Périscolaires FENASSCO', allocatedAmount: Math.round((estData.financialGoal || 5000000) * 0.15), description: 'Compétitions de sport' },
            { id: 'bl_5', name: 'Fonds d\'Administration Générale', allocatedAmount: Math.round((estData.financialGoal || 5000000) * 0.15), description: 'Frais divers de bureau' }
          ];

          await setDoc(settingsRef, cleanPayload({
            id: 'apee_settings',
            studentId: 'apee_settings',
            parentId: id,
            title: estData.name || 'Établissement',
            amount: Number(estData.cotisationAmount || 25000),
            dueDate: estData.schoolYear || '2025/2026',
            status: 'Paid',
            amountPaid: Number(estData.financialGoal || 5000000),
            budgetLinesList: JSON.stringify(budgetLines),
            finManagerName: estData.finManagerName || '',
            finManagerPhone: estData.finManagerPhone || '',
            finManagerPassword: estData.finManagerPassword || '1234',
            pedManagerName: estData.pedManagerName || '',
            pedManagerPhone: estData.pedManagerPhone || '',
            pedManagerPassword: estData.pedManagerPassword || '1234'
          }), { merge: true });
        } catch (settingsErr) {
          console.warn(`[schoolSync] Settings sync note for ${id}:`, settingsErr);
        }

        // 4. Sync cached students for this school if present in local storage
        try {
          const cachedStudentsStr = localStorage.getItem(`pasma_students_${rawId}`) || localStorage.getItem(`pasma_students_${id}`);
          if (cachedStudentsStr) {
            const cachedStudents = JSON.parse(cachedStudentsStr);
            if (Array.isArray(cachedStudents)) {
              for (const stu of cachedStudents) {
                if (stu && stu.id) {
                  const stuId = sanitizeFirestoreId(stu.id);
                  await setDoc(doc(db, 'students', stuId), cleanPayload({
                    ...stu,
                    id: stuId,
                    parentId: id
                  }), { merge: true });
                }
              }
            }
          }
        } catch (stuErr) {
          console.warn(`[schoolSync] Students sync note for ${id}:`, stuErr);
        }

      } catch (err: any) {
        console.warn(`[schoolSync] Sync notice for school ${id}:`, err?.message || err);
        errors.push({ schoolId: id, error: err?.message || err });
      }
    }

    // Update local cache with synced school items to maintain parity
    try {
      const updatedList = Array.from(localEstsMap.values()).map(e => ({
        ...e,
        id: sanitizeFirestoreId(e.id)
      }));
      localStorage.setItem('pasma_local_establishments', JSON.stringify(updatedList));
      sessionStorage.setItem('pasma_local_establishments', JSON.stringify(updatedList));
    } catch (cacheErr) {
      console.warn('[schoolSync] Local cache sync warning:', cacheErr);
    }

  } catch (err) {
    console.warn('[schoolSync] Sync fallback for local schools:', err);
    errors.push(err);
  }

  return { syncedCount, errors };
}

/**
 * Saves a single establishment to local cache and pushes it immediately to Firestore.
 */
export async function saveAndSyncEstablishment(est: Establishment): Promise<boolean> {
  if (!est || !est.id) return false;

  const id = sanitizeFirestoreId(est.id);
  const updatedEst = { ...est, id, updatedAt: new Date().toISOString() };

  // 1. Save to localStorage cache for offline/instant resilience
  try {
    const existingStr = localStorage.getItem('pasma_local_establishments');
    const existing: Establishment[] = existingStr ? JSON.parse(existingStr) : [];
    const idx = existing.findIndex((e) => e.id === id || e.id === est.id);
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...updatedEst };
    } else {
      existing.push(updatedEst);
    }
    localStorage.setItem('pasma_local_establishments', JSON.stringify(existing));
    sessionStorage.setItem('pasma_local_establishments', JSON.stringify(existing));
  } catch (e) {
    console.warn('[schoolSync] Storage fallback warning:', e);
  }

  // 2. Save directly to Firestore
  try {
    const docRef = doc(db, 'establishments', id);
    const cleanData = cleanPayload(updatedEst);
    await setDoc(docRef, cleanData, { merge: true });
    return true;
  } catch (err) {
    console.warn(`[schoolSync] Firestore save note for establishment ${id}:`, err);
    queuePendingAction('UPDATE', 'establishments', id, `Enregistrer établissement ${updatedEst.name || id}`, cleanPayload(updatedEst));
    return false;
  }
}

