import { Router } from 'express';
import authRoutes from './authRoutes.js';
import chatRoutes from './chatRoutes.js';

const router = Router();

// Auth routes
router.use('/auth', authRoutes);

// Chat API routes
router.use('/chat', chatRoutes);

// Health check endpoint at /api/health
router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default router;
