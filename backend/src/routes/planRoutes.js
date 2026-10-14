import { Router } from 'express';
import { getPlans, savePlan } from '../controllers/planController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', protect, getPlans);
router.post('/', protect, savePlan);

export default router;
