// Central environment-variable access — never hard-code secrets
export const PORT           = process.env.PORT           || 5000;
export const MONGO_URI      = process.env.MONGO_URI;
export const JWT_SECRET     = process.env.JWT_SECRET;
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
export const NODE_ENV       = process.env.NODE_ENV       || 'development';
export const CLIENT_URL     = process.env.CLIENT_URL     || 'http://localhost:5173';
