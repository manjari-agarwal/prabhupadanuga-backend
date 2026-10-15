import { randomUUID } from 'node:crypto';
import User from '../models/User.js';
import { isValidPhoneNumber } from 'libphonenumber-js';
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
const invalid = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const cleanContact = (destination, channel) => channel === 'email' ? destination.trim().toLowerCase() : destination.trim();
const isValidContact = (destination, channel) => channel === 'email'
  ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)
  : /^\+[1-9]\d{6,14}$/.test(destination) && isValidPhoneNumber(destination);
const ownContact = (user, channel) => channel === 'email' ? user.email : user.mobileNo;
const contactField = channel => channel === 'email' ? 'email' : 'mobileNo';
export async function updateProfile(req, res) {
  const allowed = ['name', 'initiationName', 'educationDegree', 'address', 'pinCode', 'city', 'state', 'country', 'spiritualMaster', 'associatedIskconTemple', 'timezone', 'spouseName'];
  for (const field of allowed) if (req.body[field] !== undefined) req.user[field] = req.body[field];
  for (const field of ['dateOfBirth', 'marriageDate']) {
    if (req.body[field] !== undefined) req.user[field] = req.body[field] ? new Date(req.body[field] + 'T00:00:00.000Z') : null;
  }
  if (req.body.dateOfBirth && new Date(req.body.dateOfBirth + 'T00:00:00Z') > new Date()) throw invalid('Date of birth cannot be in the future');
  if (req.body.updatesConsent !== undefined) {
    req.user.updatesConsent = req.body.updatesConsent;
    req.user.updatesConsentAt = req.body.updatesConsent ? new Date() : null;
  }
  if (req.body.children !== undefined) {
    const ids = req.body.children.map(c => c.id).filter(Boolean);
    if (new Set(ids).size !== ids.length) throw invalid('Duplicate child ID', 422);
    req.user.children = req.body.children.map(c => ({ ...c, id: c.id || randomUUID() }));
  }
  await req.user.save();
  return success(res, publicUser(req.user), 'Profile updated successfully');
}
export async function requestContactOtp(req, res) {
  const { channel } = req.params;
  const destination = cleanContact(req.body.destination || ownContact(req.user, channel) || '', channel);
  if (!isValidContact(destination, channel)) throw invalid(`Provide a valid ${channel}`);
  if (destination !== ownContact(req.user, channel)) {
    const used = await User.exists({ [contactField(channel)]: destination, _id: { $ne: req.user._id } });
    if (used) throw invalid('This contact is already registered', 409);
  }
  const data = await requestOtp(destination, channel);
  return success(res, { ...data, destination }, `OTP sent to your ${channel}`);
}
export async function verifyContact(req, res) {
  const { channel } = req.params;
  const destination = cleanContact(req.body.destination || ownContact(req.user, channel) || '', channel);
  if (!isValidContact(destination, channel)) throw invalid(`Provide a valid ${channel}`);
  const field = contactField(channel);
  if (destination !== ownContact(req.user, channel)) {
    const used = await User.exists({ [field]: destination, _id: { $ne: req.user._id } });
    if (used) throw invalid('This contact is already registered', 409);
  }
  await verifyOtp(destination, channel, req.body.otp);
  req.user[field] = destination;
  if (channel === 'mobile') { req.user.isMobileVerified = true; req.user.mobileVerifiedAt = new Date(); }
  else { req.user.isEmailVerified = true; req.user.emailVerifiedAt = new Date(); }
  try { await req.user.save(); }
  catch (error) { if (error.code === 11000) throw invalid('This contact is already registered',409); throw error; }
  return success(res, publicUser(req.user), `${channel === 'mobile' ? 'Mobile number' : 'Email'} verified successfully`);
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
  const mode = req.query.mode || 'individual';
  if (!['individual', 'family'].includes(mode)) throw invalid('mode must be individual or family');
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const backgroundPath = path.resolve(dirname, '../assets/prabhupadanuga-certificate-background.png');
  const names = mode === 'family'
    ? [req.user.name, req.user.spouseName, ...(req.user.children || []).map(child => child.name)].filter(Boolean)
    : [req.user.name];
  // PDFs are generated from saved profile values only, never from query-supplied names.
  const doc = new PDFDocument({ size: [842, 474], margin: 0, info: { Title: `Prabhupadanuga ${mode} Certificate` } });
  const safeId = (req.user.registrationId || String(req.user._id)).replace(/[^A-Za-z0-9_-]/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="prabhupadanuga-${mode}-${safeId}.pdf"`);
  doc.pipe(res);
  doc.image(backgroundPath, 0, 0, { width: 842, height: 474 });
  doc.fillColor('#5A351D').font('Times-Bold').fontSize(27).text('PRABHUPADANUGA CERTIFICATE', 100, 78, { width: 642, align: 'center' });
  doc.font('Times-Roman').fontSize(14).text(mode === 'family' ? 'Lovingly presented to the family of' : 'This certificate is lovingly presented to', 120, 142, { width: 602, align: 'center' });
  const fontSize = names.length > 8 ? 13 : names.length > 4 ? 16 : mode === 'family' ? 21 : 30;
  doc.fillColor('#8B4513').font('Times-Bold').fontSize(fontSize).text(names.join('  •  '), 110, 179, { width: 622, height: 83, align: 'center', ellipsis: true });
  if (mode === 'individual' && req.user.initiationName) doc.fillColor('#5A351D').font('Times-Italic').fontSize(16).text(`(${req.user.initiationName})`, 120, 226, { width: 602, align: 'center' });
  doc.fillColor('#5A351D').font('Times-Roman').fontSize(15).text('for registering with devotion and gratitude in the service of Srila Prabhupada.', 135, 273, { width: 572, align: 'center' });
  doc.font('Times-Bold').fontSize(13).text(`Registration ID: ${req.user.registrationId || safeId}`, 150, 330, { width: 542, align: 'center' });
  doc.font('Times-Roman').fontSize(11).text(`Registered on: ${req.user.createdAt.toISOString().slice(0, 10)}`, 150, 352, { width: 542, align: 'center' });
  doc.font('Times-Italic').fontSize(12).text(env.CERTIFICATE_ISSUER_NAME, 535, 390, { width: 190, align: 'center' });
  doc.end();
}
