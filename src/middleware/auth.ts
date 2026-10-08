import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import crypto from 'crypto';
import firebaseConfig from '../../firebase-applet-config.json';

export interface OidcSessionClaims {
  uid: string;
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string | null;
  picture?: string | null;
  iss: string;
  aud: string;
  auth_time?: number;
  iat: number;
  exp: number;
  authMethod: 'firebase_id_token' | 'google_oauth_oidc' | 'session_jwt';
}

export interface AuthRequest extends Request {
  user?: DecodedIdToken | OidcSessionClaims;
}

const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.SESSION_SECRET ||
  `laponte-oidc-jwt-${firebaseConfig.projectId}-${firebaseConfig.appId}`;

export const SESSION_COOKIE_NAME = 'laponte_oidc_token';

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  let str = input.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return Buffer.from(str, 'base64').toString('utf8');
}

/**
 * Signs an OIDC-compliant application session JWT (HS256) after verifying the user's Google/Firebase OIDC identity.
 */
export function signAppSessionJwt(claims: {
  uid: string;
  email: string;
  email_verified?: boolean;
  name?: string | null;
  picture?: string | null;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: OidcSessionClaims = {
    uid: claims.uid,
    sub: claims.uid,
    email: claims.email,
    email_verified: claims.email_verified ?? true,
    name: claims.name || null,
    picture: claims.picture || null,
    iss: `https://securetoken.google.com/${firebaseConfig.projectId}`,
    aud: firebaseConfig.projectId,
    auth_time: now,
    iat: now,
    exp: now + 60 * 60 * 24 * 7, // 7 days
    authMethod: 'session_jwt',
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(signingInput)
    .digest();

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

/**
 * Verifies an application session JWT (HS256)
 */
export function verifyAppSessionJwt(token: string): OidcSessionClaims | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, encodedSig] = parts;
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSig = base64UrlEncode(
      crypto.createHmac('sha256', JWT_SECRET).update(signingInput).digest()
    );

    if (expectedSig !== encodedSig) return null;

    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as OidcSessionClaims;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx > -1) {
      const k = pair.slice(0, idx).trim();
      const v = decodeURIComponent(pair.slice(idx + 1).trim());
      out[k] = v;
    }
  }
  return out;
}

/**
 * Verifies a Google OIDC ID Token or OAuth2 Access Token against Google's OIDC endpoints as fallback.
 */
async function verifyGoogleOidcToken(token: string): Promise<OidcSessionClaims | null> {
  try {
    // 1. Try verifying as a Google/Firebase OIDC ID Token (JWT) via Google's tokeninfo endpoint
    if (token.split('.').length === 3) {
      const res = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`
      );
      if (res.ok) {
        const info = await res.json();
        const now = Math.floor(Date.now() / 1000);
        return {
          uid: info.user_id || info.sub,
          sub: info.sub,
          email: info.email || 'user@lapontedance.es',
          email_verified: info.email_verified === 'true' || info.email_verified === true,
          name: info.name || null,
          picture: info.picture || null,
          iss: info.iss || 'https://accounts.google.com',
          aud: info.aud || firebaseConfig.projectId,
          iat: Number(info.iat) || now,
          exp: Number(info.exp) || now + 3600,
          authMethod: 'google_oauth_oidc',
        };
      }
    }

    // 2. Try verifying as a Google OAuth 2.0 Access Token via OpenID Connect userinfo endpoint
    const userInfoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (userInfoRes.ok) {
      const profile = await userInfoRes.json();
      const now = Math.floor(Date.now() / 1000);
      return {
        uid: profile.sub,
        sub: profile.sub,
        email: profile.email || 'user@lapontedance.es',
        email_verified: Boolean(profile.email_verified),
        name: profile.name || null,
        picture: profile.picture || null,
        iss: 'https://accounts.google.com',
        aud: firebaseConfig.projectId,
        iat: now,
        exp: now + 3600,
        authMethod: 'google_oauth_oidc',
      };
    }
  } catch (err) {
    console.error('Google OIDC fallback verification error:', err);
  }
  return null;
}

export async function resolveAuthenticatedUser(
  req: Request
): Promise<DecodedIdToken | OidcSessionClaims | null> {
  const authHeader = req.headers.authorization;
  const cookies = parseCookies(req.headers.cookie);
  const bearerToken =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.split('Bearer ')[1].trim()
      : null;

  const candidateToken = bearerToken || cookies[SESSION_COOKIE_NAME] || null;
  if (!candidateToken) return null;

  // 1. Check if it's our signed application OIDC session JWT first
  const appJwt = verifyAppSessionJwt(candidateToken);
  if (appJwt) {
    return appJwt;
  }

  // 2. Verify as Firebase Admin OIDC ID Token (RS256)
  try {
    const decodedFirebase = await adminAuth.verifyIdToken(candidateToken);
    return decodedFirebase;
  } catch {
    // Fall through to Google OIDC tokeninfo / userinfo verification
  }

  // 3. Verify via Google OIDC tokeninfo / userinfo endpoint
  const googleClaims = await verifyGoogleOidcToken(candidateToken);
  if (googleClaims) {
    return googleClaims;
  }

  return null;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const verifiedUser = await resolveAuthenticatedUser(req);
    if (!verifiedUser) {
      return res
        .status(401)
        .json({ error: 'No autorizado: Token OIDC/JWT ausente o inválido.' });
    }
    req.user = verifiedUser;
    next();
  } catch (error) {
    console.error('Error verifying OIDC/JWT token:', error);
    return res
      .status(401)
      .json({ error: 'No autorizado: Error al verificar la sesión OIDC/JWT.' });
  }
};
