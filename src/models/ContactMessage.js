import mongoose from 'mongoose';

const contactMessageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, trim: true, required: true, maxlength: 120 },
  email: { type: String, lowercase: true, trim: true, required: true, maxlength: 254 },
  subject: { type: String, trim: true, required: true, maxlength: 60 },
  message: { type: String, trim: true, required: true, maxlength: 3000 },
  status: { type: String, enum: ['new', 'in_progress', 'resolved'], default: 'new', index: true }
}, { timestamps: true, versionKey: false });
contactMessageSchema.index({ user: 1, createdAt: -1 });
export default mongoose.model('ContactMessage', contactMessageSchema);
