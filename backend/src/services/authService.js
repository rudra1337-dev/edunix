import User from '../models/User.js';
import { generateToken } from '../utils/generateToken.js';

export class AuthService {
  /**
   * Register a new student account
   */
  static async register({ name, email, password, preferredLanguage = 'en' }) {
    const trimmedName = name.trim();
    const normalizedEmail = email.toLowerCase().trim();

    // Check email uniqueness
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      const error = new Error('An account with this email address already exists.');
      error.statusCode = 409;
      throw error;
    }

    // Always enforce STUDENT role for public registration
    const user = await User.create({
      name: trimmedName,
      email: normalizedEmail,
      password,
      role: 'STUDENT',
      preferredLanguage: preferredLanguage || 'en',
    });

    const token = generateToken({
      id: user._id.toString(),
      role: user.role,
    });

    return {
      user: user.toSafeObject(),
      token,
    };
  }

  /**
   * Authenticate a user with email and password
   */
  static async login({ email, password }) {
    const normalizedEmail = email.toLowerCase().trim();

    // Find user and explicitly select password hash
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      throw error;
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      throw error;
    }

    const token = generateToken({
      id: user._id.toString(),
      role: user.role,
    });

    return {
      user: user.toSafeObject(),
      token,
    };
  }

  /**
   * Fetch current authenticated user profile
   */
  static async getProfile(userId) {
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      throw error;
    }
    return user.toSafeObject();
  }
}

export default AuthService;
