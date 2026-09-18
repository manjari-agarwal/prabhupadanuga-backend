import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middlewares/authenticate.js';
import { optionalAuthenticate } from '../middlewares/optionalAuthenticate.js';
import { listPosts, myPosts, postDetail, createPost, updatePost, deletePost, toggleLike, recordShare, listComments, addComment, updateComment, deleteComment, moderatePost, moderationQueue } from '../controllers/hub.controller.js';

const router = Router();
export const validate = (schema, location = 'body') => (req, res, next) => {
  try {
    const parsed = schema.parse(req[location]);
    if (location === 'query') req.validatedQuery = parsed;
    else req[location] = parsed;
    next();
  } catch (error) {
    next(error);
  }
};
const paging = z.object({ type: z.enum(['tribute', 'story']), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20), search: z.string().trim().max(100).optional(), sort: z.enum(['latest', 'oldest', 'popular']).default('latest') });
const commentPaging = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) });
const createSchema = z.object({ type: z.enum(['tribute', 'story']), title: z.string().trim().min(2).max(160), body: z.string().trim().max(5000).optional(), mediaUrl: z.string().url().optional(), thumbnailUrl: z.string().url().optional(), durationSeconds: z.coerce.number().positive().max(60).optional() }).superRefine((data, ctx) => { if (data.type === 'tribute' && (!data.mediaUrl || !data.durationSeconds)) ctx.addIssue({ code: 'custom', message: 'Tribute requires mediaUrl and durationSeconds (maximum 60)' }); if (data.type === 'story' && !data.body) ctx.addIssue({ code: 'custom', message: 'Story requires body text' }); });
const updateSchema = z.object({ title: z.string().trim().min(2).max(160).optional(), body: z.string().trim().min(1).max(5000).optional(), mediaUrl: z.union([z.string().url(), z.literal('')]).optional(), thumbnailUrl: z.union([z.string().url(), z.literal('')]).optional() }).refine(data => Object.keys(data).length > 0, 'At least one field is required');
const commentSchema = z.object({ text: z.string().trim().min(1).max(1000) });

router.get('/', optionalAuthenticate, validate(paging, 'query'), listPosts);
router.get('/mine', authenticate, validate(z.object({ type: z.enum(['tribute', 'story']).optional() }), 'query'), myPosts);
router.get('/moderation/queue', authenticate, validate(z.object({ status: z.enum(['pending', 'rejected']).default('pending'), type: z.enum(['tribute', 'story']).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) }), 'query'), moderationQueue);
router.get('/:id', optionalAuthenticate, postDetail);
router.post('/', authenticate, validate(createSchema), createPost);
router.patch('/:id', authenticate, validate(updateSchema), updatePost);
router.delete('/:id', authenticate, deletePost);
router.post('/:id/like', authenticate, toggleLike);
router.post('/:id/share', optionalAuthenticate, recordShare);
router.get('/:id/comments', optionalAuthenticate, validate(commentPaging, 'query'), listComments);
router.post('/:id/comments', authenticate, validate(commentSchema), addComment);
router.patch('/:id/comments/:commentId', authenticate, validate(commentSchema), updateComment);
router.delete('/:id/comments/:commentId', authenticate, deleteComment);
router.patch('/:id/moderation', authenticate, validate(z.object({ status: z.enum(['published', 'rejected']), moderationNote: z.string().trim().max(500).optional() })), moderatePost);

export default router;
