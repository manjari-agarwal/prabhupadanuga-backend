import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true, lowercase: true, match: /^[a-z][a-z0-9_]*$/ },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  subtitle: { type: String, required: true, trim: true, maxlength: 500 },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
schema.index({ isActive: 1, sortOrder: 1 });
export default mongoose.model('VolunteerCategory', schema);
