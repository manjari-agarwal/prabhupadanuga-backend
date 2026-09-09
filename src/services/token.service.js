import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function createAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, type: 'access' }, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN });
}

export function createRefreshToken(user) {
  return jwt.sign({ sub: user.id, type: 'refresh' }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN });
}

export function createOtpProof(destination, channel) {
  return jwt.sign({ destination, channel, type: 'otp-proof' }, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
}

export function verifyOtpProof(token, expectedDestination, expectedChannel) {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  return payload.type === 'otp-proof' && payload.destination === expectedDestination && payload.channel === expectedChannel;
}
