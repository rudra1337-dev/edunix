import { Router } from 'express';
import {
  getPlans,
  getPlanById,
  savePlan,
  updatePlan,
  deletePlan,
} from '../controllers/planController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', protect, getPlans);
router.post('/', protect, savePlan);
router.get('/:planId', protect, getPlanById);
router.put('/:planId', protect, updatePlan);
router.delete('/:planId', protect, deletePlan);

export default router;
