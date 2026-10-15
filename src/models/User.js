import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  registrationId: { type: String, unique: true, sparse: true, index: true },
  name: { type: String, trim: true, required: true, maxlength: 120 },
  initiationName: { type: String, trim: true, maxlength: 120 },
  dateOfBirth: Date,
  educationDegree: { type: String, trim: true, maxlength: 150 },
  spiritualMaster: { type: String, trim: true, maxlength: 150 },
  marriageDate: Date,
  spouseName: { type: String, trim: true, maxlength: 120 },
  children: [{ id: { type: String, required: true }, name: { type: String, required: true, trim: true, maxlength: 120 }, gender: { type: String, enum: ['male','female','other'], required: true }, _id: false }],
  mobileNo: { type: String, required: true, unique: true, match: /^\+[1-9]\d{6,14}$/ },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  address: { type: String, trim: true, maxlength: 100 },
  pinCode: { type: String, trim: true, maxlength: 20 },
  updatesConsent: { type: Boolean, default: false },
  updatesConsentAt: Date,
  city: { type: String, trim: true, maxlength: 100 },
  state: { type: String, trim: true, maxlength: 100 },
  country: { type: String, trim: true, maxlength: 100 },
  timezone: { type: String, trim: true, default: 'UTC', maxlength: 80 },
  profileImage: { type: String, trim: true },
  associatedIskconTemple: { type: String, trim: true, maxlength: 100 },
  role: { type: String, enum: ['devotee', 'ambassador', 'admin'], default: 'devotee' },
  isActive: { type: Boolean, default: true },
  mobileVerifiedAt: Date,
  emailVerifiedAt: Date,
  isMobileVerified: { type: Boolean, default: false },
  isEmailVerified: { type: Boolean, default: false },
  lastLoginAt: Date,
  familyMembers: [{ id: { type: String, required: true }, name: { type: String, required: true, trim: true, maxlength: 120 }, relation: { type: String, enum: ['spouse','son','daughter','other'], required: true }, _id: false }],
  deletedAt: Date
}, { timestamps: true, versionKey: false });

export default mongoose.model('User', userSchema);
