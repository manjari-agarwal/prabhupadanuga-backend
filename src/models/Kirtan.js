import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  platform: { type: String, required: true, enum: ['youtube','facebook'] },
  url: { type: String, required: true, match: /^https:\/\// },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, default: null },
  status: { type: String, enum: ['draft','published','cancelled'], default: 'draft' }
}, { timestamps: true });
schema.index({ status: 1, startsAt: 1 });
export default mongoose.model('Kirtan', schema);
