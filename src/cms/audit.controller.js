import mongoose from 'mongoose';
import CmsAuditLog from '../models/CmsAuditLog.js';
const send=(res,data)=>res.json({success:true,statusCode:200,message:'Success',data});
const isDay=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'));
const cleanText=s=>String(s||'').slice(0,150);
function redactedSummary(record){
 // Never expose before/after snapshots: they can contain personal details or credentials.
 const after=record.after||{};const before=record.before||{};
 const keys=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>!/password|secret|token|otp|email|mobile|phone|pan|address|donor|name|body|note|comment|permissions/i.test(k));
 return keys.slice(0,10);
}
export async function listAuditLogs(req,res){
 const page=Math.max(1,Math.min(100000,parseInt(req.query.page,10)||1));
 const limit=Math.min(100,Math.max(1,parseInt(req.query.limit,10)||20));
 const query={};
 if(req.query.resource){const resource=String(req.query.resource);if(!/^[A-Za-z]{2,80}$/.test(resource))return res.status(422).json({success:false,statusCode:422,message:'Invalid resource',data:null});query.resource=resource;}
 if(req.query.action){const action=String(req.query.action);if(!/^[a-z_]{2,40}$/.test(action))return res.status(422).json({success:false,statusCode:422,message:'Invalid action',data:null});query.action=action;}
 if(req.query.admin){if(!mongoose.isValidObjectId(req.query.admin))return res.status(422).json({success:false,statusCode:422,message:'Invalid admin ID',data:null});query.admin=req.query.admin;}
 if(req.query.from||req.query.to){if((req.query.from&&!isDay(req.query.from))||(req.query.to&&!isDay(req.query.to)))return res.status(422).json({success:false,statusCode:422,message:'Invalid dates',data:null});query.createdAt={};if(req.query.from)query.createdAt.$gte=new Date(req.query.from+'T00:00:00Z');if(req.query.to)query.createdAt.$lt=new Date(new Date(req.query.to+'T00:00:00Z').getTime()+86400000);}
 const [items,total]=await Promise.all([CmsAuditLog.find(query).sort({createdAt:-1,_id:-1}).skip((page-1)*limit).limit(limit).populate('admin','name email').lean(),CmsAuditLog.countDocuments(query)]);
 return send(res,{items:items.map(x=>({id:String(x._id),actor:x.admin?{id:String(x.admin._id),name:cleanText(x.admin.name),email:cleanText(x.admin.email)}:null,action:x.action,resource:x.resource,resourceId:x.resourceId||null,changedFields:redactedSummary(x),createdAt:x.createdAt})),pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}});
}
export async function auditFilters(req,res){const [resources,actions]=await Promise.all([CmsAuditLog.distinct('resource'),CmsAuditLog.distinct('action')]);return send(res,{resources:resources.sort(),actions:actions.sort()});}
