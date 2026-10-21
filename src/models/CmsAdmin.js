import mongoose from 'mongoose';
const grantSchema=new mongoose.Schema({module:{type:String,required:true},actions:{type:[String],default:[]}},{_id:false});
const schema=new mongoose.Schema({
 email:{type:String,required:true,unique:true,lowercase:true,trim:true},
 name:{type:String,required:true,trim:true},passwordHash:{type:String,required:true,select:false},
 role:{type:String,enum:['super_admin','admin','editor','viewer'],default:'viewer'},
 permissions:{type:[grantSchema],default:[]},active:{type:Boolean,default:true},
 tokenVersion:{type:Number,default:0},lastLoginAt:Date,
 otpHash:{type:String,select:false},otpExpiresAt:{type:Date,select:false},otpAttempts:{type:Number,default:0,select:false},
 otpChallengeId:{type:String,select:false},otpIssuedAt:{type:Date,select:false},
 loginFailures:{type:Number,default:0,select:false},lockedUntil:{type:Date,select:false}
},{timestamps:true});
export default mongoose.model('CmsAdmin',schema);
