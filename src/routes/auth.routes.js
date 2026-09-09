import { Router } from 'express';
import { z } from 'zod';
import { getCountries, getCountryCallingCode } from 'libphonenumber-js';
import { sendOtp, confirmOtp, register, login } from '../controllers/auth.controller.js';

const router = Router();
const mobile = z.string().regex(/^\+[1-9]\d{6,14}$/, 'Use international mobile format, for example +919876543210');
const email = z.string().email().transform(value => value.toLowerCase());
const validate = (schema, action) => (req, res, next) => { try { req.body = schema.parse(req.body); return action(req, res, next); } catch (error) { return next(error); } };

router.post('/otp/request', validate(z.object({ destination: z.string().min(3), channel: z.enum(['mobile', 'email']) }).superRefine((data, ctx) => { if (data.channel === 'mobile' && !mobile.safeParse(data.destination).success) ctx.addIssue({ code: 'custom', message: 'Invalid international mobile number' }); if (data.channel === 'email' && !email.safeParse(data.destination).success) ctx.addIssue({ code: 'custom', message: 'Invalid email' }); }), sendOtp));
router.post('/otp/verify', validate(z.object({ destination: z.string().min(3), channel: z.enum(['mobile', 'email']), otp: z.string().regex(/^\d{4}$/, 'OTP must be exactly 4 digits') }), confirmOtp));
router.get('/isd-codes', (req, res) => {
  const data = getCountries().map(countryCode => ({ countryCode, isdCode: `+${getCountryCallingCode(countryCode)}` })).sort((a, b) => a.isdCode.localeCompare(b.isdCode) || a.countryCode.localeCompare(b.countryCode));
  res.json({ success: true, statusCode: 200, message: 'ISD codes fetched successfully', data });
});
router.post('/register', validate(z.object({ name: z.string().min(2).max(120), initiationName: z.string().max(120).optional(), mobileNo: mobile, email, address:z.string().optional(), city: z.string().max(100).optional(), state: z.string().max(100).optional(), country: z.string().max(100).optional(), profileImage: z.string().url().optional(), mobileProofToken: z.string().optional(), emailProofToken: z.string().optional() }), register));
router.post('/login', validate(z.object({ destination: z.string().min(3), channel: z.enum(['mobile', 'email']), proofToken: z.string() }).superRefine((data, ctx) => { if (data.channel === 'mobile' && !mobile.safeParse(data.destination).success) ctx.addIssue({ code: 'custom', message: 'Invalid international mobile number' }); if (data.channel === 'email' && !email.safeParse(data.destination).success) ctx.addIssue({ code: 'custom', message: 'Invalid email' }); }), login));

export default router;
