import { success } from '../utils/apiResponse.js';
import { requestOtp, verifyOtp } from '../services/otp.service.js';
import { uploadProfileImage } from '../services/media.service.js';
import HubPost from '../models/HubPost.js';
import HubComment from '../models/HubComment.js';
import PDFDocument from 'pdfkit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';

const publicUser = user => { const { _id, ...data } = user.toObject(); return { id: _id, ...data }; };

export async function me(req, res) {
  const [tributeCount, storyCount] = await Promise.all([
    HubPost.countDocuments({ author: req.user.id, type: 'tribute', deletedAt: null }),
    HubPost.countDocuments({ author: req.user.id, type: 'story', deletedAt: null })
  ]);
  return success(res, { ...publicUser(req.user), contentCounts: { tributes: tributeCount, stories: storyCount }, certificateAvailable: true });
}
export async function updateProfile(req, res) {
  const allowed = ['name', 'initiationName', 'city', 'state', 'country', 'address', 'associatedIskconTemple'];
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

export async function deleteAccount(req, res) {
  const now = new Date();
  req.user.isActive = false;
  req.user.deletedAt = now;
  await Promise.all([
    req.user.save(),
    HubPost.updateMany({ author: req.user.id, deletedAt: null }, { deletedAt: now }),
    HubComment.updateMany({ author: req.user.id, deletedAt: null }, { deletedAt: now })
  ]);
  return success(res, null, 'Account deleted successfully');
}

export async function downloadCertificate(req, res) {
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const backgroundPath = path.resolve(dirname, '../assets/prabhupadanuga-certificate-background.png');
  const doc = new PDFDocument({ size: [842, 474], margin: 0, info: { Title: `Prabhupadanuga Certificate - ${req.user.name}` } });
  const safeId = req.user.registrationId.replace(/[^A-Za-z0-9_-]/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="prabhupadanuga-certificate-${safeId}.pdf"`);
  doc.pipe(res);
  doc.image(backgroundPath, 0, 0, { width: 842, height: 474 });
  doc.fillColor('#5A351D').font('Times-Bold').fontSize(28).text('PRABHUPADANUGA CERTIFICATE', 100, 78, { width: 642, align: 'center' });
  doc.font('Times-Roman').fontSize(14).text('This certificate is lovingly presented to', 120, 142, { width: 602, align: 'center' });
  doc.fillColor('#8B4513').font('Times-Bold').fontSize(30).text(req.user.name, 110, 179, { width: 622, align: 'center' });
  if (req.user.initiationName) doc.fillColor('#5A351D').font('Times-Italic').fontSize(16).text(`(${req.user.initiationName})`, 120, 219, { width: 602, align: 'center' });
  doc.fillColor('#5A351D').font('Times-Roman').fontSize(15).text('for registering with devotion and gratitude in the service of Srila Prabhupada.', 135, 260, { width: 572, align: 'center' });
  doc.font('Times-Bold').fontSize(13).text(`Registration ID: ${req.user.registrationId}`, 150, 320, { width: 542, align: 'center' });
  doc.font('Times-Roman').fontSize(11).text(`Registered on: ${req.user.createdAt.toISOString().slice(0, 10)}`, 150, 344, { width: 542, align: 'center' });
  doc.font('Times-Italic').fontSize(12).text(env.CERTIFICATE_ISSUER_NAME, 535, 390, { width: 190, align: 'center' });
  doc.end();
}
