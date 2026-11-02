import { randomUUID } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config.js';

const JWT_ISSUER = 'question-bank';
const JWT_AUDIENCE = 'question-bank-web';

export type UserRole = 'student' | 'teacher' | 'admin';

export interface AccessTokenPayload extends jwt.JwtPayload {
  sub: string;
  username: string;
  role: UserRole;
  tokenVersion: number;
  purpose: 'access';
}

interface AccessTokenUser {
  id: string;
  username: string;
  role: string;
  tokenVersion: number;
}

export function signAccessToken(user: AccessTokenUser): string {
  const options: SignOptions = {
    algorithm: 'HS256',
    expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    jwtid: randomUUID(),
    subject: user.id,
  };

  return jwt.sign(
    {
      username: user.username,
      role: user.role,
      tokenVersion: user.tokenVersion,
      purpose: 'access',
    },
    config.jwtSecret,
    options,
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, config.jwtSecret, {
    algorithms: ['HS256'],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });

  if (
    typeof decoded === 'string'
    || decoded.purpose !== 'access'
    || typeof decoded.sub !== 'string'
    || typeof decoded.tokenVersion !== 'number'
  ) {
    throw new Error('Invalid access token payload.');
  }

  return decoded as AccessTokenPayload;
}
