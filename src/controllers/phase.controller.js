import { dailyDashboard, resolveTimezone } from '../services/dashboard.service.js';
import AppContent from '../models/AppContent.js';
import DonateClick from '../models/DonateClick.js';
import VolunteerRequest from '../models/VolunteerRequest.js';
import HubPost from '../models/HubPost.js';
import User from '../models/User.js';
import { success } from '../utils/apiResponse.js';
import { env } from '../config/env.js';
import { homeSummary } from '../services/sadhana.service.js';

const PAGE_SLUGS = ['about-srila-prabhupada','contact-us','privacy-policy','terms-and-conditions','prabhupada-letter','login'];
const contact = () => ({ email: env.PUBLIC_CONTACT_EMAIL || null, phone: env.PUBLIC_CONTACT_PHONE || null, address: env.PUBLIC_CONTACT_ADDRESS || null });
export async function bootstrap(req, res) {
  const pages = await AppContent.find({ slug: { $in: PAGE_SLUGS }, published: true }).select('slug title body imageUrl links version updatedAt').lean();
  const lookup = Object.fromEntries(pages.map(page => [page.slug, page]));
  return success(res, { branding: { loginImageUrl: env.LOGIN_IMAGE_URL || null }, contact: contact(), pages: lookup, externalLinks: { donateNow: env.DONATE_NOW_URL }, supportEmail: env.PUBLIC_CONTACT_EMAIL || null });
}
export async function content(req, res) {
  if (!PAGE_SLUGS.includes(req.params.slug)) return res.status(404).json({ success: false, statusCode: 404, message: 'Page not found', data: null });
  const page = await AppContent.findOne({ slug: req.params.slug, published: true }).select('slug title body imageUrl links version updatedAt').lean();
  if (!page) return res.status(404).json({ success: false, statusCode: 404, message: 'Page is not published', data: null });
  return success(res, page);
}
export async function home(req, res) {
  const now = new Date();
  const timezone = resolveTimezone(req.user.timezone);
  const [counts, featured, registrationCount, daily, sadhana] = await Promise.all([
    HubPost.aggregate([{ $match: { author: req.user._id, deletedAt: null } }, { $group: { _id: '$type', count: { $sum: 1 } } }]),
    HubPost.find({ deletedAt: null, status: 'published' }).sort({ createdAt: -1 }).limit(5).populate('author','name initiationName profileImage').lean(),
    User.countDocuments({ isActive: true, deletedAt: null }),
    dailyDashboard(now, timezone, req.user),
    homeSummary(req.user)
  ]);
  return success(res, { user: { id: req.user.id, name: req.user.name, profileImage: req.user.profileImage || null }, journey: { sankalp: { enabled: false, donateNowUrl: env.DONATE_NOW_URL }, tributes: { videoCount: counts.find(x=>x._id==='tribute')?.count || 0, storyCount: counts.find(x=>x._id==='story')?.count || 0 }, sadhana }, quote: daily.quote, timezone: daily.timezone, localDate: daily.localDate, countdown: daily.countdown, quiz: daily.quiz, featuredTributes: featured, certificate: { available: true }, community: { registrationCount }, liveKirtan: daily.liveKirtan });
}
export async function recordDonateClick(req, res) {
  const { eventId, source } = req.body;
  await DonateClick.updateOne({ user: req.user._id, eventId }, { $setOnInsert: { user: req.user._id, eventId, source, destination: env.DONATE_NOW_URL } }, { upsert: true });
  return success(res, { url: env.DONATE_NOW_URL, eventId }, 'Donate Now click recorded');
}
export async function donationReport(req, res) {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, statusCode: 403, message: 'Admin access required', data: null });
  const from = new Date(req.validatedQuery.from || '2000-01-01');
  const to = req.validatedQuery.to ? new Date(`${req.validatedQuery.to}T23:59:59.999Z`) : new Date();
  const range = { clickedAt: { $gte: from, $lte: to } };
  const [totalClicks, distinctUsers, bySource, byDay] = await Promise.all([
    DonateClick.countDocuments(range), DonateClick.distinct('user',range),
    DonateClick.aggregate([{ $match: range }, { $group: { _id: '$source', clicks: { $sum: 1 }, users: { $addToSet: '$user' } } }, { $project: { source:'$_id', clicks:1, uniqueUsers:{ $size:'$users' }, _id:0 } }]),
    DonateClick.aggregate([{ $match: range }, { $group: { _id: { $dateToString: { format:'%Y-%m-%d', date:'$clickedAt', timezone:'Asia/Kolkata' } }, clicks: { $sum: 1 } } }, { $sort: { _id:1 } }])
  ]);
  return success(res, { totalClicks, uniqueUsers: distinctUsers.length, bySource, byDay, from: from.toISOString(), to: to.toISOString() });
}
export async function volunteer(req, res) {
  const entry = await VolunteerRequest.create({ user: req.user._id, ...req.body, phone: req.user.mobileNo, email: req.user.email });
  return success(res, { id: entry.id, status: entry.status, createdAt: entry.createdAt }, 'Volunteer interest submitted', 201);
}
export async function myVolunteer(req, res) {
  return success(res, await VolunteerRequest.find({ user: req.user._id }).sort({ createdAt: -1 }).lean());
}

export async function saveContent(req,res) {
  if (req.user.role !== 'admin') return res.status(403).json({success:false,statusCode:403,message:'Admin access required',data:null});
  if (!PAGE_SLUGS.includes(req.params.slug)) return res.status(404).json({success:false,statusCode:404,message:'Unknown content slug',data:null});
  const page = await AppContent.findOneAndUpdate({slug:req.params.slug},{$set:req.body,$setOnInsert:{slug:req.params.slug}}, {upsert:true,new:true,runValidators:true});
  return success(res,page,'Content saved');
}
export async function adminVolunteerList(req,res) {
  if (req.user.role !== 'admin') return res.status(403).json({success:false,statusCode:403,message:'Admin access required',data:null});
  const {page,limit,status} = req.validatedQuery;
  const query = status ? {status} : {};
  const [items,total] = await Promise.all([VolunteerRequest.find(query).sort({createdAt:-1}).skip((page-1)*limit).limit(limit).populate('user','name registrationId').lean(),VolunteerRequest.countDocuments(query)]);
  return success(res,{items,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}});
}
export async function updateVolunteerStatus(req,res) {
  if (req.user.role !== 'admin') return res.status(403).json({success:false,statusCode:403,message:'Admin access required',data:null});
  if (!/^[0-9a-f]{24}$/i.test(req.params.id)) return res.status(404).json({success:false,statusCode:404,message:'Request not found',data:null});
  const item=await VolunteerRequest.findByIdAndUpdate(req.params.id,{$set:{status:req.body.status}},{new:true});
  if (!item) return res.status(404).json({success:false,statusCode:404,message:'Request not found',data:null});
  return success(res,item,'Volunteer request updated');
}
