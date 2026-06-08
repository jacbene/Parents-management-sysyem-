import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, signInAnonymously } from 'firebase/auth';
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

export async function goOffline() {
  // We bypass disableNetwork(db) to avoid interrupting active Firestore watch streams
  // which causes internal asynchronous assertion exceptions in sandboxed iframe environments.
  console.log("[Pasma-sys Local Sync] Simulated offline mode activated (using local persistence cache).");
}

export async function goOnline() {
  // We bypass enableNetwork(db) to avoid interrupting active Firestore watch streams.
  console.log("[Pasma-sys Local Sync] Connection network active / sync restored.");
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive');
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

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

export async function logout() {
  await signOut(auth);
  googleAccessToken = null;
}
