import mongoose from 'mongoose';
const schema=new mongoose.Schema({title:{type:String,required:true,trim:true},chapter:{type:String,default:'',trim:true},topic:{type:String,default:'',trim:true},description:{type:String,default:''},isActive:{type:Boolean,default:true}},{timestamps:true});
schema.index({title:1,chapter:1,topic:1},{unique:true});
export default mongoose.model('QuestionBankMaster',schema);
