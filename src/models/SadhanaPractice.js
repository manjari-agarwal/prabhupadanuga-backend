import mongoose from 'mongoose';
const schema = new mongoose.Schema({
 code: {type:String,required:true,unique:true,lowercase:true,trim:true,match:/^[a-z][a-z0-9_]*$/},
 title:{type:String,required:true,trim:true,maxlength:100},subtitle:{type:String,default:'',maxlength:160},
 target:{type:Number,default:1,min:0},unit:{type:String,enum:['rounds','minutes','sessions','times'],default:'times'},
 sortOrder:{type:Number,default:0},isActive:{type:Boolean,default:true},
 attendanceEnabled:{type:Boolean,default:false}
},{timestamps:true,versionKey:false});
export default mongoose.model('SadhanaPractice',schema);
