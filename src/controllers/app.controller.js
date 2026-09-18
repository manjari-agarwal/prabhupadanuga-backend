import User from '../models/User.js';
import { env } from '../config/env.js';
import { success } from '../utils/apiResponse.js';

export async function appSummary(req, res) {
  const registrationCount = await User.countDocuments({ isActive: true, deletedAt: null });
  const serverNow = new Date();
  const startAt = env.COUNTDOWN_START_AT ? new Date(env.COUNTDOWN_START_AT) : null;
  const targetAt = env.COUNTDOWN_TARGET_AT ? new Date(env.COUNTDOWN_TARGET_AT) : null;
  return success(res, {
    registrationCount,
    countdown: {
      serverNow: serverNow.toISOString(),
      startAt: startAt?.toISOString() || null,
      targetAt: targetAt?.toISOString() || null,
      isActive: Boolean(startAt && targetAt && serverNow >= startAt && serverNow < targetAt),
      remainingSeconds: targetAt ? Math.max(0, Math.floor((targetAt - serverNow) / 1000)) : null
    }
  });
}
