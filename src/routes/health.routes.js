import { Router } from 'express';
import mongoose from 'mongoose';
import { success } from '../utils/apiResponse.js';

const router = Router();

router.get('/', (req, res) => success(res, {
  service: 'prabhupadanuga-backend',
  environment: process.env.NODE_ENV,
  database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  timestamp: new Date().toISOString()
}, 'Service is healthy'));

export default router;
