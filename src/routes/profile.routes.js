import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { z } from 'zod';
import { authenticate } from '../middlewares/authenticate.js';
import { me, updateProfile, requestContactOtp, verifyContact, uploadPicture } from '../controllers/profile.controller.js';

const router = Router();
const allowedImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const validMimeType = ['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream'].includes(file.mimetype);
    if (!allowedImageExtensions.has(extension) || !validMimeType) return cb(Object.assign(new Error('Only JPG, JPEG, PNG, or WebP profile images are allowed'), { statusCode: 415 }));
    return cb(null, true);
  }
});
const validate = schema => (req, res, next) => { try { req.body = schema.parse(req.body); next(); } catch (error) { next(error); } };
router.use(authenticate);
router.param('channel', (req, res, next, channel) => {
  if (!['mobile', 'email'].includes(channel)) return res.status(400).json({ success: false, statusCode: 400, message: 'Channel must be mobile or email', data: null });
  next();
});
router.get('/me', me);
router.patch('/me', validate(z.object({ name: z.string().min(2).max(120).optional(), initiationName: z.string().max(120).optional(), city: z.string().max(100).optional(), state: z.string().max(100).optional(), country: z.string().max(100).optional(), address:z.string().max(100).optional(), associatedIskconTemple:z.string().max(100).optional() })), updateProfile);
router.post('/verify/:channel/request-otp', validate(z.object({})), requestContactOtp);
router.post('/verify/:channel/confirm', validate(z.object({ otp: z.string().regex(/^\d{4}$/, 'OTP must be exactly 4 digits') })), verifyContact);
router.post('/profile-picture', upload.single('file'), uploadPicture);
export default router;
