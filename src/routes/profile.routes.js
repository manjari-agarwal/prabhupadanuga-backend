import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { z } from 'zod';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { authenticate } from '../middlewares/authenticate.js';
import { me, updateProfile, requestContactOtp, verifyContact, uploadPicture, deleteAccount, downloadCertificate } from '../controllers/profile.controller.js';

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
const date = z.iso.date().nullable().optional();
const text = max => z.string().trim().max(max).optional();
const child = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(2).max(120), gender: z.enum(['male','female','other']) }).strict();
const profileUpdate = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  initiationName: text(120), dateOfBirth: date, educationDegree: text(150),
  address: text(500), pinCode: text(20), city: text(100), state: text(100), country: text(100),
  updatesConsent: z.boolean().optional(),
  marriageDate: date, spouseName: text(120), children: z.array(child).max(20).optional(),
  spiritualMaster: text(150), associatedIskconTemple: text(100),
  timezone: z.string().max(80).refine(v => { try { new Intl.DateTimeFormat('en-US',{timeZone:v}); return true; } catch { return false; } }, 'Invalid IANA timezone').optional()
}).strict();
router.patch('/me', validate(profileUpdate), updateProfile);
const contactOtpRequest = z.object({ destination: z.string().trim().min(3).optional() }).strict();
router.post('/verify/:channel/request-otp', validate(contactOtpRequest), requestContactOtp);
router.post('/verify/:channel/confirm', validate(z.object({ otp: z.string().regex(/^\d{4}$/, 'OTP must be exactly 4 digits'), destination: z.string().trim().min(3).optional() }).strict()), verifyContact);
router.post('/profile-picture', upload.single('file'), uploadPicture);
router.get('/certificate', downloadCertificate);
router.delete('/me', deleteAccount);
export default router;
