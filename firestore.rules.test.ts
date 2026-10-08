/**
 * Security Rules Verification Suite for La Ponte Dance (/sessions/{sessionId})
 * Verifies that all 12 Dirty Dozen payloads return PERMISSION_DENIED.
 */

export interface DirtyDozenTestCase {
  id: number;
  name: string;
  auth: { uid: string; email_verified: boolean } | null;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const dirtyDozenTestSuite: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated create attempt',
    auth: null,
    operation: 'create',
    path: '/sessions/valid_session_1',
    payload: {
      ownerId: 'user_1',
      topic: 'Clases',
      summary: 'Consulta infantil',
      status: 'active',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified email create attempt',
    auth: { uid: 'user_1', email_verified: false },
    operation: 'create',
    path: '/sessions/valid_session_1',
    payload: {
      ownerId: 'user_1',
      topic: 'Clases',
      summary: 'Consulta infantil',
      status: 'active',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Identity spoofing ownerId mismatch',
    auth: { uid: 'user_1', email_verified: true },
    operation: 'create',
    path: '/sessions/valid_session_1',
    payload: {
      ownerId: 'user_2',
      topic: 'Clases',
      summary: 'Consulta infantil',
      status: 'active',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow field injection on create',
    auth: { uid: 'user_1', email_verified: true },
    operation: 'create',
    path: '/sessions/valid_session_1',
    payload: {
      ownerId: 'user_1',
      topic: 'Clases',
      summary: 'Consulta infantil',
      status: 'active',
      isAdmin: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Path variable ID poisoning with invalid characters',
    auth: { uid: 'user_1', email_verified: true },
    operation: 'create',
    path: '/sessions/invalid$id!@#',
    payload: {
      ownerId: 'user_1',
      topic: 'Clases',
      summary: 'Consulta infantil',
      status: 'active',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Summary string length overflow (> 500 chars)',
    auth: { uid: 'user_1', email_verified: true },
    operation: 'create',
    path: '/sessions/valid_session_1',
    payload: {
      ownerId: 'user_1',
      topic: 'Clases',
      summary: 'A'.repeat(501),
      status: 'active',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Invalid status enum value',
    auth: { uid: 'user_1', email_verified: true },
    operation: 'create',
    path: '/sessions/valid_session_1',
    payload: {
      ownerId: 'user_1',
      topic: 'Clases',
      summary: 'Consulta infantil',
      status: 'deleted',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Client-forged createdAt timestamp',
    auth: { uid: 'user_1', email_verified: true },
    operation: 'create',
    path: '/sessions/valid_session_1',
    payload: {
      ownerId: 'user_1',
      topic: 'Clases',
      summary: 'Consulta infantil',
      status: 'active',
      createdAt: '2020-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Immortal field ownerId mutation on update',
    auth: { uid: 'user_1', email_verified: true },
    operation: 'update',
    path: '/sessions/valid_session_1',
    payload: {
      ownerId: 'user_2',
      topic: 'Clases',
      summary: 'Actualizado',
      status: 'active',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Update on archived terminal state document',
    auth: { uid: 'user_1', email_verified: true },
    operation: 'update',
    path: '/sessions/archived_session_1',
    payload: {
      ownerId: 'user_1',
      topic: 'Clases',
      summary: 'Reabriendo sesión archivada',
      status: 'active',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Cross-user read (get) on another user session',
    auth: { uid: 'user_2', email_verified: true },
    operation: 'get',
    path: '/sessions/user_1_session',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unfiltered list query across other users',
    auth: { uid: 'user_2', email_verified: true },
    operation: 'list',
    path: '/sessions',
    expectedResult: 'PERMISSION_DENIED',
  },
];
