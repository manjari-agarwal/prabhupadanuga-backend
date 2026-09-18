import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import os from 'node:os';
import { unlink } from 'node:fs/promises';
import { authenticate } from '../middlewares/authenticate.js';
import { uploadMedia } from '../controllers/media.controller.js';

const router = Router();
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const videoExtensions = new Set(['.mp4', '.mov']);
const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (req, file, cb) => cb(null, `prabhupadanuga-${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const type = req.params.type;
    const extension = path.extname(file.originalname).toLowerCase();
    const imageValid = type === 'story-image' && imageExtensions.has(extension) && ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    const videoValid = type === 'tribute-video' && videoExtensions.has(extension) && ['video/mp4', 'video/quicktime'].includes(file.mimetype);
    if (!imageValid && !videoValid) return cb(Object.assign(new Error(type === 'tribute-video' ? 'Only MP4 or MOV video is allowed' : 'Only JPG, JPEG, PNG, or WebP image is allowed'), { statusCode: 415 }));
    return cb(null, true);
  }
});

router.use(authenticate);
router.post('/:type', (req, res, next) => {
  if (!['tribute-video', 'story-image'].includes(req.params.type)) return res.status(400).json({ success: false, statusCode: 400, message: 'Media type must be tribute-video or story-image', data: null });
  return next();
}, upload.single('file'), async (req, res, next) => {
  if (req.params.type === 'story-image' && req.file?.size > 5 * 1024 * 1024) {
    await unlink(req.file.path).catch(() => {});
    return next(Object.assign(new Error('Story image must be 5 MB or smaller'), { statusCode: 413 }));
  }
  return next();
}, uploadMedia);

export default router;
