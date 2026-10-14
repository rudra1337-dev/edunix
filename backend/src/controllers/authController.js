import asyncHandler from '../utils/asyncHandler.js';
import AuthService from '../services/authService.js';
import { setAuthCookie, clearAuthCookie } from '../utils/generateToken.js';

/**
 * @desc    Register a new student
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, preferredLanguage } = req.body;

  const { user, token } = await AuthService.register({
    name,
    email,
    password,
    preferredLanguage,
  });

  // Set HttpOnly cookie
  setAuthCookie(res, token);

  res.status(201).json({
    success: true,
    message: 'Registration successful.',
    user,
    token,
  });
});

/**
 * @desc    Authenticate user & get session
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { user, token } = await AuthService.login({
    email,
    password,
  });

  // Set HttpOnly cookie
  setAuthCookie(res, token);

  res.status(200).json({
    success: true,
    message: 'Login successful.',
    user,
    token,
  });
});

/**
 * @desc    Log out current user & clear session cookie
 * @route   POST /api/auth/logout
 * @access  Public / Authenticated
 */
export const logout = asyncHandler(async (_req, res) => {
  clearAuthCookie(res);

  res.status(200).json({
    success: true,
    message: 'Logout successful.',
  });
});

/**
 * @desc    Get currently logged in user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = asyncHandler(async (req, res) => {
  // req.user is set by authMiddleware protect()
  res.status(200).json({
    success: true,
    user: req.user,
  });
});
