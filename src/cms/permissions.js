export const CMS_MODULES=Object.freeze(['dashboard','analytics','moderation','calendar','sankalpa','contact','volunteer','kirtan','quiz','sadhana','users','quotes','cms_users','audit']);
export const CMS_ACTIONS=Object.freeze(['view','create','edit','approve','delete','export','manage']);
export function hasCmsPermission(admin,module,action){
 if(!CMS_MODULES.includes(module)||!CMS_ACTIONS.includes(action))return false;
 if(['super_admin','admin'].includes(admin?.role))return true;
 return (admin?.permissions||[]).some(p=>p.module===module&&(p.actions.includes(action)||p.actions.includes('manage')));
}
export function cmsPermission(module,action){return(req,res,next)=>hasCmsPermission(req.cmsAdmin,module,action)?next():res.status(403).json({success:false,statusCode:403,message:'CMS permission denied',data:null});}
export function validateGrants(grants){
 if(!Array.isArray(grants)||grants.length>CMS_MODULES.length)return null;
 const seen=new Set();const result=[];
 for(const p of grants){
  if(!p||!CMS_MODULES.includes(p.module)||seen.has(p.module)||!Array.isArray(p.actions)||p.actions.some(a=>!CMS_ACTIONS.includes(a))||new Set(p.actions).size!==p.actions.length)return null;
  seen.add(p.module);result.push({module:p.module,actions:p.actions});
 }
 return result;
}
export function visiblePermissions(admin){return ['super_admin','admin'].includes(admin.role)?CMS_MODULES.map(module=>({module,actions:[...CMS_ACTIONS]})):(admin.permissions||[]);}
