import { createContext, useState, useEffect, useCallback } from 'react';
import {
  getCurrentUser,
  loginUser,
  registerUser,
  logoutUser,
} from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  /**
   * Initialize or verify session against backend /api/auth/me
   */
  const refreshUser = useCallback(async () => {
    try {
      setAuthError(null);
      const res = await getCurrentUser();
      if (res?.success && res.user) {
        setUser(res.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      if (err.status === 401) {
        // Not authenticated or expired session
        setUser(null);
      } else {
        // Network or server error - don't immediately clear session if offline
        setAuthError(err.message || 'Unable to connect to authentication server');
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  /**
   * Log in user with email & password
   */
  const login = async (credentials) => {
    setAuthError(null);
    const res = await loginUser(credentials);
    if (res?.success && res.user) {
      setUser(res.user);
      return res.user;
    }
    throw new Error(res?.message || 'Login failed');
  };

  /**
   * Register user with name, email, password, etc.
   */
  const register = async (userData) => {
    setAuthError(null);
    const res = await registerUser(userData);
    if (res?.success && res.user) {
      setUser(res.user);
      return res.user;
    }
    throw new Error(res?.message || 'Registration failed');
  };

  /**
   * Log out user and clear session cookie
   */
  const logout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.warn('Logout API error:', err.message);
    } finally {
      setUser(null);
      setAuthError(null);
    }
  };

  const value = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    authError,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export { AuthContext };
export { useAuth } from '../hooks/useAuth';
export default AuthContext;
