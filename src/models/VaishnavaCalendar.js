import mongoose from 'mongoose';
const eventSchema = new mongoose.Schema({date: {type:String,required:true,match:/^\d{4}-\d{2}-\d{2}$/}, event:{type:String,required:true},description:{type:String,default:null}}, {_id:false});
const schema = new mongoose.Schema({year:{type:Number,required:true,min:2026,max:2026},month:{type:Number,required:true,min:1,max:12},data:[eventSchema]}, {timestamps:true});
schema.index({year:1,month:1},{unique:true});
export default mongoose.model('VaishnavaCalendar',schema);
