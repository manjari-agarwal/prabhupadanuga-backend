import { success } from '../utils/apiResponse.js';
import { requestOtp, verifyOtp } from '../services/otp.service.js';
import { uploadProfileImage } from '../services/media.service.js';

const publicUser = user => { const { _id, ...data } = user.toObject(); return { id: _id, ...data }; };

export const me = (req, res) => success(res, publicUser(req.user));
export async function updateProfile(req, res) {
  const allowed = ['name', 'initiationName', 'city', 'state', 'country'];
  allowed.forEach(field => { if (req.body[field] !== undefined) req.user[field] = req.body[field]; });
  await req.user.save(); return success(res, publicUser(req.user), 'Profile updated successfully');
}
export async function requestContactOtp(req, res) {
  const channel = req.params.channel;
  const destination = channel === 'mobile' ? req.user.mobileNo : req.user.email;
  const data = await requestOtp(destination, channel);
  return success(res, data, `OTP sent to your ${channel}`);
}
export async function verifyContact(req, res) {
  const channel = req.params.channel;
  const destination = channel === 'mobile' ? req.user.mobileNo : req.user.email;
  await verifyOtp(destination, channel, req.body.otp);
  if (channel === 'mobile') { req.user.isMobileVerified = true; req.user.mobileVerifiedAt = new Date(); }
  else { req.user.isEmailVerified = true; req.user.emailVerifiedAt = new Date(); }
  await req.user.save(); return success(res, publicUser(req.user), `${channel === 'mobile' ? 'Mobile number' : 'Email'} verified successfully`);
}
export async function uploadPicture(req, res) {
  const profileImage = await uploadProfileImage(req.user.id, req.file);
  req.user.profileImage = profileImage; await req.user.save();
  return success(res, { profileImage }, 'Profile picture uploaded successfully');
}
