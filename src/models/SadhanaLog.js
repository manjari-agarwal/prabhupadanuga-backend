import mongoose from 'mongoose';
const entry = new mongoose.Schema({code:{type:String,required:true},title:{type:String,required:true},target:{type:Number,required:true},unit:{type:String,required:true},completed:{type:Boolean,default:false},value:{type:Number,min:0,default:0},comment:{type:String,default:'',maxlength:2000},attendance:{type:String,enum:['online','temple','offline_other','not_attended',null],default:null},updatedAt:{type:Date,default:Date.now}}, {_id:false});
const schema = new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},date:{type:String,required:true,match:/^\d{4}-\d{2}-\d{2}$/},timezone:{type:String,required:true},entries:[entry]}, {timestamps:true,versionKey:false});
schema.index({user:1,date:1},{unique:true});
export default mongoose.model('SadhanaLog',schema);
