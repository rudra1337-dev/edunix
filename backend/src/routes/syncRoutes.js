import { Router } from 'express';
import { syncBatch, pullSync } from '../controllers/syncController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

// Both sync endpoints require authenticated user session
router.post('/batch', protect, syncBatch);
router.get('/pull', protect, pullSync);

export default router;
