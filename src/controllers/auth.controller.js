import User from '../models/User.js';
import { success } from '../utils/apiResponse.js';
import { requestOtp, verifyOtp } from '../services/otp.service.js';
import { createAccessToken, createRefreshToken, createOtpProof, verifyOtpProof } from '../services/token.service.js';
import { env } from '../config/env.js';

function publicUser(user) { const { _id, __v, ...data } = user.toObject(); return { id: _id, ...data }; }
function registrationId() { return `${env.REGISTRATION_ID_PREFIX}-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`; }

export async function sendOtp(req, res) {
  const { destination, channel } = req.body;
  const data = await requestOtp(destination, channel);
  return success(res, data, 'OTP sent successfully');
}

export async function confirmOtp(req, res) {
  const { destination, channel, otp } = req.body;
  await verifyOtp(destination, channel, otp);
  const normalizedDestination = channel === 'email' ? destination.toLowerCase() : destination;
  const existingUser = await User.exists({ [channel === 'mobile' ? 'mobileNo' : 'email']: normalizedDestination, isActive: true });
  const user = existingUser ? await User.findById(existingUser._id) : null;
  if (user) { user.lastLoginAt = new Date(); await user.save(); }
  return success(res, {
    proofToken: createOtpProof(normalizedDestination, channel),
    isRegistered: Boolean(user),
    nextStep: user ? 'dashboard' : 'register',
    ...(user ? { user: publicUser(user), accessToken: createAccessToken(user), refreshToken: createRefreshToken(user) } : {})
  }, 'OTP verified successfully');
}

export async function register(req, res) {
  const { name, initiationName, mobileNo, email, city, state, country, profileImage, mobileProofToken, emailProofToken } = req.body;
  const mobileVerified = mobileProofToken ? verifyOtpProof(mobileProofToken, mobileNo, 'mobile') : false;
  const emailVerified = emailProofToken ? verifyOtpProof(emailProofToken, email.toLowerCase(), 'email') : false;
  if (!mobileVerified && !emailVerified) return res.status(400).json({ success: false, statusCode: 400, message: 'Verify either mobile number or email before registration', data: null });
  const existing = await User.findOne({ $or: [{ mobileNo }, { email: email.toLowerCase() }] });
  if (existing) return res.status(409).json({ success: false, statusCode: 409, message: 'Mobile number or email is already registered', data: null });
  const now = new Date();
  const user = await User.create({ registrationId: registrationId(), name, initiationName, mobileNo, email, city, state, country, profileImage, mobileVerifiedAt: mobileVerified ? now : undefined, emailVerifiedAt: emailVerified ? now : undefined, isMobileVerified: mobileVerified, isEmailVerified: emailVerified, lastLoginAt: now });
  return success(res, { user: publicUser(user), accessToken: createAccessToken(user), refreshToken: createRefreshToken(user) }, 'Registration completed successfully', 201);
}

export async function login(req, res) {
  const { destination, channel, proofToken } = req.body;
  if (!verifyOtpProof(proofToken, destination, channel)) return res.status(400).json({ success: false, statusCode: 400, message: 'Valid OTP verification is required', data: null });
  const user = await User.findOne({ [channel === 'mobile' ? 'mobileNo' : 'email']: destination, isActive: true });
  if (!user) return res.status(404).json({ success: false, statusCode: 404, message: 'No registration found for this contact', data: null });
  user.lastLoginAt = new Date(); await user.save();
  return success(res, { user: publicUser(user), accessToken: createAccessToken(user), refreshToken: createRefreshToken(user) }, 'Login successful');
}
