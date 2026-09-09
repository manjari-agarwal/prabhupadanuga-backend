import bcrypt from 'bcryptjs';
import OtpVerification from '../models/OtpVerification.js';
import { env } from '../config/env.js';

const otpFor = () => String(Math.floor(100000 + Math.random() * 900000));

export async function requestOtp(destination, channel) {
  const code = otpFor();
  await OtpVerification.deleteMany({ destination, channel, verifiedAt: null });
  await OtpVerification.create({
    destination, channel, codeHash: await bcrypt.hash(code, 10),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000)
  });

  // Phase 1 integration point: send through the existing ISKCON Vesu OTP provider / SMTP.
  // Never expose code in production responses or logs.
  return env.NODE_ENV === 'production' ? {} : { developmentOtp: code };
}

export async function verifyOtp(destination, channel, code) {
  const otp = await OtpVerification.findOne({ destination, channel, verifiedAt: null }).sort({ createdAt: -1 });
  if (!otp || otp.expiresAt < new Date()) throw Object.assign(new Error('OTP is invalid or expired'), { statusCode: 400 });
  if (otp.attempts >= 5) throw Object.assign(new Error('OTP attempt limit exceeded'), { statusCode: 429 });
  otp.attempts += 1;
  if (!await bcrypt.compare(code, otp.codeHash)) { await otp.save(); throw Object.assign(new Error('Invalid OTP'), { statusCode: 400 }); }
  otp.verifiedAt = new Date();
  await otp.save();
}
