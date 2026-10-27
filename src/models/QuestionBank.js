import mongoose from 'mongoose';
const schema=new mongoose.Schema({master:{type:mongoose.Schema.Types.ObjectId,ref:'QuestionBankMaster',required:true,index:true},text:{type:String,required:true},type:{type:String,enum:['single_choice','multiple_choice'],default:'single_choice'},options:{type:[{id:String,text:String,_id:false}],validate:v=>v.length===4},correctOptionIds:{type:[String],required:true},marks:{type:Number,required:true,min:1,default:1},explanation:{type:String,default:''},isActive:{type:Boolean,default:true},sourceKey:{type:String,unique:true,sparse:true},sourceQuizIds:{type:[String],default:[]}},{timestamps:true});
schema.index({master:1,isActive:1,createdAt:-1});
export default mongoose.model('QuestionBank',schema);
