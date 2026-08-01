import { doc, setDoc, getDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { db, auth, loginAnonymously, queuePendingAction } from '../firebase';
import { Establishment } from '../types';

export const DEFAULT_FALLBACK_SCHOOLS: Establishment[] = [
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

export function sanitizeFirestoreId(id: string): string {
  if (!id) return `sch_${Date.now()}`;
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

// In-memory set of deleted IDs for cross-module consistency within session
const inMemoryDeletedIds = new Set<string>(['demo_school_ekali', 'demo_school_ekali_settings']);

/**
 * Fetch deleted school IDs directly from Firestore (`system/deleted_schools`)
 * and merge them into local storage so all devices/browsers respect deletions.
 */
export async function fetchAndSyncDeletedSchoolIds(): Promise<Set<string>> {
  const merged = getDeletedSchoolIds();
  try {
    const docRef = doc(db, 'system', 'deleted_schools');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data?.ids)) {
        data.ids.forEach((id: string) => {
          if (id) {
            merged.add(id);
            merged.add(sanitizeFirestoreId(id));
            inMemoryDeletedIds.add(id);
            inMemoryDeletedIds.add(sanitizeFirestoreId(id));
          }
        });
        localStorage.setItem('pasma_deleted_schools', JSON.stringify(Array.from(merged)));
      }
    }
  } catch (err) {
    console.warn('[schoolSync] Could not fetch system/deleted_schools from Firestore:', err);
  }
  return merged;
}

export function getDeletedSchoolIds(): Set<string> {
  const set = new Set<string>(inMemoryDeletedIds);
  try {
    const deletedStr = localStorage.getItem('pasma_deleted_schools');
    if (deletedStr) {
      const parsed = JSON.parse(deletedStr);
      if (Array.isArray(parsed)) {
        parsed.forEach((id: string) => {
          if (id) {
            set.add(id);
            set.add(sanitizeFirestoreId(id));
          }
        });
      }
    }
  } catch (e) {
    console.warn('[schoolSync] Error reading pasma_deleted_schools:', e);
  }
  return set;
}

export function isSchoolDeleted(schoolId: string): boolean {
  if (!schoolId) return false;
  const set = getDeletedSchoolIds();
  return set.has(schoolId) || set.has(sanitizeFirestoreId(schoolId));
}

export async function deleteAndPurgeSchool(schoolId: string): Promise<boolean> {
  if (!schoolId) return false;
  const id = sanitizeFirestoreId(schoolId);

  // 1. Mark as deleted in local memory & localStorage
  try {
    inMemoryDeletedIds.add(schoolId);
    inMemoryDeletedIds.add(id);
    const set = getDeletedSchoolIds();
    set.add(schoolId);
    set.add(id);
    localStorage.setItem('pasma_deleted_schools', JSON.stringify(Array.from(set)));
  } catch (e) {
    console.warn('[schoolSync] Error updating pasma_deleted_schools:', e);
  }

  // 2. Remove from local establishment caches
  try {
    const keysToClean = ['pasma_local_establishments'];
    for (const key of keysToClean) {
      const localStr = localStorage.getItem(key);
      if (localStr) {
        const parsed = JSON.parse(localStr);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((e: any) => e && e.id !== schoolId && e.id !== id);
          localStorage.setItem(key, JSON.stringify(filtered));
        }
      }
      const sessionStr = sessionStorage.getItem(key);
      if (sessionStr) {
        const parsed = JSON.parse(sessionStr);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((e: any) => e && e.id !== schoolId && e.id !== id);
          sessionStorage.setItem(key, JSON.stringify(filtered));
        }
      }
    }
    localStorage.removeItem(`pasma_students_${schoolId}`);
    localStorage.removeItem(`pasma_students_${id}`);

    // Explicitly clear portal_selected_school_id and reset selection keys from localStorage & sessionStorage
    const currentSelected = localStorage.getItem('portal_selected_school_id') || sessionStorage.getItem('portal_selected_school_id');
    if (!currentSelected || currentSelected === schoolId || currentSelected === id) {
      localStorage.removeItem('portal_selected_school_id');
      sessionStorage.removeItem('portal_selected_school_id');
      localStorage.removeItem('portal_user_role');
      localStorage.removeItem('portal_parent_details');
      localStorage.removeItem('portal_teacher_details');
      localStorage.removeItem('portal_manager_details');
      localStorage.removeItem('portal_login_timestamp');
      sessionStorage.removeItem('portal_user_role');
    }
  } catch (e) {
    console.warn('[schoolSync] Error purging local school cache:', e);
  }

  // 3. Centralized deletion in Firestore (Register in system/deleted_schools document + set isDeleted flag + deleteDoc)
  try {
    // Record in global deleted schools registry
    const sysDocRef = doc(db, 'system', 'deleted_schools');
    await setDoc(sysDocRef, {
      ids: arrayUnion(schoolId, id),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // Mark as deleted on document itself as soft flag then delete document
    try {
      await setDoc(doc(db, 'establishments', id), { isDeleted: true, deletedAt: new Date().toISOString() }, { merge: true });
      await deleteDoc(doc(db, 'establishments', id));
      if (id !== schoolId) {
        await setDoc(doc(db, 'establishments', schoolId), { isDeleted: true, deletedAt: new Date().toISOString() }, { merge: true });
        await deleteDoc(doc(db, 'establishments', schoolId));
      }
    } catch (docErr) {
      console.warn('[schoolSync] Establishment document deletion note:', docErr);
    }

    try {
      await deleteDoc(doc(db, 'invoices', `${id}_settings`));
      await deleteDoc(doc(db, 'invoices', `${schoolId}_settings`));
    } catch (err) {
      console.warn("Could not delete settings invoice for school:", id, err);
    }
    return true;
  } catch (err) {
    console.warn('[schoolSync] Firestore deletion warning:', err);
    queuePendingAction('DELETE', 'establishments', id, `Supprimer établissement ${id}`, {});
    return false;
  }
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

    // Always fetch latest deleted school IDs from Firestore first
    const deletedSet = await fetchAndSyncDeletedSchoolIds();

    // 1. Gather local establishments from localStorage and sessionStorage
    const localEstsMap = new Map<string, any>();

    // Seed default fallback schools first (only if NOT deleted)
    DEFAULT_FALLBACK_SCHOOLS.forEach((est) => {
      const sanitizedId = sanitizeFirestoreId(est.id);
      if (!deletedSet.has(est.id) && !deletedSet.has(sanitizedId)) {
        localEstsMap.set(est.id, est);
      }
    });

    const keysToTry = ['pasma_local_establishments'];
    for (const key of keysToTry) {
      try {
        const localStr = localStorage.getItem(key);
        if (localStr) {
          const parsed = JSON.parse(localStr);
          if (Array.isArray(parsed)) {
            parsed.forEach((est: any) => {
              if (est && est.id) {
                const sanitizedId = sanitizeFirestoreId(est.id);
                if (!deletedSet.has(est.id) && !deletedSet.has(sanitizedId)) {
                  localEstsMap.set(est.id, est);
                }
              }
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
              if (est && est.id) {
                const sanitizedId = sanitizeFirestoreId(est.id);
                if (!deletedSet.has(est.id) && !deletedSet.has(sanitizedId)) {
                  localEstsMap.set(est.id, est);
                }
              }
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

      // Final check against deletedSet
      if (deletedSet.has(rawId) || deletedSet.has(id)) {
        continue;
      }

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
          const settingsSnap = await getDoc(settingsRef);
          if (!settingsSnap.exists()) {
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
          }
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

    // Update local cache with synced school items to maintain parity (and purge deleted)
    try {
      const updatedList = Array.from(localEstsMap.values())
        .filter(e => !deletedSet.has(e.id) && !deletedSet.has(sanitizeFirestoreId(e.id)))
        .map(e => ({
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
export async function saveAndSyncEstablishment(est: Establishment, isUserCreated = false): Promise<boolean> {
  if (!est || !est.id) return false;

  const id = sanitizeFirestoreId(est.id);

  // If school is marked as deleted, refuse to save unless user explicitly created it
  const deletedSet = getDeletedSchoolIds();
  if (deletedSet.has(est.id) || deletedSet.has(id)) {
    if (!isUserCreated) {
      console.log(`[schoolSync] Skipping save for deleted school: ${est.id}`);
      return false;
    } else {
      // User created a new school with same ID or un-deleted
      deletedSet.delete(est.id);
      deletedSet.delete(id);
      localStorage.setItem('pasma_deleted_schools', JSON.stringify(Array.from(deletedSet)));
    }
  }

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
    const filtered = existing.filter(e => !deletedSet.has(e.id) && !deletedSet.has(sanitizeFirestoreId(e.id)));
    localStorage.setItem('pasma_local_establishments', JSON.stringify(filtered));
    sessionStorage.setItem('pasma_local_establishments', JSON.stringify(filtered));
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

