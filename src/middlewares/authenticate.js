import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config/env.js';

export async function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ success: false, statusCode: 401, message: 'Authentication is required', data: null });
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (payload.type !== 'access') throw new Error('Invalid token type');
    const user = await User.findOne({ _id: payload.sub, isActive: true });
    if (!user) return res.status(401).json({ success: false, statusCode: 401, message: 'User session is invalid', data: null });
    req.user = user;
    next();
  } catch (_) { return res.status(401).json({ success: false, statusCode: 401, message: 'Invalid or expired access token', data: null }); }
}
