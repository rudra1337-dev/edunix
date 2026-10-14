import { Router } from 'express';
import authRoutes from './authRoutes.js';
import chatRoutes from './chatRoutes.js';
import syncRoutes from './syncRoutes.js';
import planRoutes from './planRoutes.js';

const router = Router();

// Auth routes
router.use('/auth', authRoutes);

// Chat API routes
router.use('/chat', chatRoutes);

// Synchronization routes
router.use('/sync', syncRoutes);

// Learning plan routes
router.use('/plans', planRoutes);

// Health check endpoint at /api/health
router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default router;
