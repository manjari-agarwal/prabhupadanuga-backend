import bcrypt from 'bcryptjs';
import OtpVerification from '../models/OtpVerification.js';
import { env } from '../config/env.js';

const otpFor = () => String(Math.floor(1000 + Math.random() * 9000));

function configuredDestinations(value) {
  return new Set(value.split(',').map(item => item.trim().toLowerCase()).filter(Boolean));
}

function isProductionMockDestination(destination, channel) {
  const list = channel === 'mobile'
    ? env.PRODUCTION_MOCK_OTP_ALLOWED_MOBILES
    : env.PRODUCTION_MOCK_OTP_ALLOWED_EMAILS;
  return configuredDestinations(list).has(destination.toLowerCase());
}

function shouldUseMockOtp(destination, channel) {
  // Non-production environments must never incur SMS/email-provider charges.
  if (env.NODE_ENV !== 'production') return true;
  return isProductionMockDestination(destination, channel);
}

async function sendThroughProvider(destination, channel, code) {
  if (!env.OTP_API_URL || !env.OTP_API_KEY) {
    throw Object.assign(new Error('OTP provider is not configured'), { statusCode: 503 });
  }

  // The provider adapter must be aligned with the exact ISKCON Vesu OTP vendor payload
  // before OTP_DELIVERY_MODE is changed to provider.
  const response = await fetch(env.OTP_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': env.OTP_API_KEY },
    body: JSON.stringify({ destination, channel, otp: code, otpLength: 4 })
  });
  if (!response.ok) throw Object.assign(new Error('OTP provider could not send OTP'), { statusCode: 502 });
}

export async function requestOtp(destination, channel) {
  const normalizedDestination = channel === 'email' ? destination.toLowerCase() : destination;
  const useMockOtp = shouldUseMockOtp(normalizedDestination, channel);
  const code = useMockOtp ? env.MOCK_OTP_CODE : otpFor();
  await OtpVerification.deleteMany({ destination: normalizedDestination, channel, verifiedAt: null });
  await OtpVerification.create({
    destination: normalizedDestination, channel, codeHash: await bcrypt.hash(code, 10),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000)
  });

  if (!useMockOtp) await sendThroughProvider(normalizedDestination, channel, code);
  // OTP is never returned or logged, in either mock or provider mode.
  return {};
}

export async function verifyOtp(destination, channel, code) {
  const normalizedDestination = channel === 'email' ? destination.toLowerCase() : destination;
  const otp = await OtpVerification.findOne({ destination: normalizedDestination, channel, verifiedAt: null }).sort({ createdAt: -1 });
  if (!otp || otp.expiresAt < new Date()) throw Object.assign(new Error('OTP is invalid or expired'), { statusCode: 400 });
  if (otp.attempts >= 5) throw Object.assign(new Error('OTP attempt limit exceeded'), { statusCode: 429 });
  otp.attempts += 1;
  if (!await bcrypt.compare(code, otp.codeHash)) { await otp.save(); throw Object.assign(new Error('Invalid OTP'), { statusCode: 400 }); }
  otp.verifiedAt = new Date();
  await otp.save();
}
