import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, disableNetwork, enableNetwork, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Silence Firestore's built-in unreachable backend warnings in sandbox container
setLogLevel('silent');

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, (firebaseConfig as any).firestoreDatabaseId); /* CRITICAL: The app will break without this line */

export async function goOffline() {
  try {
    await disableNetwork(db);
    console.log("Firestore network disabled successfully (going offline).");
  } catch (err) {
    console.warn("Failed to deactivate Firestore network:", err);
  }
}

export async function goOnline() {
  try {
    await enableNetwork(db);
    console.log("Firestore network enabled successfully (going online).");
  } catch (err) {
    console.warn("Failed to activate Firestore network:", err);
  }
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
