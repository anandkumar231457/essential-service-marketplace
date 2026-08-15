import jwt from 'jsonwebtoken';
const { sign, verify } = jwt;
import { env } from '../config/env.js';

export interface JwtPayload {
  userId: string;
  role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN';
  iat?: number;
  exp?: number;
}

/** Sign an access token. */
export function signAccessToken(userId: string, role: JwtPayload['role']) {
  return sign({ userId, role }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/** Sign a refresh token. */
export function signRefreshToken(userId: string) {
  return sign({ userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/** Verify an access token. Returns payload or throws. */
export function verifyAccessToken(token: string) {
  return verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
}