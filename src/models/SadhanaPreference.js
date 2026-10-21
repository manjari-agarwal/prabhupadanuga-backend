import mongoose from 'mongoose';
const schema = new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,unique:true},
 practices:[{code:{type:String,required:true},target:{type:Number,min:0,default:1},_id:false}],
 configuredAt:{type:Date,default:Date.now}}, {timestamps:true,versionKey:false});
export default mongoose.model('SadhanaPreference',schema);
