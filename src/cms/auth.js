import jwt from 'jsonwebtoken';
import {scryptSync,randomBytes,timingSafeEqual,createHmac} from 'node:crypto';
import CmsAdmin from '../models/CmsAdmin.js';
import {visiblePermissions} from './permissions.js';

const secret=()=>{if(!process.env.CMS_JWT_SECRET||process.env.CMS_JWT_SECRET.length<32)throw new Error('CMS_JWT_SECRET must have at least 32 characters');return process.env.CMS_JWT_SECRET;};
const fail=(res,code,message)=>res.status(code).json({success:false,statusCode:code,message,data:null});
const normalize=email=>String(email||'').trim().toLowerCase();
export function hashPassword(password){const salt=randomBytes(16).toString('hex');return `scrypt:${salt}:${scryptSync(password,salt,64).toString('hex')}`;}
export function verifyPassword(password,stored){try{const [algorithm,salt,hash]=stored.split(':');if(algorithm!=='scrypt')return false;const expected=Buffer.from(hash,'hex');const received=scryptSync(password,salt,expected.length);return expected.length===received.length&&timingSafeEqual(expected,received);}catch{return false;}}
const otpDigest=(id,code)=>createHmac('sha256',secret()).update(`${id}:${code}`).digest('hex');
const otpEqual=(expected,actual)=>{if(!expected||!actual)return false;return timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(actual,'hex'));};
const publicAdmin=admin=>({id:admin.id,email:admin.email,name:admin.name,role:admin.role,permissions:visiblePermissions(admin)});
async function sendAdminOtp(email,code){
 if(process.env.CMS_MOCK_AUTH==='true'&&process.env.NODE_ENV!=='production')return;
 const {env}=await import('../config/env.js');
 if(env.EMAIL_PROVIDER!=='smtp'||!env.SMTP_HOST||!env.SMTP_USER||!env.SMTP_PASS||!env.SMTP_FROM)throw Object.assign(new Error('CMS SMTP is not configured'),{statusCode:503});
 const {default:nodemailer}=await import('nodemailer');
 const transporter=nodemailer.createTransport({host:env.SMTP_HOST,port:env.SMTP_PORT,secure:env.SMTP_PORT===465,auth:{user:env.SMTP_USER,pass:env.SMTP_PASS}});
 await transporter.sendMail({from:env.SMTP_FROM,to:email,subject:'Prabhupadaanuga CMS login verification',text:`Your CMS login code is ${code}. It expires in 5 minutes. Do not share it.`});
}
export async function cmsLogin(req,res){
 const email=normalize(req.body?.email),password=req.body?.password;
 if(!/^\S+@\S+\.\S+$/.test(email)||typeof password!=='string')return fail(res,422,'Valid email and password are required');
 const admin=await CmsAdmin.findOne({email,active:true}).select('+passwordHash +loginFailures +lockedUntil +otpIssuedAt');
 const fake='scrypt:0123456789abcdef0123456789abcdef:'+ '00'.repeat(64);
 const valid=verifyPassword(password,admin?.passwordHash||fake);
 if(!admin||!valid){if(admin){admin.loginFailures=(admin.loginFailures||0)+1;if(admin.loginFailures>=5)admin.lockedUntil=new Date(Date.now()+15*60*1000);await admin.save();}return fail(res,401,'Invalid credentials');}
 if(admin.lockedUntil&&admin.lockedUntil>new Date())return fail(res,429,'Too many attempts. Please try later');
 if(admin.otpIssuedAt&&Date.now()-admin.otpIssuedAt.getTime()<30000)return fail(res,429,'Please wait before requesting another OTP');
 const challengeId=randomBytes(24).toString('hex');
 const code=process.env.CMS_MOCK_AUTH==='true'&&process.env.NODE_ENV!=='production'?'123456':String(randomBytes(4).readUInt32BE(0)%1000000).padStart(6,'0');
 await sendAdminOtp(admin.email,code);
 admin.otpHash=otpDigest(challengeId,code);admin.otpChallengeId=challengeId;admin.otpExpiresAt=new Date(Date.now()+5*60000);admin.otpAttempts=0;admin.otpIssuedAt=new Date();admin.loginFailures=0;admin.lockedUntil=undefined;await admin.save();
 return res.json({success:true,statusCode:200,message:'Verification code sent to email',data:{challengeId,expiresInSeconds:300,maskedEmail:admin.email.replace(/^(.{1,2}).*(@.*)$/,'$1***$2')}});
}
export async function cmsVerifyOtp(req,res){
 const challengeId=String(req.body?.challengeId||''),otp=String(req.body?.otp||'');
 if(!/^[a-f0-9]{48}$/.test(challengeId)||!/^\d{6}$/.test(otp))return fail(res,422,'Valid challengeId and six-digit OTP required');
 const admin=await CmsAdmin.findOne({otpChallengeId:challengeId,active:true}).select('+otpHash +otpExpiresAt +otpAttempts +otpChallengeId');
 if(!admin||!admin.otpExpiresAt||admin.otpExpiresAt<=new Date())return fail(res,401,'Invalid or expired login challenge');
 if(admin.otpAttempts>=5)return fail(res,429,'Too many OTP attempts');
 const verified=otpEqual(admin.otpHash,otpDigest(challengeId,otp));
 // Atomic update prevents replay/concurrent OTP consumption.
 if(!verified){await CmsAdmin.updateOne({_id:admin.id,otpChallengeId:challengeId},{$inc:{otpAttempts:1}});return fail(res,401,'Invalid verification code');}
 const consumed=await CmsAdmin.findOneAndUpdate({_id:admin.id,otpChallengeId:challengeId,otpExpiresAt:{$gt:new Date()},otpAttempts:{$lt:5}},{$unset:{otpHash:1,otpChallengeId:1,otpExpiresAt:1,otpIssuedAt:1},$set:{lastLoginAt:new Date(),otpAttempts:0}},{new:true});
 if(!consumed)return fail(res,401,'Login challenge already consumed');
 const accessToken=jwt.sign({sub:String(consumed.id),type:'cms_access',aud:'prabhupadanuga-cms',ver:consumed.tokenVersion},secret(),{algorithm:'HS256',expiresIn:'8h'});
 return res.json({success:true,statusCode:200,message:'Login successful',data:{accessToken,tokenType:'Bearer',expiresInSeconds:28800,admin:publicAdmin(consumed)}});
}
export async function cmsAuthenticate(req,res,next){try{
 const value=req.get('X-CMS-Authorization')||'';
 if(!/^Bearer\s+\S+$/i.test(value))return fail(res,401,'CMS authentication required');
 const data=jwt.verify(value.replace(/^Bearer\s+/i,''),secret(),{algorithms:['HS256'],audience:'prabhupadanuga-cms'});
 if(data.type!=='cms_access')return fail(res,401,'Invalid CMS token');
 const admin=await CmsAdmin.findById(data.sub);if(!admin?.active||admin.tokenVersion!==data.ver)return fail(res,401,'CMS session invalid');req.cmsAdmin=admin;next();
}catch{return fail(res,401,'Invalid or expired CMS token');}}
export async function cmsMe(req,res){return res.json({success:true,statusCode:200,message:'Success',data:publicAdmin(req.cmsAdmin)});}
export async function cmsLogout(req,res){await CmsAdmin.updateOne({_id:req.cmsAdmin.id},{$inc:{tokenVersion:1}});return res.json({success:true,statusCode:200,message:'Logged out',data:null});}
