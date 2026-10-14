import { Router } from 'express';
import chatRoutes from './chatRoutes.js';

const router = Router();

// Chat API routes
router.use('/chat', chatRoutes);

// General health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default router;
