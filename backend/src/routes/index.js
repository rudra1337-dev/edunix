import { Router } from 'express';
import authRoutes from './authRoutes.js';

const router = Router();

// Auth routes
router.use('/auth', authRoutes);

// Health check endpoint at /api/health
router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default router;
