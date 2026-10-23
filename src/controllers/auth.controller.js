import { randomUUID } from 'node:crypto';
import User from '../models/User.js';
import { success } from '../utils/apiResponse.js';
import { requestOtp, verifyOtp } from '../services/otp.service.js';
import { createAccessToken, createRefreshToken, createOtpProof, verifyOtpProof } from '../services/token.service.js';
import { env } from '../config/env.js';

function verifyProofSafely(token,destination,channel) { try { return Boolean(token && verifyOtpProof(token,destination,channel)); } catch {return false;} }
function publicUser(user) { const { _id, __v, ...data } = user.toObject(); return { id: _id, ...data }; }
function registrationId() { return `${env.REGISTRATION_ID_PREFIX}-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`; }

export async function sendOtp(req, res) {
  const { destination, channel } = req.body;
  const data = await requestOtp(destination, channel);
  return success(res, data, 'OTP sent successfully');
}

export async function confirmOtp(req, res) {
  const { destination, channel, otp } = req.body;
  await verifyOtp(destination, channel, otp);

  const normalizedDestination = channel === 'email' ? destination.toLowerCase() : destination;
  const contactField = channel === 'mobile' ? 'mobileNo' : 'email';
  const user = await User.findOne({
    [contactField]: normalizedDestination,
    isActive: true,
    deletedAt: null
  });

  // A successful OTP verification proves ownership of this contact. If the
  // contact already belongs to a registered user, mark that channel verified
  // and continue directly to the dashboard.
  if (user) {
    const now = new Date();
    if (channel === 'mobile') {
      user.isMobileVerified = true;
      user.mobileVerifiedAt = user.mobileVerifiedAt || now;
    } else {
      user.isEmailVerified = true;
      user.emailVerifiedAt = user.emailVerifiedAt || now;
    }
    user.lastLoginAt = now;
    await user.save();
  }

  return success(res, {
    proofToken: createOtpProof(normalizedDestination, channel),
    isRegistered: Boolean(user),
    nextStep: user ? 'dashboard' : 'register',
    ...(user ? { user: publicUser(user), accessToken: createAccessToken(user), refreshToken: createRefreshToken(user) } : {})
  }, 'OTP verified successfully');
}

export async function register(req, res) {
  const { name, initiationName, mobileNo, email, address, city, state, country, pinCode, associatedIskconTemple, updatesConsent, profileImage, proofToken, mobileProofToken, emailProofToken } = req.body;

  const normalizedEmail = email ? email.toLowerCase() : undefined;
  // Keep legacy token fields for backward compatibility, but validate every
  // supplied OTP proof against both registration contacts. This allows FE to
  // simply send the common `proofToken` returned by /otp/verify and also fixes
  // older clients that accidentally send an email proof in mobileProofToken.
  const proofTokens = [...new Set([proofToken, mobileProofToken, emailProofToken].filter(Boolean))];
  const mobileVerified = proofTokens.some(token => verifyProofSafely(token, mobileNo, 'mobile'));
  const emailVerified = Boolean(normalizedEmail) && proofTokens.some(token => verifyProofSafely(token, normalizedEmail, 'email'));
  if (!mobileVerified && !emailVerified) return res.status(400).json({ success: false, statusCode: 400, message: 'Verify either mobile number or email before registration', data: null });
  const existing = await User.findOne({ $or: [{ mobileNo }, ...(normalizedEmail ? [{ email: normalizedEmail }] : [])] });
  if (existing) return res.status(409).json({ success: false, statusCode: 409, message: 'Mobile number or email is already registered', data: null });
  const now = new Date();
  const user = await User.create({ registrationId: registrationId(), name, initiationName, mobileNo, ...(normalizedEmail ? {email:normalizedEmail} : {}), address, city, state, country, pinCode, associatedIskconTemple, updatesConsent, updatesConsentAt: updatesConsent ? now : undefined, profileImage, mobileVerifiedAt: mobileVerified ? now : undefined, emailVerifiedAt: emailVerified ? now : undefined, isMobileVerified: mobileVerified, isEmailVerified: emailVerified, lastLoginAt: now });
  return success(res, { user: publicUser(user), accessToken: createAccessToken(user), refreshToken: createRefreshToken(user) }, 'Registration completed successfully', 201);
}

export async function login(req, res) {
  const { channel, proofToken } = req.body;
  const destination = channel === 'email' ? req.body.destination.toLowerCase() : req.body.destination;
  if (!verifyProofSafely(proofToken, destination, channel)) return res.status(400).json({ success: false, statusCode: 400, message: 'Valid OTP verification is required', data: null });
  const user = await User.findOne({ [channel === 'mobile' ? 'mobileNo' : 'email']: destination, [channel === 'mobile' ? 'isMobileVerified' : 'isEmailVerified']: true, isActive: true, deletedAt: null });
  if (!user) return res.status(404).json({ success: false, statusCode: 404, message: 'No registration found for this contact', data: null });
  user.lastLoginAt = new Date(); await user.save();
  return success(res, { user: publicUser(user), accessToken: createAccessToken(user), refreshToken: createRefreshToken(user) }, 'Login successful');
}
