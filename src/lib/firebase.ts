import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.addons.current.action.compose',
  'https://www.googleapis.com/auth/gmail.addons.current.message.action',
  'https://www.googleapis.com/auth/gmail.addons.current.message.metadata',
  'https://www.googleapis.com/auth/gmail.addons.current.message.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.insert',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.metadata',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.acls',
  'https://www.googleapis.com/auth/calendar.acls.readonly',
  'https://www.googleapis.com/auth/calendar.app.created',
  'https://www.googleapis.com/auth/calendar.calendarlist',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  'https://www.googleapis.com/auth/calendar.calendars',
  'https://www.googleapis.com/auth/calendar.calendars.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.events.freebusy',
  'https://www.googleapis.com/auth/calendar.events.owned',
  'https://www.googleapis.com/auth/calendar.events.owned.readonly',
  'https://www.googleapis.com/auth/calendar.events.public.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.settings.readonly',
  'https://www.googleapis.com/auth/contacts',
  'https://www.googleapis.com/auth/contacts.other.readonly',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/directory.readonly',
  'https://www.googleapis.com/auth/user.addresses.read',
  'https://www.googleapis.com/auth/user.birthday.read',
  'https://www.googleapis.com/auth/user.emails.read',
  'https://www.googleapis.com/auth/user.gender.read',
  'https://www.googleapis.com/auth/user.organization.read',
  'https://www.googleapis.com/auth/user.phonenumbers.read',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.body.readonly',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/documents.readonly',
];

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

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
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// In-memory cache for Google Workspace OAuth access token and OIDC Session JWT
let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedSessionJwt: string | null = null;

export interface OidcClaimsClient {
  sub: string;
  uid: string;
  email: string;
  email_verified: boolean;
  name?: string | null;
  picture?: string | null;
  iss: string;
  aud: string;
  exp?: number;
}

let cachedOidcClaims: OidcClaimsClient | null = null;

export async function establishOidcJwtSession(
  user: User,
  accessToken?: string | null,
  googleIdToken?: string | null
): Promise<OidcClaimsClient | null> {
  try {
    const firebaseIdToken = await user.getIdToken();
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        idToken: firebaseIdToken,
        googleIdToken: googleIdToken || null,
        accessToken: accessToken || cachedAccessToken || null,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.sessionJwt) {
        cachedSessionJwt = data.sessionJwt;
      }
      if (data.oidcClaims) {
        cachedOidcClaims = data.oidcClaims;
        return data.oidcClaims;
      }
    }
  } catch (err) {
    console.error('OIDC/JWT session exchange failed:', err);
  }
  return null;
}

export async function getAuthBearerToken(user?: User | null): Promise<string> {
  if (cachedSessionJwt) return cachedSessionJwt;
  const targetUser = user || auth.currentUser;
  if (targetUser) {
    return await targetUser.getIdToken();
  }
  return '';
}

export function getCachedOidcClaims(): OidcClaimsClient | null {
  return cachedOidcClaims;
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null, oidcClaims?: OidcClaimsClient | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const claims = await establishOidcJwtSession(user, cachedAccessToken);
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken, claims);
      } else if (!isSigningIn) {
        if (onAuthSuccess) onAuthSuccess(user, null, claims);
      }
    } else {
      cachedAccessToken = null;
      cachedSessionJwt = null;
      cachedOidcClaims = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
  oidcClaims: OidcClaimsClient | null;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }
    cachedAccessToken = credential.accessToken;
    const oidcClaims = await establishOidcJwtSession(
      result.user,
      cachedAccessToken,
      credential.idToken
    );
    return { user: result.user, accessToken: cachedAccessToken, oidcClaims };
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch {
    // ignore network error on logout
  }
  await auth.signOut();
  cachedAccessToken = null;
  cachedSessionJwt = null;
  cachedOidcClaims = null;
};

// Firestore ChatSession (/sessions/{sessionId}) operations adhering strictly to firebase-blueprint.json
export interface ChatSessionRecord {
  id: string;
  ownerId: string;
  topic: string;
  summary: string;
  status: 'active' | 'archived';
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export function subscribeUserSessions(
  uid: string,
  onUpdate: (sessions: ChatSessionRecord[]) => void
) {
  const path = 'sessions';
  const q = query(collection(db, path), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: ChatSessionRecord[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ChatSessionRecord, 'id'>),
      }));
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createFirestoreSession(topic: string, summary: string) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Debes iniciar sesión con Google.');

  const safeId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`.replace(
    /[^a-zA-Z0-9_-]/g,
    ''
  );
  const path = `sessions/${safeId}`;
  const cleanTopic = topic.trim().slice(0, 120) || 'Consulta General';
  const cleanSummary = summary.trim().slice(0, 500) || 'Orientación guardada desde La Ponte Dance';

  try {
    await setDoc(doc(db, 'sessions', safeId), {
      ownerId: currentUser.uid.slice(0, 128),
      topic: cleanTopic,
      summary: cleanSummary,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function archiveFirestoreSession(sessionId: string) {
  const path = `sessions/${sessionId}`;
  try {
    await updateDoc(doc(db, 'sessions', sessionId), {
      status: 'archived',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteFirestoreSession(sessionId: string) {
  const path = `sessions/${sessionId}`;
  try {
    await deleteDoc(doc(db, 'sessions', sessionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Firestore TrialBooking (/trialBookings/{bookingId}) operations adhering strictly to firebase-blueprint.json
export interface TrialBookingFirestoreRecord {
  id: string;
  ownerId: string;
  studentName: string;
  studentPhone: string;
  ageGroup: string;
  activity: string;
  preferredDate: string;
  preferredTime: string;
  calendarEventId: string;
  status: 'confirmed' | 'cancelled';
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export function subscribeUserTrialBookings(
  uid: string,
  onUpdate: (bookings: TrialBookingFirestoreRecord[]) => void
) {
  const path = 'trialBookings';
  const q = query(collection(db, path), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: TrialBookingFirestoreRecord[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<TrialBookingFirestoreRecord, 'id'>),
      }));
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createFirestoreTrialBooking(params: {
  studentName: string;
  studentPhone: string;
  ageGroup: string;
  activity: string;
  preferredDate: string;
  preferredTime: string;
  calendarEventId: string;
}): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Debes iniciar sesión con Google.');

  const safeId = `trial_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`.replace(
    /[^a-zA-Z0-9_-]/g,
    ''
  );
  const path = `trialBookings/${safeId}`;

  try {
    await setDoc(doc(db, 'trialBookings', safeId), {
      ownerId: currentUser.uid.slice(0, 128),
      studentName: params.studentName.trim().slice(0, 120),
      studentPhone: params.studentPhone.trim().slice(0, 40),
      ageGroup: params.ageGroup.trim().slice(0, 120),
      activity: params.activity.trim().slice(0, 120),
      preferredDate: params.preferredDate.trim().slice(0, 20),
      preferredTime: params.preferredTime.trim().slice(0, 20),
      calendarEventId: (params.calendarEventId || 'local_sync').trim().slice(0, 200),
      status: 'confirmed',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return safeId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function cancelFirestoreTrialBooking(bookingId: string) {
  const path = `trialBookings/${bookingId}`;
  try {
    await updateDoc(doc(db, 'trialBookings', bookingId), {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
