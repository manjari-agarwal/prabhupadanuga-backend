import mongoose from 'mongoose';
const schema = new mongoose.Schema({
 admin:{type:mongoose.Schema.Types.ObjectId,ref:'CmsAdmin',required:true},
 action:{type:String,required:true},resource:{type:String,required:true},resourceId:String,
 before:mongoose.Schema.Types.Mixed,after:mongoose.Schema.Types.Mixed,
 createdAt:{type:Date,default:Date.now}
},{versionKey:false});
schema.index({createdAt:-1});
export default mongoose.model('CmsAuditLog',schema);
