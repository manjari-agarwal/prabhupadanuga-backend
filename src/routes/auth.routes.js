import { Router } from 'express';
import { z } from 'zod';
import { getCountries, getCountryCallingCode, isValidPhoneNumber } from 'libphonenumber-js';
import { sendOtp, confirmOtp, register, login } from '../controllers/auth.controller.js';

const router = Router();
const mobile = z.string().trim().refine(v => /^\+[1-9]\d{6,14}$/.test(v) && isValidPhoneNumber(v), 'Invalid international mobile number');
const email = z.string().trim().email().transform(v => v.toLowerCase());
const validate = (schema, action) => (req, res, next) => { try { req.body = schema.parse(req.body); return Promise.resolve(action(req,res,next)).catch(next); } catch(e) { return next(e); } };
const contactSchema = z.object({ destination: z.string().trim().min(3), channel: z.enum(['mobile','email']) }).superRefine((d, ctx) => {
  if (d.channel === 'mobile' && !mobile.safeParse(d.destination).success) ctx.addIssue({ code:'custom', path:['destination'], message:'Invalid international mobile number' });
  if (d.channel === 'email' && !email.safeParse(d.destination).success) ctx.addIssue({ code:'custom', path:['destination'], message:'Invalid email address' });
});
router.get('/isd-codes', (req,res) => {
  const list = getCountries().map(countryCode => ({ countryCode, isdCode:`+${getCountryCallingCode(countryCode)}` }));
  list.sort((a,b) => (a.countryCode === 'IN' ? -1 : b.countryCode === 'IN' ? 1 : a.countryCode.localeCompare(b.countryCode)));
  res.json({ success:true,statusCode:200,message:'ISD codes fetched successfully',data:list });
});
router.post('/otp/request', validate(contactSchema, sendOtp));
router.post('/otp/verify', validate(contactSchema.safeExtend({ otp:z.string().regex(/^\d{4}$/,'OTP must be exactly 4 digits') }), confirmOtp));
router.post('/register', validate(z.object({
  name:z.string().trim().min(2).max(120), initiationName:z.string().trim().max(120).optional().default(''),
  mobileNo:mobile, email:email.optional(), address:z.string().trim().min(1).max(500),
  city:z.string().trim().min(1).max(100), state:z.string().trim().min(1).max(100), country:z.string().trim().min(1).max(100),
  pinCode:z.string().trim().max(20).optional(), associatedIskconTemple:z.string().trim().max(100).optional(),
  updatesConsent:z.boolean().optional().default(false),
  profileImage:z.string().url().optional(), mobileProofToken:z.string().optional(), emailProofToken:z.string().optional()
}).refine(d => Boolean(d.mobileProofToken || d.emailProofToken), {message:'Verified OTP proof is required'}), register));
router.post('/login',validate(contactSchema.safeExtend({proofToken:z.string().min(1)}),login));
export default router;
