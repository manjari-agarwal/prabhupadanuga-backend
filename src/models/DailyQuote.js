import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  month: { type: Number, required: true, min: 1, max: 12 },
  day: { type: Number, required: true, min: 1, max: 31 },
  englishText: { type: String, required: true, trim: true },
  footnoteEnglish: { type: String, default: '' },
  imageUrl: { type: String, default: null },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });
schema.index({ month: 1, day: 1 }, { unique: true });
export default mongoose.model('DailyQuote', schema);
