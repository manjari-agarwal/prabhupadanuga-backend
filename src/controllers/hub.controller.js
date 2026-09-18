import mongoose from 'mongoose';
import HubPost from '../models/HubPost.js';
import HubLike from '../models/HubLike.js';
import HubComment from '../models/HubComment.js';
import { env } from '../config/env.js';
import { success } from '../utils/apiResponse.js';

const publishedStatus = () => env.NODE_ENV === 'production' ? 'pending' : 'published';
const publicAuthor = { name: 1, initiationName: 1, profileImage: 1, registrationId: 1 };
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function assertObjectId(value, label = 'Record') {
  if (!mongoose.isValidObjectId(value)) throw Object.assign(new Error(`${label} not found`), { statusCode: 404 });
}

function serializePost(post, isLiked = false) {
  const value = post.toObject ? post.toObject() : post;
  const { _id, ...data } = value;
  return { id: _id, ...data, isLiked };
}

async function visiblePost(id, user) {
  assertObjectId(id, 'Post');
  const post = await HubPost.findOne({ _id: id, deletedAt: null }).populate('author', publicAuthor);
  if (!post) throw Object.assign(new Error('Post not found'), { statusCode: 404 });
  const own = user && String(post.author?._id || post.author) === String(user.id);
  if (post.status !== 'published' && !own && user?.role !== 'admin') throw Object.assign(new Error('Post not found'), { statusCode: 404 });
  return post;
}

export async function listPosts(req, res) {
  const { type, page, limit, search, sort } = req.validatedQuery;
  const filter = { type, status: 'published', deletedAt: null };
  if (search) filter.$or = [
    { title: { $regex: escapeRegex(search), $options: 'i' } },
    { body: { $regex: escapeRegex(search), $options: 'i' } }
  ];
  const order = sort === 'oldest' ? { createdAt: 1 } : sort === 'popular' ? { likeCount: -1, createdAt: -1 } : { createdAt: -1 };
  const [items, total] = await Promise.all([
    HubPost.find(filter).sort(order).skip((page - 1) * limit).limit(limit).populate('author', publicAuthor),
    HubPost.countDocuments(filter)
  ]);
  let liked = new Set();
  if (req.user && items.length) {
    liked = new Set((await HubLike.find({ user: req.user.id, post: { $in: items.map(item => item.id) } }).select('post')).map(item => String(item.post)));
  }
  return success(res, { items: items.map(item => serializePost(item, liked.has(String(item.id)))), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function myPosts(req, res) {
  const { type } = req.validatedQuery;
  const filter = { author: req.user.id, deletedAt: null, ...(type ? { type } : {}) };
  const items = await HubPost.find(filter).sort({ createdAt: -1 });
  return success(res, items.map(item => serializePost(item)));
}

export async function postDetail(req, res) {
  const post = await visiblePost(req.params.id, req.user);
  const isLiked = req.user ? Boolean(await HubLike.exists({ post: post.id, user: req.user.id })) : false;
  return success(res, serializePost(post, isLiked));
}

export async function createPost(req, res) {
  const { type, title, body, mediaUrl, thumbnailUrl, durationSeconds } = req.body;
  if (type === 'tribute' && !mediaUrl) throw Object.assign(new Error('Tribute video is required'), { statusCode: 422 });
  if (type === 'story' && !body) throw Object.assign(new Error('Story text is required'), { statusCode: 422 });
  const maximum = type === 'tribute' ? env.MAX_USER_VIDEOS : env.MAX_USER_STORIES;
  const count = await HubPost.countDocuments({ author: req.user.id, type, deletedAt: null });
  if (count >= maximum) throw Object.assign(new Error(`Maximum ${maximum} ${type === 'tribute' ? 'tributes' : 'stories'} allowed per user`), { statusCode: 409 });
  const status = publishedStatus();
  const post = await HubPost.create({ author: req.user.id, type, title, body, mediaUrl, thumbnailUrl, durationSeconds, status, publishedAt: status === 'published' ? new Date() : undefined });
  await post.populate('author', publicAuthor);
  return success(res, serializePost(post), status === 'pending' ? 'Submitted for approval' : 'Published successfully', 201);
}

export async function updatePost(req, res) {
  assertObjectId(req.params.id, 'Post');
  const post = await HubPost.findOne({ _id: req.params.id, author: req.user.id, deletedAt: null });
  if (!post) throw Object.assign(new Error('Post not found or not owned by you'), { statusCode: 404 });
  for (const field of ['title', 'body', 'thumbnailUrl']) if (req.body[field] !== undefined) post[field] = req.body[field];
  if (post.type === 'story' && req.body.mediaUrl !== undefined) post.mediaUrl = req.body.mediaUrl || undefined;
  if (env.NODE_ENV === 'production') { post.status = 'pending'; post.publishedAt = undefined; post.moderationNote = undefined; }
  await post.save();
  return success(res, serializePost(post), env.NODE_ENV === 'production' ? 'Updated and submitted for approval' : 'Updated successfully');
}

export async function deletePost(req, res) {
  assertObjectId(req.params.id, 'Post');
  const post = await HubPost.findOne({ _id: req.params.id, author: req.user.id, deletedAt: null });
  if (!post) throw Object.assign(new Error('Post not found or not owned by you'), { statusCode: 404 });
  post.deletedAt = new Date(); await post.save();
  return success(res, null, 'Post deleted successfully');
}

export async function toggleLike(req, res) {
  const post = await visiblePost(req.params.id, req.user);
  if (post.status !== 'published') throw Object.assign(new Error('Only published posts can be liked'), { statusCode: 409 });
  const existing = await HubLike.findOne({ post: post.id, user: req.user.id });
  if (existing) { await existing.deleteOne(); await HubPost.updateOne({ _id: post.id, likeCount: { $gt: 0 } }, { $inc: { likeCount: -1 } }); }
  else { await HubLike.create({ post: post.id, user: req.user.id }); await HubPost.updateOne({ _id: post.id }, { $inc: { likeCount: 1 } }); }
  const likeCount = await HubLike.countDocuments({ post: post.id });
  await HubPost.updateOne({ _id: post.id }, { likeCount });
  return success(res, { isLiked: !existing, likeCount });
}

export async function recordShare(req, res) {
  const post = await visiblePost(req.params.id, req.user);
  if (post.status !== 'published') throw Object.assign(new Error('Only published posts can be shared'), { statusCode: 409 });
  const updated = await HubPost.findByIdAndUpdate(post.id, { $inc: { shareCount: 1 } }, { new: true });
  return success(res, { shareCount: updated.shareCount }, 'Share recorded');
}

export async function listComments(req, res) {
  await visiblePost(req.params.id, req.user);
  const { page, limit } = req.validatedQuery;
  const filter = { post: req.params.id, deletedAt: null };
  const [items, total] = await Promise.all([
    HubComment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('author', publicAuthor),
    HubComment.countDocuments(filter)
  ]);
  return success(res, { items: items.map(item => ({ id: item.id, ...item.toObject(), _id: undefined })), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

export async function addComment(req, res) {
  const post = await visiblePost(req.params.id, req.user);
  if (post.status !== 'published') throw Object.assign(new Error('Only published posts can be commented on'), { statusCode: 409 });
  const comment = await HubComment.create({ post: post.id, author: req.user.id, text: req.body.text });
  await HubPost.updateOne({ _id: post.id }, { $inc: { commentCount: 1 } });
  await comment.populate('author', publicAuthor);
  return success(res, { id: comment.id, ...comment.toObject(), _id: undefined }, 'Comment added', 201);
}

export async function updateComment(req, res) {
  assertObjectId(req.params.commentId, 'Comment');
  const comment = await HubComment.findOne({ _id: req.params.commentId, post: req.params.id, author: req.user.id, deletedAt: null });
  if (!comment) throw Object.assign(new Error('Comment not found or not owned by you'), { statusCode: 404 });
  comment.text = req.body.text; await comment.save();
  return success(res, { id: comment.id, ...comment.toObject(), _id: undefined }, 'Comment updated');
}

export async function deleteComment(req, res) {
  assertObjectId(req.params.commentId, 'Comment');
  const comment = await HubComment.findOne({ _id: req.params.commentId, post: req.params.id, deletedAt: null });
  if (!comment || (String(comment.author) !== String(req.user.id) && req.user.role !== 'admin')) throw Object.assign(new Error('Comment not found or not allowed'), { statusCode: 404 });
  comment.deletedAt = new Date(); await comment.save();
  await HubPost.updateOne({ _id: req.params.id, commentCount: { $gt: 0 } }, { $inc: { commentCount: -1 } });
  return success(res, null, 'Comment deleted');
}

export async function moderatePost(req, res) {
  if (req.user.role !== 'admin') throw Object.assign(new Error('Admin access is required'), { statusCode: 403 });
  assertObjectId(req.params.id, 'Post');
  const post = await HubPost.findOne({ _id: req.params.id, deletedAt: null });
  if (!post) throw Object.assign(new Error('Post not found'), { statusCode: 404 });
  post.status = req.body.status; post.moderationNote = req.body.moderationNote;
  post.publishedAt = req.body.status === 'published' ? new Date() : undefined;
  await post.save();
  return success(res, serializePost(post), `Post ${req.body.status}`);
}

export async function moderationQueue(req, res) {
  if (req.user.role !== 'admin') throw Object.assign(new Error('Admin access is required'), { statusCode: 403 });
  const { page, limit, status, type } = req.validatedQuery;
  const filter = { deletedAt: null, status, ...(type ? { type } : {}) };
  const [items, total] = await Promise.all([
    HubPost.find(filter).sort({ createdAt: 1 }).skip((page - 1) * limit).limit(limit).populate('author', publicAuthor),
    HubPost.countDocuments(filter)
  ]);
  return success(res, { items: items.map(item => serializePost(item)), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}
