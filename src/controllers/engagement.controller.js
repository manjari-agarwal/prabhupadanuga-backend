import VaishnavaCalendar from '../models/VaishnavaCalendar.js';
import Sankalp from '../models/Sankalp.js';
import VolunteerRequest from '../models/VolunteerRequest.js';
import VolunteerCategory from '../models/VolunteerCategory.js';
import { success } from '../utils/apiResponse.js';
import { resolveTimezone } from '../services/dashboard.service.js';
const localNow = (timezone) => Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).filter(x=>['year','month','day'].includes(x.type)).map(x=>[x.type,Number(x.value)]));
export async function calendarMonth(req,res) {
  const timezone=resolveTimezone(req.user.timezone); const now=localNow(timezone);
  const year=req.validatedQuery.year??now.year; const month=req.validatedQuery.month??now.month;
  const row=await VaishnavaCalendar.findOne({year,month}).lean();
  const events=(row?.data||[]).map((x,i)=>({id:`${year}-${String(month).padStart(2,'0')}-${i+1}`,date:x.date,title:x.event,description:x.description||null})).sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title));
  return success(res,{year,month,timezone,localDate:`${now.year}-${String(now.month).padStart(2,'0')}-${String(now.day).padStart(2,'0')}`,events,markedDates:[...new Set(events.map(x=>x.date))],available:!!row});
}
export async function createSankalp(req,res) {
  const {frequency,amount,donor,requestId}=req.body;
  const months={monthly:1,quarterly:3,half_yearly:6,yearly:12};
  let record=await Sankalp.findOne({user:req.user._id,requestId});
  if (record) return success(res,{id:record.id,status:record.status,frequency:record.frequency,amount:record.amount,createdAt:record.createdAt},'Existing Sankalp request');
  try { record=await Sankalp.create({user:req.user._id,requestId,frequency,intervalMonths:months[frequency],amount,donor,status:'pending_payment_setup'}); }
  catch (e) {if(e.code===11000) {record=await Sankalp.findOne({user:req.user._id,requestId}); if(record) return success(res,{id:record.id,status:record.status},'Existing Sankalp request');}throw e;}
  return success(res,{id:record.id,frequency,amount,currency:'INR',status:record.status,paymentRequired:true,paymentInitialized:false,createdAt:record.createdAt},'Sankalp details saved; payment setup pending',201);
}
export async function mySankalps(req,res){const rows=await Sankalp.find({user:req.user._id}).sort({createdAt:-1}).select('-donor.pan').lean();return success(res,rows);}
export async function volunteerCategories(req,res){const rows=await VolunteerCategory.find({isActive:true}).sort({sortOrder:1,title:1}).select('code title subtitle -_id').lean();return success(res,rows);}
export async function registerVolunteer(req,res){
  const {categories,name,email,mobileNo,note}=req.body;
  const valid=await VolunteerCategory.countDocuments({code:{$in:categories},isActive:true});
  if(valid!==categories.length) return res.status(400).json({success:false,statusCode:400,message:'One or more selected volunteer categories are invalid or inactive',data:null});
  const existing=await VolunteerRequest.findOne({user:req.user._id,status:{$in:['submitted','contacted','approved']}});
  if(existing) {existing.services=categories;existing.name=name;existing.email=email;existing.phone=mobileNo||'';existing.note=note||'';await existing.save();return success(res,{id:existing.id,status:existing.status,categories:existing.services},'Volunteer preferences updated');}
  const row=await VolunteerRequest.create({user:req.user._id,services:categories,name,email,phone:mobileNo||'',note:note||''});
  return success(res,{id:row.id,status:row.status,categories:row.services},'Volunteer interest registered',201);
}
