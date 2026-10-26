import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import OtpVerification from '../models/OtpVerification.js';
import { env } from '../config/env.js';
import { deliverOtp } from './otpDelivery.service.js';

const fail = (message,statusCode) => Object.assign(new Error(message),{statusCode});
const normalize = (destination,channel) => channel === 'email' ? destination.trim().toLowerCase() : destination.trim();

function parseAllowlist(value) {
  return value
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
}

function usesFixedOtp(destination,channel) {
  const list = channel === 'mobile'
    ? env.MOCK_OTP_ALLOWED_MOBILES
    : env.MOCK_OTP_ALLOWED_EMAILS;

  return parseAllowlist(list).includes(destination.toLowerCase());
}

export async function requestOtp(destination,channel) {
  destination = normalize(destination,channel);
  const fixedOtp = usesFixedOtp(destination,channel);

  const latest = await OtpVerification.findOne({ destination,channel }).sort({createdAt:-1});
  if (latest && Date.now() - latest.createdAt.getTime() < env.OTP_RESEND_COOLDOWN_SECONDS * 1000) throw fail('Please wait before requesting another OTP',429);

  const windowStart = new Date(Date.now()-env.OTP_EXPIRES_SECONDS*1000);
  const hourly = await OtpVerification.countDocuments({destination,channel,createdAt:{$gte:windowStart}});
  if (hourly >= env.OTP_MAX_REQUESTS_PER_WINDOW) throw fail('Too many OTP requests. Please try later.',429);

  // Google/review test contacts use the fixed code and no SMS/email is sent.
  // Every other contact always gets a newly generated OTP through the live provider.
  const code = fixedOtp ? env.MOCK_OTP_CODE : String(randomInt(1000,10000));
  const record = await OtpVerification.create({
    destination,
    channel,
    codeHash:await bcrypt.hash(code,10),
    expiresAt:new Date(Date.now()+env.OTP_EXPIRES_SECONDS*1000)
  });

  try {
    if (!fixedOtp) await deliverOtp(destination,channel,code);
  } catch (e) {
    await OtpVerification.deleteOne({_id:record._id});
    throw e;
  }

  await OtpVerification.updateMany(
    {destination,channel,verifiedAt:null,invalidatedAt:null,_id:{$ne:record._id}},
    {$set:{invalidatedAt:new Date()}}
  );

  return {
    expiresInSeconds:env.OTP_EXPIRES_SECONDS,
    resendAfterSeconds:env.OTP_RESEND_COOLDOWN_SECONDS
  };
}

export async function verifyOtp(destination,channel,code) {
  destination = normalize(destination,channel);
  const record = await OtpVerification.findOne({ destination,channel,verifiedAt:null,invalidatedAt:null }).sort({createdAt:-1});
  if (!record || record.expiresAt.getTime() < Date.now()) throw fail('OTP is invalid or expired',400);
  if (record.attempts >= env.OTP_MAX_VERIFY_ATTEMPTS) throw fail('OTP attempt limit exceeded',429);
  record.attempts++;
  const matched = await bcrypt.compare(code,record.codeHash);
  if (!matched) { await record.save(); throw fail('Invalid OTP',400); }
  record.verifiedAt = new Date();
  await record.save();
  return true;
}
