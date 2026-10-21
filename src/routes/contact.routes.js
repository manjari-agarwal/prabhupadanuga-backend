import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/authenticate.js';
import { submitContactMessage } from '../controllers/contact.controller.js';

const router = Router();
router.use(authenticate);

const messageSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  subject: z.enum([
    'donation_enquiry',
    'volunteer',
    'media_press',
    'general_enquiry',
    'take_sankalpa'
  ]).optional().default('general_enquiry'),
  message: z.string().trim().min(10).max(3000)
}).strict();

router.post('/messages', (req, res, next) => {
  try {
    req.body = messageSchema.parse(req.body);
    return next();
  } catch (error) {
    return next(error);
  }
}, submitContactMessage);

export default router;
