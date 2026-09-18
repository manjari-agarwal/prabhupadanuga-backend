import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config/env.js';

export async function optionalAuthenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return next();
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (payload.type !== 'access') return next();
    req.user = await User.findOne({ _id: payload.sub, isActive: true });
    return next();
  } catch (_) {
    return next();
  }
}
