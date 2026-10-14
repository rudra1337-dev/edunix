import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  registerValidationRules,
  loginValidationRules,
} from '../validators/authValidator.js';

const router = Router();

router.post('/register', registerValidationRules, validate, register);
router.post('/login', loginValidationRules, validate, login);
router.post('/logout', logout);
router.get('/me', protect, getMe);

export default router;
