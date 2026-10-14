import { Router } from 'express';
import { sendMessage, getEngineStatus } from '../controllers/chatController.js';

const router = Router();

router.post('/message', sendMessage);
router.get('/status', getEngineStatus);

export default router;
