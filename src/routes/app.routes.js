import { Router } from 'express';
import { appSummary } from '../controllers/app.controller.js';

const router = Router();
router.get('/summary', appSummary);
export default router;
