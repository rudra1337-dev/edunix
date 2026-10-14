import { apiGet, apiPost } from './api.js';

export const loginUser    = (credentials) => apiPost('/auth/login', credentials);
export const registerUser = (userData)    => apiPost('/auth/register', userData);
export const logoutUser   = ()            => apiPost('/auth/logout');
export const getCurrentUser = ()          => apiGet('/auth/me');
