import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN, NODE_ENV } from '../config/env.js';

export const COOKIE_NAME = 'token';

export const getCookieOptions = () => ({
  httpOnly: true,
  secure: NODE_ENV === 'production',
  sameSite: NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  path: '/',
});

export const generateToken = (payload, expiresIn = JWT_EXPIRES_IN) => {
  const tokenPayload = typeof payload === 'string' ? { id: payload } : payload;
  return jwt.sign(tokenPayload, JWT_SECRET, { expiresIn });
};

export const setAuthCookie = (res, token) => {
  res.cookie(COOKIE_NAME, token, getCookieOptions());
};

export const clearAuthCookie = (res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });
};

export default generateToken;
