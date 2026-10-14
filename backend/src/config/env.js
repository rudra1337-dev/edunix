export const PORT           = process.env.PORT           || 5000;
export const MONGO_URI      = process.env.MONGO_URI;
export const JWT_SECRET     = process.env.JWT_SECRET;
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
export const NODE_ENV       = process.env.NODE_ENV       || 'development';
export const CLIENT_URL     = process.env.CLIENT_URL     || 'http://localhost:5173';

// AI Services Configuration
export const OLLAMA_BASE_URL    = process.env.OLLAMA_BASE_URL    || 'http://localhost:11434';
export const OLLAMA_MODEL       = process.env.OLLAMA_MODEL       || 'llama3';
export const ONLINE_AI_URL      = process.env.ONLINE_AI_URL      || '';
export const ONLINE_AI_API_KEY  = process.env.ONLINE_AI_API_KEY  || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '';
export const ONLINE_AI_PROVIDER = process.env.ONLINE_AI_PROVIDER || 'gemini';
export const ONLINE_AI_MODEL    = process.env.ONLINE_AI_MODEL    || 'gemini-1.5-flash';

