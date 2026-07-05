import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, signInAnonymously, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { initializeFirestore, setLogLevel, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Silence Firestore's built-in unreachable backend warnings in sandbox container
setLogLevel('silent');

const databaseId = (firebaseConfig as any).firestoreDatabaseId;
let dbInstance;

try {
  // Use experimentalForceLongPolling: true to ensure stable network connections
  // in sandboxed iframe / containerized environments to prevent transport-layer stream drop exceptions (ca9/b815 / ve: -1).
  dbInstance = databaseId 
    ? initializeFirestore(app, { experimentalForceLongPolling: true }, databaseId)
    : initializeFirestore(app, { experimentalForceLongPolling: true });
} catch (error: any) {
  // If already initialized (e.g. during dev HMR loads), safely retrieve the active instance
  dbInstance = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
}

export const db = dbInstance;

let simulatedOffline = typeof localStorage !== 'undefined' ? localStorage.getItem('pasma_offline_simulated') === 'true' : false;

export function isOffline() {
  return simulatedOffline || (typeof navigator !== 'undefined' && !navigator.onLine);
}

export async function goOffline() {
  simulatedOffline = true;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('pasma_offline_simulated', 'true');
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('pasma_connection_changed'));
    window.dispatchEvent(new Event('pasma_actions_updated'));
  }
  console.log("[Pasma-sys Local Sync] Simulated offline mode activated (using local persistence cache).");
}

export async function goOnline() {
  simulatedOffline = false;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('pasma_offline_simulated', 'false');
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('pasma_connection_changed'));
    window.dispatchEvent(new Event('pasma_actions_updated'));
  }
  console.log("[Pasma-sys Local Sync] Connection network active / sync restored.");
}

export function queuePendingAction(
  type: 'CREATE' | 'UPDATE' | 'DELETE',
  collection: string,
  targetId: string,
  title: string,
  data?: any
) {
  try {
    if (typeof localStorage === 'undefined') return;
    const saved = localStorage.getItem('pasma_pending_actions');
    const list = saved ? JSON.parse(saved) : [];
    
    let newList = [...list];
    if (type === 'DELETE') {
      newList = newList.filter((item: any) => !(item.collection === collection && item.targetId === targetId));
    } else if (type === 'UPDATE') {
      const existingIdx = newList.findIndex((item: any) => item.collection === collection && item.targetId === targetId && item.type !== 'DELETE');
      if (existingIdx !== -1) {
        newList[existingIdx].data = data;
        newList[existingIdx].title = title;
        newList[existingIdx].timestamp = new Date().toISOString();
        localStorage.setItem('pasma_pending_actions', JSON.stringify(newList));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('pasma_actions_updated'));
          window.dispatchEvent(new CustomEvent('pasma_save_offline', { detail: { title } }));
        }
        return;
      }
    }

    const newAction = {
      id: 'pa_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type,
      collection,
      targetId,
      title,
      timestamp: new Date().toISOString(),
      data
    };
    newList.push(newAction);
    localStorage.setItem('pasma_pending_actions', JSON.stringify(newList));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('pasma_actions_updated'));
      window.dispatchEvent(new CustomEvent('pasma_save_offline', { detail: { title } }));
    }
  } catch (err) {
    console.error("Failed to queue pending action:", err);
  }
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
googleProvider.addScope('https://www.googleapis.com/auth/firebase');
googleProvider.addScope('https://www.googleapis.com/auth/cloud-platform');

export let googleAccessToken: string | null = null;

export function setGoogleAccessToken(token: string | null) {
  googleAccessToken = token;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  if (errMsg.includes('unavailable') || errMsg.includes('Could not reach') || errMsg.includes('offline') || errMsg.includes('Failed to get document')) {
    console.warn(`[Pasma-sys Local Sync] Firestore is offline during ${operationType} on ${path || 'database'}. Data will sync when network is restored.`);
    return;
  }
  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      googleAccessToken = credential.accessToken;
    }
    return result.user;
  } catch (error) {
    console.error("Auth Error:", error);
    throw error;
  }
}

export async function loginAnonymously() {
  try {
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (error) {
    console.error("Anonymous Auth Error:", error);
    throw error;
  }
}

export async function signUpWithEmail(email: string, password: string) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    console.error("SignUp Email Error:", error);
    throw error;
  }
}

export async function loginWithEmail(email: string, password: string) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    console.error("Login Email Error:", error);
    throw error;
  }
}

export async function resetPassword(email: string) {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error("Password Reset Error:", error);
    throw error;
  }
}

export async function logout() {
  await signOut(auth);
  googleAccessToken = null;
}
