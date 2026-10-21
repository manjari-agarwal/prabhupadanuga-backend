import mongoose from 'mongoose';
import HubPost from '../models/HubPost.js';
import User from '../models/User.js';
import DonateClick from '../models/DonateClick.js';
import Sankalp from '../models/Sankalp.js';
import ContactMessage from '../models/ContactMessage.js';
import VolunteerRequest from '../models/VolunteerRequest.js';
import CmsAuditLog from '../models/CmsAuditLog.js';
const good=(res,data,message='Success')=>res.json({success:true,statusCode:200,message,data});
const bad=(res,statusCode,message)=>res.status(statusCode).json({success:false,statusCode,message,data:null});
function pagination(req){const page=Math.max(1,Math.min(100000,Number(req.query.page)||1));const limit=Math.max(1,Math.min(100,Number(req.query.limit)||20));return {page,limit};}
function dateBounds(query){
 const date=String(query.date||new Date().toISOString().slice(0,10));
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(`${date}T00:00:00.000Z`).toISOString().slice(0,10)!==date)throw Object.assign(new Error('Invalid YYYY-MM-DD date'),{statusCode:422});
 const start=new Date(`${date}T00:00:00.000Z`);return {date,start,end:new Date(start.getTime()+86400000)};
}
export async function overview(req,res){
 const {date,start,end}=dateBounds(req.query);const range={$gte:start,$lt:end};
 const [registrations,clicks,pendingTributes,pendingStories,newContacts,newVolunteers,sankalps]=await Promise.all([
  User.countDocuments({createdAt:range,deletedAt:null}),DonateClick.countDocuments({clickedAt:range}),
  HubPost.countDocuments({type:'tribute',status:'pending',deletedAt:null}),HubPost.countDocuments({type:'story',status:'pending',deletedAt:null}),
  ContactMessage.countDocuments({status:'new'}),VolunteerRequest.countDocuments({status:'submitted'}),Sankalp.countDocuments({createdAt:range})
 ]);
 return good(res,{date,timezone:'UTC',registrations,donationWebsiteClicks:clicks,pendingTributes,pendingStories,newContacts,newVolunteers,sankalpRequests:sankalps});
}
export async function clicksDaily(req,res){
 const days=Math.max(1,Math.min(90,Number(req.query.days)||30));const end=new Date();const start=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth(),end.getUTCDate()-days+1));
 const rows=await DonateClick.aggregate([{$match:{clickedAt:{$gte:start}}},{$group:{_id:{date:{$dateToString:{format:'%Y-%m-%d',date:'$clickedAt',timezone:'UTC'}},source:'$source'},count:{$sum:1}}},{$sort:{'_id.date':1,'_id.source':1}}]);
 return good(res,{timezone:'UTC',days,items:rows.map(x=>({date:x._id.date,source:x._id.source,count:x.count}))});
}
export async function moderationList(req,res){
 const {page,limit}=pagination(req);const status=req.query.status||'pending';const type=req.query.type;
 if(!['pending','published','rejected'].includes(status))return bad(res,422,'Invalid status');
 if(type&&!['tribute','story'].includes(type))return bad(res,422,'Invalid type');
 const filter={status,deletedAt:null,...(type?{type}:{})};
 const [items,total]=await Promise.all([HubPost.find(filter).sort({createdAt:-1}).skip((page-1)*limit).limit(limit).populate('author','name email registrationId'),HubPost.countDocuments(filter)]);
 return good(res,{items,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}});
}
export async function moderate(req,res){
 if(!mongoose.isValidObjectId(req.params.id))return bad(res,404,'Post not found');
 const {status,moderationNote=''}=req.body||{};
 if(!['published','rejected'].includes(status)||typeof moderationNote!=='string'||moderationNote.length>500)return bad(res,422,'Invalid moderation request');
 if(status==='rejected'&&!moderationNote.trim())return bad(res,422,'A rejection reason is required');
 const post=await HubPost.findOneAndUpdate({_id:req.params.id,status:'pending',deletedAt:null},{$set:{status,moderationNote,publishedAt:status==='published'?new Date():null}},{new:true});
 if(!post)return bad(res,409,'Post is no longer pending or does not exist');
 await CmsAuditLog.create({admin:req.cmsAdmin.id,action:status==='published'?'approve':'reject',resource:'HubPost',resourceId:String(post.id),after:{status,moderationNote}});
 return good(res,{id:post.id,type:post.type,status:post.status,moderationNote:post.moderationNote},'Moderation completed');
}
