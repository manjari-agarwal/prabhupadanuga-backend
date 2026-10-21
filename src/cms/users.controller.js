import mongoose from 'mongoose';
import CmsAdmin from '../models/CmsAdmin.js';
import CmsAuditLog from '../models/CmsAuditLog.js';
import {hashPassword} from './auth.js';
import {CMS_MODULES,CMS_ACTIONS,validateGrants,visiblePermissions} from './permissions.js';
const send=(res,data,code=200,message='Success')=>res.status(code).json({success:true,statusCode:code,message,data});
const fail=(res,code,message)=>res.status(code).json({success:false,statusCode:code,message,data:null});
const output=u=>({id:u.id,name:u.name,email:u.email,role:u.role,active:u.active,permissions:visiblePermissions(u),createdAt:u.createdAt,lastLoginAt:u.lastLoginAt});
const validEmail=e=>typeof e==='string'&&/^\S+@\S+\.\S+$/.test(e.trim());
const validRole=r=>['admin','editor','viewer'].includes(r);
const validPassword=p=>typeof p==='string'&&p.length>=12&&p.length<=128;
export async function listUsers(req,res){const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(100,Math.max(1,Number(req.query.limit)||20));const [items,total]=await Promise.all([CmsAdmin.find().sort({createdAt:-1}).skip((page-1)*limit).limit(limit),CmsAdmin.countDocuments()]);return send(res,{items:items.map(output),pagination:{page,limit,total}});}
export async function createUser(req,res){const {name,email,password,role='viewer',permissions=[]}=req.body||{};
 if(typeof name!=='string'||!name.trim()||name.length>100||!validEmail(email)||!validPassword(password)||!validRole(role))return fail(res,422,'Invalid name, email, password (12+ characters), or role');
 if(role==='admin'&&req.cmsAdmin.role!=='super_admin')return fail(res,403,'Only master admin can create full administrators');
 const grants=validateGrants(permissions);if(!grants)return fail(res,422,'Invalid module permissions');
 try{const created=await CmsAdmin.create({name:name.trim(),email:email.trim().toLowerCase(),passwordHash:hashPassword(password),role,permissions:grants});await CmsAuditLog.create({admin:req.cmsAdmin.id,action:'create',resource:'CmsAdmin',resourceId:created.id,after:{email:created.email,role,permissions:grants}});return send(res,output(created),201,'CMS user created');}catch(e){if(e.code===11000)return fail(res,409,'Email already registered');throw e;}
}
export async function updateUser(req,res){if(!mongoose.isValidObjectId(req.params.id))return fail(res,404,'CMS user not found');const target=await CmsAdmin.findById(req.params.id);if(!target)return fail(res,404,'CMS user not found');
 if(target.role==='super_admin'||target.role==='admin'&&req.cmsAdmin.role!=='super_admin')return fail(res,403,'Only master admin can manage administrators');
 if(String(target.id)===String(req.cmsAdmin.id))return fail(res,403,'Use the account settings flow for your own account');
 const body=req.body||{},allowed=['name','role','active','permissions','password'];if(!Object.keys(body).length||Object.keys(body).some(k=>!allowed.includes(k)))return fail(res,422,'Invalid fields');
 if(body.name!==undefined){if(typeof body.name!=='string'||!body.name.trim()||body.name.length>100)return fail(res,422,'Invalid name');target.name=body.name.trim();}
 if(body.role!==undefined){if(!validRole(body.role))return fail(res,422,'Invalid role');if(body.role==='admin'&&req.cmsAdmin.role!=='super_admin')return fail(res,403,'Only master admin can assign admin role');target.role=body.role;}
 if(body.active!==undefined){if(typeof body.active!=='boolean')return fail(res,422,'Invalid active flag');target.active=body.active;}
 if(body.permissions!==undefined){const grants=validateGrants(body.permissions);if(!grants)return fail(res,422,'Invalid permissions');target.permissions=grants;}
 if(body.password!==undefined){if(!validPassword(body.password))return fail(res,422,'Password must be at least 12 characters');target.passwordHash=hashPassword(body.password);}
 target.tokenVersion+=1;await target.save();await CmsAuditLog.create({admin:req.cmsAdmin.id,action:'update',resource:'CmsAdmin',resourceId:target.id,after:{role:target.role,active:target.active,permissions:target.permissions}});return send(res,output(target));
}
export async function modules(req,res){return send(res,{modules:CMS_MODULES,actions:CMS_ACTIONS});}
