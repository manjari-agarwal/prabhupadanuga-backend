import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  registrationId: { type: String, unique: true, sparse: true, index: true },
  name: { type: String, trim: true, required: true, maxlength: 120 },
  initiationName: { type: String, trim: true, maxlength: 120 },
  mobileNo: { type: String, required: true, unique: true, match: /^\+[1-9]\d{6,14}$/ },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  address: { type: String, trim: true, maxlength: 100 },
  city: { type: String, trim: true, maxlength: 100 },
  state: { type: String, trim: true, maxlength: 100 },
  country: { type: String, trim: true, maxlength: 100 },
  profileImage: { type: String, trim: true },
  associatedIskconTemple: { type: String, trim: true, maxlength: 100 },
  role: { type: String, enum: ['devotee', 'ambassador', 'admin'], default: 'devotee' },
  isActive: { type: Boolean, default: true },
  mobileVerifiedAt: Date,
  emailVerifiedAt: Date,
  isMobileVerified: { type: Boolean, default: false },
  isEmailVerified: { type: Boolean, default: false },
  lastLoginAt: Date
}, { timestamps: true, versionKey: false });

export default mongoose.model('User', userSchema);
