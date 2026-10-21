import mongoose from 'mongoose';
import Kirtan from '../models/Kirtan.js';
import CmsAuditLog from '../models/CmsAuditLog.js';

const ok=(res,data,message='Success',statusCode=200)=>res.status(statusCode).json({success:true,statusCode,message,data});
const fail=(res,message,code=422)=>res.status(code).json({success:false,statusCode:code,message,data:null});
const validId=id=>mongoose.isValidObjectId(id);
const urlValid=(raw,platform)=>{try{const u=new URL(raw);if(u.protocol!=='https:')return false;const host=u.hostname.toLowerCase();return platform==='youtube'?['youtube.com','www.youtube.com','m.youtube.com','youtu.be','www.youtube-nocookie.com'].includes(host):['facebook.com','www.facebook.com','m.facebook.com','fb.watch','www.fb.watch'].includes(host);}catch{return false}};
function read(body,{partial=false}={}){
 const allowed=['title','platform','url','startsAt','endsAt','status'];
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))throw Error('Invalid Kirtan fields');
 const values={};for(const k of allowed)if(Object.hasOwn(body,k))values[k]=body[k];
 if(!partial&&['title','platform','url','startsAt'].some(k=>values[k]==null))throw Error('Title, platform, URL and start time are required');
 if(values.title!==undefined){if(typeof values.title!=='string'||!values.title.trim()||values.title.length>200)throw Error('Invalid title');values.title=values.title.trim()}
 if(values.platform!==undefined&&!['youtube','facebook'].includes(values.platform))throw Error('Invalid platform');
 if(values.status!==undefined&&!['draft','published','cancelled'].includes(values.status))throw Error('Invalid status');
 if(values.startsAt!==undefined){if(!values.startsAt||Number.isNaN(Date.parse(values.startsAt)))throw Error('Invalid startsAt');values.startsAt=new Date(values.startsAt)}
 if(values.endsAt!==undefined&&values.endsAt!==null){if(Number.isNaN(Date.parse(values.endsAt)))throw Error('Invalid endsAt');values.endsAt=new Date(values.endsAt)}
 if(values.url!==undefined&&typeof values.url!=='string')throw Error('Invalid URL');
 return values;
}
const audit=(req,action,row,before,after)=>CmsAuditLog.create({admin:req.cmsAdmin.id,action,resource:'Kirtan',resourceId:String(row._id),before,after});
const pack=row=>({id:String(row._id),title:row.title,platform:row.platform,url:row.url,startsAt:row.startsAt,endsAt:row.endsAt,status:row.status,isFeatured:!!row.isFeatured,createdAt:row.createdAt,updatedAt:row.updatedAt});
export async function listCmsKirtans(req,res){const page=Math.max(1,Math.min(100000,Number.parseInt(req.query.page,10)||1)),limit=Math.max(1,Math.min(50,Number.parseInt(req.query.limit,10)||15));const filter={};if(req.query.status&&['draft','published','cancelled'].includes(req.query.status))filter.status=req.query.status;const [items,total]=await Promise.all([Kirtan.find(filter).sort({startsAt:-1,_id:-1}).skip((page-1)*limit).limit(limit).lean(),Kirtan.countDocuments(filter)]);return ok(res,{items:items.map(pack),pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}})}
export async function createCmsKirtan(req,res){let fields;try{fields=read(req.body)}catch(e){return fail(res,e.message)}if(!urlValid(fields.url,fields.platform))return fail(res,'URL must be HTTPS and match the selected platform');if(fields.endsAt&&fields.endsAt<=fields.startsAt)return fail(res,'End time must be after start time');const row=await Kirtan.create({...fields,status:fields.status||'draft',isFeatured:false});await audit(req,'create',row,null,pack(row));return ok(res,pack(row),'Kirtan created',201)}
export async function updateCmsKirtan(req,res){if(!validId(req.params.id))return fail(res,'Invalid Kirtan ID');const row=await Kirtan.findById(req.params.id);if(!row)return fail(res,'Kirtan not found',404);let values;try{values=read(req.body,{partial:true})}catch(e){return fail(res,e.message)}if(!Object.keys(values).length)return fail(res,'At least one field is required');const platform=values.platform||row.platform,url=values.url||row.url;if(!urlValid(url,platform))return fail(res,'URL must be HTTPS and match platform');const start=values.startsAt||row.startsAt,end=values.endsAt===undefined?row.endsAt:values.endsAt;if(end&&end<=start)return fail(res,'End time must be after start time');const before=pack(row);Object.assign(row,values);if(row.status!=='published')row.isFeatured=false;await row.save();await audit(req,'edit',row,before,pack(row));return ok(res,pack(row),'Kirtan updated')}
export async function featureCmsKirtan(req,res){if(!validId(req.params.id))return fail(res,'Invalid Kirtan ID');const row=await Kirtan.findById(req.params.id);if(!row)return fail(res,'Kirtan not found',404);if(row.status!=='published')return fail(res,'Publish this Kirtan before featuring it');const previous=await Kirtan.findOne({isFeatured:true}).lean();await Kirtan.updateMany({isFeatured:true,_id:{$ne:row._id}},{$set:{isFeatured:false}});try{row.isFeatured=true;await row.save()}catch(e){return fail(res,'Could not feature Kirtan; retry the operation',409)}await audit(req,'feature',row,{previousFeaturedId:previous?String(previous._id):null},{featuredId:String(row._id)});return ok(res,pack(row),'Featured Kirtan updated')}
export async function unfeatureCmsKirtan(req,res){if(!validId(req.params.id))return fail(res,'Invalid Kirtan ID');const row=await Kirtan.findById(req.params.id);if(!row)return fail(res,'Kirtan not found',404);row.isFeatured=false;await row.save();await audit(req,'unfeature',row,null,{featured:false});return ok(res,pack(row),'Kirtan unfeatured')}
