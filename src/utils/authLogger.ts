import { db, auth } from '../firebase';
import { collection, doc, setDoc } from 'firebase/firestore';

export interface AuthLogInput {
  errorMessage: string;
  errorCode?: string;
  action: string;
  component: string;
  schoolName?: string;
  schoolId?: string;
  details?: string;
}

export async function logAuthError(input: AuthLogInput) {
  const logId = `log_auth_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const timestamp = new Date().toISOString();
  const userId = auth.currentUser?.uid || 'anonymous';
  const userEmail = auth.currentUser?.email || '';
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Server/Unknown';

  const logData = {
    id: logId,
    timestamp,
    userId,
    userEmail,
    errorCode: input.errorCode || 'PERMISSION_DENIED',
    errorMessage: input.errorMessage,
    action: input.action,
    component: input.component,
    schoolName: input.schoolName || '',
    schoolId: input.schoolId || '',
    details: input.details || '',
    userAgent
  };

  // 1. Try to write to Firestore logs_auth collection
  try {
    const logRef = doc(collection(db, 'logs_auth'), logId);
    await setDoc(logRef, logData);
    console.log("[AuthLogger] Secure auth log written to Firestore successfully.");
  } catch (fsErr: any) {
    console.warn("[AuthLogger] Failed to write secure log to Firestore. Saving in local cache.", fsErr);
  }

  // 2. Always double-write to local device cache for resilient diagnostics
  try {
    const existingStr = localStorage.getItem('pasma_auth_logs');
    const existing = existingStr ? JSON.parse(existingStr) : [];
    existing.unshift(logData);
    // Keep max 100 logs in local storage to prevent size bloat
    if (existing.length > 100) {
      existing.pop();
    }
    localStorage.setItem('pasma_auth_logs', JSON.stringify(existing));
  } catch (storageErr) {
    console.warn("[AuthLogger] Failed to write secure log to localStorage.", storageErr);
  }
}
