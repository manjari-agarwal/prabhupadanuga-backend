import mongoose from 'mongoose';

const otpVerificationSchema = new mongoose.Schema({
  destination: { type: String, required: true, index: true },
  channel: { type: String, enum: ['mobile', 'email'], required: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  verifiedAt: Date,
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, { timestamps: true, versionKey: false });

export default mongoose.model('OtpVerification', otpVerificationSchema);
